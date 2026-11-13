import { NextRequest, NextResponse } from 'next/server';
import { ensureSeeded, json, err, actor, requireRole } from '@/lib/server/api-helpers';
import { getDb, uid, nowIso, audit } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/sp/evidence?price_entry_id=&store_id=
export async function GET(req: NextRequest) {
  const db = ensureSeeded();
  const url = new URL(req.url);
  const pe = url.searchParams.get('price_entry_id');
  const st = url.searchParams.get('store_id');
  const where: string[] = [];
  const args: any[] = [];
  if (pe) { where.push('price_entry_id = ?'); args.push(pe); }
  if (st) { where.push('store_id = ?'); args.push(st); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(`SELECT * FROM evidence ${whereSql} ORDER BY checked_at DESC LIMIT 100`).all(...args) as any[];
  return json(rows);
}

// POST /api/sp/evidence — { price_entry_id?, store_id, product_id?, photo_b64?, employee_name, comment, ocr_price? }
export async function POST(req: NextRequest) {
  const db = getDb();
  const a = requireRole(req, ['specialist', 'analyst', 'admin']);
  if (a instanceof NextResponse) return a;
  const b = await req.json();
  if (!b.store_id) return err('store_id: торговая точка обязательна');
  const b64 = b.photo_b64 || null;
  if (b64 && b64.length > 4 * 1024 * 1024) return err('Фото слишком большое (макс. 4 МБ)', 400);
  if (!b64 && !b.ocr_price) return err('Приложите фото или укажите распознанную цену', 400);
  // OCR stub: if a price is provided we can compare with the entry price later;
  // real OCR integration point (e.g. Tesseract) is left as a hook in ocr_status.
  let ocrStatus: 'pending' | 'matched' | 'mismatched' = 'pending';
  let ocrPrice = b.ocr_price !== undefined && b.ocr_price !== null ? Number(b.ocr_price) : null;
  if (b.price_entry_id && ocrPrice !== null) {
    const entry = db.prepare('SELECT price FROM price_entries WHERE id=?').get(b.price_entry_id) as any;
    if (entry) ocrStatus = Math.abs(entry.price - ocrPrice) < 1 ? 'matched' : 'mismatched';
  }
  const id = uid('evd');
  db.prepare(`INSERT INTO evidence (id, price_entry_id, store_id, product_id, photo_b64, checked_at, employee_name, comment, ocr_price, ocr_status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, b.price_entry_id || null, b.store_id, b.product_id || null, b64, b.checked_at || nowIso(), b.employee_name || a.name, b.comment || null, ocrPrice, ocrStatus, nowIso());
  audit(db, a.name, a.role, 'evidence.create', 'evidence', id, { store_id: b.store_id, price_entry_id: b.price_entry_id || null });
  return json(db.prepare('SELECT * FROM evidence WHERE id=?').get(id), 201);
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const a = requireRole(req, ['specialist', 'analyst', 'admin']);
  if (a instanceof NextResponse) return a;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return err('id обязателен');
  const r = db.prepare('DELETE FROM evidence WHERE id=?').run(id);
  if (!r.changes) return err('Доказательство не найдено', 404);
  audit(db, a.name, a.role, 'evidence.delete', 'evidence', id, null);
  return json({ deleted: true });
}
