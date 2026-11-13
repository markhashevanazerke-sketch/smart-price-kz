'use client';
// SMART PRICE — Interactive Kazakhstan map (real OSM boundaries) + stores + region stats.

import React, { useEffect, useMemo, useState } from 'react';
import { MapPinned, Store, X, TrendingUp, TrendingDown } from 'lucide-react';
import { kzRegions } from '@/lib/sp/geo/kz-regions';
import { REGIONS, regionName } from '@/lib/sp/regions';
import { useSP } from '@/lib/sp/context';
import { PageHeader, Card, CardBody, EmptyState } from '@/components/sp/ui';
import { fmtKzt, fmtPct, fmtDate, unitLabel } from '@/lib/sp/format';

// equirectangular projection over KZ bounding box
const LON0 = 46.5, LON1 = 89.5, LAT0 = 40.5, LAT1 = 55.5;
const W = 960, H = 420;
const project = (lng: number, lat: number): [number, number] => {
  const x = ((lng - LON0) / (LON1 - LON0)) * W;
  const y = ((LAT1 - lat) / (LAT1 - LAT0)) * H;
  return [x, y];
};

function ringToPath(ring: number[][] | null | undefined): string {
  if (!ring || !Array.isArray(ring) || ring.length === 0) return '';
  return ring.map((pt, i) => {
    const [x, y] = project(pt[0], pt[1]);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join('') + 'Z';
}

function featureToPath(geom: any): string {
  if (!geom) return '';
  if (geom.type === 'Polygon') return (geom.coordinates || []).map(ringToPath).filter(Boolean).join(' ');
  if (geom.type === 'MultiPolygon') return (geom.coordinates || []).map((poly: any) => (Array.isArray(poly) ? poly : []).map(ringToPath).filter(Boolean).join(' ')).filter(Boolean).join(' ');
  return '';
}

type StoreInfo = { id: string; name: string; type: string; region_code: string; city: string; lat: number | null; lng: number | null; monitoring_status: string; change_pct: number | null };

export default function MapPage() {
  const { tr, lang } = useSP();
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [regionStats, setRegionStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [storeDetail, setStoreDetail] = useState<StoreInfo | null>(null);
  const [storePrices, setStorePrices] = useState<any[]>([]);

  const paths = useMemo(() => kzRegions.map(f => ({ code: f.properties.code, path: featureToPath(f.geometry) })), []);

  useEffect(() => {
    fetch('/api/sp/analytics/compare?mode=stores').then(r => r.json()).then(setStores).catch(() => {});
  }, []);

  useEffect(() => {
    setRegionStats(null);
    if (!selectedRegion) return;
    setStatsLoading(true);
    fetch(`/api/sp/analytics/compare?mode=regional&region=${selectedRegion}`)
      .then(r => r.json()).then(setRegionStats).catch(() => setRegionStats(null)).finally(() => setStatsLoading(false));
  }, [selectedRegion]);

  const openStore = (s: StoreInfo) => {
    setStoreDetail(s);
    setStorePrices([]);
    fetch(`/api/sp/prices?store_id=${s.id}&page_size=6`).then(r => r.json()).then(j => setStorePrices(j.rows || [])).catch(() => {});
  };

  const markerColor = (s: StoreInfo) => {
    if (s.monitoring_status === 'paused') return '#94A3B8';
    if (s.change_pct === null) return '#1E4E8C';
    if (s.change_pct > 1.5) return '#DC2626';
    if (s.change_pct < -1.5) return '#16A34A';
    return '#1E4E8C';
  };

  const typeIcon = (t: string) => (t === 'market' ? '🥬' : t === 'shop' ? '🏪' : '🛒');

  const dyn = regionStats?.dynamics?.filter((d: any) => d.value) || [];
  const dynMax = dyn.length ? Math.max(...dyn.map((d: any) => d.value)) : 0;
  const dynMin = dyn.length ? Math.min(...dyn.map((d: any) => d.value)) : 0;

  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <PageHeader title={tr('map_title')} subtitle={tr('map_subtitle')} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* MAP */}
        <Card className="xl:col-span-2">
          <CardBody>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-slate-500">{tr('select_region')}:</span>
              <select
                value={selectedRegion}
                onChange={e => setSelectedRegion(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white outline-none focus:border-blue-400"
              >
                <option value="">{tr('all_regions')}</option>
                {REGIONS.map(r => <option key={r.code} value={r.code}>{regionName(r.code, lang)}</option>)}
              </select>
              <div className="flex-1" />
              <div className="flex items-center gap-3 text-[10.5px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />{tr('legend_up')}</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />{tr('legend_down')}</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#1E4E8C] inline-block" />{tr('legend_stable')}</span>
              </div>
            </div>

            <div className="relative rounded-xl border border-slate-200 bg-gradient-to-b from-[#F8FAFD] to-[#EEF3FA] overflow-hidden">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                {paths.map(p => {
                  const sel = selectedRegion === p.code;
                  const dim = selectedRegion && !sel;
                  return (
                    <path
                      key={p.code}
                      d={p.path}
                      fill={sel ? '#1E4E8C' : '#DCE5F2'}
                      fillOpacity={dim ? 0.45 : 1}
                      stroke={sel ? '#12315A' : '#9FB4D0'}
                      strokeWidth={sel ? 1.6 : 0.8}
                      className="cursor-pointer transition-all hover:fill-[#C7D6EC]"
                      onClick={() => setSelectedRegion(sel ? '' : p.code)}
                    >
                      <title>{regionName(p.code, lang)}</title>
                    </path>
                  );
                })}
                {/* store markers */}
                {stores.map(s => {
                  if (s.lat === null || s.lng === null) return null;
                  const [x, y] = project(s.lng, s.lat);
                  const visible = !selectedRegion || s.region_code === selectedRegion;
                  return (
                    <g key={s.id} opacity={visible ? 1 : 0.15} className="cursor-pointer" onClick={() => visible && openStore(s)}>
                      <circle cx={x} cy={y} r={selectedRegion ? 9 : 7} fill={markerColor(s)} stroke="#fff" strokeWidth="2" />
                      <text x={x} y={y + 3.2} textAnchor="middle" fontSize="8">{typeIcon(s.type)}</text>
                      {selectedRegion === s.region_code && (
                        <text x={x} y={y - 13} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0F2540">{s.name}</text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* store popup */}
              {storeDetail && (
                <div className="absolute top-3 right-3 w-[320px] max-w-[85%] bg-white rounded-2xl border border-slate-200 shadow-xl z-10">
                  <div className="flex items-start justify-between px-4 pt-3.5">
                    <div>
                      <div className="font-bold text-[13.5px] text-slate-900">{storeDetail.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {storeDetail.city} · {regionName(storeDetail.region_code, lang)}
                      </div>
                    </div>
                    <button onClick={() => setStoreDetail(null)} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="px-4 py-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                      <div className="text-slate-400">{tr('store_type')}</div>
                      <div className="font-semibold text-slate-700">{tr('type_' + storeDetail.type)}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                      <div className="text-slate-400">7 {tr('days7').toLowerCase()}</div>
                      <div className={`font-bold tabular-nums ${storeDetail.change_pct && storeDetail.change_pct > 0 ? 'text-red-600' : storeDetail.change_pct && storeDetail.change_pct < 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {storeDetail.change_pct === null ? '—' : fmtPct(storeDetail.change_pct)}
                      </div>
                    </div>
                    {storeDetail.lat !== null && (
                      <div className="col-span-2 rounded-lg bg-slate-50 px-2.5 py-1.5 flex justify-between">
                        <span className="text-slate-400">{tr('gps')}</span>
                        <span className="font-mono text-slate-600">{storeDetail.lat.toFixed(4)}, {storeDetail.lng?.toFixed(4)}</span>
                      </div>
                    )}
                  </div>
                  <div className="px-4 pb-3.5">
                    <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{tr('last_updates')}</div>
                    {storePrices.length === 0 && <div className="text-[11px] text-slate-400">...</div>}
                    {storePrices.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                        <div className="text-[11.5px] text-slate-700 truncate pr-2">{p.product?.name_ru} · {fmtDate(p.collected_at, lang)}</div>
                        <div className="text-[11.5px] font-bold text-slate-900 tabular-nums shrink-0">{fmtKzt(p.price, lang)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="mt-2 text-[10.5px] text-slate-400">
              © OpenStreetMap contributors (ODbL) · {tr('demo_addr_note')}
            </p>
          </CardBody>
        </Card>

        {/* REGION STATS */}
        <Card>
          <CardBody className="flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <MapPinned className="w-4.5 h-4.5 w-[18px] h-[18px] text-[#1E4E8C]" />
              <h3 className="font-bold text-slate-800 text-[14px]">
                {selectedRegion ? regionName(selectedRegion, lang) : tr('region_stats')}
              </h3>
            </div>
            {!selectedRegion && (
              <div className="text-sm text-slate-400 leading-relaxed flex-1 flex items-center justify-center text-center px-4">
                {tr('select_region')} ↓
              </div>
            )}
            {selectedRegion && statsLoading && <div className="text-sm text-slate-400 py-8 text-center">{tr('loading')}</div>}
            {selectedRegion && !statsLoading && regionStats && (
              <div className="space-y-4 overflow-y-auto max-h-[560px] pr-1">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                    <div className="text-[10.5px] text-slate-400">{tr('stores_count_lbl')}</div>
                    <div className="text-xl font-bold text-slate-900">{regionStats.stores_count}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                    <div className="text-[10.5px] text-slate-400">{tr('products_monitored')}</div>
                    <div className="text-xl font-bold text-slate-900">{regionStats.products_monitored}</div>
                  </div>
                </div>

                {regionStats.stores_count === 0 && <EmptyState text={tr('no_region_data')} />}

                {/* dynamics */}
                {dyn.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 mb-1.5">{tr('price_trend')} (14 {tr('days14').replace('14', '')})</div>
                    <svg viewBox="0 0 300 70" className="w-full h-auto">
                      <polyline
                        fill="none" stroke="#1E4E8C" strokeWidth="2" strokeLinecap="round"
                        points={dyn.map((d: any, i: number) => {
                          const x = 10 + (i / Math.max(1, dyn.length - 1)) * 280;
                          const y = 10 + (1 - (d.value - dynMin) / (dynMax - dynMin || 1)) * 50;
                          return `${x},${y}`;
                        }).join(' ')}
                      />
                    </svg>
                  </div>
                )}

                {/* avg prices */}
                {regionStats.average_prices?.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 mb-2">{tr('avg_prices')}</div>
                    <div className="space-y-1">
                      {regionStats.average_prices.slice(0, 8).map((p: any, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="text-[12px] text-slate-700 flex-1 truncate">{p.name}</div>
                          <div className="text-[12px] font-bold text-slate-900 tabular-nums">{fmtKzt(p.avg, lang)}<span className="text-[10px] text-slate-400 font-normal">{unitLabel(p.unit, lang) === 'кг' || unitLabel(p.unit, lang) === 'kg' ? '/кг' : unitLabel(p.unit, lang) === 'л' || unitLabel(p.unit, lang) === 'L' ? '/л' : ''}</span></div>
                          <span className={`text-[10.5px] font-bold tabular-nums w-14 text-right ${p.change_pct > 0 ? 'text-red-600' : p.change_pct < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {p.change_pct > 0 ? '+' : ''}{p.change_pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-red-600 mb-1.5 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> {tr('most_expensive')}</div>
                    {(regionStats.most_expensive || []).map((p: any, i: number) => (
                      <div key={i} className="flex justify-between text-[11.5px] py-0.5"><span className="text-slate-600">{p.name}</span><b className="tabular-nums">{fmtKzt(p.avg, lang)}</b></div>
                    ))}
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-emerald-600 mb-1.5 flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" /> {tr('cheapest')}</div>
                    {(regionStats.cheapest || []).map((p: any, i: number) => (
                      <div key={i} className="flex justify-between text-[11.5px] py-0.5"><span className="text-slate-600">{p.name}</span><b className="tabular-nums">{fmtKzt(p.avg, lang)}</b></div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
