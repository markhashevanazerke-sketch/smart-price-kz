// SMART PRICE — AI price analytics engine.
// Detects suspicious price changes WITHOUT calling them violations:
//  1. threshold check  — change vs previous price of same product+store
//  2. z-score          — new unit price vs 30-day distribution (all stores, same base product)
//  3. cross-store      — unit price vs median of same base product across stores (MAD)
// Result = anomaly candidates for analyst review.

import Database from 'better-sqlite3';
import { getDb, uid, nowIso, today, audit, notify } from './db';
import { Product, Store, Anomaly, AnomalySeverity } from '../sp/types';

export interface Settings {
  spike_threshold_pct: number;
  zscore_threshold: number;
  outlier_pct: number;
  window_days: number;
}

export function getSettings(db: Database.Database): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    spike_threshold_pct: parseFloat(map.spike_threshold_pct || '15'),
    zscore_threshold: parseFloat(map.zscore_threshold || '3.0'),
    outlier_pct: parseFloat(map.outlier_pct || '30'),
    window_days: parseInt(map.window_days || '30', 10),
  };
}

export function setSettings(db: Database.Database, key: string, value: string) {
  db.prepare(`INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(key, value);
}

const unitPrice = (price: number, amount: number) => (amount > 0 ? price / amount : price);

export function getProduct(db: Database.Database, id: string): Product | undefined {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product | undefined;
}
export function getStore(db: Database.Database, id: string): Store | undefined {
  return db.prepare('SELECT * FROM stores WHERE id = ?').get(id) as Store | undefined;
}

export function priceHistory(db: Database.Database, productId: string, storeId: string) {
  return db.prepare(`SELECT * FROM price_entries WHERE product_id = ? AND store_id = ? ORDER BY collected_at ASC, id ASC`).all(productId, storeId) as any[];
}

export function latestPrice(db: Database.Database, productId: string, storeId: string): any | undefined {
  return db.prepare(`SELECT * FROM price_entries WHERE product_id = ? AND store_id = ? ORDER BY collected_at DESC, id DESC LIMIT 1`).get(productId, storeId) as any;
}

function severityFor(pct: number, z: number | null, type: string): AnomalySeverity {
  const a = Math.abs(pct);
  if (a >= 30 || (z !== null && z >= 3.5)) return 'high';
  if (a >= 20 || (z !== null && z >= 2.8)) return 'medium';
  return 'low';
}

export interface DetectResult {
  entryId: string;
  anomalies: Anomaly[];
}

/** Detect anomalies for a single price entry. Returns created anomalies. */
export function detectForEntry(db: Database.Database, entryId: string, opts: { actor?: string; role?: string } = {}): DetectResult {
  const entry = db.prepare('SELECT * FROM price_entries WHERE id = ?').get(entryId) as any;
  if (!entry) return { entryId, anomalies: [] };
  const product = getProduct(db, entry.product_id);
  const store = getStore(db, entry.store_id);
  if (!product || !store) return { entryId, anomalies: [] };

  const s = getSettings(db);
  const created: Anomaly[] = [];
  let thresholdHit = false;

  // one event = one anomaly: skip if the same store+product+type was already flagged within 48h
  const hasRecent = (type: string) => (
    (db.prepare(`SELECT COUNT(*) c FROM anomalies WHERE product_id = ? AND store_id = ? AND type = ? AND detected_at > ?`)
      .get(product.id, store.id, type, new Date(Date.now() - 48 * 3600000).toISOString()) as any).c > 0
  );

  const push = (a: Omit<Anomaly, 'id' | 'detected_at' | 'is_demo' | 'status'> & { is_demo?: number }) => {
    if (hasRecent(a.type)) return;
    const id = uid('ano');
    const row: Anomaly = { id, detected_at: nowIso(), is_demo: a.is_demo ?? 1, status: 'new', ...a } as Anomaly;
    db.prepare(`INSERT INTO anomalies (id, price_entry_id, product_id, store_id, type, severity, change_pct, metric, value, prev_price, new_price, message, status, detected_at, is_demo)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'new', ?, ?)`).run(
      id, entry.id, product.id, store.id, a.type, a.severity, a.change_pct, a.metric, a.value, a.prev_price, a.new_price, a.message, nowIso(), a.is_demo ?? 1
    );
    created.push(row);
    notify(db, 'anomaly', a.message, `Торговая точка: ${store.name}. Требуется проверка аналитиком.`, a.severity === 'high' ? 'danger' : 'warning', id);
  };

  // 1) change vs previous price (same product + store)
  const hist = priceHistory(db, product.id, store.id).filter(e =>
    e.id !== entry.id && (e.collected_at < entry.collected_at || (e.collected_at === entry.collected_at && e.id < entry.id))
  );
  const prev = hist[hist.length - 1];
  if (prev) {
    const pct = ((entry.price - prev.price) / prev.price) * 100;
    if (Math.abs(pct) >= s.spike_threshold_pct) {
      const type = pct > 0 ? 'spike' : 'drop';
      const sev = severityFor(pct, null, type);
      thresholdHit = true;
      push({
        type, severity: sev,
        change_pct: Math.round(pct * 10) / 10,
        metric: 'threshold', value: Math.round(pct * 10) / 10,
        prev_price: prev.price, new_price: entry.price,
        message: `${product.name_ru} (${product.amount} ${product.unit}): ${prev.price} → ${entry.price} ₸ (${pct > 0 ? '+' : ''}${Math.round(pct * 10) / 10}%). Порог: ${s.spike_threshold_pct}%.`,
      });
    }
  }

  // 2) z-score vs the store's own 30-day history of this product (robust to regional levels)
  const cutoff = new Date(Date.now() - (s.window_days + 1) * 86400000).toISOString().slice(0, 10);
  const histRows = db.prepare(`SELECT price, p.amount FROM price_entries pe
    JOIN products p ON p.id = pe.product_id
    WHERE pe.product_id = ? AND pe.store_id = ? AND pe.collected_at >= ? AND pe.collected_at < ?
  `).all(product.id, store.id, cutoff, today()) as { price: number; amount: number }[];
  const xs = histRows.map(r => unitPrice(r.price, r.amount));
  if (!thresholdHit && xs.length >= 8) {
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1)) || 1;
    const x = unitPrice(entry.price, product.amount);
    const z = (x - mean) / sd;
    if (Math.abs(z) >= s.zscore_threshold) {
      push({
        type: z > 0 ? 'spike' : 'drop',
        severity: severityFor(0, z, 'z'),
        change_pct: null,
        metric: 'z-score (история точки)', value: Math.round(z * 100) / 100,
        prev_price: Math.round(mean), new_price: Math.round(x),
        message: `${product.name_ru}: цена за ${product.unit} (${Math.round(x)} ₸) отклоняется на ${Math.abs(z).toFixed(1)}σ от собственной 30-дневной истории точки (сред. ${Math.round(mean)} ₸).`,
      });
    }
  }

  // 3) cross-store outlier: unit price vs median of SAME store type (last 7 days)
  const week = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const peerRows = db.prepare(`
    SELECT pe.price, p.amount, st.name AS store_name, st.type AS store_type FROM price_entries pe
    JOIN products p ON p.id = pe.product_id
    JOIN stores st ON st.id = pe.store_id
    WHERE p.base_key = ? AND pe.collected_at >= ? AND st.type = ?
  `).all(product.base_key, week, store.type) as { price: number; amount: number; store_name: string; store_type: string }[];
  const peers = peerRows.map(r => ({ v: unitPrice(r.price, r.amount), s: r.store_name })).filter(p => p.s !== store.name);
  if (!thresholdHit && peers.length >= 3) {
    const vals = peers.map(p => p.v).sort((a, b) => a - b);
    const median = vals[Math.floor(vals.length / 2)];
    const mad = (() => { const d = vals.map(v => Math.abs(v - median)).sort((a, b) => a - b); return d[Math.floor(d.length / 2)]; })();
    const x = unitPrice(entry.price, product.amount);
    const dev = median > 0 ? ((x - median) / median) * 100 : 0;
    // flag when the unit price clearly deviates from the median of same-type peers
    if (Math.abs(dev) >= s.outlier_pct) {
      push({
        type: 'outlier',
        severity: severityFor(dev, null, 'out'),
        change_pct: Math.round(dev * 10) / 10,
        metric: 'cross-store (MAD)', value: Math.round(dev * 10) / 10,
        prev_price: Math.round(median), new_price: Math.round(x),
        message: `${product.name_ru}: цена в ${store.name} (${Math.round(x)} ₸/${product.unit}) выше/ниже медианы среди точек того же типа (${Math.round(median)} ₸/${product.unit}) на ${Math.abs(Math.round(dev * 10) / 10)}%.`,
      });
    }
  }

  if (created.length > 0) {
    db.prepare(`UPDATE price_entries SET status='flagged' WHERE id = ?`).run(entry.id);
    audit(db, opts.actor || 'AI-модуль', opts.role || 'system', 'anomaly.detected', 'anomaly', entryId, { count: created.length, types: created.map(c => c.type) });
  }
  return { entryId, anomalies: created };
}

/** Re-run detection for all entries in the last N days (idempotent). */
export function runFullDetection(db: Database.Database, days = 3, opts: { actor?: string; role?: string } = {}) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  db.prepare(`DELETE FROM anomalies WHERE price_entry_id IS NOT NULL AND price_entry_id IN (
    SELECT id FROM price_entries WHERE collected_at >= ?)`)
    .run(cutoff);
  const entries = db.prepare('SELECT id FROM price_entries WHERE collected_at >= ?').all(cutoff) as { id: string }[];
  let total = 0;
  for (const e of entries) {
    const r = detectForEntry(db, e.id, opts);
    total += r.anomalies.length;
  }
  return { entries_checked: entries.length, anomalies_found: total };
}

// ---------------- basket ----------------

export function getBasket(db: Database.Database): { product_id: string; amount: number }[] {
  const row = db.prepare(`SELECT value FROM settings WHERE key='basket'`).get() as { value: string } | undefined;
  if (!row) return [];
  try { return JSON.parse(row.value); } catch { return []; }
}

export function basketCostForStore(db: Database.Database, storeId: string, asOf: string): number | null {
  const basket = getBasket(db);
  if (!basket.length) return null;
  let total = 0;
  let found = 0;
  for (const item of basket) {
    const last = db.prepare(`SELECT pe.price, p.amount FROM price_entries pe JOIN products p ON p.id=pe.product_id
      WHERE pe.product_id=? AND pe.store_id=? AND pe.collected_at <= ? ORDER BY pe.collected_at DESC, pe.id DESC LIMIT 1`)
      .get(item.product_id, storeId, asOf) as { price: number; amount: number } | undefined;
    if (last) { total += item.amount * unitPrice(last.price, last.amount); found++; }
  }
  return found >= basket.length * 0.7 ? Math.round(total) : null;
}

export function basketSeries(db: Database.Database, days: number) {
  const stores = db.prepare(`SELECT id FROM stores WHERE monitoring_status='active'`).all() as { id: string }[];
  const out: { date: string; value: number | null; n: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const vals: number[] = [];
    for (const st of stores) {
      const c = basketCostForStore(db, st.id, date);
      if (c !== null) vals.push(c);
    }
    out.push({ date, value: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null, n: vals.length });
  }
  return out;
}

// ---------------- movers ----------------

export function topMovers(db: Database.Database, days: number, n: number) {
  const base = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT p.base_key, p.name_ru, p.name_en, p.unit,
           AVG(CASE WHEN pe.collected_at < ? THEN pe.price/p.amount END) AS old_u,
           AVG(CASE WHEN pe.collected_at >= ? THEN pe.price/p.amount END) AS new_u,
           COUNT(CASE WHEN pe.collected_at < ? THEN 1 END) AS old_n,
           COUNT(CASE WHEN pe.collected_at >= ? THEN 1 END) AS new_n
    FROM price_entries pe JOIN products p ON p.id = pe.product_id
    WHERE pe.collected_at >= ?
    GROUP BY p.base_key
  `).all(base, base, base, base, new Date(Date.now() - days * 86400000 - 14 * 86400000).toISOString().slice(0, 10)) as any[];
  const movers = rows
    .filter(r => r.old_u && r.new_u && r.old_n >= 3 && r.new_n >= 3)
    .map(r => ({ base_key: r.base_key, name: r.name_ru, name_en: r.name_en, unit: r.unit, from: Math.round(r.old_u), to: Math.round(r.new_u), change_pct: Math.round(((r.new_u - r.old_u) / r.old_u) * 1000) / 10 }));
  const rising = movers.filter(m => m.change_pct > 0).sort((a, b) => b.change_pct - a.change_pct).slice(0, n);
  const falling = movers.filter(m => m.change_pct < 0).sort((a, b) => a.change_pct - b.change_pct).slice(0, n);
  return { rising, falling };
}

