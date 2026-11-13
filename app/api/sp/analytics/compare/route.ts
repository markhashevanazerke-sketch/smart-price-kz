import { NextRequest } from 'next/server';
import { ensureSeeded, json, err } from '@/lib/server/api-helpers';
import { compareAcrossStores, productDynamics, regionalStats } from '@/lib/server/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/sp/analytics/compare?product_id=
export async function GET(req: NextRequest) {
  const db = ensureSeeded();
  const mode = new URL(req.url).searchParams.get('mode') || 'compare';
  try {
    if (mode === 'regional') {
      const region = new URL(req.url).searchParams.get('region');
      if (!region) return err('region обязателен');
      return json(regionalStats(db, region));
    }
    if (mode === 'stores') {
      // lightweight map data: stores + 7-day average unit-price change per store
      const week = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const base = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
      const stores = db.prepare('SELECT id, name, type, region_code, city, lat, lng, monitoring_status FROM stores').all() as any[];
      const changes = db.prepare(`
        SELECT pe.store_id,
               AVG(CASE WHEN pe.collected_at >= ? THEN pe.price/p.amount END) AS cur,
               AVG(CASE WHEN pe.collected_at >= ? AND pe.collected_at < ? THEN pe.price/p.amount END) AS old
        FROM price_entries pe JOIN products p ON p.id = pe.product_id
        WHERE pe.collected_at >= ?
        GROUP BY pe.store_id
      `).all(week, week, base, base) as any[];
      const map = new Map(changes.map(c => [c.store_id, c]));
      const out = stores.map(s => {
        const c = map.get(s.id);
        const change_pct = c && c.cur && c.old ? Math.round(((c.cur - c.old) / c.old) * 1000) / 10 : null;
        return { ...s, change_pct };
      });
      return json(out);
    }
    if (mode === 'dynamics') {
      const pid = new URL(req.url).searchParams.get('product_id');
      const days = Math.min(60, Math.max(7, parseInt(new URL(req.url).searchParams.get('days') || '14', 10)));
      if (!pid) return err('product_id обязателен');
      return json(productDynamics(db, pid, days) || { error: 'not found' });
    }
    const pid = new URL(req.url).searchParams.get('product_id');
    if (!pid) return err('product_id обязателен');
    const res = compareAcrossStores(db, pid);
    return res ? json(res) : json({ error: 'товар не найден' }, 404);
  } catch (e: any) {
    return json({ error: e.message || 'internal error' }, 500);
  }
}
