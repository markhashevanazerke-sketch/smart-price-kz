import { NextRequest } from 'next/server';
import { ensureSeeded, json, priceRowWithMeta } from '@/lib/server/api-helpers';
import { basketCostForStore, basketSeries, topMovers } from '@/lib/server/analytics';
import { today } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const db = ensureSeeded();
    const todayStr = today();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const products_count = (db.prepare('SELECT COUNT(*) c FROM products').get() as any).c;
    const stores_count = (db.prepare('SELECT COUNT(*) c FROM stores').get() as any).c;
    const prices_count = (db.prepare('SELECT COUNT(*) c FROM price_entries').get() as any).c;
    const suspicious_count = (db.prepare(`SELECT COUNT(*) c FROM anomalies WHERE status IN ('new','review')`).get() as any).c;

    const stores = db.prepare(`SELECT id FROM stores WHERE monitoring_status='active'`).all() as { id: string }[];
    const basketNow: number[] = [];
    const basketWeek: number[] = [];
    for (const s of stores) {
      const c = basketCostForStore(db, s.id, todayStr);
      if (c !== null) basketNow.push(c);
      const cw = basketCostForStore(db, s.id, weekAgo);
      if (cw !== null) basketWeek.push(cw);
    }
    const basket_avg = basketNow.length ? Math.round(basketNow.reduce((a, b) => a + b, 0) / basketNow.length) : null;
    const basket_week = basketWeek.length ? Math.round(basketWeek.reduce((a, b) => a + b, 0) / basketWeek.length) : null;
    const basket_change_pct = basket_avg && basket_week ? Math.round(((basket_avg - basket_week) / basket_week) * 1000) / 10 : null;

    const movers = topMovers(db, 7, 10);
    const lastUpdatesRows = db.prepare(`SELECT * FROM price_entries ORDER BY collected_at DESC, created_at DESC LIMIT 10`).all() as any[];
    const notifications = db.prepare(`SELECT * FROM notifications ORDER BY read ASC, created_at DESC LIMIT 8`).all() as any[];

    return json({
      products_count,
      stores_count,
      prices_count,
      basket_avg,
      basket_change_pct,
      rising_products: movers.rising.length,
      falling_products: movers.falling.length,
      suspicious_count,
      series: basketSeries(db, 14),
      top_rising: movers.rising,
      top_falling: movers.falling,
      last_updates: lastUpdatesRows.map(r => priceRowWithMeta(db, r)),
      notifications,
    });
  } catch (e: any) {
    return json({ error: e.message || 'internal error', stack: e.stack }, 500);
  }
}
