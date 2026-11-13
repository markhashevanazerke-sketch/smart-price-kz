'use client';
// SMART PRICE — Price Verification: anomaly queue, history, comments, decisions, evidence.

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck, MessageSquare, Camera, History as HistoryIcon,
  CheckCircle2, XCircle, Send, Flag, UserPlus,
} from 'lucide-react';
import { useSP, spFetch } from '@/lib/sp/context';
import { PageHeader, Card, CardBody, Btn, Modal, Field, Input, EmptyState, SeverityPill, StatusPill, Change } from '@/components/sp/ui';
import { fmtKzt, fmtDate, fmtDateTime, productName, unitLabel } from '@/lib/sp/format';
import { toast } from 'sonner';

export default function VerificationPage() {
  return (
    <Suspense fallback={null}>
      <VerificationPageInner />
    </Suspense>
  );
}

function VerificationPageInner() {
  const { tr, lang, currentUser } = useSP();
  const search = useSearchParams();
  const [rows, setRows] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [status, setStatus] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [type, setType] = useState('all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [tab, setTab] = useState<'history' | 'comments' | 'evidence'>('history');
  const canDecide = currentUser?.role === 'analyst' || currentUser?.role === 'admin';

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (severity !== 'all') params.set('severity', severity);
    if (type !== 'all') params.set('type', type);
    if (q) params.set('q', q);
    const j = await fetch('/api/sp/analytics?' + params.toString()).then(r => r.json());
    setRows(j.rows || []);
    setCounts(j.counts || {});
  }, [status, severity, type, q]);
  useEffect(() => { load(); }, [load]);

  const openDetail = useCallback(async (id: string) => {
    setOpenId(id);
    setDetail(null); setHistory([]); setComments([]); setEvidence([]);
    setDecisionNote(''); setCommentText('');
    const j = await fetch('/api/sp/analytics').then(r => r.json());
    const a = (j.rows || []).find((x: any) => x.id === id);
    setDetail(a || null);
    if (a) {
      const h = await fetch(`/api/sp/prices?product_id=${a.product_id}&store_id=${a.store_id}&sort=date-asc&page_size=100`).then(r => r.json());
      setHistory(h.rows || []);
      const c = await fetch(`/api/sp/comments?ref_type=anomaly&ref_id=${id}`).then(r => r.json()).catch(() => []);
      setComments(Array.isArray(c) ? c : []);
      const e = await fetch(`/api/sp/evidence?price_entry_id=${a.price_entry_id || ''}&store_id=${a.store_id}`).then(r => r.json()).catch(() => []);
      setEvidence(Array.isArray(e) ? e : []);
    }
  }, []);

  // auto-open from ?open= (demo scenario step 6)
  useEffect(() => {
    const open = search.get('open');
    if (open) {
      const t = setTimeout(() => { openDetail(open); window.history.replaceState({}, '', '/verification'); }, 400);
      return () => clearTimeout(t);
    }
  }, [search, openDetail]);

  const decide = async (newStatus: 'confirmed' | 'dismissed' | 'review') => {
    if (!detail) return;
    try {
      await spFetch('/api/sp/analytics/decision', {
        method: 'POST',
        body: JSON.stringify({ id: detail.id, status: newStatus, note: decisionNote || undefined }),
      });
      toast.success(tr('decision_saved'));
      load();
      openDetail(detail.id);
    } catch (e: any) { toast.error(e.message); }
  };

  const sendComment = async (cType: 'comment' | 'flag' | 'conclusion' | 'transfer') => {
    if (!detail || !commentText.trim()) return;
    try {
      await spFetch('/api/sp/comments', {
        method: 'POST',
        body: JSON.stringify({ ref_type: 'anomaly', ref_id: detail.id, type: cType, content: commentText.trim(), decision: cType === 'conclusion' ? 'confirmed' : null }),
      });
      toast.success(tr('comment_added'));
      setCommentText('');
      const c = await fetch(`/api/sp/comments?ref_type=anomaly&ref_id=${detail.id}`).then(r => r.json()).catch(() => []);
      setComments(Array.isArray(c) ? c : []);
      if (cType === 'conclusion') decide('confirmed');
    } catch (e: any) { toast.error(e.message); }
  };

  const typeKey = (t: string) => t === 'spike' ? 'type_spike' : t === 'drop' ? 'type_drop' : 'type_outlier';

  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <PageHeader title={tr('verif_title')} subtitle={tr('verif_subtitle')} />

      {/* status tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {[['all', tr('all')], ['new', tr('stat_new')], ['review', tr('stat_review')], ['confirmed', tr('stat_confirmed')], ['dismissed', tr('stat_dismissed')]].map(([id, label]) => (
          <button key={id} onClick={() => setStatus(id)}
            className={`px-4 py-2 rounded-xl text-[12.5px] font-semibold border transition-colors ${status === id ? 'bg-[#12315A] text-white border-[#12315A]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            {label}
            {counts[id] !== undefined && <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10.5px] ${status === id ? 'bg-white/20' : 'bg-slate-100'}`}>{counts[id]}</span>}
          </button>
        ))}
        <div className="flex-1" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={tr('search_ph')}
          className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs w-52 outline-none focus:border-blue-400" />
        <select value={severity} onChange={e => setSeverity(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs">
          <option value="all">{tr('severity_lbl')}</option>
          <option value="high">HIGH</option><option value="medium">MED</option><option value="low">LOW</option>
        </select>
        <select value={type} onChange={e => setType(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs">
          <option value="all">{tr('type_spike')} / …</option>
          <option value="spike">{tr('type_spike')}</option>
          <option value="drop">{tr('type_drop')}</option>
          <option value="outlier">{tr('type_outlier')}</option>
        </select>
      </div>

      {/* queue */}
      <div className="space-y-2.5">
        {rows.length === 0 && <Card><EmptyState text={tr('no_anomalies_verif')} /></Card>}
        {rows.map(a => (
          <Card key={a.id} className={`cursor-pointer transition-all hover:border-blue-300 ${openId === a.id ? 'border-blue-400 ring-2 ring-blue-100' : ''}`} >
            <div onClick={() => openDetail(a.id)} className="p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${a.severity === 'high' ? 'bg-red-50 text-red-600' : a.severity === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'}`}>
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[13.5px] text-slate-900">{a.product_name}</span>
                  <SeverityPill severity={a.severity} tr={tr} />
                  <StatusPill status={a.status} tr={tr} />
                  <span className="text-[10.5px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-semibold">{tr(typeKey(a.type))}</span>
                </div>
                <div className="text-[12px] text-slate-500 mt-1 truncate">{a.store_name} · {a.city} · {a.metric}{a.change_pct !== null ? ` · ${a.change_pct > 0 ? '+' : ''}${a.change_pct}%` : ''}</div>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <div className="text-[12px] text-slate-400 tabular-nums">{fmtKzt(a.prev_price, lang)} → <b className="text-slate-800">{fmtKzt(a.new_price, lang)}</b></div>
                <div className="text-[10.5px] text-slate-400 mt-0.5">{fmtDate(a.detected_at, lang)}</div>
              </div>
              <button className="text-xs text-blue-700 font-bold hover:underline shrink-0">{tr('open')} →</button>
            </div>
          </Card>
        ))}
      </div>

      {/* DETAIL MODAL */}
      <Modal open={!!openId} onClose={() => { setOpenId(null); setDetail(null); }} title={detail ? `${detail.product_name} — ${detail.store_name}` : ''} wide>
        {detail && (
          <div id="sp-demo-anomaly-modal">
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <SeverityPill severity={detail.severity} tr={tr} />
              <StatusPill status={detail.status} tr={tr} />
              <span className="text-[11px] px-2 py-1 rounded-md bg-slate-100 text-slate-500 font-semibold">{tr(typeKey(detail.type))} · {detail.metric}</span>
              {detail.change_pct !== null && <Change value={detail.change_pct} />}
              <span className="text-[11px] text-slate-400 ml-auto">{tr('detected')}: {fmtDateTime(detail.detected_at, lang)}</span>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mb-4 text-[13px] text-slate-700 leading-relaxed">
              {detail.message}
              <div className="mt-2 flex items-center gap-3 text-[13px]">
                <span className="text-slate-400">{tr('prev_new')}:</span>
                <b className="tabular-nums">{fmtKzt(detail.prev_price, lang)}</b>
                <span className="text-slate-400">→</span>
                <b className="tabular-nums text-slate-900">{fmtKzt(detail.new_price, lang)}</b>
                <span className="text-[11px] text-slate-400">({detail.product_amount !== undefined ? detail.amount : ''} {unitLabel(detail.unit, lang)})</span>
              </div>
            </div>

            {/* tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-4">
              {(['history', 'comments', 'evidence'] as const).map(t => (
                <button key={t} id={t === 'history' ? 'sp-demo-history-tab' : undefined}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${tab === t ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                  {t === 'history' ? <HistoryIcon className="w-3.5 h-3.5" /> : t === 'comments' ? <MessageSquare className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
                  {tr(t === 'history' ? 'history_tab' : t === 'comments' ? 'comments_tab' : 'evidence_tab')}
                </button>
              ))}
            </div>

            {tab === 'history' && (
              <div id="sp-demo-history" className="max-h-[260px] overflow-y-auto rounded-xl border border-slate-100">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="text-left text-[10.5px] uppercase text-slate-400">
                      <th className="px-4 py-2">{tr('date')}</th><th className="px-4 py-2 text-right">{tr('current_price')}</th>
                      <th className="px-4 py-2 text-right">{tr('price_per_unit')}</th><th className="px-4 py-2">{tr('change')}</th><th className="px-4 py-2">{tr('entered_by')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().map(h => (
                      <tr key={h.id} className="border-t border-slate-50">
                        <td className="px-4 py-2 text-slate-500 tabular-nums">{fmtDate(h.collected_at, lang)}</td>
                        <td className="px-4 py-2 text-right font-bold text-slate-800 tabular-nums">{fmtKzt(h.price, lang)}</td>
                        <td className="px-4 py-2 text-right text-slate-500 tabular-nums">{h.price_per_unit ? fmtKzt(h.price_per_unit, lang) : '—'}</td>
                        <td className="px-4 py-2"><Change value={h.change_pct} /></td>
                        <td className="px-4 py-2 text-slate-400">{h.entered_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'comments' && (
              <div className="space-y-3">
                <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                  {comments.length === 0 && <div className="text-xs text-slate-400 text-center py-6">{tr('no_data')}</div>}
                  {comments.map(c => (
                    <div key={c.id} className={`rounded-xl border p-3 ${c.type === 'conclusion' ? 'border-violet-200 bg-violet-50/50' : 'border-slate-100 bg-slate-50/50'}`}>
                      <div className="flex items-center gap-2 text-[11px]">
                        <b className="text-slate-700">{c.author}</b>
                        <span className="text-slate-400">· {c.role} · {fmtDateTime(c.created_at, lang)}</span>
                        {c.decision && <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded ${c.decision === 'confirmed' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{c.decision}</span>}
                      </div>
                      <div className="text-[12.5px] text-slate-600 mt-1.5 leading-relaxed">{c.content}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder={tr('comment_ph')} />
                  <Btn variant="ghost" onClick={() => sendComment('comment')} title={tr('send')}><Send className="w-4 h-4" /></Btn>
                  <Btn variant="danger" onClick={() => sendComment('flag')} title={tr('flag_incorrect')}><Flag className="w-4 h-4" /></Btn>
                  <Btn variant="outline" onClick={() => sendComment('transfer')} title={tr('transfer_to_analyst')}><UserPlus className="w-4 h-4" /></Btn>
                  {canDecide && <Btn variant="success" onClick={() => sendComment('conclusion')}><CheckCircle2 className="w-4 h-4" /> {tr('conclusion')}</Btn>}
                </div>
              </div>
            )}

            {tab === 'evidence' && (
              <div className="space-y-2">
                {evidence.length === 0 && <EmptyState text={tr('no_data')} />}
                {evidence.map(ev => (
                  <div key={ev.id} className="flex gap-3 rounded-xl border border-slate-100 p-3">
                    {ev.photo_b64 && <img src={ev.photo_b64} alt="" className="w-24 h-24 object-cover rounded-lg border border-slate-200" />}
                    <div className="min-w-0 text-xs">
                      <div className="font-semibold text-slate-700">{ev.employee_name}</div>
                      <div className="text-slate-400">{tr('checked_at')}: {fmtDateTime(ev.checked_at, lang)}</div>
                      {ev.comment && <div className="text-slate-500 mt-1">{ev.comment}</div>}
                      <div className="text-[10.5px] mt-1.5 text-slate-400">
                        {tr('evidence_ocr')}: {ev.ocr_price !== null ? `${ev.ocr_price} ₸ — ` : ''}{ev.ocr_status === 'matched' ? tr('ocr_matched') : ev.ocr_status === 'mismatched' ? tr('ocr_mismatched') : tr('ocr_pending')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* decision */}
            {canDecide && detail.status !== 'confirmed' && detail.status !== 'dismissed' && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <Field label={`${tr('decision')} · ${tr('decision_note')}`}>
                  <Input value={decisionNote} onChange={e => setDecisionNote(e.target.value)} placeholder={tr('decision_note')} />
                </Field>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Btn variant="success" onClick={() => decide('confirmed')}><CheckCircle2 className="w-4 h-4" /> {tr('confirm_anomaly')}</Btn>
                  <Btn variant="danger" onClick={() => decide('dismissed')}><XCircle className="w-4 h-4" /> {tr('dismiss_anomaly')}</Btn>
                  {detail.status === 'new' && <Btn variant="outline" onClick={() => decide('review')}><ShieldCheck className="w-4 h-4" /> {tr('send_review')}</Btn>}
                </div>
              </div>
            )}
            {detail.reviewer && (
              <div className="mt-3 text-[11.5px] text-slate-400">
                {tr('reviewer')}: <b className="text-slate-600">{detail.reviewer}</b>
                {detail.decision_note && <div className="mt-1 text-slate-500">{detail.decision_note}</div>}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
