import { NextRequest, NextResponse } from 'next/server';
import { ensureSeeded, json, err, actor, requireRole, createPriceEntry, priceRowWithMeta, findDuplicate } from '@/lib/server/api-helpers';
import { getDb, audit, today, nowIso } from '@/lib/server/db';
import { runFullDetection } from '@/lib/server/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/sp/prices — filterable, paginated price monitoring table
export async function GET(req: NextRequest) {
  try {
    const db = ensureSeeded();
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const storeId = url.searchParams.get('store_id');
    const productId = url.searchParams.get('product_id');
    const region = url.searchParams.get('region');
    const source = url.searchParams.get('source');
    const status = url.searchParams.get('status');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const flagged = url.searchParams.get('flagged') === '1';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get('page_size') || '50', 10)));
    const sort = url.searchParams.get('sort') || 'date-desc';

    const where: string[] = [];
    const args: any[] = [];
    if (storeId) { where.push('pe.store_id = ?'); args.push(storeId); }
    if (productId) { where.push('pe.product_id = ?'); args.push(productId); }
    if (region && region !== 'all') { where.push('st.region_code = ?'); args.push(region); }
    if (source && source !== 'all') { where.push('pe.source = ?'); args.push(source); }
    if (status && status !== 'all') { where.push('pe.status = ?'); args.push(status); }
    if (from) { where.push('pe.collected_at >= ?'); args.push(from); }
    if (to) { where.push('pe.collected_at <= ?'); args.push(to); }
    if (flagged) { where.push(`pe.id IN (SELECT price_entry_id FROM anomalies WHERE price_entry_id IS NOT NULL)`); }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    // text search is applied in JS (SQLite LIKE is not case-insensitive for Cyrillic)
    const countRow = db.prepare(`SELECT COUNT(*) c FROM price_entries pe JOIN products p ON p.id=pe.product_id JOIN stores st ON st.id=pe.store_id ${whereSql}`).get(...args) as any;
    const total = q ? countRow.c : countRow.c;

    const orderMap: Record<string, string> = {
      'date-desc': 'pe.collected_at DESC, pe.created_at DESC',
      'date-asc': 'pe.collected_at ASC, pe.created_at ASC',
      'price-desc': 'pe.price DESC',
      'price-asc': 'pe.price ASC',
      'name': 'p.name_ru ASC',
      'store': 'st.name ASC',
    };
    const bigLimit = q ? 5000 : pageSize;
    const rows = db.prepare(`SELECT pe.*, p.name_ru AS pname_ru, p.name_kk AS pname_kk, p.name_en AS pname_en, st.name AS sname
      FROM price_entries pe JOIN products p ON p.id=pe.product_id JOIN stores st ON st.id=pe.store_id ${whereSql}
      ORDER BY ${orderMap[sort] || orderMap['date-desc']} LIMIT ? OFFSET ?`).all(...args, bigLimit, 0) as any[];
    const filtered = q
      ? rows.filter(r => [r.pname_ru, r.pname_kk, r.pname_en, r.sname].some(v => v && String(v).toLowerCase().includes(q)))
      : rows;
    const realTotal = filtered.length;
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

    return json({ total: realTotal, page, page_size: pageSize, rows: paged.map(r => priceRowWithMeta(db, r)) });
  } catch (e: any) {
    return json({ error: e.message || 'internal error' }, 500);
  }
}

// POST /api/sp/prices — manual price entry (or ?detect=0 to skip AI)
export async function POST(req: NextRequest) {
  const res = createPriceEntry(req, await req.json(), { runDetection: new URL(req.url).searchParams.get('detect') !== '0' });
  return res instanceof NextResponse ? res : json(res, 201);
}

// PUT /api/sp/prices — edit a record
export async function PUT(req: NextRequest) {
  const db = getDb();
  const a = actor(req);
  const b = await req.json();
  const cur = db.prepare('SELECT * FROM price_entries WHERE id=?').get(b.id) as any;
  if (!cur) return err('Запись не найдена', 404);
  if (b.price !== undefined && (typeof b.price !== 'number' || b.price <= 0)) return err('price: цена должна быть числом > 0');
  const dup = b.collected_at && b.collected_at !== cur.collected_at ? findDuplicate(db, cur.product_id, cur.store_id, b.collected_at, b.id) : null;
  if (dup) return err('Дублирующая запись для этой даты уже существует', 409);
  db.prepare('UPDATE price_entries SET price=?, collected_at=?, status=?, note=? WHERE id=?')
    .run(b.price ?? cur.price, b.collected_at || cur.collected_at, b.status || cur.status, b.note !== undefined ? b.note : cur.note, b.id);
  audit(db, a.name, a.role, 'price.update', 'price', b.id, { from: cur.price, to: b.price ?? cur.price });
  // re-run detection if price changed
  let detection = null;
  if (b.price !== undefined && b.price !== cur.price) {
    detection = (await import('@/lib/server/analytics')).detectForEntry(db, b.id, { actor: a.name, role: a.role });
  }
  return json({ entry: priceRowWithMeta(db, db.prepare('SELECT * FROM price_entries WHERE id=?').get(b.id)), detection });
}

// DELETE /api/sp/prices?id=
export async function DELETE(req: NextRequest) {
  const db = getDb();
  const a = requireRole(req, ['specialist', 'analyst', 'admin']);
  if (a instanceof NextResponse) return a;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return err('id обязателен');
  const cur = db.prepare('SELECT * FROM price_entries WHERE id=?').get(id) as any;
  if (!cur) return err('Запись не найдена', 404);
  db.prepare('DELETE FROM anomalies WHERE price_entry_id=?').run(id);
  db.prepare('DELETE FROM price_entries WHERE id=?').run(id);
  audit(db, a.name, a.role, 'price.delete', 'price', id, { price: cur.price });
  return json({ deleted: true });
}
