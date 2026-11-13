// SMART PRICE — demo data seed. ALL DATA HERE IS SYNTHETIC / TEST DATA.
// Stores have synthetic (test) addresses and coordinates around real city centers.
// Seeded with a deterministic PRNG so the demo is stable between restarts.

import Database from 'better-sqlite3';
import { getDb, uid, nowIso, today, audit, notify } from './db';
import { runFullDetection, setSettings } from './analytics';
import { Store, Product } from '../sp/types';

// deterministic PRNG (mulberry32)
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashSeed = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const roundPrice = (p: number) => (p >= 1000 ? Math.round(p / 10) * 10 : Math.round(p / 5) * 5);

// region (ISO 3166-2) → relative price level
const REGION_LEVEL: Record<string, number> = {
  'KZ-75': 1.08, 'KZ-71': 1.10, 'KZ-79': 1.02, 'KZ-35': 0.95, 'KZ-15': 0.98,
  'KZ-27': 0.97, 'KZ-55': 1.00, 'KZ-62': 1.03, 'KZ-61': 1.01, 'KZ-63': 1.05,
};
const TYPE_LEVEL: Record<string, number> = { supermarket: 1.0, shop: 1.07, market: 0.85 };

const USERS = [
  { name: 'Айжан Серікжанова', role: 'specialist', pin: '1111', lang: 'kk' },
  { name: 'Дамир Бек', role: 'analyst', pin: '2222', lang: 'ru' },
  { name: 'Гүлнара Нұрланова', role: 'admin', pin: '3333', lang: 'kk' },
];

const STORES: Omit<Store, 'id' | 'created_at' | 'last_checked_at'>[] = [
  { name: 'SmartMart (демо)', type: 'supermarket', region_code: 'KZ-75', city: 'Алматы', address: 'Демо-адрес, тестовые данные', lat: 43.2260, lng: 76.8572, monitoring_status: 'active', is_demo: 1 },
  { name: 'Рынок «Демо-1»', type: 'market', region_code: 'KZ-75', city: 'Алматы', address: 'Демо-адрес, тестовые данные', lat: 43.2145, lng: 76.8435, monitoring_status: 'active', is_demo: 1 },
  { name: 'Базар «Демо-2»', type: 'market', region_code: 'KZ-75', city: 'Алматы', address: 'Демо-адрес, тестовые данные', lat: 43.2305, lng: 76.8415, monitoring_status: 'active', is_demo: 1 },
  { name: 'Суперстор «Демо»', type: 'supermarket', region_code: 'KZ-71', city: 'Астана', address: 'Демо-адрес, тестовые данные', lat: 51.1730, lng: 71.4550, monitoring_status: 'active', is_demo: 1 },
  { name: 'Мини-маркет «Демо»', type: 'shop', region_code: 'KZ-71', city: 'Астана', address: 'Демо-адрес, тестовые данные', lat: 51.1655, lng: 71.4435, monitoring_status: 'active', is_demo: 1 },
  { name: 'Рынок «Демо» Астана', type: 'market', region_code: 'KZ-71', city: 'Астана', address: 'Демо-адрес, тестовые данные', lat: 51.1590, lng: 71.4600, monitoring_status: 'active', is_demo: 1 },
  { name: 'SmartMart (демо)', type: 'supermarket', region_code: 'KZ-79', city: 'Шымкент', address: 'Демо-адрес, тестовые данные', lat: 42.2965, lng: 69.6045, monitoring_status: 'active', is_demo: 1 },
  { name: 'Базар «Демо» Шымкент', type: 'market', region_code: 'KZ-79', city: 'Шымкент', address: 'Демо-адрес, тестовые данные', lat: 42.2885, lng: 69.5955, monitoring_status: 'active', is_demo: 1 },
  { name: 'Супермаркет «Демо»', type: 'supermarket', region_code: 'KZ-35', city: 'Караганда', address: 'Демо-адрес, тестовые данные', lat: 49.8095, lng: 73.1115, monitoring_status: 'active', is_demo: 1 },
  { name: 'Мини-маркет Караганда', type: 'shop', region_code: 'KZ-35', city: 'Караганда', address: 'Демо-адрес, тестовые данные', lat: 49.8020, lng: 73.1030, monitoring_status: 'active', is_demo: 1 },
  { name: 'Рынок «Демо» Актюбинск', type: 'market', region_code: 'KZ-15', city: 'Актобе', address: 'Демо-адрес, тестовые данные', lat: 50.2585, lng: 57.1805, monitoring_status: 'active', is_demo: 1 },
  { name: 'Супермаркет «Демо» Орал', type: 'supermarket', region_code: 'KZ-27', city: 'Орал', address: 'Демо-адрес, тестовые данные', lat: 50.0740, lng: 51.3225, monitoring_status: 'active', is_demo: 1 },
  { name: 'Мини-маркет Павлодар', type: 'shop', region_code: 'KZ-55', city: 'Павлодар', address: 'Демо-адрес, тестовые данные', lat: 52.2015, lng: 76.9195, monitoring_status: 'active', is_demo: 1 },
  { name: 'Рынок «Демо» Жайык', type: 'market', region_code: 'KZ-62', city: 'Жайык', address: 'Демо-адрес, тестовые данные', lat: 47.7235, lng: 82.8685, monitoring_status: 'active', is_demo: 1 },
  { name: 'Супермаркет «Демо» Түркістан', type: 'supermarket', region_code: 'KZ-61', city: 'Түркістан', address: 'Демо-адрес, тестовые данные', lat: 43.2850, lng: 68.5512, monitoring_status: 'active', is_demo: 1 },
  { name: 'Базар «Демо» Усть-Каменогорск', type: 'market', region_code: 'KZ-63', city: 'Усть-Каменогорск', address: 'Демо-адрес, тестовые данные', lat: 50.5570, lng: 84.0945, monitoring_status: 'active', is_demo: 1 },
];

