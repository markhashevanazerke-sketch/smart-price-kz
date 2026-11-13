import { NextRequest } from 'next/server';
import { ensureSeeded } from '@/lib/server/api-helpers';
import { today } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/sp/prices/template — download import template (XLSX + CSV)
export async function GET(req: NextRequest) {
  const db = ensureSeeded();
  const fmt = (new URL(req.url).searchParams.get('format') || 'xlsx').toLowerCase();
  const xlsxMod: any = await import('xlsx');
  const XLSX: any = xlsxMod.default ?? xlsxMod;
  const products = db.prepare('SELECT name_ru, barcode FROM products ORDER BY name_ru').all() as any[];
  const stores = db.prepare('SELECT name FROM stores ORDER BY name').all() as any[];
  const rows = [
    { 'Товар (название или штрихкод)': products[0]?.name_ru || '', 'Торговая точка (название)': stores[0]?.name || '', 'Цена, ₸': 460, 'Дата (ГГГГ-ММ-ДД)': today(), 'Комментарий': 'Заполните по одному товару в строке' },
    { 'Товар (название или штрихкод)': products[1]?.name_ru || '', 'Торговая точка (название)': stores[0]?.name || '', 'Цена, ₸': 280, 'Дата (ГГГГ-ММ-ДД)': today(), 'Комментарий': '' },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 38 }, { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 26 }];
  if (fmt === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="smartprice-import-template.csv"' } });
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Prices');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Response(out, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="smartprice-import-template.xlsx"' } });
}
