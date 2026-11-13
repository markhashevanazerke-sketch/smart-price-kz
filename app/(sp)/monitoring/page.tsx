'use client';
// SMART PRICE — Price Monitoring: table + manual entry + Excel/CSV import + history + evidence.

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Plus, Upload, Download, Pencil, Trash2, Search, History as HistoryIcon,
  Camera, FileSpreadsheet, ChevronLeft, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { useSP, spFetch } from '@/lib/sp/context';
import { PageHeader, Card, Btn, Modal, Field, Input, Select, StatusPill, EmptyState, Change } from '@/components/sp/ui';
import { REGIONS, regionName } from '@/lib/sp/regions';
import { fmtKzt, fmtDate, fmtDateTime, productName, unitLabel } from '@/lib/sp/format';
import { toast } from 'sonner';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function MonitoringPage() {
  return (
    <Suspense fallback={null}>
      <MonitoringPageInner />
    </Suspense>
  );
}

function MonitoringPageInner() {
  const { tr, lang, currentUser } = useSP();
  const search = useSearchParams();

  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [q, setQ] = useState(search.get('q') || '');
  const [storeId, setStoreId] = useState('');
  const [region, setRegion] = useState('all');
  const [source, setSource] = useState('all');
  const [status, setStatus] = useState('all');
  const [flagged, setFlagged] = useState(false);
  const [sort, setSort] = useState('date-desc');
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);

  // modals
  const [priceModal, setPriceModal] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [editRow, setEditRow] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [historyRow, setHistoryRow] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [evidenceRow, setEvidenceRow] = useState<any>(null);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [evForm, setEvForm] = useState<any>({ comment: '', employee_name: '', photo: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    params.set('sort', sort);
    if (q) params.set('q', q);
    if (storeId) params.set('store_id', storeId);
    if (region !== 'all') params.set('region', region);
    if (source !== 'all') params.set('source', source);
    if (status !== 'all') params.set('status', status);
    if (flagged) params.set('flagged', '1');
    try {
      const j = await fetch('/api/sp/prices?' + params.toString()).then(r => r.json());
      setRows(j.rows || []);
      setTotal(j.total || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, pageSize, q, storeId, region, source, status, flagged, sort]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/sp/products').then(r => r.json()).then(setProducts).catch(() => {});
    fetch('/api/sp/stores').then(r => r.json()).then(setStores).catch(() => {});
  }, []);

  // demo prefill: ?new=1&demo=1 → open price form prefilled with oil 1L @ SmartMart
  useEffect(() => {
    if (search.get('new') === '1') {
      const isDemo = search.get('demo') === '1';
      setDemoMode(isDemo);
      const oil = products.find(p => p.base_key === 'oil-sunflower' && p.amount === 1) || products[0];
      const sm = stores.find(s => s.name === 'SmartMart (демо)' && s.city === 'Алматы') || stores[0];
      if (oil && sm) {
        setForm({ product_id: oil.id, store_id: sm.id, price: '', collected_at: todayStr(), note: isDemo ? 'Демо-сценарий' : '' });
        setEditRow(null);
        setPriceModal(true);
        // clean URL
        window.history.replaceState({}, '', '/monitoring');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, stores]);

  const openCreate = () => {
    setEditRow(null);
    setDemoMode(false);
    setForm({ product_id: '', store_id: '', price: '', collected_at: todayStr(), note: '' });
    setPriceModal(true);
  };

  const openEdit = (r: any) => {
    setEditRow(r);
    setDemoMode(false);
    setForm({ product_id: r.product_id, store_id: r.store_id, price: String(r.price), collected_at: r.collected_at, note: r.note || '' });
    setPriceModal(true);
  };

  const savePrice = async () => {
    setSaving(true);
    try {
      const body = { ...form, price: parseFloat(String(form.price).replace(',', '.')) };
      if (editRow) {
        const res = await spFetch('/api/sp/prices', { method: 'PUT', body: JSON.stringify({ id: editRow.id, ...body }) });
        toast.success(tr('price_saved'));
        if (res.detection?.anomalies?.length) toast.warning(tr('anomaly_on_save'));
      } else {
        const res = await spFetch('/api/sp/prices', { method: 'POST', body: JSON.stringify(body) });
        toast.success(tr('price_added'));
        if (res.detection?.anomalies?.length) {
          toast.warning(`${tr('anomaly_on_save')} (${res.detection.anomalies.length})`);
        }
      }
      setPriceModal(false);
      load();
    } catch (e: any) {
      if (e.status === 409) toast.error(tr('dup_error'));
      else toast.error(e.details ? `${tr('invalid_error')}: ${e.details.join('; ')}` : e.message);
    } finally {
      setSaving(false);
    }
  };

  const del = async (r: any) => {
    if (!confirm(tr('delete_confirm'))) return;
    try {
      await spFetch(`/api/sp/prices?id=${r.id}`, { method: 'DELETE' });
      toast.success(tr('price_deleted'));
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const openHistory = async (r: any) => {
    setHistoryRow(r);
    setHistory([]);
    const j = await fetch(`/api/sp/prices?product_id=${r.product_id}&store_id=${r.store_id}&sort=date-asc&page_size=100`).then(x => x.json());
    setHistory(j.rows || []);
  };

  const openEvidence = async (r: any) => {
    setEvidenceRow(r);
    setEvForm({ comment: '', employee_name: currentUser?.name || '', photo: '' });
    setEvidence([]);
    try {
      const j = await spFetch(`/api/sp/evidence?price_entry_id=${r.id}`);
      setEvidence(j);
    } catch { /* ignore */ }
  };

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { toast.error(tr('photo_ph')); return; }
    const reader = new FileReader();
    reader.onload = () => setEvForm(v => ({ ...v, photo: String(reader.result) }));
    reader.readAsDataURL(f);
  };

  const saveEvidence = async () => {
    if (!evForm.photo) { toast.error(tr('photo_ph')); return; }
    try {
      await spFetch('/api/sp/evidence', {
        method: 'POST',
        body: JSON.stringify({
          price_entry_id: evidenceRow.id,
          store_id: evidenceRow.store_id,
          product_id: evidenceRow.product_id,
          photo_b64: evForm.photo,
          employee_name: evForm.employee_name,
          comment: evForm.comment,
          checked_at: new Date().toISOString(),
        }),
      });
      toast.success(tr('evidence_added'));
      openEvidence(evidenceRow);
    } catch (e: any) { toast.error(e.message); }
  };

  const doImport = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const headers: Record<string, string> = {
      'x-user-name': encodeURIComponent(currentUser?.name || ''),
      'x-user-role': currentUser?.role || 'specialist',
    };
    setLoading(true);
    try {
      const r = await fetch('/api/sp/prices/import', { method: 'POST', body: fd, headers });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
      setImportResult(j);
      toast.success(`${tr('import_result')}: ${j.imported} ${tr('import_ok')}`);
      if (j.rejected?.length) toast.warning(`${j.rejected.length} ${tr('import_rejected')}`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader title={tr('monitoring_title')} subtitle={tr('monitoring_subtitle')}>
        <Btn variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4" /> {tr('import_file')}</Btn>
        <Btn onClick={openCreate}><Plus className="w-4 h-4" /> {tr('add_price')}</Btn>
      </PageHeader>

      {/* filters */}
      <Card className="mb-4">
        <div className="p-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder={tr('search_prices')}
              className="pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm w-56 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
          <select value={storeId} onChange={e => { setStoreId(e.target.value); setPage(1); }} className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs max-w-[220px]">
            <option value="">{tr('store')}</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name} — {s.city}</option>)}
          </select>
          <select value={region} onChange={e => { setRegion(e.target.value); setPage(1); }} className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs">
            <option value="all">{tr('region_filter')}</option>
            {REGIONS.map(r => <option key={r.code} value={r.code}>{regionName(r.code, lang)}</option>)}
          </select>
          <select value={source} onChange={e => { setSource(e.target.value); setPage(1); }} className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs">
            <option value="all">{tr('source')}</option>
            {['manual', 'excel', 'photo', 'demo'].map(s => <option key={s} value={s}>{tr('source_' + s)}</option>)}
          </select>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs">
            <option value="all">{tr('status_check')}</option>
            {['pending', 'verified', 'flagged'].map(s => <option key={s} value={s}>{tr('status_' + s)}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={flagged} onChange={e => { setFlagged(e.target.checked); setPage(1); }} className="rounded border-slate-300" />
            {tr('flagged_filter')}
          </label>
          <select value={sort} onChange={e => setSort(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs">
            <option value="date-desc">↓ {tr('date')}</option>
            <option value="date-asc">↑ {tr('date')}</option>
            <option value="price-desc">↓ {tr('current_price')}</option>
            <option value="name">{tr('product')}</option>
            <option value="store">{tr('store')}</option>
          </select>
          {(q || storeId || region !== 'all' || source !== 'all' || status !== 'all' || flagged) && (
            <button onClick={() => { setQ(''); setStoreId(''); setRegion('all'); setSource('all'); setStatus('all'); setFlagged(false); setPage(1); }}
              className="text-xs text-blue-700 hover:underline font-semibold">{tr('reset_filters')}</button>
          )}
        </div>
      </Card>

      {/* table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                <th className="px-5 py-3 font-semibold">{tr('product')}</th>
                <th className="px-3 py-3 font-semibold">{tr('store')}</th>
                <th className="px-3 py-3 font-semibold">{tr('region')}</th>
                <th className="px-3 py-3 font-semibold text-right">{tr('current_price')}</th>
                <th className="px-3 py-3 font-semibold text-right">{tr('prev_price')}</th>
                <th className="px-3 py-3 font-semibold text-right">{tr('price_per_unit')}</th>
                <th className="px-3 py-3 font-semibold">{tr('change')}</th>
                <th className="px-3 py-3 font-semibold">{tr('date')}</th>
                <th className="px-3 py-3 font-semibold">{tr('source')}</th>
                <th className="px-3 py-3 font-semibold">{tr('status_check')}</th>
                <th className="px-3 py-3 font-semibold text-right">{tr('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={11} className="px-5 py-10 text-center text-slate-400 text-sm">{tr('loading')}</td></tr>}
              {!loading && rows.map(r => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-semibold text-slate-800 text-[13px]">{productName(r.product, lang)}</div>
                    <div className="text-[10.5px] text-slate-400">{r.product?.amount} {unitLabel(r.product?.unit, lang)} · {r.product?.package}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-[12.5px] text-slate-700">{r.store?.name}</div>
                    <div className="text-[10.5px] text-slate-400">{r.store?.city}</div>
                  </td>
                  <td className="px-3 py-3 text-[11.5px] text-slate-500">{regionName(r.store?.region_code, lang)}</td>
                  <td className="px-3 py-3 text-right font-bold text-slate-900 tabular-nums">{fmtKzt(r.price, lang)}</td>
                  <td className="px-3 py-3 text-right text-slate-400 tabular-nums">{fmtKzt(r.prev_price, lang)}</td>
                  <td className="px-3 py-3 text-right text-slate-600 tabular-nums text-[12.5px]">{r.price_per_unit ? fmtKzt(r.price_per_unit, lang).replace('₸', '') + ' ' + unitLabel(r.product?.unit, lang) : '—'}</td>
                  <td className="px-3 py-3"><Change value={r.change_pct} /></td>
                  <td className="px-3 py-3 text-[12px] text-slate-500 tabular-nums">{fmtDate(r.collected_at, lang)}</td>
                  <td className="px-3 py-3"><StatusPill status={r.source} tr={tr} /></td>
                  <td className="px-3 py-3"><StatusPill status={r.status} tr={tr} /></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <button title={tr('price_history')} onClick={() => openHistory(r)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"><HistoryIcon className="w-3.5 h-3.5" /></button>
                      <button title={tr('add_evidence')} onClick={() => openEvidence(r)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"><Camera className="w-3.5 h-3.5" /></button>
                      <button title={tr('edit')} onClick={() => openEdit(r)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
                      <button title={tr('delete')} onClick={() => del(r)} className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && <EmptyState text={tr('no_prices')} />}
        </div>
        {/* pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
          <span className="text-xs text-slate-400">{total} {tr('rows_total')}</span>
          <div className="flex items-center gap-2">
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs">
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40 hover:bg-slate-50"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs text-slate-500 font-semibold">{page} / {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40 hover:bg-slate-50"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </Card>

      {/* PRICE MODAL */}
      <Modal open={priceModal} onClose={() => setPriceModal(false)} title={editRow ? tr('edit_price') : tr('add_price')}>
        <div id="sp-demo-price-form" className="space-y-4">
          <Field label={tr('product')} required>
            <Select value={form.product_id || ''} onChange={e => setForm({ ...form, product_id: e.target.value })} disabled={demoMode}>
              <option value="">{tr('select_product')}</option>
              {products.map(p => <option key={p.id} value={p.id}>{productName(p, lang)} — {p.amount} {unitLabel(p.unit, lang)}</option>)}
            </Select>
          </Field>
          <Field label={tr('store')} required>
            <Select value={form.store_id || ''} onChange={e => setForm({ ...form, store_id: e.target.value })} disabled={demoMode}>
              <option value="">—</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name} — {s.city}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${tr('current_price')}, ₸`} required>
              <Input id="sp-demo-price-input" type="number" min="1" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} disabled={demoMode} placeholder="1100" />
            </Field>
            <Field label={tr('date')} required>
              <Input type="date" value={form.collected_at} onChange={e => setForm({ ...form, collected_at: e.target.value })} disabled={demoMode} max={todayStr()} />
            </Field>
          </div>
          <Field label={tr('note')}><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} disabled={demoMode} /></Field>
          {form.product_id && (() => {
            const p = products.find(x => x.id === form.product_id);
            const price = parseFloat(String(form.price).replace(',', '.'));
            if (!p || !isFinite(price) || price <= 0) return null;
            return (
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-[12.5px] text-blue-900 flex items-center justify-between">
                <span>{tr('price_per_unit')}:</span>
                <b className="tabular-nums">{fmtKzt(Math.round(price / p.amount), lang)} / {unitLabel(p.unit, lang)}</b>
              </div>
            );
          })()}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setPriceModal(false)}>{tr('cancel')}</Btn>
          <Btn onClick={savePrice} disabled={saving} id="sp-demo-save-btn">
            <span id="sp-demo-save-spin" />{saving ? '...' : tr('save')}
          </Btn>
        </div>
      </Modal>

      {/* IMPORT MODAL */}
      <Modal open={importOpen} onClose={() => { setImportOpen(false); setImportResult(null); }} title={tr('import_file')}>
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/50 transition-colors p-8 text-center cursor-pointer"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) doImport(f); }}>
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <div className="text-sm font-semibold text-slate-700">{tr('import_file')}</div>
            <div className="text-xs text-slate-400 mt-1">CSV / XLSX · {tr('import_template')}</div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) doImport(f); }} />
          </div>
          <div className="flex gap-2">
            <a href="/api/sp/prices/template" className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[13px] font-semibold text-slate-700 transition-colors">
              <Download className="w-4 h-4" /> {tr('import_template')}
            </a>
            <a href="/api/sp/prices/template?format=csv" className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[13px] font-semibold text-slate-700 transition-colors">
              <Download className="w-4 h-4" /> {tr('import_template_csv')}
            </a>
          </div>
          {importResult && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs space-y-2">
              <div className="flex gap-4">
                <span className="text-emerald-700 font-bold">{importResult.imported} {tr('import_ok')}</span>
                <span className="text-amber-700 font-bold">{importResult.rejected?.length || 0} {tr('import_rejected')}</span>
                <span className="text-slate-500 font-bold">{importResult.skipped?.length || 0} {tr('import_skipped')}</span>
                <span className="text-red-600 font-bold">{importResult.anomaliesFound || 0} AI</span>
              </div>
              {importResult.rejected?.slice(0, 8).map((r: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-red-600">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{tr('import_rejected')} #{r.row}: {r.reason}</span>
                </div>
              ))}
              {importResult.skipped?.slice(0, 4).map((r: any, i: number) => (
                <div key={'s' + i} className="text-amber-600">#{r.row}: {r.reason}</div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* HISTORY MODAL */}
      <Modal open={!!historyRow} onClose={() => setHistoryRow(null)} title={`${tr('price_history')} — ${historyRow ? productName(historyRow.product, lang) : ''}`} wide>
        {historyRow && (
          <div>
            <div className="text-xs text-slate-400 mb-3">{historyRow.store?.name} · {historyRow.store?.city}</div>
            <MiniChart rows={history} />
            <div className="mt-4 max-h-[280px] overflow-y-auto rounded-xl border border-slate-100">
              <table className="w-full text-xs">
                <tbody>
                  {[...history].reverse().map(h => (
                    <tr key={h.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2 text-slate-500 tabular-nums">{fmtDate(h.collected_at, lang)}</td>
                      <td className="px-4 py-2 font-bold text-slate-800 tabular-nums">{fmtKzt(h.price, lang)}</td>
                      <td className="px-4 py-2 text-slate-500 tabular-nums">{h.price_per_unit ? fmtKzt(h.price_per_unit, lang) : '—'}</td>
                      <td className="px-4 py-2"><Change value={h.change_pct} /></td>
                      <td className="px-4 py-2 text-slate-400">{h.entered_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* EVIDENCE MODAL */}
      <Modal open={!!evidenceRow} onClose={() => setEvidenceRow(null)} title={tr('add_evidence')}>
        <div className="space-y-4">
          <Field label={tr('photo')} required>
            <input type="file" accept="image/*" onChange={onPhoto}
              className="w-full text-xs text-slate-500 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-[#12315A] file:text-white file:text-xs file:font-semibold hover:file:bg-[#1a4477] file:cursor-pointer" />
          </Field>
          {evForm.photo && <img src={evForm.photo} alt="preview" className="max-h-40 rounded-xl border border-slate-200" />}
          <Field label={tr('employee_name')}><Input value={evForm.employee_name} onChange={e => setEvForm({ ...evForm, employee_name: e.target.value })} /></Field>
          <Field label={tr('comment')}><Input value={evForm.comment} onChange={e => setEvForm({ ...evForm, comment: e.target.value })} placeholder={tr('comment_ph')} /></Field>
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-[11px] text-slate-500">
            {tr('evidence_ocr')}: {tr('ocr_pending')}
          </div>
          {evidence.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-slate-500 mb-2">{tr('evidence_tab')}</div>
              <div className="space-y-2">
                {evidence.map(ev => (
                  <div key={ev.id} className="flex gap-3 rounded-xl border border-slate-100 p-2.5">
                    {ev.photo_b64 && <img src={ev.photo_b64} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />}
                    <div className="min-w-0 text-xs">
                      <div className="font-semibold text-slate-700">{ev.employee_name}</div>
                      <div className="text-slate-400">{fmtDateTime(ev.checked_at, lang)}</div>
                      {ev.comment && <div className="text-slate-500 mt-1 line-clamp-2">{ev.comment}</div>}
                      <div className="text-[10px] text-slate-400 mt-1">{tr('evidence_ocr')}: {ev.ocr_status === 'matched' ? tr('ocr_matched') : ev.ocr_status === 'mismatched' ? tr('ocr_mismatched') : tr('ocr_pending')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setEvidenceRow(null)}>{tr('cancel')}</Btn>
            <Btn onClick={saveEvidence}><Camera className="w-4 h-4" /> {tr('save')}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MiniChart({ rows }: { rows: any[] }) {
  if (rows.length < 2) return null;
  const W = 760, H = 140, P = 14;
  const vals = rows.map(r => r.price);
  const min = Math.min(...vals), max = Math.max(...vals);
  const x = (i: number) => P + (i / (rows.length - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - min) / (max - min || 1)) * (H - 2 * P);
  const pts = rows.map((r, i) => `${x(i).toFixed(1)},${y(r.price).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <polyline points={pts} fill="none" stroke="#1E4E8C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {rows.map((r, i) => (
        <circle key={r.id} cx={x(i)} cy={y(r.price)} r="3" fill="#fff" stroke="#1E4E8C" strokeWidth="1.8">
          <title>{r.collected_at}: {r.price} ₸</title>
        </circle>
      ))}
    </svg>
  );
}
