'use client';
// SMART PRICE — application shell: sidebar navigation + topbar.

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, MapPinned, Package, Store, ClipboardList, BrainCircuit,
  ShieldCheck, History, FileBarChart, Users, Settings, Bell, Tag, ChevronDown,
  CheckCircle2, CircleAlert, Info, Sparkles,
} from 'lucide-react';
import { SPProvider, useSP, spFetch } from '@/lib/sp/context';
import { LANGS } from '@/lib/sp/i18n';
import { fmtDateTime } from '@/lib/sp/format';
import { DemoRunner } from '@/components/sp/DemoRunner';

const NAV = [
  { href: '/dashboard', key: 'nav_dashboard', icon: LayoutDashboard },
  { href: '/map', key: 'nav_map', icon: MapPinned },
  { href: '/products', key: 'nav_products', icon: Package },
  { href: '/stores', key: 'nav_stores', icon: Store },
  { href: '/monitoring', key: 'nav_monitoring', icon: ClipboardList },
  { href: '/ai', key: 'nav_ai', icon: BrainCircuit },
  { href: '/verification', key: 'nav_verification', icon: ShieldCheck },
  { href: '/history', key: 'nav_history', icon: History },
  { href: '/reports', key: 'nav_reports', icon: FileBarChart },
  { href: '/users', key: 'nav_users', icon: Users },
  { href: '/settings', key: 'nav_settings', icon: Settings },
];

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    specialist: 'bg-sky-100 text-sky-800 border-sky-200',
    analyst: 'bg-violet-100 text-violet-800 border-violet-200',
    admin: 'bg-amber-100 text-amber-800 border-amber-200',
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${map[role] || map.specialist}`}>
      {role}
    </span>
  );
}

function NotificationsBell() {
  const { tr, lang, unread, setUnread } = useSP();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch('/api/sp/notifications').then(r => r.json()).then(j => setItems(j.rows || [])).catch(() => {});
  }, [open]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as any)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const sevIcon = (sev: string) =>
    sev === 'danger' ? <CircleAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> :
    sev === 'warning' ? <CircleAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /> :
    sev === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> :
    <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />;

  return (
    <div className="relative" ref={ref} id="sp-demo-bell">
      <button
        onClick={() => { setOpen(!open); fetch('/api/sp/notifications').then(r => r.json()).then(j => setUnread(j.unread || 0)).catch(() => {}); }}
        className="relative w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center transition-colors"
        aria-label={tr('notifications')}
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-[400px] max-w-[90vw] bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="font-semibold text-sm">{tr('notifications')}</div>
            <button
              className="text-xs text-blue-700 hover:underline"
              onClick={() => { spFetch('/api/sp/notifications/read', { method: 'POST', body: '{}' }).catch(() => {}); setUnread(0); }}
            >
              {tr('mark_all_read')}
            </button>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {items.length === 0 && <div className="p-6 text-sm text-slate-400 text-center">{tr('notifications_empty')}</div>}
            {items.map(n => (
              <div key={n.id} className={`px-4 py-3 border-b border-slate-50 flex gap-2.5 ${n.read ? 'opacity-60' : ''}`}>
                {sevIcon(n.severity)}
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-slate-800 truncate">{n.title}</div>
                  {n.message && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</div>}
                  <div className="text-[10px] text-slate-400 mt-1">{fmtDateTime(n.created_at, lang)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { tr, users, currentUser, setCurrentUserId } = useSP();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as any)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#12315A] to-[#1E4E8C] text-white flex items-center justify-center text-xs font-bold">
          {(currentUser?.name || 'Г').split(' ').map(w => w[0]).slice(0, 2).join('')}
        </div>
        <div className="text-left hidden sm:block">
          <div className="text-[13px] font-semibold text-slate-800 leading-tight">{currentUser?.name || '...'}</div>
          {currentUser && <div className="text-[10px] text-slate-400">{tr('role_' + currentUser.role)}</div>}
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-72 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">{tr('switch_user')}</div>
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => { setCurrentUserId(u.id); setOpen(false); }}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors ${u.id === currentUser?.id ? 'bg-blue-50/60' : ''}`}
            >
              <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                {u.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-slate-800 truncate">{u.name}</div>
                <div className="text-[11px] text-slate-400">{tr('role_' + u.role)}</div>
              </div>
              <RoleBadge role={u.role} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LangSwitcher() {
  const { lang, setLang } = useSP();
  return (
    <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5">
      {LANGS.map(l => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={`px-2.5 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${lang === l.code ? 'bg-[#12315A] text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}
          title={l.label}
        >
          {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const { tr } = useSP();
  return (
    <aside className="w-[248px] shrink-0 bg-gradient-to-b from-[#0D2038] to-[#0B1B2E] text-white flex flex-col">
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center shadow-lg shadow-blue-950/60 group-hover:scale-105 transition-transform">
            <Tag className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold tracking-wide leading-tight">SMART PRICE</div>
            <div className="text-[10px] text-blue-300/60 tracking-widest uppercase">Food Intelligence</div>
          </div>
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(n => {
          const active = pathname?.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-medium transition-all group ${
                active ? 'bg-white/10 text-white' : 'text-blue-100/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className={`w-1 self-stretch rounded-full -ml-1 mr-0.5 transition-opacity ${active ? 'bg-blue-400 opacity-100' : 'opacity-0'}`} />
              <n.icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-blue-300' : 'text-blue-200/40 group-hover:text-blue-200'}`} />
              <span className="truncate">{tr(n.key)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-4 pb-5 pt-2 border-t border-white/10 space-y-2">
        <button
          onClick={() => { window.location.href = '/dashboard?demo=1'; }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500/90 to-blue-600/90 hover:from-blue-500 hover:to-blue-500 text-white text-[13px] font-semibold transition-all"
        >
          <Sparkles className="w-4 h-4" /> {tr('run_demo')}
        </button>
        <div className="flex items-center justify-between text-[10px] text-blue-200/40 px-1">
          <span>SQLite · REST API</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />online</span>
        </div>
      </div>
    </aside>
  );
}

function Topbar() {
  const { tr } = useSP();
  return (
    <header className="sp-topbar h-16 shrink-0 bg-white border-b border-slate-200 flex items-center gap-3 px-5">
      <div className="relative flex-1 max-w-md">
        <input
          placeholder={tr('search_ph')}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100/80 border border-transparent focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
              const v = encodeURIComponent((e.target as HTMLInputElement).value.trim());
              window.location.href = `/monitoring?q=${v}`;
            }
          }}
        />
        <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
      </div>
      <div className="flex-1" />
      <span className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> {tr('demo_badge')}
      </span>
      <LangSwitcher />
      <NotificationsBell />
      <UserMenu />
    </header>
  );
}

export default function SPLayout({ children }: { children: React.ReactNode }) {
  return (
    <SPProvider>
      <div className="h-screen flex overflow-hidden bg-[#F4F6FA]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      <DemoRunner />
    </SPProvider>
  );
}