interface P {
  base: string; kk: string; ru: string; en: string; cat: Product['category'];
  brand?: string; producer?: string; fat?: number; amount: number; unit: Product['unit']; pack: string; barcode?: string;
  basePrice: number; trend?: number;
}
const PRODUCTS: P[] = [
  { base: 'milk-2.5', kk: 'Сүт 2,5% 0,9 л', ru: 'Молоко 2,5% 0,9 л', en: 'Milk 2.5% 0.9 L', cat: 'dairy', brand: 'СутПрод', producer: 'СутПрод (демо)', fat: 2.5, amount: 0.9, unit: 'l', pack: 'бутылка', barcode: '4601000000011', basePrice: 420 },
  { base: 'milk-2.5', kk: 'Сүт 2,5% 1 л', ru: 'Молоко пастеризованное 2,5% 1 л', en: 'Milk 2.5% 1 L', cat: 'dairy', brand: 'СутПрод', producer: 'СутПрод (демо)', fat: 2.5, amount: 1, unit: 'l', pack: 'тетрапак', barcode: '4601000000028', basePrice: 460 },
  { base: 'milk-2.5', kk: 'Сүт 2,5% 2 л', ru: 'Молоко 2,5% 2 л', en: 'Milk 2.5% 2 L', cat: 'dairy', brand: 'СутПрод', producer: 'СутПрод (демо)', fat: 2.5, amount: 2, unit: 'l', pack: 'тетрапак', barcode: '4601000000035', basePrice: 880 },
  { base: 'kefir-2.5', kk: 'Кефир 2,5% 1 л', ru: 'Кефир 2,5% 1 л', en: 'Kefir 2.5% 1 L', cat: 'dairy', brand: 'СутПрод', producer: 'СутПрод (демо)', fat: 2.5, amount: 1, unit: 'l', pack: 'бутылка', barcode: '4601000000042', basePrice: 520 },
  { base: 'kefir-2.5', kk: 'Кефир 2,5% 0,5 л', ru: 'Кефир 2,5% 0,5 л', en: 'Kefir 2.5% 0.5 L', cat: 'dairy', brand: 'СутПрод', producer: 'СутПрод (демо)', fat: 2.5, amount: 0.5, unit: 'l', pack: 'бутылка', basePrice: 290 },
  { base: 'smetana-20', kk: 'Сметана 20% 400 г', ru: 'Сметана 20% 400 г', en: 'Smetana 20% 400 g', cat: 'dairy', brand: 'Молочный дом', producer: 'Молочный дом (демо)', fat: 20, amount: 0.4, unit: 'kg', pack: 'банка', barcode: '4601000000059', basePrice: 950 },
  { base: 'smetana-20', kk: 'Сметана 20% 700 г', ru: 'Сметана 20% 700 г', en: 'Smetana 20% 700 g', cat: 'dairy', brand: 'Молочный дом', producer: 'Молочный дом (демо)', fat: 20, amount: 0.7, unit: 'kg', pack: 'банка', basePrice: 1600 },
  { base: 'flour-bread', kk: 'Біринші сұрыптағы ұн 1 кг', ru: 'Мука пшеничная высший сорт 1 кг', en: 'Wheat flour 1 kg', cat: 'groceries', brand: 'Балхаш', producer: 'Балхаш (демо)', amount: 1, unit: 'kg', pack: 'пакет', barcode: '4601000000066', basePrice: 380 },
  { base: 'flour-bread', kk: 'Біринші сұрыптағы ұн 2 кг', ru: 'Мука пшеничная высший сорт 2 кг', en: 'Wheat flour 2 kg', cat: 'groceries', brand: 'Балхаш', producer: 'Балхаш (демо)', amount: 2, unit: 'kg', pack: 'пакет', barcode: '4601000000073', basePrice: 750 },
  { base: 'flour-bread', kk: 'Біринші сұрыптағы ұн 5 кг', ru: 'Мука пшеничная высший сорт 5 кг', en: 'Wheat flour 5 kg', cat: 'groceries', brand: 'Балхаш', producer: 'Балхаш (демо)', amount: 5, unit: 'kg', pack: 'мешок', basePrice: 1850, trend: 0.002 },
  { base: 'sugar', kk: 'Қант 0,5 кг', ru: 'Сахар 0,5 кг', en: 'Sugar 0.5 kg', cat: 'groceries', brand: 'Балхаш', producer: 'Балхаш (демо)', amount: 0.5, unit: 'kg', pack: 'пакет', barcode: '4601000000080', basePrice: 330 },
  { base: 'sugar', kk: 'Қант 1 кг', ru: 'Сахар 1 кг', en: 'Sugar 1 kg', cat: 'groceries', brand: 'Балхаш', producer: 'Балхаш (демо)', amount: 1, unit: 'kg', pack: 'пакет', barcode: '4601000000097', basePrice: 650 },
  { base: 'sugar', kk: 'Қант 2 кг', ru: 'Сахар 2 кг', en: 'Sugar 2 kg', cat: 'groceries', brand: 'Балхаш', producer: 'Балхаш (демо)', amount: 2, unit: 'kg', pack: 'пакет', basePrice: 1290 },
  { base: 'rice', kk: 'Күріш дән 1 кг', ru: 'Рис дранёный 1 кг', en: 'Rice 1 kg', cat: 'groceries', brand: 'Шаңырақ', producer: 'Шаңырақ (демо)', amount: 1, unit: 'kg', pack: 'пакет', barcode: '4601000000103', basePrice: 780, trend: 0.002 },
  { base: 'rice', kk: 'Күріш дән 3 кг', ru: 'Рис дранёный 3 кг', en: 'Rice 3 kg', cat: 'groceries', brand: 'Шаңырақ', producer: 'Шаңырақ (демо)', amount: 3, unit: 'kg', pack: 'пакет', basePrice: 2250 },
  { base: 'buckwheat', kk: 'Балқаш (гречка) 0,5 кг', ru: 'Гречка 0,5 кг', en: 'Buckwheat 0.5 kg', cat: 'groceries', brand: 'Шаңырақ', producer: 'Шаңырақ (демо)', amount: 0.5, unit: 'kg', pack: 'пакет', barcode: '4601000000110', basePrice: 520 },
  { base: 'buckwheat', kk: 'Балқаш (гречка) 1 кг', ru: 'Гречка 1 кг', en: 'Buckwheat 1 kg', cat: 'groceries', brand: 'Шаңырақ', producer: 'Шаңырақ (демо)', amount: 1, unit: 'kg', pack: 'пакет', basePrice: 1030 },
  { base: 'oil-sunflower', kk: 'Күн карағы майы 1 л', ru: 'Подсолнечное масло 1 л', en: 'Sunflower oil 1 L', cat: 'groceries', brand: 'Зерде', producer: 'Зерде (демо)', amount: 1, unit: 'l', pack: 'бутылка', barcode: '4601000000127', basePrice: 950, trend: 0.003 },
  { base: 'oil-sunflower', kk: 'Күн карағы майы 5 л', ru: 'Подсолнечное масло 5 л', en: 'Sunflower oil 5 L', cat: 'groceries', brand: 'Зерде', producer: 'Зерде (демо)', amount: 5, unit: 'l', pack: 'канистра', basePrice: 4600 },
  { base: 'potato', kk: 'Пататы (кедірқасық)', ru: 'Картофель', en: 'Potato', cat: 'vegetables', amount: 1, unit: 'kg', pack: 'весовой', basePrice: 280, trend: 0.004 },
  { base: 'carrot', kk: 'Сәбіз', ru: 'Морковь', en: 'Carrot', cat: 'vegetables', amount: 1, unit: 'kg', pack: 'весовой', basePrice: 260 },
  { base: 'onion', kk: 'Пияз', ru: 'Лук', en: 'Onion', cat: 'vegetables', amount: 1, unit: 'kg', pack: 'весовой', basePrice: 220 },
  { base: 'cabbage', kk: 'Кірбізем (кызылқия емес, күмбез)', ru: 'Капуста белокочанная', en: 'Cabbage', cat: 'vegetables', amount: 1, unit: 'kg', pack: 'весовой', basePrice: 240 },
  { base: 'eggs-c1', kk: 'Жумұртқа С1, 10 дана', ru: 'Яйца С1, 10 шт', en: 'Eggs C1, 10 pcs', cat: 'other', amount: 10, unit: 'pcs', pack: 'лоток', barcode: '4601000000134', basePrice: 650 },
  { base: 'eggs-c1', kk: 'Жумұртқа С1, 30 дана', ru: 'Яйца С1, 30 шт', en: 'Eggs C1, 30 pcs', cat: 'other', amount: 30, unit: 'pcs', pack: 'коробка', basePrice: 1850 },
  { base: 'bread-loaf', kk: 'Нан (лепешка) 900 г', ru: 'Хлеб (лепешка) 900 г', en: 'Bread loaf 900 g', cat: 'other', brand: 'Наубайхан', producer: 'Наубайхан (демо)', amount: 0.9, unit: 'kg', pack: 'штук', basePrice: 220 },
  { base: 'salt', kk: 'Тұз 1 кг', ru: 'Соль 1 кг', en: 'Salt 1 kg', cat: 'other', brand: 'Алтыналан', producer: 'Алтыналан (демо)', amount: 1, unit: 'kg', pack: 'пакет', barcode: '4601000000141', basePrice: 250 },
];

