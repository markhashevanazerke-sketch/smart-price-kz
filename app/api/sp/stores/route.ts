import { NextRequest, NextResponse } from 'next/server';
import { ensureSeeded, json, err, requireRole } from '@/lib/server/api-helpers';
import { getDb, uid, nowIso, audit } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES = new Set(['supermarket', 'shop', 'market']);

export async function GET(req: NextRequest) {
  const db = ensureSeeded();
  const url = new URL(req.url);
  const region = url.searchParams.get('region');
  const type = url.searchParams.get('type');
  const q = (url.searchParams.get('q') || '').toLowerCase();
  let sql = `SELECT s.*, (SELECT COUNT(*) FROM price_entries pe WHERE pe.store_id = s.id) AS prices_count FROM stores s`;
  const where: string[] = [];
  const args: any[] = [];
  if (region && region !== 'all') { where.push('s.region_code = ?'); args.push(region); }
  if (type && type !== 'all') { where.push('s.type = ?'); args.push(type); }
  if (q) { where.push('(s.name LIKE ? OR s.city LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY s.name';
  return json(db.prepare(sql).all(...args));
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const a = requireRole(req, ['specialist', 'analyst', 'admin']);
  if (a instanceof NextResponse) return a;
  try {
    const b = await req.json();
    const errors: string[] = [];
    if (!b.name || !String(b.name).trim()) errors.push('name: название обязательно');
    if (!TYPES.has(b.type)) errors.push('type: supermarket | shop | market');
    if (!b.region_code) errors.push('region_code: регион обязателен');
    if (!b.city || !String(b.city).trim()) errors.push('city: город обязателен');
    if (b.lat !== undefined && b.lat !== null && (isNaN(b.lat) || b.lat < 40 || b.lat > 56)) errors.push('lat: координаты вне Казахстана (40–56 с.ш.)');
    if (b.lng !== undefined && b.lng !== null && (isNaN(b.lng) || b.lng < 46 || b.lng > 90)) errors.push('lng: координаты вне Казахстана (46–90 в.д.)');
    if (errors.length) return err('Торговая точка некорректна', 400, errors);
    const id = uid('sto');
    db.prepare(`INSERT INTO stores (id, name, type, region_code, city, address, lat, lng, monitoring_status, last_checked_at, is_demo, created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, b.name, b.type, b.region_code, b.city, b.address || null, b.lat ?? null, b.lng ?? null,
        b.monitoring_status === 'paused' ? 'paused' : 'active', null, b.is_demo ? 1 : 0, nowIso());
    audit(db, a.name, a.role, 'store.create', 'store', id, { name: b.name, city: b.city });
    return json(db.prepare('SELECT * FROM stores WHERE id=?').get(id), 201);
  } catch (e: any) {
    return err(e.message || 'Не удалось создать торговую точку', 500);
  }
}

export async function PUT(req: NextRequest) {
  const db = getDb();
  const a = requireRole(req, ['specialist', 'analyst', 'admin']);
  if (a instanceof NextResponse) return a;
  try {
    const b = await req.json();
    const cur = db.prepare('SELECT * FROM stores WHERE id=?').get(b.id) as any;
    if (!cur) return err('Торговая точка не найдена', 404);
    db.prepare(`UPDATE stores SET name=?, type=?, region_code=?, city=?, address=?, lat=?, lng=?, monitoring_status=? WHERE id=?`)
      .run(b.name || cur.name, TYPES.has(b.type) ? b.type : cur.type, b.region_code || cur.region_code,
        b.city || cur.city, b.address !== undefined ? b.address : cur.address,
        b.lat !== undefined ? b.lat : cur.lat, b.lng !== undefined ? b.lng : cur.lng,
        b.monitoring_status === 'paused' ? 'paused' : 'active', b.id);
    audit(db, a.name, a.role, 'store.update', 'store', b.id, b);
    return json(db.prepare('SELECT * FROM stores WHERE id=?').get(b.id));
  } catch (e: any) {
    return err(e.message || 'Не удалось обновить торговую точку', 500);
  }
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const a = requireRole(req, ['analyst', 'admin']);
  if (a instanceof NextResponse) return a;
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return err('id обязателен');
  const prices = (db.prepare('SELECT COUNT(*) c FROM price_entries WHERE store_id=?').get(id) as any).c;
  if (prices > 0) return err(`Нельзя удалить: у точки ${prices} записей цен. Сначала удалите или перенесите записи.`, 409);
  const r = db.prepare('DELETE FROM stores WHERE id=?').run(id);
  if (!r.changes) return err('Торговая точка не найдена', 404);
  audit(db, a.name, a.role, 'store.delete', 'store', id, null);
  return json({ deleted: true });
}
