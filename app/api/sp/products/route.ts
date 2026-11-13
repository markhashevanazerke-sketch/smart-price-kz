import { NextRequest, NextResponse } from 'next/server';
import { ensureSeeded, json, err, actor, requireRole, dbOrErr } from '@/lib/server/api-helpers';
import { getDb, uid, nowIso, audit } from '@/lib/server/db';
import { Role } from '@/lib/sp/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const db = ensureSeeded();
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').toLowerCase();
  const cat = url.searchParams.get('category');
  const base = url.searchParams.get('base');
  let rows = db.prepare('SELECT * FROM products').all() as any[];
  if (cat && cat !== 'all') rows = rows.filter(p => p.category === cat);
  if (base) rows = rows.filter(p => p.base_key === base);
  if (q) {
    rows = rows.filter(p =>
      [p.name_kk, p.name_ru, p.name_en, p.brand, p.barcode, p.base_key].some(v => v && String(v).toLowerCase().includes(q))
    );
  }
  rows.sort((a, b) => (a.category + a.name_ru).localeCompare(b.category + b.name_ru, 'ru'));
  return json(rows);
}

const CATS = new Set(['dairy', 'groceries', 'vegetables', 'other']);
const UNITS = new Set(['kg', 'l', 'pcs']);

export async function POST(req: NextRequest) {
  const db = getDb();
  const a = requireRole(req, ['analyst', 'admin']);
  if (a instanceof NextResponse) return a;
  try {
    const b = await req.json();
    const errors: string[] = [];
    for (const k of ['name_kk', 'name_ru', 'name_en']) if (!b[k] || !String(b[k]).trim()) errors.push(`${k}: название обязательно`);
    if (!b.base_key) errors.push('base_key: ключ базового товара обязателен');
    if (!CATS.has(b.category)) errors.push('category: неверная категория');
    if (!UNITS.has(b.unit)) errors.push('unit: единица должна быть kg | l | pcs');
    if (!b.amount || b.amount <= 0) errors.push('amount: вес/объём > 0');
    if (!b.package) errors.push('package: тип упаковки обязателен');
    if (errors.length) return err('Товар некорректен', 400, errors);
    const id = uid('prd');
    db.prepare(`INSERT INTO products (id, base_key, name_kk, name_ru, name_en, category, brand, producer, fat, amount, unit, package, barcode, is_demo, created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, b.base_key, b.name_kk, b.name_ru, b.name_en, b.category, b.brand || null, b.producer || null, b.fat ?? null, b.amount, b.unit, b.package, b.barcode || null, b.is_demo ? 1 : 0, nowIso());
    audit(db, a.name, a.role, 'product.create', 'product', id, { name: b.name_ru });
    const row = db.prepare('SELECT * FROM products WHERE id=?').get(id);
    return json(row, 201);
  } catch (e: any) {
    return err(e.message || 'Не удалось создать товар', 500);
  }
}

export async function PUT(req: NextRequest) {
  const db = getDb();
  const a = requireRole(req, ['analyst', 'admin']);
  if (a instanceof NextResponse) return a;
  try {
    const b = await req.json();
    const cur = db.prepare('SELECT * FROM products WHERE id=?').get(b.id) as any;
    if (!cur) return err('Товар не найден', 404);
    db.prepare(`UPDATE products SET base_key=?, name_kk=?, name_ru=?, name_en=?, category=?, brand=?, producer=?, fat=?, amount=?, unit=?, package=?, barcode=? WHERE id=?`)
      .run(b.base_key || cur.base_key, b.name_kk ?? cur.name_kk, b.name_ru ?? cur.name_ru, b.name_en ?? cur.name_en,
        CATS.has(b.category) ? b.category : cur.category, b.brand ?? cur.brand, b.producer ?? cur.producer,
        b.fat !== undefined ? b.fat : cur.fat, b.amount && b.amount > 0 ? b.amount : cur.amount,
        UNITS.has(b.unit) ? b.unit : cur.unit, b.package || cur.package, b.barcode ?? cur.barcode, b.id);
    audit(db, a.name, a.role, 'product.update', 'product', b.id, b);
    return json(db.prepare('SELECT * FROM products WHERE id=?').get(b.id));
  } catch (e: any) {
    return err(e.message || 'Не удалось обновить товар', 500);
  }
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const a = requireRole(req, ['admin']);
  if (a instanceof NextResponse) return a;
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return err('id обязателен');
  const r = db.prepare('DELETE FROM products WHERE id=?').run(id);
  if (!r.changes) return err('Товар не найден', 404);
  audit(db, a.name, a.role, 'product.delete', 'product', id, null);
  return json({ deleted: true });
}
