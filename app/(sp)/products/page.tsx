'use client';
// SMART PRICE — Product catalog + product matching.

import React, { useEffect, useMemo, useState } from 'react';
import { Package, Plus, Pencil, Trash2, GitMerge, Search, Check, X } from 'lucide-react';
import { useSP, spFetch } from '@/lib/sp/context';
import { PageHeader, Card, CardBody, Btn, Modal, Field, Input, Select, StatusPill, EmptyState } from '@/components/sp/ui';
import { fmtKzt, productName } from '@/lib/sp/format';
import { toast } from 'sonner';

const CATS = [
  { id: 'dairy', key: 'cat_dairy' },
  { id: 'groceries', key: 'cat_groceries' },
  { id: 'vegetables', key: 'cat_vegetables' },
  { id: 'other', key: 'cat_other' },
];
const UNITS = [{ id: 'kg', key: 'unit_kg' }, { id: 'l', key: 'unit_l' }, { id: 'pcs', key: 'unit_pcs' }];
const PACKS = [
  { id: 'бутылка', key: 'pkg_bottle' }, { id: 'пакет', key: 'pkg_pack' }, { id: 'пакет', key2: 'pkg_pack' },
  { id: 'тетрапак', key: 'pkg_carton' }, { id: 'весовой', key: 'pkg_bulk' }, { id: 'штук', key: 'pkg_loaf' },
  { id: 'банка', key: 'pkg_jar' }, { id: 'канистра', key: 'pkg_canister' }, { id: 'коробка', key: 'pkg_box' }, { id: 'мешок', key: 'pkg_bag' },
];
const PACK_IDS = ['бутылка', 'пакет', 'тетрапак', 'весовой', 'штук', 'банка', 'канистра', 'коробка', 'мешок'];

const emptyForm = {
  base_key: '', name_kk: '', name_ru: '', name_en: '', category: 'dairy',
  brand: '', producer: '', fat: '', amount: '1', unit: 'kg', package: 'пакет', barcode: '',
};

