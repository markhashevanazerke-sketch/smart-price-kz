'use client';
// SMART PRICE — shared UI primitives.

import React, { useEffect, useState as useStateAny } from 'react';
import { X } from 'lucide-react';
import { useSP } from '@/lib/sp/context';

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1 max-w-3xl">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(16,42,83,0.05)] ${className}`}>{children}</div>;
}

export function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function StatCard({ label, value, sub, icon: Icon, tone = 'navy', trend }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; icon: any;
  tone?: 'navy' | 'green' | 'red' | 'amber' | 'sky' | 'violet'; trend?: number | null;
}) {
  const tones: Record<string, string> = {
    navy: 'from-[#12315A] to-[#1E4E8C]',
    green: 'from-emerald-500 to-emerald-600',
    red: 'from-red-500 to-rose-600',
    amber: 'from-amber-500 to-orange-500',
    sky: 'from-sky-500 to-blue-600',
    violet: 'from-violet-500 to-purple-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(16,42,83,0.05)] p-5 relative overflow-hidden group">
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${tones[tone]} opacity-[0.07] group-hover:opacity-[0.12] transition-opacity`} />
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-slate-500">{label}</span>
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${tones[tone]} text-white flex items-center justify-center shadow-sm`}>
          <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
        </div>
      </div>
      <div className="mt-3 text-[26px] leading-none font-bold text-slate-900 tabular-nums">{value}</div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {trend !== undefined && trend !== null && (
          <span className={`font-semibold ${trend > 0 ? 'text-red-600' : trend < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
            {trend > 0 ? '▲' : trend < 0 ? '▼' : '—'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }: {
  open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; wide?: boolean;
}) {
  const { tr } = useSP();
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} max-h-[88vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-[15px]">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-4.5 h-4.5 w-[18px] h-[18px]" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Btn({ children, onClick, variant = 'primary', type = 'button', disabled = false, className = '' }: {
  children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'success' | 'outline';
  type?: 'button' | 'submit'; disabled?: boolean; className?: string;
}) {
  const styles: Record<string, string> = {
    primary: 'bg-[#12315A] hover:bg-[#1a4477] text-white shadow-sm',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-600',
    danger: 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm',
    outline: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300',
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export const Input = React.forwardRef<HTMLInputElement, any>(function Input({ className = '', ...rest }, ref) {
  return (
    <input
      ref={ref}
      {...rest}
      className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400 ${className}`}
    />
  );
});

export function Select({ className = '', children, ...rest }: any) {
  return (
    <select
      {...rest}
      className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all ${className}`}
    >
      {children}
    </select>
  );
}

export function Field({ label, children, required = false }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold text-slate-600 mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</span>
      {children}
    </label>
  );
}

export function StatusPill({ status, tr }: { status: string; tr: (k: string) => string }) {
  const map: Record<string, { cls: string; key?: string }> = {
    pending: { cls: 'bg-amber-50 text-amber-700 border-amber-200', key: 'status_pending' },
    verified: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', key: 'status_verified' },
    flagged: { cls: 'bg-red-50 text-red-700 border-red-200', key: 'status_flagged' },
    new: { cls: 'bg-sky-50 text-sky-700 border-sky-200', key: 'stat_new' },
    review: { cls: 'bg-amber-50 text-amber-700 border-amber-200', key: 'stat_review' },
    confirmed: { cls: 'bg-red-50 text-red-700 border-red-200', key: 'stat_confirmed' },
    dismissed: { cls: 'bg-slate-100 text-slate-600 border-slate-200', key: 'stat_dismissed' },
    active: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', key: 'status_active' },
    paused: { cls: 'bg-slate-100 text-slate-600 border-slate-200', key: 'status_paused' },
    suggested: { cls: 'bg-amber-50 text-amber-700 border-amber-200', key: 'match_suggested' },
    rejected: { cls: 'bg-slate-100 text-slate-600 border-slate-200', key: 'match_rejected' },
    manual: { cls: 'bg-sky-50 text-sky-700 border-sky-200', key: 'source_manual' },
    excel: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', key: 'source_excel' },
    photo: { cls: 'bg-violet-50 text-violet-700 border-violet-200', key: 'source_photo' },
    demo: { cls: 'bg-amber-50 text-amber-700 border-amber-200', key: 'source_demo' },
  };
  const m = map[status] || { cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${m.cls}`}>
      {m.key ? tr(m.key) : status}
    </span>
  );
}

export function SeverityPill({ severity, tr }: { severity: string; tr: (k: string) => string }) {
  const map: Record<string, string> = {
    high: 'bg-red-50 text-red-700 border-red-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-sky-50 text-sky-700 border-sky-200',
  };
  const key = severity === 'high' ? 'sev_high' : severity === 'medium' ? 'sev_medium' : 'sev_low';
  // severity labels come from type_* fallback: use generic
  const label = severity === 'high' ? 'HIGH' : severity === 'medium' ? 'MED' : 'LOW';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold tracking-wide ${map[severity] || map.low}`}>
      {label}
    </span>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-14 text-center">
      <div className="text-3xl mb-3">📭</div>
      <div className="text-sm text-slate-400">{text}</div>
    </div>
  );
}

export function Change({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || isNaN(value)) return <span className="text-slate-400 text-xs">—</span>;
  const cls = value > 0.05 ? 'text-red-600 bg-red-50 border-red-200' : value < -0.05 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-slate-500 bg-slate-50 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11.5px] font-bold tabular-nums ${cls}`}>
      {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

export function useSPData(url: string, deps: any[] = []) {
  const [data, setData] = useStateAny(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    setLoading(true);
    fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [url, ...deps]);
  return { data, loading, error, reload: load };
}
