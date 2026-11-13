'use client';
// SMART PRICE — Main Dashboard.

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Package, Store, ClipboardList, ShoppingBasket, TrendingUp, ShieldAlert,
  ArrowUpRight, ArrowDownRight, Activity,
} from 'lucide-react';
import { useSP } from '@/lib/sp/context';
import { PageHeader, Card, CardBody, StatCard, Change, EmptyState } from '@/components/sp/ui';
import { fmtKzt, fmtPct, fmtDate, productName } from '@/lib/sp/format';

export default function DashboardPage() {
  const { tr, lang, currentUser } = useSP();
  const [s, setS] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch('/api/sp/summary').then(r => r.json()).then(d => { setS(d); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const i = setInterval(load, 15000);
    return () => clearInterval(i);
  }, []);

  const series = useMemo(() => (s?.series || []).filter((p: any) => p.value !== null), [s]);

  if (loading && !s) {
    return <div className="p-10 text-slate-400 text-sm">{tr('loading')}</div>;
  }

  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <PageHeader
        title={`${tr('dashboard_greeting')}, ${currentUser?.name?.split(' ')[0] || ''} 👋`}
        subtitle={tr('app_tagline')}
      >
        <span className="text-xs text-slate-400 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-emerald-500" />
          {new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'kk' ? 'kk-KZ' : 'ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </PageHeader>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label={tr('kpi_products')} value={s?.products_count ?? '—'} icon={Package} tone="navy" sub={tr('items')} />
        <StatCard label={tr('kpi_stores')} value={s?.stores_count ?? '—'} icon={Store} tone="sky" sub={tr('stores')} />
        <StatCard label={tr('kpi_prices')} value={s?.prices_count ?? '—'} icon={ClipboardList} tone="violet" sub={tr('rows_total')} />
        <StatCard
          label={tr('kpi_basket')}
          value={s?.basket_avg ? fmtKzt(s.basket_avg, lang) : '—'}
          icon={ShoppingBasket}
          tone="amber"
          trend={s?.basket_change_pct ?? null}
          sub={tr('basket_change')}
        />
        <StatCard label={tr('kpi_rising')} value={s?.rising_products ?? '—'} icon={TrendingUp} tone="red" sub="7 days" />
        <StatCard
          label={tr('kpi_suspicious')}
          value={s?.suspicious_count ?? '—'}
          icon={ShieldAlert}
          tone={s?.suspicious_count ? 'red' : 'green'}
          sub={<Link href="/verification" className="hover:underline">{tr('view_all')}</Link>}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
        {/* Basket dynamics chart */}
        <Card className="xl:col-span-2">
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-[14px]">{tr('chart_basket_title')}</h3>
              {s?.basket_change_pct !== null && s?.basket_change_pct !== undefined && (
                <ChangeBadge value={s.basket_change_pct} />
              )}
            </div>
            <BasketChart series={series} />
          </CardBody>
        </Card>

        {/* AI alerts */}
        <Card>
          <CardBody className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 text-[14px] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" /> {tr('alerts_title')}
              </h3>
              <Link href="/verification" className="text-xs text-blue-700 hover:underline font-semibold">{tr('view_all')}</Link>
            </div>
            {(!s?.notifications || s.notifications.length === 0) && <EmptyState text={tr('alerts_empty')} />}
            <div className="space-y-2.5 overflow-y-auto max-h-[340px] pr-1">
              {(s?.notifications || []).map((n: any) => (
                <div key={n.id} className={`rounded-xl border p-3 ${n.severity === 'danger' ? 'border-red-200 bg-red-50/50' : n.severity === 'warning' ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-slate-50/50'}`}>
                  <div className="text-[12.5px] font-semibold text-slate-800 leading-snug">{n.title}</div>
                  {n.message && <div className="text-[11.5px] text-slate-500 mt-1 line-clamp-2">{n.message}</div>}
                  <div className="text-[10px] text-slate-400 mt-1.5">{fmtDate(n.created_at, lang)} · {fmtKzt(0, lang) === '—' ? '' : ''}{new Date(n.created_at).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
        {/* Top rising */}
        <MoversCard title={tr('top_rising')} tone="up" rows={s?.top_rising || []} />
        {/* Top falling */}
        <MoversCard title={tr('top_falling')} tone="down" rows={s?.top_falling || []} />
        {/* Last updates */}
        <Card>
          <CardBody className="h-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 text-[14px]">{tr('last_updates')}</h3>
              <Link href="/monitoring" className="text-xs text-blue-700 hover:underline font-semibold">{tr('view_all')}</Link>
            </div>
            <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1">
              {(s?.last_updates || []).map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/40 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold text-slate-800 truncate">{productName(r.product, lang)}</div>
                    <div className="text-[11px] text-slate-400 truncate">{r.store?.name} · {r.store?.city}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[13px] font-bold text-slate-900 tabular-nums">{fmtKzt(r.price, lang)}</div>
                    <Change value={r.change_pct} />
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 mb-2 flex items-center gap-2 text-[11px] text-slate-400">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        {tr('demo_data_notice')}
      </div>
    </div>
  );
}

function ChangeBadge({ value }: { value: number }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${value > 0 ? 'bg-red-50 text-red-700 border-red-200' : value < 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
      {value > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
      {fmtPct(value)}
    </span>
  );
}

function MoversCard({ title, tone, rows }: { title: string; tone: 'up' | 'down'; rows: any[] }) {
  const { lang } = useSP();
  return (
    <Card>
      <CardBody className="h-full">
        <h3 className="font-bold text-slate-800 text-[14px] mb-3 flex items-center gap-2">
          {tone === 'up' ? <ArrowUpRight className="w-4 h-4 text-red-500" /> : <ArrowDownRight className="w-4 h-4 text-emerald-500" />}
          {title}
        </h3>
        {rows.length === 0 && <EmptyState text={tr_local(tone)} />}
        <div className="space-y-1.5">
          {rows.map((r: any, i: number) => (
            <div key={r.base_key + i} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0 ${tone === 'up' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium text-slate-700 truncate">{r.name}</div>
                <div className="text-[10.5px] text-slate-400 tabular-nums">
                  {fmtKzt(r.from, lang)} → {fmtKzt(r.to, lang)}
                </div>
              </div>
              <span className={`text-[12px] font-bold tabular-nums ${tone === 'up' ? 'text-red-600' : 'text-emerald-600'}`}>
                {r.change_pct > 0 ? '+' : ''}{r.change_pct}%
              </span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function tr_local(tone: string) {
  return tone === 'up' ? 'нет данных' : 'нет данных';
}

// Lightweight SVG line chart (no external deps needed)
function BasketChart({ series }: { series: { date: string; value: number }[] }) {
  const { lang } = useSP();
  const W = 720, H = 220, PAD = { l: 56, r: 16, t: 16, b: 28 };
  if (!series.length) return <EmptyState text="—" />;
  const vals = series.map(p => p.value).filter((v): v is number => v !== null);
  const min = Math.min(...vals) * 0.985, max = Math.max(...vals) * 1.015;
  const x = (i: number) => PAD.l + (i / Math.max(1, series.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min || 1)) * (H - PAD.t - PAD.b);
  const pts = series.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${PAD.l},${H - PAD.b} ${pts} ${W - PAD.r},${H - PAD.b}`;
  const gridLines = 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <defs>
        <linearGradient id="basketGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1E4E8C" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#1E4E8C" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const gy = PAD.t + (i / gridLines) * (H - PAD.t - PAD.b);
        const gv = max - (i / gridLines) * (max - min);
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={gy} y2={gy} stroke="#E6EAF2" strokeWidth="1" />
            <text x={PAD.l - 8} y={gy + 4} textAnchor="end" fontSize="10" fill="#94A3B8">{Math.round(gv).toLocaleString('ru-RU')}</text>
          </g>
        );
      })}
      <polygon points={area} fill="url(#basketGrad)" />
      <polyline points={pts} fill="none" stroke="#1E4E8C" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {series.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r="2.6" fill="#fff" stroke="#1E4E8C" strokeWidth="1.8" />
          {i % Math.ceil(series.length / 7) === 0 && (
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="9.5" fill="#94A3B8">
              {p.date.slice(5).replace('-', '.')}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