export default function ProductsPage() {
  const { tr, lang, currentUser } = useSP();
  const [products, setProducts] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [tab, setTab] = useState<'catalog' | 'matching'>('catalog');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [matches, setMatches] = useState<any[]>([]);
  const canEdit = currentUser?.role === 'analyst' || currentUser?.role === 'admin';
  const canDelete = currentUser?.role === 'admin';

  const load = () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (cat !== 'all') params.set('category', cat);
    fetch('/api/sp/products?' + params.toString()).then(r => r.json()).then(setProducts).catch(() => {});
  };
  useEffect(() => { load(); }, [q, cat]);
  useEffect(() => {
    if (tab === 'matching') fetch('/api/sp/matching').then(r => r.json()).then(j => setMatches(j.rows || [])).catch(() => {});
  }, [tab]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ ...p, fat: p.fat ?? '', brand: p.brand || '', producer: p.producer || '', barcode: p.barcode || '' });
    setModal(true);
  };

  const save = async () => {
    try {
      const body = {
        ...form,
        amount: parseFloat(String(form.amount).replace(',', '.')),
        fat: form.fat ? parseFloat(String(form.fat).replace(',', '.')) : null,
        is_demo: 0,
      };
      if (editing) {
        await spFetch('/api/sp/products', { method: 'PUT', body: JSON.stringify({ id: editing.id, ...body }) });
        toast.success(tr('products_saved'));
      } else {
        await spFetch('/api/sp/products', { method: 'POST', body: JSON.stringify(body) });
        toast.success(tr('products_created'));
      }
      setModal(false);
      load();
    } catch (e: any) {
      toast.error(e.details ? `${tr('invalid_error')}: ${e.details.join('; ')}` : e.message);
    }
  };

  const del = async (p: any) => {
    if (!confirm(tr('delete_confirm'))) return;
    try {
      await spFetch(`/api/sp/products?id=${p.id}`, { method: 'DELETE' });
      toast.success(tr('products_deleted'));
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const decideMatch = async (m: any, action: 'confirm' | 'reject') => {
    try {
      await spFetch('/api/sp/matching', { method: 'POST', body: JSON.stringify({ id: m.id, action, note: 'Ручное решение специалиста' }) });
      toast.success(tr('match_decided'));
      const j = await fetch('/api/sp/matching').then(r => r.json());
      setMatches(j.rows || []);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <PageHeader title={tr('products_title')} subtitle={tr('products_subtitle')}>
        {canEdit && (
          <Btn onClick={openCreate}><Plus className="w-4 h-4" /> {tr('add_product')}</Btn>
        )}
      </PageHeader>

      {/* tabs */}
      <div className="flex items-center gap-1 mb-4 bg-slate-100 rounded-xl p-1 w-fit">
        {(['catalog', 'matching'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all flex items-center gap-2 ${tab === t ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>
            {t === 'catalog' ? <Package className="w-4 h-4" /> : <GitMerge className="w-4 h-4" />}
            {t === 'catalog' ? tr('nav_products') : tr('matching_title')}
          </button>
        ))}
      </div>

      {tab === 'catalog' ? (
        <>
          {/* filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative">
              <input value={q} onChange={e => setQ(e.target.value)} placeholder={tr('search_ph')}
                className="pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm w-64 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setCat('all')} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${cat === 'all' ? 'bg-[#12315A] text-white border-[#12315A]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{tr('cat_all')}</button>
              {CATS.map(c => (
                <button key={c.id} onClick={() => setCat(c.id)} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${cat === c.id ? 'bg-[#12315A] text-white border-[#12315A]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  {tr(c.key)}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400 ml-auto">{products.length} {tr('items')}</span>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                    <th className="px-5 py-3 font-semibold">{tr('name_ru')}</th>
                    <th className="px-4 py-3 font-semibold">{tr('category')}</th>
                    <th className="px-4 py-3 font-semibold">{tr('brand')}</th>
                    <th className="px-4 py-3 font-semibold">{tr('amount')}</th>
                    <th className="px-4 py-3 font-semibold">{tr('package')}</th>
                    <th className="px-4 py-3 font-semibold">{tr('barcode')}</th>
                    <th className="px-4 py-3 font-semibold">{tr('base_key')}</th>
                    {canEdit && <th className="px-4 py-3 font-semibold text-right">{tr('actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-800">{productName(p, lang)}</div>
                        {p.fat !== null && p.fat !== undefined && <div className="text-[10.5px] text-slate-400">{tr('fatness')}: {p.fat}%</div>}
                      </td>
                      <td className="px-4 py-3"><span className="text-xs text-slate-500">{tr('cat_' + p.category)}</span></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{p.brand || '—'}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700 tabular-nums">{p.amount} {tr('unit_' + p.unit)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{p.package}</td>
                      <td className="px-4 py-3 text-[11px] font-mono text-slate-400">{p.barcode || '—'}</td>
                      <td className="px-4 py-3"><code className="text-[10.5px] bg-slate-100 rounded px-1.5 py-0.5 text-slate-500">{p.base_key}</code></td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
                            {canDelete && <button onClick={() => del(p)} className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {products.length === 0 && <EmptyState text={tr('no_data')} />}
            </div>
          </Card>
          <p className="mt-3 text-[11px] text-slate-400">{tr('same_base_note')}</p>
        </>
      ) : (
        <>
          <p className="text-xs text-slate-500 mb-4">{tr('matching_subtitle')} · {tr('match_hint')}</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {matches.length === 0 && <EmptyState text={tr('no_matches')} />}
            {matches.map(m => (
              <Card key={m.id || m.product_a.id + m.product_b.id}>
                <CardBody>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-slate-800 truncate">{m.product_a.name_ru}</div>
                      <div className="text-[10.5px] text-slate-400">{m.product_a.amount} {tr('unit_' + m.product_a.unit)} · {m.product_a.package}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
                      <GitMerge className="w-4.5 h-4.5 w-[18px] h-[18px] text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-slate-800 truncate">{m.product_b.name_ru}</div>
                      <div className="text-[10.5px] text-slate-400">{m.product_b.amount} {tr('unit_' + m.product_b.unit)} · {m.product_b.package}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600" style={{ width: `${Math.round(m.confidence * 100)}%` }} />
                    </div>
                    <span className="text-xs font-bold text-violet-700 tabular-nums">{Math.round(m.confidence * 100)}%</span>
                    <StatusPill status={m.status} tr={tr} />
                  </div>
                  {m.reasons?.length > 0 && (
                    <div className="mt-2 text-[10.5px] text-slate-400">{tr('match_reasons')}: {m.reasons.join(', ')}</div>
                  )}
                  {m.status === 'suggested' && canEdit && (
                    <div className="mt-3 flex gap-2">
                      <Btn variant="success" className="flex-1 !py-2" onClick={() => decideMatch(m, 'confirm')}><Check className="w-3.5 h-3.5" /> {tr('match_confirm')}</Btn>
                      <Btn variant="danger" className="flex-1 !py-2" onClick={() => decideMatch(m, 'reject')}><X className="w-3.5 h-3.5" /> {tr('match_reject')}</Btn>
                    </div>
                  )}
                  {m.confirmed_by && <div className="mt-2 text-[10.5px] text-slate-400">{m.confirmed_by}</div>}
                </CardBody>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* create/edit modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? tr('edit_product') : tr('add_product')} wide>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={tr('name_kk')} required><Input value={form.name_kk} onChange={e => setForm({ ...form, name_kk: e.target.value })} /></Field>
          <Field label={tr('name_ru')} required><Input value={form.name_ru} onChange={e => setForm({ ...form, name_ru: e.target.value })} /></Field>
          <Field label={tr('name_en')} required><Input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} /></Field>
          <Field label={tr('base_key')} required>
            <Input value={form.base_key} onChange={e => setForm({ ...form, base_key: e.target.value })} placeholder="milk-2.5" />
          </Field>
          <Field label={tr('category')} required>
            <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATS.map(c => <option key={c.id} value={c.id}>{tr(c.key)}</option>)}
            </Select>
          </Field>
          <Field label={tr('brand')}><Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} /></Field>
          <Field label={tr('producer')}><Input value={form.producer} onChange={e => setForm({ ...form, producer: e.target.value })} /></Field>
          <Field label={tr('fatness')}><Input type="number" step="0.1" value={form.fat} onChange={e => setForm({ ...form, fat: e.target.value })} /></Field>
          <Field label={tr('amount')} required>
            <Input type="number" step="0.1" min="0.1" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label={tr('unit')} required>
            <Select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
              {UNITS.map(u => <option key={u.id} value={u.id}>{tr(u.key)}</option>)}
            </Select>
          </Field>
          <Field label={tr('package')} required>
            <Select value={form.package} onChange={e => setForm({ ...form, package: e.target.value })}>
              {PACK_IDS.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label={tr('barcode')}><Input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setModal(false)}>{tr('cancel')}</Btn>
          <Btn onClick={save}>{tr('save')}</Btn>
        </div>
      </Modal>
    </div>
  );
}
