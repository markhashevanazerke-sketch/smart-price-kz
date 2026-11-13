// Shared helpers for SMART PRICE API routes.
import { NextRequest, NextResponse } from 'next/server';
import { getDb, uid, nowIso, today, audit, notify } from './db';
import { detectForEntry } from './analytics';
import { isSeeded, seedDemo } from './seed';
import { Role, PriceEntry } from '../sp/types';

export const json = (data: unknown, init?: number) => NextResponse.json(data, { status: init ?? 200 });
export const err = (message: string, init = 400, details?: unknown) => NextResponse.json({ error: message, details }, { status: init });

export interface Actor { name: string; role: Role }

export function actor(req: NextRequest): Actor {
  const role = (req.headers.get('x-user-role') || 'specialist') as Role;
  let name = req.headers.get('x-user-name') || '';
  try { name = name ? decodeURIComponent(name) : ''; } catch { /* keep raw */ }
  return { name: name || 'Неизвестный пользователь', role };
}

export function requireRole(req: NextRequest, roles: Role[]): Actor | NextResponse {
  const a = actor(req);
  if (!roles.includes(a.role)) return err(`Недостаточно прав. Требуется роль: ${roles.join(' / ')}`, 403);
  return a;
}

export function dbOrErr() {
  const db = getDb();
  return db;
}

export function validatePriceInput(body: any): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const { product_id, store_id, price, collected_at } = body || {};
  if (!product_id) errors.push('product_id: товар не выбран');
  if (!store_id) errors.push('store_id: торговая точка не выбрана');
  if (price === undefined || price === null || price === '') errors.push('price: цена не указана');
  else if (typeof price !== 'number' || !isFinite(price) || price <= 0) errors.push('price: цена должна быть числом > 0');
  else if (price > 1_000_000) errors.push('price: цена некорректна (слишком большая — проверьте значение)');
  if (collected_at && !/^\d{4}-\d{2}-\d{2}$/.test(collected_at)) errors.push('collected_at: дата в формате ГГГГ-ММ-ДД');
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function findDuplicate(db: ReturnType<typeof getDb>, product_id: string, store_id: string, date: string, excludeId?: string) {
  return db.prepare(`SELECT * FROM price_entries WHERE product_id=? AND store_id=? AND collected_at=? AND (? IS NULL OR id != ?) LIMIT 1`)
    .get(product_id, store_id, date, excludeId, excludeId) as any;
}

/** Insert a price entry (with validation + duplicate check) and run AI detection on it. */
export function createPriceEntry(req: NextRequest, body: any, opts: { source?: string; runDetection?: boolean } = {}) {
  const db = getDb();
  const a = actor(req);
  const v = validatePriceInput(body);
  if (!v.ok) return err('Данные некорректны', 400, v.errors);
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(body.product_id) as any;
  const store = db.prepare('SELECT * FROM stores WHERE id=?').get(body.store_id) as any;
  if (!product) return err('Товар не найден', 404);
  if (!store) return err('Торговая точка не найдена', 404);
  const date = body.collected_at || today();
  const dup = findDuplicate(db, body.product_id, body.store_id, date);
  if (dup) return err('Дублирующая запись: для этого товара и магазина уже есть цена за указанную дату', 409, { duplicate_id: dup.id, price: dup.price });
  const id = uid('prc');
  db.prepare(`INSERT INTO price_entries (id, product_id, store_id, price, collected_at, source, status, entered_by, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, body.product_id, body.store_id, body.price, date, opts.source || 'manual', 'pending', a.name, body.note || null, nowIso());
  db.prepare(`UPDATE stores SET last_checked_at = ? WHERE id = ?`).run(date, store.id);
  audit(db, a.name, a.role, 'price.create', 'price', id, { price: body.price, date, store: store.name, product: product.name_ru });
  let detection = null;
  if (opts.runDetection !== false) {
    detection = detectForEntry(db, id, { actor: a.name, role: a.role });
    if (detection.anomalies.length) notify(db, 'system', 'AI: обнаружена аномалия', `${product.name_ru} в ${store.name}: ${detection.anomalies[0].message}`, detection.anomalies[0].severity === 'high' ? 'danger' : 'warning', detection.anomalies[0].id);
  }
  const entry = db.prepare(`SELECT * FROM price_entries WHERE id=?`).get(id) as any;
  return { entry, detection };
}

export function priceRowWithMeta(db: ReturnType<typeof getDb>, row: any): PriceEntry {
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(row.product_id) as any;
  const store = db.prepare('SELECT * FROM stores WHERE id=?').get(row.store_id) as any;
  const prev = db.prepare(`SELECT price FROM price_entries WHERE product_id=? AND store_id=? AND collected_at < ? ORDER BY collected_at DESC, id DESC LIMIT 1`).get(row.product_id, row.store_id, row.collected_at) as any;
  return {
    ...row,
    product,
    store,
    price_per_unit: product ? Math.round(row.price / product.amount) : null,
    prev_price: prev ? prev.price : null,
    change_pct: prev && prev.price ? Math.round(((row.price - prev.price) / prev.price) * 1000) / 10 : null,
  } as PriceEntry;
}

export function ensureSeeded() {
  const db = getDb();
  // lazy seed so the first request always has data (mutex: seed only once)
  if (!isSeeded(db) && !ensureSeeded.locked) {
    ensureSeeded.locked = true;
    try {
      seedDemo(db);
    } finally {
      ensureSeeded.locked = false;
    }
  }
  return db;
}
(ensureSeeded as any).locked = false;