// ---------------- regional ----------------

export function regionalStats(db: Database.Database, regionCode: string) {
  const stores = db.prepare(`SELECT * FROM stores WHERE region_code = ?`).all(regionCode) as Store[];
  const storeIds = stores.map(s => s.id);
  const week = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const base = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  let avgByProduct: { name: string; name_en: string; unit: string; avg: number; change_pct: number }[] = [];
  let expensive: { name: string; avg: number }[] = [];
  let cheap: { name: string; avg: number }[] = [];
  let dynamics: { date: string; value: number }[] = [];
  if (storeIds.length) {
    const ids = storeIds.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT p.name_ru AS name, p.name_en, p.unit,
             AVG(CASE WHEN pe.collected_at >= ? THEN pe.price/p.amount END) AS cur,
             AVG(CASE WHEN pe.collected_at < ? AND pe.collected_at >= ? THEN pe.price/p.amount END) AS old
      FROM price_entries pe JOIN products p ON p.id = pe.product_id
      WHERE pe.store_id IN (${ids}) AND pe.collected_at >= ?
      GROUP BY p.base_key
    `).all(week, week, base, base, ...storeIds) as any[];
    avgByProduct = rows
      .filter(r => r.cur && r.old)
      .map(r => ({ name: r.name, name_en: r.name_en, unit: r.unit, avg: Math.round(r.cur), change_pct: Math.round(((r.cur - r.old) / r.old) * 1000) / 10 }))
      .sort((a, b) => b.avg - a.avg);
    expensive = avgByProduct.slice(0, 5).map(r => ({ name: r.name, avg: r.avg }));
    cheap = [...avgByProduct].reverse().slice(0, 5).map(r => ({ name: r.name, avg: r.avg }));
    // dynamics: average basket-like index over 14 days
    for (let i = 13; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const row = db.prepare(`SELECT AVG(pe.price/p.amount) AS m FROM price_entries pe JOIN products p ON p.id=pe.product_id WHERE pe.store_id IN (${ids}) AND pe.collected_at = ?`).get(...storeIds, date) as { m: number | null };
      dynamics.push({ date, value: row.m ? Math.round(row.m) : null as any });
    }
  }
  return {
    stores_count: stores.length,
    stores,
    products_monitored: avgByProduct.length,
    average_prices: avgByProduct,
    most_expensive: expensive,
    cheapest: cheap,
    dynamics,
  };
}

// ---------------- comparison ----------------

export function compareAcrossStores(db: Database.Database, productId: string) {
  const product = getProduct(db, productId);
  if (!product) return null;
  const week = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT pe.store_id, pe.price, pe.collected_at, st.name AS store_name, st.type, st.region_code, st.city
    FROM price_entries pe JOIN stores st ON st.id = pe.store_id
    WHERE pe.product_id = ? AND pe.collected_at >= ?
    ORDER BY pe.collected_at DESC
  `).all(productId, week) as any[];
  const byStore = new Map<string, any>();
  for (const r of rows) if (!byStore.has(r.store_id)) byStore.set(r.store_id, r);
  const list = [...byStore.values()].map(r => ({
    store: r.store_name, type: r.type, region_code: r.region_code, city: r.city,
    price: r.price, per_unit: Math.round(unitPrice(r.price, product.amount)), date: r.collected_at,
  }));
  const vals = list.map(l => l.per_unit).sort((a, b) => a - b);
  const median = vals.length ? vals[Math.floor(vals.length / 2)] : null;
  for (const l of list) if (median) l.dev_pct = Math.round(((l.per_unit - median) / median) * 1000) / 10;
  return { product, entries: list, min: vals[0] ?? null, max: vals[vals.length - 1] ?? null, median };
}

export function productDynamics(db: Database.Database, productId: string, days: number) {
  const product = getProduct(db, productId);
  if (!product) return null;
  const rows = db.prepare(`SELECT collected_at, AVG(price) AS m FROM price_entries WHERE product_id = ? AND collected_at >= ?
    GROUP BY collected_at ORDER BY collected_at ASC`).all(productId, new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)) as any[];
  return { product, series: rows.map(r => ({ date: r.collected_at, price: Math.round(r.m), per_unit: Math.round(r.m / product.amount) })) };
}
