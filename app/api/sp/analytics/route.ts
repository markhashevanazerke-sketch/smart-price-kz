import { NextRequest, NextResponse } from 'next/server';
import { ensureSeeded, json, err, requireRole } from '@/lib/server/api-helpers';
import { getDb, audit, nowIso } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/sp/analytics — anomaly queue with filters
export async function GET(req: NextRequest) {
  const db = ensureSeeded();
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const severity = url.searchParams.get('severity');
  const type = url.searchParams.get('type');
  const region = url.searchParams.get('region');
  const q = (url.searchParams.get('q') || '').toLowerCase();
  const where: string[] = [];
  const args: any[] = [];
  if (status && status !== 'all') { where.push('a.status = ?'); args.push(status); }
  if (severity && severity !== 'all') { where.push('a.severity = ?'); args.push(severity); }
  if (type && type !== 'all') { where.push('a.type = ?'); args.push(type); }
  if (region && region !== 'all') { where.push('st.region_code = ?'); args.push(region); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  let rows = db.prepare(`
    SELECT a.*, p.name_ru AS product_name, p.name_en AS product_name_en, p.amount, p.unit,
           st.name AS store_name, st.city, st.region_code
    FROM anomalies a
    JOIN products p ON p.id = a.product_id
    JOIN stores st ON st.id = a.store_id
    ${whereSql}
    LIMIT 1000
  `).all(...args) as any[];
  if (q) rows = rows.filter(r => [r.product_name, r.product_name_en, r.store_name].some(v => v && String(v).toLowerCase().includes(q)));
  rows.sort((x, y) => {
    const sev = (r: any) => (r.severity === 'high' ? 0 : r.severity === 'medium' ? 1 : 2);
    return sev(x) - sev(y) || String(y.detected_at).localeCompare(String(x.detected_at));
  });
  rows = rows.slice(0, 300);
  const counts = {
    all: (db.prepare('SELECT COUNT(*) c FROM anomalies').get() as any).c,
    new: (db.prepare(`SELECT COUNT(*) c FROM anomalies WHERE status='new'`).get() as any).c,
    review: (db.prepare(`SELECT COUNT(*) c FROM anomalies WHERE status='review'`).get() as any).c,
    confirmed: (db.prepare(`SELECT COUNT(*) c FROM anomalies WHERE status='confirmed'`).get() as any).c,
    dismissed: (db.prepare(`SELECT COUNT(*) c FROM anomalies WHERE status='dismissed'`).get() as any).c,
  };
  return json({ rows, counts });
}

