import { NextRequest } from 'next/server';
import { ensureSeeded, json, err } from '@/lib/server/api-helpers';
import { getDb, today } from '@/lib/server/db';
import { basketCostForStore, regionalStats, topMovers, getBasket, getSettings } from '@/lib/server/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REGION_NAMES: Record<string, string> = {
  'KZ-75': 'г. Алматы', 'KZ-71': 'г. Астана', 'KZ-79': 'г. Шымкент',
  'KZ-19': 'Алматинская обл.', 'KZ-11': 'Акимолой облысы (Акмолінская обл.)',
  'KZ-23': 'Атырауская обл.', 'KZ-27': 'Западно-Казахстанская обл.',
  'KZ-15': 'Актюбинская обл.', 'KZ-47': 'Маңғыстау обл.', 'KZ-63': 'Восточно-Казахстанская обл.',
  'KZ-31': 'Жамбылская обл.', 'KZ-43': 'Кызылординская обл.', 'KZ-61': 'Түркістан обл.',
  'KZ-59': 'Северо-Казахстанская обл.', 'KZ-55': 'Павлодарская обл.', 'KZ-35': 'Карагандинская обл.',
  'KZ-39': 'Костанайская обл.', 'KZ-10': 'Абай обл.', 'KZ-33': 'Жетысу обл.', 'KZ-62': 'Улытау обл.',
};
export const regionName = (code: string) => REGION_NAMES[code] || code;

/** Report data (JSON) for the Reports page / print view. */
export function buildReport(db: ReturnType<typeof getDb>, type: string, params: Record<string, string>) {
  const week = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  if (type === 'regional') {
    const regions = db.prepare('SELECT DISTINCT region_code FROM stores ORDER BY region_code').all() as { region_code: string }[];
    return regions.map(r => {
      const st = regionalStats(db, r.region_code);
      return {
        region: r.region_code,
        region_name: regionName(r.region_code),
        stores_count: st.stores_count,
        products_monitored: st.products_monitored,
        average_prices: st.average_prices,
        most_expensive: st.most_expensive,
        cheapest: st.cheapest,
      };
    });
  }
  if (type === 'store') {
    const stores = db.prepare('SELECT * FROM stores ORDER BY name').all() as any[];
    const basket = getBasket(db);
    const basketProdIds = basket.map(b => b.product_id);
    return stores.map(s => {
      const row: Record<string, any> = {
        name: s.name, type: s.type, city: s.city, region: regionName(s.region_code),
        last_checked: s.last_checked_at, basket: basketCostForStore(db, s.id, today()),
      };
      const prices = db.prepare(`SELECT p.base_key, p.name_ru, p.unit, pe.price, p.amount FROM price_entries pe JOIN products p ON p.id=pe.product_id
        WHERE pe.store_id=? AND pe.collected_at >= ? ORDER BY pe.collected_at DESC`).all(s.id, week) as any[];
      const byBase = new Map<string, any>();
      for (const p of prices) if (!byBase.has(p.base_key)) byBase.set(p.base_key, p);
      for (const [k, p] of byBase) row[`unit_${p.base_key}`] = Math.round(p.price / p.amount);
      return row;
    });
  }
  if (type === 'product') {
    const pid = params.product_id;
    const product = db.prepare('SELECT * FROM products WHERE id=?').get(pid) as any;
    if (!product) return { error: 'товар не найден' };
    const rows = db.prepare(`SELECT pe.*, pr.amount, pr.unit, st.name AS store_name FROM price_entries pe JOIN products pr ON pr.id=pe.product_id JOIN stores st ON st.id=pe.store_id
      WHERE pe.product_id=? ORDER BY pe.collected_at DESC, pe.id DESC`).all(pid) as any[];
    let prevPrice: number | null = null;
    return {
      product: { ...product },
      rows: rows.map(r => {
        const per = Math.round(r.price / r.amount);
        const out = { date: r.collected_at, store: r.store_name, price: r.price, per_unit: per, change_pct: prevPrice ? Math.round(((prevPrice - r.price) / prevPrice) * 1000) / 10 : null };
        prevPrice = r.price;
        return out;
      }),
    };
  }
  if (type === 'basket') {
    const stores = db.prepare(`SELECT id, name FROM stores WHERE monitoring_status='active' ORDER BY name`).all() as any[];
    const days = 14;
    const header: any[] = [];
    for (let i = days - 1; i >= 0; i--) header.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
    const matrix = stores.map(s => ({
      store: s.name,
      values: header.map(d => basketCostForStore(db, s.id, d)),
    }));
    const avg = header.map((d, i) => {
      const vals = matrix.map(m => m.values[i]).filter((v): v is number => v !== null);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    });
    const movers = topMovers(db, 7, 10);
    return { header, matrix, avg, movers, basket_items: getBasket(db).map(b => ({ product: (db.prepare('SELECT name_ru, amount, unit FROM products WHERE id=?').get(b.product_id) as any), amount: b.amount })) };
  }
  if (type === 'prices') {
    const from = params.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const rows = db.prepare(`SELECT pe.*, p.name_ru, p.amount, p.unit, st.name AS store_name, st.city, st.region_code FROM price_entries pe
      JOIN products p ON p.id=pe.product_id JOIN stores st ON st.id=pe.store_id
      WHERE pe.collected_at >= ? ORDER BY pe.collected_at DESC`).all(from) as any[];
    return rows.map(r => ({
      date: r.collected_at, product: r.name_ru, unit: r.unit, amount: r.amount, price: r.price,
      per_unit: Math.round(r.price / r.amount), store: r.store_name, city: r.city, region: regionName(r.region_code),
      source: r.source, status: r.status, entered_by: r.entered_by,
    }));
  }
  return { error: 'unknown report type' };
}

// GET /api/sp/reports/export?type=...&format=xlsx|json
export async function GET(req: NextRequest) {
  const db = ensureSeeded();
  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'regional';
  const fmt = (url.searchParams.get('format') || 'xlsx').toLowerCase();
  const data = buildReport(db, type, Object.fromEntries(url.searchParams.entries()));
  if ((data as any)?.error) return json((data as any), 400);
  if (fmt === 'json') return json(data);
  const xlsxMod: any = await import('xlsx');
  const XLSX: any = xlsxMod.default ?? xlsxMod;
  const wb = XLSX.utils.book_new();
  const sheetName = `Report_${type}`;
  if (type === 'product') {
    const d = data as any;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.rows), 'History');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([d.product]), 'Product');
  } else if (type === 'basket') {
    const d = data as any;
    const matrix = d.matrix.map((m: any, i: number) => {
      const o: Record<string, any> = { store: m.store };
      d.header.forEach((hd: string, j: number) => { o[hd] = m.values[j]; });
      return o;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matrix), 'Basket by store');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.header.map((hd: string, i: number) => ({ date: hd, avg_basket: d.avg[i] }))), 'Average');
  } else {
    const flat = (data as any[]).map(row => {
      const o: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) {
        if (Array.isArray(v)) {
          if (k === 'average_prices') o.products = (v as any[]).length;
          else if (k === 'most_expensive') o.most_expensive = (v as any[]).map(x => `${x.name}: ${x.avg}₸`).join('; ');
          else if (k === 'cheapest') o.cheapest = (v as any[]).map(x => `${x.name}: ${x.avg}₸`).join('; ');
          else o[k] = JSON.stringify(v);
        } else o[k] = v;
      }
      return o;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flat.length ? flat : []), sheetName);
  }
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const fname = `smartprice-report-${type}-${today()}.xlsx`;
  return new Response(out, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${fname}"` } });
}
