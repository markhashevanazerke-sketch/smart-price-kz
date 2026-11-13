'use client';
// SMART PRICE — Analytical reports: regional / store / product / basket / prices + Excel & PDF export.

import React, { useEffect, useMemo, useState } from 'react';
import { FileBarChart, Download, Printer } from 'lucide-react';
import { useSP } from '@/lib/sp/context';
import { PageHeader, Card, CardBody, Btn, Select, EmptyState, Change } from '@/components/sp/ui';
import { REGIONS, regionName } from '@/lib/sp/regions';
import { fmtKzt, fmtDate, productName } from '@/lib/sp/format';
import { toast } from 'sonner';

const REPORT_TYPES = [
  { id: 'regional', key: 'report_regional' },
  { id: 'store', key: 'report_store' },
  { id: 'product', key: 'report_product' },
  { id: 'basket', key: 'report_basket' },
  { id: 'prices', key: 'report_prices' },
];

export default function ReportsPage() {
  const { tr, lang, currentUser } = useSP();
  const [type, setType] = useState('regional');
  const [productId, setProductId] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sp/products').then(r => r.json()).then(setProducts).catch(() => {});
  }, []);

  useEffect(() => {
    if (type === 'product' && !productId) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set('type', type);
    params.set('format', 'json');
    if (type === 'product') params.set('product_id', productId);
    fetch('/api/sp/reports?' + params.toString()).then(r => r.json()).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [type, productId]);

  const exportExcel = () => {
    const params = new URLSearchParams();
    params.set('type', type);
    if (type === 'product') params.set('product_id', productId);
    window.open('/api/sp/reports?' + params.toString(), '_blank');
    toast.success(tr('report_generated'));
  };

  return (
    <div className="p-6 max-w-[1500px] mx-auto" id="sp-report-print">
      <PageHeader title={tr('reports_title')} subtitle={tr('reports_subtitle')}>
        <Btn variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4" /> {tr('print_report')}</Btn>
        <Btn onClick={exportExcel}><Download className="w-4 h-4" /> {tr('export_excel')}</Btn>
      </PageHeader>

      {/* report picker */}
      <Card className="mb-4">
        <div className="p-4 flex flex-wrap items-center gap-2">
          {REPORT_TYPES.map(r => (
            <button key={r.id} onClick={() => setType(r.id)}
              className={`px-4 py-2.5 rounded-xl text-[12.5px] font-semibold border transition-colors ${type === r.id ? 'bg-[#12315A] text-white border-[#12315A]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              <FileBarChart className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />{tr(r.key)}
            </button>
          ))}
          {type === 'product' && (
            <select value={productId} onChange={e => setProductId(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs max-w-[280px]">
              <option value="">{tr('select_product')}</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name_ru}</option>)}
            </select>
          )}
        </div>
      </Card>

      {loading && <div className="text-sm text-slate-400 py-10 text-center">{tr('loading')}</div>}

      {/* REGIONAL */}
      {type === 'regional' && Array.isArray(data) && (
        <div className="space-y-3">
          {data.map((r: any) => (
            <Card key={r.region}>
              <CardBody>
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-bold text-slate-900 text-[14.5px]">{r.region_name}</h3>
                  <span className="text-[11px] px-2 py-1 rounded-lg bg-slate-100 text-slate-500 font-semibold">{tr('stores_count_lbl')}: {r.stores_count}</span>
                  <span className="text-[11px] px-2 py-1 rounded-lg bg-slate-100 text-slate-500 font-semibold">{tr('products_monitored')}: {r.products_monitored}</span>
                </div>
                {r.average_prices?.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    {r.average_prices.map((p: any, i: number) => (
                      <div key={i} className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                        <div className="text-[11px] text-slate-500 truncate">{p.name}</div>
                        <div className="flex items-center justify-between mt-1">
                          <b className="text-[13px] tabular-nums">{fmtKzt(p.avg, lang)}</b>
                          <Change value={p.change_pct} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {(!r.average_prices || r.average_prices.length === 0) && <div className="text-xs text-slate-400 mt-3">{tr('no_region_data')}</div>}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* STORE */}
      {type === 'store' && Array.isArray(data) && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10.5px] uppercase text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-3">{tr('store')}</th>
                  <th className="px-3 py-3">{tr('city')}</th>
                  <th className="px-3 py-3">{tr('region')}</th>
                  <th className="px-3 py-3 text-right">{tr('basket_cost')}</th>
                  <th className="px-3 py-3">{tr('last_checked')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s: any, i: number) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{s.name}</td>
                    <td className="px-3 py-2.5 text-slate-500">{s.city}</td>
                    <td className="px-3 py-2.5 text-slate-500">{s.region}</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">{s.basket ? fmtKzt(s.basket, lang) : '—'}</td>
                    <td className="px-3 py-2.5 text-slate-400">{s.last_checked ? fmtDate(s.last_checked, lang) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* PRODUCT */}
      {type === 'product' && data?.product && (
        <Card>
          <CardBody>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="font-bold text-slate-900 text-[15px]">{data.product.name_ru}</h3>
              <span className="text-[11px] px-2 py-1 rounded-lg bg-slate-100 text-slate-500">{data.product.amount} {data.product.unit} · {data.product.package}</span>
              <code className="text-[10.5px] bg-slate-100 rounded px-1.5 py-0.5 text-slate-400">{data.product.base_key}</code>
            </div>
            <div className="max-h-[480px] overflow-y-auto rounded-xl border border-slate-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-[10.5px] uppercase text-slate-400">
                    <th className="px-4 py-2.5">{tr('date')}</th><th className="px-4 py-2.5">{tr('store')}</th>
                    <th className="px-4 py-2.5 text-right">{tr('current_price')}</th>
                    <th className="px-4 py-2.5 text-right">{tr('price_per_unit')}</th>
                    <th className="px-4 py-2.5 text-right">{tr('change')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r: any, i: number) => (
                    <tr key={i} className="border-t border-slate-50">
                      <td className="px-4 py-2 text-slate-500 tabular-nums">{fmtDate(r.date, lang)}</td>
                      <td className="px-4 py-2 text-slate-700">{r.store}</td>
                      <td className="px-4 py-2 text-right font-bold tabular-nums">{fmtKzt(r.price, lang)}</td>
                      <td className="px-4 py-2 text-right text-slate-500 tabular-nums">{fmtKzt(r.per_unit, lang)}</td>
                      <td className="px-4 py-2 text-right"><Change value={r.change_pct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* BASKET */}
      {type === 'basket' && data && (
        <div className="space-y-4">
          <Card>
            <CardBody>
              <div className="text-[11px] font-semibold text-slate-400 mb-2">{tr('report_basket')}</div>
              <div className="flex flex-wrap gap-2">
                {(data.basket_items || []).map((b: any, i: number) => (
                  <span key={i} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-600">
                    {b.amount}× {b.product?.name_ru}
                  </span>
                ))}
              </div>
            </CardBody>
          </Card>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase text-slate-400 border-b border-slate-100">
                    <th className="px-4 py-3 sticky left-0 bg-white">{tr('store')}</th>
                    {data.header.map((d: string) => <th key={d} className="px-2 py-3 text-right whitespace-nowrap">{d.slice(5)}</th>)}
                    <th className="px-4 py-3 text-right">{tr('avg_price')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.matrix.map((m: any, i: number) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-2 font-semibold text-slate-700 sticky left-0 bg-white">{m.store}</td>
                      {m.values.map((v: any, j: number) => (
                        <td key={j} className="px-2 py-2 text-right tabular-nums text-slate-600">{v ? fmtKzt(v, lang).replace(/\s/g, '') : '—'}</td>
                      ))}
                      <td className="px-4 py-2 text-right font-bold tabular-nums">
                        {(() => { const vals = m.values.filter((v: any) => v); return vals.length ? fmtKzt(Math.round(vals.reduce((a: number, b: any) => a + b, 0) / vals.length), lang) : '—'; })()}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/80">
                    <td className="px-4 py-2 font-bold text-slate-800 sticky left-0 bg-slate-50">{tr('avg_price')}</td>
                    {data.avg.map((v: any, j: number) => (
                      <td key={j} className="px-2 py-2 text-right font-bold tabular-nums">{v ? fmtKzt(v, lang).replace(/\s/g, '') : '—'}</td>
                    ))}
                    <td className="px-4 py-2" />
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* PRICES */}
      {type === 'prices' && Array.isArray(data) && (
        <Card>
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-[10.5px] uppercase text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-3">{tr('date')}</th><th className="px-3 py-3">{tr('product')}</th>
                  <th className="px-3 py-3 text-right">{tr('current_price')}</th><th className="px-3 py-3 text-right">{tr('price_per_unit')}</th>
                  <th className="px-3 py-3">{tr('store')}</th><th className="px-3 py-3">{tr('region')}</th>
                  <th className="px-3 py-3">{tr('source')}</th><th className="px-3 py-3">{tr('entered_by')}</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 300).map((r: any, i: number) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-4 py-2 text-slate-500 tabular-nums">{fmtDate(r.date, lang)}</td>
                    <td className="px-3 py-2 text-slate-700 font-medium">{r.product}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{fmtKzt(r.price, lang)}</td>
                    <td className="px-3 py-2 text-right text-slate-500 tabular-nums">{fmtKzt(r.per_unit, lang)}</td>
                    <td className="px-3 py-2 text-slate-500">{r.store} ({r.city})</td>
                    <td className="px-3 py-2 text-slate-500">{r.region}</td>
                    <td className="px-3 py-2 text-slate-400">{r.source}</td>
                    <td className="px-3 py-2 text-slate-400">{r.entered_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
        <span>⚠ {tr('demo_report_note')}</span>
        <span>{tr('generated_by')}: {currentUser?.name || '—'} · {new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU')}</span>
      </div>
    </div>
  );
}
