import { NextRequest, NextResponse } from 'next/server';
import { ensureSeeded, json, err, requireRole, validatePriceInput, findDuplicate } from '@/lib/server/api-helpers';
import { getDb, uid, nowIso, today, audit, notify } from '@/lib/server/db';
import { detectForEntry } from '@/lib/server/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

/** Manual CSV parser (UTF-8, ';' or ',' separator) — keeps dates as plain strings. */
function parseCsvText(text: string, FS: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lines.length) return [];
  const parseLine = (line: string): string[] => {
    const out: string[] = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === FS) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map(s => s.trim());
  };
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(l => {
    const vals = parseLine(l);
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = vals[i] ?? ''; });
    return o;
  });
}

/** Parse CSV / XLSX buffer → rows of strings. */
async function parseUpload(buffer: ArrayBuffer, filename: string): Promise<Record<string, string>[]> {
  if (filename.endsWith('.csv')) {
    const text = new TextDecoder('utf-8').decode(new Uint8Array(buffer)).replace(/^\uFEFF/, '');
    const firstLine = text.split(/\r?\n/)[0] || '';
    const semi = (firstLine.match(/;/g) || []).length;
    const comma = (firstLine.match(/,/g) || []).length;
    return parseCsvText(text, semi > comma ? ';' : ',');
  }
  const xlsxMod: any = await import('xlsx');
  const XLSX: any = xlsxMod.default ?? xlsxMod;
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, string>[];
}

// POST /api/sp/prices/import  (multipart: file)
export async function POST(req: NextRequest) {
  const db = ensureSeeded();
  const a = requireRole(req, ['specialist', 'analyst', 'admin']);
  if (a instanceof NextResponse) return a;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err('Ожидается multipart/form-data с полем file', 400);
  }
  const file = form.get('file');
  if (!(file instanceof File)) return err('Файл не найден (поле "file")', 400);
  const name = file.name.toLowerCase();
  if (!name.endsWith('.csv') && !name.endsWith('.xlsx') && !name.endsWith('.xls')) return err('Поддерживаются только .csv и .xlsx', 400);

  const buffer = await file.arrayBuffer();
  let rows: Record<string, string>[];
  try {
    rows = await parseUpload(buffer, name);
  } catch (e: any) {
    return err('Не удалось разобрать файл: ' + (e.message || e), 400);
  }
  if (!rows.length) return err('Файл пуст', 400);

  // normalize header names
  const headerMap = (k: string) => norm(k).replace(/[^a-zа-я0-9]/g, '');
  const keyed = rows.map(r => {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) o[headerMap(k)] = String(v).trim();
    return o;
  });

  const products = db.prepare('SELECT * FROM products').all() as any[];
  const stores = db.prepare('SELECT * FROM stores').all() as any[];
  const productByName = new Map<string, any>();
  for (const p of products) {
    productByName.set(norm(p.name_ru), p);
    productByName.set(norm(p.name_kk), p);
    productByName.set(norm(p.name_en), p);
    if (p.barcode) productByName.set(norm(p.barcode), p);
  }
  const storeByName = new Map<string, any>();
  for (const s of stores) storeByName.set(norm(s.name), s);

  const getCol = (row: Record<string, string>, keys: string[]) => {
    for (const k of keys) if (row[k] !== undefined && row[k] !== '') return row[k];
    return undefined;
  };

  const ins = db.prepare(`INSERT INTO price_entries (id, product_id, store_id, price, collected_at, source, status, entered_by, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  let imported = 0;
  const skipped: { row: number; reason: string }[] = [];
  const rejected: { row: number; reason: string }[] = [];
  const newEntryIds: string[] = [];

  keyed.forEach((row, i) => {
    const rowNum = i + 2; // +1 header +1 1-based
    const product = getCol(row, ['product', 'productru', 'productkk', 'producten', 'товар', 'товарру', 'товаркк', 'barcod', 'штрихкод']);
    const store = getCol(row, ['store', 'storeruu', 'магазин', 'торговаяточка', 'storename']);
    const priceRaw = getCol(row, ['price', 'цена', 'pricekzt', 'ценатенге']);
    const dateRaw = getCol(row, ['collectedat', 'date', 'дата', 'collected']);
    if (!product || !store || !priceRaw) { rejected.push({ row: rowNum, reason: 'Не заполнены обязательные поля (товар / магазин / цена)' }); return; }
    const p = productByName.get(norm(product));
    if (!p) { rejected.push({ row: rowNum, reason: `Товар не найден: "${product}"` }); return; }
    const st = storeByName.get(norm(store));
    if (!st) { rejected.push({ row: rowNum, reason: `Торговая точка не найдена: "${store}"` }); return; }
    const price = parseFloat(String(priceRaw).replace(/\s/g, '').replace(',', '.'));
    if (!isFinite(price) || price <= 0) { rejected.push({ row: rowNum, reason: `Некорректная цена: "${priceRaw}"` }); return; }
    if (price > 1_000_000) { rejected.push({ row: rowNum, reason: `Некорректная цена (слишком большая): ${price}` }); return; }
    let date = today();
    if (dateRaw) {
      let dm: string | null = String(dateRaw).match(/(\d{4})-(\d{2})-(\d{2})/)?.[0] ?? null;
      if (!dm) {
        const m2 = String(dateRaw).match(/(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{4})/);
        if (m2) dm = `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
      }
      if (!dm) {
        const num = parseFloat(String(dateRaw));
        if (num > 25000 && num < 60000) {
          const d = new Date(Math.round((num - 25569) * 86400000));
          dm = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        }
      }
      if (!dm) { rejected.push({ row: rowNum, reason: `Некорректная дата: "${dateRaw}" (нужно ГГГГ-ММ-ДД)` }); return; }
      date = dm;
    }
    if (date > today()) { rejected.push({ row: rowNum, reason: `Дата в будущем: ${date}` }); return; }
    if (findDuplicate(db, p.id, st.id, date)) { skipped.push({ row: rowNum, reason: `Дубликат: уже есть цена за ${date}` }); return; }
    const id = uid('prc');
    ins.run(id, p.id, st.id, price, date, 'excel', 'pending', a.name, `Импорт: ${file.name}`, nowIso());
    newEntryIds.push(id);
    imported++;
  });

  // AI detection on imported entries
  let anomaliesFound = 0;
  for (const id of newEntryIds) {
    const d = detectForEntry(db, id, { actor: a.name, role: a.role });
    anomaliesFound += d.anomalies.length;
  }
  if (imported) {
    db.prepare(`UPDATE stores SET last_checked_at = ? WHERE id IN (SELECT DISTINCT store_id FROM price_entries WHERE created_at >= ?)`).run(today(), nowIso().slice(0, 10));
    audit(db, a.name, a.role, 'price.import', 'price', file.name, { imported, rejected: rejected.length, skipped: skipped.length, anomaliesFound });
  }
  if (anomaliesFound) notify(db, 'system', 'AI после импорта', `Обнаружено аномалий после массового импорта: ${anomaliesFound}`, anomaliesFound > 2 ? 'danger' : 'warning');

  return json({ imported, skipped, rejected, anomaliesFound, file: file.name });
}