export function isSeeded(db: Database.Database) {
  return !!db.prepare(`SELECT value FROM settings WHERE key='seeded_at'`).get();
}

export function resetDb(db: Database.Database) {
  db.exec(`
    DELETE FROM price_entries; DELETE FROM anomalies; DELETE FROM evidence;
    DELETE FROM comments; DELETE FROM audit_log; DELETE FROM notifications;
    DELETE FROM matches; DELETE FROM products; DELETE FROM stores; DELETE FROM users; DELETE FROM settings;
  `);
}

export function seedDemo(db: Database.Database, opts: { force?: boolean } = {}) {
  if (isSeeded(db) && !opts.force) return { seeded: false, counts: null };
  resetDb(db);
  const t0 = nowIso();

  // settings (AI thresholds + basket)
  setSettings(db, 'spike_threshold_pct', '15');
  setSettings(db, 'zscore_threshold', '3.0');
  setSettings(db, 'outlier_pct', '30');
  setSettings(db, 'window_days', '30');

  // users
  const insUser = db.prepare('INSERT INTO users (id, name, role, pin, lang, active, created_at) VALUES (?,?,?,?,?,1,?)');
  const userIds: Record<string, string> = {};
  for (const u of USERS) {
    const id = uid('usr');
    userIds[u.role] = id;
    insUser.run(id, u.name, u.role, u.pin, u.lang, t0);
  }

  // stores
  const insStore = db.prepare('INSERT INTO stores (id, name, type, region_code, city, address, lat, lng, monitoring_status, last_checked_at, is_demo, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,?)');
  const storeIds: string[] = [];
  for (const s of STORES) {
    const id = uid('sto');
    storeIds.push(id);
    insStore.run(id, s.name, s.type, s.region_code, s.city, s.address, s.lat, s.lng, s.monitoring_status, null, t0);
  }

  // products
  const insProd = db.prepare('INSERT INTO products (id, base_key, name_kk, name_ru, name_en, category, brand, producer, fat, amount, unit, package, barcode, is_demo, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)');
  const prodIds: Record<string, string> = {}; // `${base}|${amount}|${pack}` -> id
  const prodById: Record<string, P> = {};
  for (const p of PRODUCTS) {
    const id = uid('prd');
    prodIds[`${p.base}|${p.amount}|${p.pack}`] = id;
    prodById[id] = p;
    insProd.run(id, p.base, p.kk, p.ru, p.en, p.cat, p.brand || null, p.producer || null, p.fat ?? null, p.amount, p.unit, p.pack, p.barcode || null, t0);
  }

  // basket: product_id by base (pick 1L milk, 1L kefir, 400g smetana, 2kg flour, 1kg sugar, 1kg rice, 1kg buckwheat, 1L oil, kg-veg, 10pcs eggs, 900g bread, 1kg salt)
  const basket = [
    { product_id: prodIds['milk-2.5|1|тетрапак'], amount: 2 },
    { product_id: prodIds['kefir-2.5|1|бутылка'], amount: 1 },
    { product_id: prodIds['smetana-20|0.4|банка'], amount: 1 },
    { product_id: prodIds['flour-bread|2|пакет'], amount: 1 },
    { product_id: prodIds['sugar|1|пакет'], amount: 1 },
    { product_id: prodIds['rice|1|пакет'], amount: 1 },
    { product_id: prodIds['buckwheat|1|пакет'], amount: 1 },
    { product_id: prodIds['oil-sunflower|1|бутылка'], amount: 1 },
    { product_id: prodIds['potato|1|весовой'], amount: 5 },
    { product_id: prodIds['carrot|1|весовой'], amount: 2 },
    { product_id: prodIds['onion|1|весовой'], amount: 2 },
    { product_id: prodIds['cabbage|1|весовой'], amount: 2 },
    { product_id: prodIds['eggs-c1|10|лоток'], amount: 2 },
    { product_id: prodIds['bread-loaf|0.9|штук'], amount: 2 },
    { product_id: prodIds['salt|1|пакет'], amount: 1 },
  ];
  setSettings(db, 'basket', JSON.stringify(basket));

  // price history: every 3 days for the last 30 days (plus 2 and 1 day ago for injected anomalies)
  const insPrice = db.prepare('INSERT INTO price_entries (id, product_id, store_id, price, collected_at, source, status, entered_by, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
  const dates: string[] = [30, 27, 24, 21, 18, 15, 12, 9, 6, 3, 2, 1].map(daysAgo);

  let priceCount = 0;
  const storeTrend: Record<string, number> = {};
  for (const storeId of storeIds) {
    const store = STORES[storeIds.indexOf(storeId)];
    const level = (REGION_LEVEL[store.region_code] ?? 1) * (TYPE_LEVEL[store.type] ?? 1);
    for (const [pid, p] of Object.entries(prodById)) {
      const rng = mulberry32(hashSeed(storeId + pid));
      const anchor = p.basePrice * level;
      let price = anchor * (0.97 + rng() * 0.06);
      let prevFinal: number | null = null;
      for (const date of dates) {
        price = price * (1 + (rng() - 0.5) * 0.05 + (p.trend || 0));
        // keep random-walk drift within ±8% of the store's expected level (no fake 30% drifts)
        price = anchor * Math.min(Math.max(price / anchor, 0.92), 1.08);
        // ---- injected demo anomalies (relative to the previous real price) ----
        let forced: number | null = null;
        // oil 1L at SmartMart Almaty: keep flat ~850 (demo will add 1100 today live)
        if (p.base === 'oil-sunflower' && p.amount === 1 && store.name === 'SmartMart (демо)' && store.city === 'Алматы') {
          price = 845 + rng() * 10;
        }
        // potato spike: Bazar Demo-2 Almaty, yesterday +22%
        if (p.base === 'potato' && store.name === 'Базар «Демо-2»' && date === daysAgo(1) && prevFinal) forced = roundPrice(prevFinal * 1.22);
        // sugar drop: Astana market, 2 days ago -18%
        if (p.base === 'sugar' && p.amount === 1 && store.name === 'Рынок «Демо» Астана' && date === daysAgo(2) && prevFinal) forced = roundPrice(prevFinal * 0.82);
        // cabbage spike 12 days ago at Astana supermarket +25% (will be confirmed later)
        if (p.base === 'cabbage' && store.name === 'Суперстор «Демо»' && date === daysAgo(12) && prevFinal) forced = roundPrice(prevFinal * 1.25);
        // eggs outlier at Shymkent bazar: ~55% above market for the last 5 days
        if (p.base === 'eggs-c1' && p.amount === 10 && store.name === 'Базар «Демо» Шымкент' && date >= daysAgo(5)) price = 880 + rng() * 20;
        const finalPrice = forced ?? roundPrice(price);
        const isRecent = date >= daysAgo(7);
        insPrice.run(uid('prc'), pid, storeId, finalPrice, date, 'demo', isRecent ? 'pending' : 'verified', 'Демо-специалист', null, t0);
        priceCount++;
        storeTrend[storeId] = date;
        prevFinal = finalPrice;
      }
    }
  }

  // last_checked_at
  db.prepare('UPDATE stores SET last_checked_at = ?').run(daysAgo(1));

  // run AI detection over recent entries (idempotent, will find injected anomalies incl. 12-day-old cabbage case)
  const det = runFullDetection(db, 14, { actor: 'AI-модуль', role: 'system' });

  // mark the old cabbage spike as reviewed & confirmed by the analyst
  const cabbageAno = db.prepare(`SELECT a.* FROM anomalies a JOIN products p ON p.id=a.product_id WHERE p.base_key='cabbage' AND a.type='spike' ORDER BY a.detected_at ASC LIMIT 1`).get() as any;
  if (cabbageAno) {
    db.prepare(`UPDATE anomalies SET status='confirmed', reviewer=?, decision_note=? WHERE id=?`)
      .run('Дамир Бек', 'Проверено: рост связан с окончанием сезона старого урожая. Повторного роста не зафиксировано — аномалия подтверждена как обоснованная.', cabbageAno.id);
    db.prepare(`INSERT INTO comments (id, ref_type, ref_id, author, role, type, content, decision, created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(uid('cmt'), 'anomaly', cabbageAno.id, 'Дамир Бек', 'analyst', 'conclusion', 'Рост 25% обоснован сезонным фактором (смена урожая капусты). Рекомендация: оставить под наблюдением 2 недели.', 'confirmed', daysAgo(10) + 'T09:30:00.000Z');
    db.prepare(`UPDATE price_entries SET status='verified' WHERE id=?`).run(cabbageAno.price_entry_id);
    audit(db, 'Дамир Бек', 'analyst', 'anomaly.decision', 'anomaly', cabbageAno.id, { decision: 'confirmed' });
  }
  // one comment from specialist on the potato anomaly (if detected)
  const potatoAno = db.prepare(`SELECT a.* FROM anomalies a JOIN products p ON p.id=a.product_id WHERE p.base_key='potato' AND a.type='spike' LIMIT 1`).get() as any;
  if (potatoAno) {
    db.prepare(`INSERT INTO comments (id, ref_type, ref_id, author, role, type, content, decision, created_at) VALUES (?,?,?,?,?,?,?,NULL,?)`)
      .run(uid('cmt'), 'anomaly', potatoAno.id, 'Айжан Серікжанова', 'specialist', 'comment', 'Проверила на месте: на рынке сегодня повышенный спрос, цены у разных ларьков отличаются. Фото ценника приложено.', daysAgo(0) + 'T08:15:00.000Z');
  }

  // evidence photo placeholder (small SVG generated as data URL) for the potato entry
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='280'><rect width='400' height='280' fill='#f3f4f6'/><rect x='20' y='20' width='360' height='240' fill='white' stroke='#1e3a5f'/><text x='200' y='90' font-family='Arial' font-size='20' text-anchor='middle' fill='#111'>ДЕМО-ФОТО ЦЕНИКА</text><text x='200' y='130' font-family='Arial' font-size='14' text-anchor='middle' fill='#555'>Картофель, 1 кг</text><text x='200' y='175' font-family='Arial' font-size='28' font-weight='bold' text-anchor='middle' fill='#111'>341 ₸</text><text x='200' y='225' font-family='Arial' font-size='11' text-anchor='middle' fill='#999'>test data / демо-данные</text></svg>`;
  const b64 = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  const potEntry = potatoAno ? (db.prepare('SELECT id FROM price_entries WHERE id=?').get(potatoAno.price_entry_id) as any) : null;
  if (potEntry) {
    db.prepare(`INSERT INTO evidence (id, price_entry_id, store_id, product_id, photo_b64, checked_at, employee_name, comment, ocr_price, ocr_status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(uid('evd'), potEntry.id, potatoAno.store_id, potatoAno.product_id, b64, daysAgo(0) + 'T08:10:00.000Z', 'Айжан Серікжанова', 'Ценник снят сегодня утром. OCR не подключён — цена введена вручную.', 341, 'pending', t0);
  }

  notify(db, 'system', 'Демо-данные загружены', 'База наполнена тестовыми данными мониторинга цен (все записи — демонстрационные).', 'info');
  audit(db, 'Система', 'system', 'seed.run', 'db', null, { prices: priceCount, detection: det });

  setSettings(db, 'seeded_at', t0);
  return {
    seeded: true,
    counts: {
      users: USERS.length,
      stores: STORES.length,
      products: PRODUCTS.length,
      prices: priceCount,
      anomalies: (db.prepare('SELECT COUNT(*) c FROM anomalies').get() as any).c,
    },
  };
}
