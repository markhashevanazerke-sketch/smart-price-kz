'use client';
// SMART PRICE — AI Analytics: detection run, cross-store comparison, regional averages, dynamics.

import React, { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, Play, Search } from 'lucide-react';
import { useSP, spFetch } from '@/lib/sp/context';
import { PageHeader, Card, CardBody, Btn, Field, Select, EmptyState, Change, SeverityPill, StatusPill } from '@/components/sp/ui';
import { REGIONS, regionName } from '@/lib/sp/regions';
import { fmtKzt, fmtPct, productName, unitLabel } from '@/lib/sp/format';
import { toast } from 'sonner';

export default function AIPage() {
  const { tr, lang, currentUser } = useSP();
  const [products, setProducts] = useState<any[]>([]);
  const [productId, setProductId] = useState('');
  const [days, setDays] = useState(14);
  const [compare, setCompare] = useState<any>(null);
  const [dynamics, setDynamics] = useState<any>(null);
  const [region, setRegion] = useState('');
  const [regional, setRegional] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [detectResult, setDetectResult] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const canRun = currentUser?.role === 'analyst' || currentUser?.role === 'admin';

  useEffect(() => {
    fetch('/api/sp/products').then(r => r.json()).then(setProducts).catch(() => {});
    fetch('/api/sp/analytics').then(r => r.json()).then(j => setAnomalies(j.rows || [])).catch(() => {});
    loadSettings();
  }, []);

  const loadSettings = () => {
    fetch('/api/sp/settings').then(r => r.ok ? r.json() : Promise.reject()).then(setSettings).catch(() => {});
  };

  const loadCompare = () => {
    if (!productId) return;
    fetch(`/api/sp/analytics/compare?product_id=${productId}`).then(r => r.json()).then(setCompare).catch(() => setCompare(null));
    fetch(`/api/sp/analytics/compare?mode=dynamics&product_id=${productId}&days=${days}`).then(r => r.json()).then(setDynamics).catch(() => setDynamics(null));
  };
  useEffect(() => { loadCompare(); }, [productId, days]);

  const loadRegional = () => {
    if (!region) { setRegional(null); return; }
    fetch(`/api/sp/analytics/compare?mode=regional&region=${region}`).then(r => r.json()).then(setRegional).catch(() => setRegional(null));
  };
  useEffect(() => { loadRegional(); }, [region]);

  const runDetection = async () => {
    setRunning(true);
    try {
      const res = await spFetch('/api/sp/prices/detect', { method: 'POST', body: JSON.stringify({ days: 3 }) });
      setDetectResult(res);
      toast.success(`${tr('detection_done')}: ${res.anomalies_found} ${tr('anomalies_detected')}`);
      const j = await fetch('/api/sp/analytics').then(r => r.json());
      setAnomalies(j.rows || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  const saveSettings = async () => {
    try {
      await spFetch('/api/sp/settings', { method: 'POST', body: JSON.stringify(settings) });
      toast.success(tr('settings_saved'));
    } catch (e: any) { toast.error(e.message); }
  };

  const cmpEntries = compare?.entries || [];
  const cmpMax = Math.max(...cmpEntries.map(e => e.per_unit), 1);

  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <PageHeader title={tr('ai_title')} subtitle={tr('ai_subtitle')}>
        {canRun && (
          <Btn onClick={runDetection} disabled={running}>
            <Play className="w-4 h-4" /> {running ? '...' : tr('run_detection')}
          </Btn>
        )}
      </PageHeader>

      <div className="rounded-2xl bg-gradient-to-r from-[#0D2038] to-[#12315A] text-white p-5 mb-5 flex flex-wrap items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
          <BrainCircuit className="w-6 h-6 text-blue-300" />
        </div>
        <div className="flex-1 min-w-[240px]">
          <div className="font-bold text-[14px]">{tr('ai_disclaimer')}</div>
          <div className="text-[11.5px] text-blue-200/70 mt-1">
            {tr('threshold_spike')}: <b>{settings.spike_threshold_pct ?? '—'}%</b> · z-score: <b>{settings.zscore_threshold ?? '—'}</b> · {tr('threshold_outlier')}: <b>{settings.outlier_pct ?? '—'}%</b>
          </div>
        </div>
        {detectResult && (
          <div className="text-right">
            <div className="text-[11px] text-blue-200/70">{tr('detection_done')}</div>
            <div className="text-xl font-bold">{detectResult.entries_checked} → {detectResult.anomalies_found}</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* LEFT: comparison */}
        <Card className="xl:col-span-2">
          <CardBody>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h3 className="font-bold text-slate-800 text-[14px]">{tr('compare_title')}</h3>
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  placeholder={tr('select_product')}
                  value={products.find(p => p.id === productId)?.name_ru || ''}
                  onChange={e => {
                    const found = products.find(p =>
                      [p.name_ru, p.name_kk, p.name_en].some(n => n.toLowerCase().includes(e.target.value.toLowerCase()))
                    );
                    setProductId(found?.id || '');
                  }}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <select value={days} onChange={e => setDays(Number(e.target.value))} className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs">
                {[7, 14, 30].map(d => <option key={d} value={d}>{tr('days' + d)}</option>)}
              </select>
            </div>

            {!productId && <EmptyState text={tr('select_product')} />}

            {productId && compare && (
              <>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                    <div className="text-[10.5px] text-emerald-600 font-semibold">{tr('min')}</div>
                    <div className="text-lg font-bold text-emerald-800 tabular-nums">{fmtKzt(compare.min, lang)}</div>
                  </div>
                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                    <div className="text-[10.5px] text-blue-600 font-semibold">{tr('median')}</div>
                    <div className="text-lg font-bold text-blue-800 tabular-nums">{fmtKzt(compare.median, lang)}</div>
                  </div>
                  <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                    <div className="text-[10.5px] text-red-600 font-semibold">{tr('max')}</div>
                    <div className="text-lg font-bold text-red-800 tabular-nums">{fmtKzt(compare.max, lang)}</div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {cmpEntries.map(e => (
                    <div key={e.store} className="flex items-center gap-3">
                      <div className="w-44 truncate text-[12px] text-slate-600">{e.store}</div>
                      <div className="flex-1 h-5 rounded-lg bg-slate-50 overflow-hidden relative">
                        <div className={`h-full rounded-lg ${e.dev_pct !== undefined && e.dev_pct > 15 ? 'bg-gradient-to-r from-red-400 to-red-500' : e.dev_pct !== undefined && e.dev_pct < -15 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-[#1E4E8C] to-[#2C6BB0]'}`}
                          style={{ width: `${Math.max(4, (e.per_unit / cmpMax) * 100)}%` }} />
                      </div>
                      <div className="w-24 text-right text-[12px] font-bold text-slate-800 tabular-nums">{fmtKzt(e.price, lang)}</div>
                      <div className="w-20 text-right text-[11.5px] text-slate-500 tabular-nums">{fmtKzt(e.per_unit, lang)}/{unitLabel(compare.product.unit, lang)}</div>
                      <div className="w-16 text-right"><Change value={e.dev_pct} /></div>
                    </div>
                  ))}
                </div>
                <div className="text-[10.5px] text-slate-400 mt-2">{tr('dev_from_median')}</div>

                {/* dynamics */}
                {dynamics?.series?.length > 1 && (
                  <div className="mt-6">
                    <div className="text-[12px] font-semibold text-slate-500 mb-2">{tr('dynamics_title')} ({tr('days' + days)})</div>
                    <DynChart series={dynamics.series} />
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>

        {/* RIGHT: regional + recent anomalies */}
        <div className="space-y-4">
          <Card>
            <CardBody>
              <h3 className="font-bold text-slate-800 text-[14px] mb-3">{tr('regional_title')}</h3>
              <Field label={tr('region')}>
                <Select value={region} onChange={e => setRegion(e.target.value)}>
                  <option value="">{tr('select_region')}</option>
                  {REGIONS.map(r => <option key={r.code} value={r.code}>{regionName(r.code, lang)}</option>)}
                </Select>
              </Field>
              {region && regional && (
                <div className="mt-3 max-h-[260px] overflow-y-auto pr-1 space-y-1">
                  {regional.average_prices?.length === 0 && <EmptyState text={tr('no_region_data')} />}
                  {regional.average_prices?.slice(0, 10).map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-[12px] py-1 border-b border-slate-50 last:border-0">
                      <span className="text-slate-600 truncate pr-2">{p.name}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <b className="tabular-nums">{fmtKzt(p.avg, lang)}</b>
                        <Change value={p.change_pct} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="font-bold text-slate-800 text-[14px] mb-3">{tr('alerts_title')}</h3>
              {anomalies.length === 0 && <EmptyState text={tr('no_anomalies')} />}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {anomalies.slice(0, 12).map(a => (
                  <div key={a.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex items-center gap-2">
                      <SeverityPill severity={a.severity} tr={tr} />
                      <StatusPill status={a.status} tr={tr} />
                      <span className="text-[10.5px] text-slate-400 ml-auto">{a.metric}</span>
                    </div>
                    <div className="text-[12px] font-semibold text-slate-700 mt-1.5 leading-snug">{a.message}</div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DynChart({ series }: { series: { date: string; price: number }[] }) {
  const W = 380, H = 120, P = 10;
  const vals = series.map(s => s.price);
  const min = Math.min(...vals), max = Math.max(...vals);
  const x = (i: number) => P + (i / (series.length - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - min) / (max - min || 1)) * (H - 2 * P);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-w-md">
      <polyline points={series.map((s, i) => `${x(i)},${y(s.price)}`).join(' ')} fill="none" stroke="#1E4E8C" strokeWidth="2" />
      {series.map((s, i) => (
        <circle key={s.date + i} cx={x(i)} cy={y(s.price)} r="2.5" fill="#fff" stroke="#1E4E8C" strokeWidth="1.5">
          <title>{s.date}: {s.price} ₸</title>
        </circle>
      ))}
    </svg>
  );
}
