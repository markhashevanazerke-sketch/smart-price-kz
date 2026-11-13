'use client';
// SMART PRICE — History & audit log.

import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { useSP } from '@/lib/sp/context';
import { PageHeader, Card, EmptyState, Select } from '@/components/sp/ui';
import { fmtDateTime } from '@/lib/sp/format';

export default function HistoryPage() {
  const { tr, lang } = useSP();
  const [rows, setRows] = useState<any[]>([]);
  const [actors, setActors] = useState<any[]>([]);
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (actor) params.set('actor', actor);
    if (action) params.set('action', action);
    fetch('/api/sp/audit?' + params.toString())
      .then(r => r.json())
      .then(j => { setRows(j.rows || []); setActors(j.actors || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [actor, action]);

  const actionLabel = (a: string) => {
    const map: Record<string, string> = {
      'price.create': 'price · create',
      'price.update': 'price · update',
      'price.delete': 'price · delete',
      'price.import': 'price · import',
      'product.create': 'product · create',
      'product.update': 'product · update',
      'product.delete': 'product · delete',
      'store.create': 'store · create',
      'store.update': 'store · update',
      'store.delete': 'store · delete',
      'anomaly.decision': 'anomaly · decision',
      'anomaly.detected': 'AI · anomaly detected',
      'comment.create': 'comment · create',
      'evidence.create': 'evidence · create',
      'evidence.delete': 'evidence · delete',
      'user.create': 'user · create',
      'user.update': 'user · update',
      'user.delete': 'user · delete',
      'analytics.run': 'AI · analysis run',
      'seed.run': 'system · seed',
    };
    return map[a] || a;
  };

  return (
    <div className="p-6 max-w-[1300px] mx-auto">
      <PageHeader title={tr('history_title')} subtitle={tr('history_subtitle')} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={actor} onChange={e => setActor(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs max-w-[240px]">
          <option value="">{tr('filter_actor')}</option>
          {actors.map(a => <option key={a.actor} value={a.actor}>{a.actor}</option>)}
        </select>
        <select value={action} onChange={e => setAction(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs">
          <option value="">{tr('filter_action')}</option>
          {['price', 'product', 'store', 'anomaly', 'comment', 'evidence', 'user', 'analytics', 'AI'].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400 ml-auto">{rows.length} {tr('rows_total')}</span>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                <th className="px-5 py-3 font-semibold">{tr('time')}</th>
                <th className="px-4 py-3 font-semibold">{tr('actor')}</th>
                <th className="px-4 py-3 font-semibold">{tr('action')}</th>
                <th className="px-4 py-3 font-semibold">{tr('entity')}</th>
                <th className="px-4 py-3 font-semibold">ID</th>
                <th className="px-4 py-3 font-semibold">{tr('details')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">{tr('loading')}</td></tr>}
              {!loading && rows.map(r => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-2.5 text-[11.5px] text-slate-500 tabular-nums whitespace-nowrap">{fmtDateTime(r.created_at, lang)}</td>
                  <td className="px-4 py-2.5 text-[12.5px] font-semibold text-slate-700 whitespace-nowrap">
                    {r.actor}
                    {r.role && <span className="ml-1.5 text-[10px] font-bold uppercase text-slate-400">{r.role}</span>}
                  </td>
                  <td className="px-4 py-2.5"><code className="text-[11px] bg-slate-100 rounded px-1.5 py-0.5 text-slate-600">{actionLabel(r.action)}</code></td>
                  <td className="px-4 py-2.5 text-[12px] text-slate-500">{r.entity || '—'}</td>
                  <td className="px-4 py-2.5 text-[10.5px] font-mono text-slate-400">{r.entity_id ? r.entity_id.slice(0, 14) + '…' : '—'}</td>
                  <td className="px-4 py-2.5 text-[11px] text-slate-400 max-w-[300px] truncate" title={r.details || ''}>{r.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && <EmptyState text={tr('no_data')} />}
        </div>
      </Card>
    </div>
  );
}
