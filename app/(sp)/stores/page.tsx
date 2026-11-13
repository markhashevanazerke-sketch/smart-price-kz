'use client';
// SMART PRICE — Store directory (full CRUD).

import React, { useEffect, useState } from 'react';
import { Store as StoreIcon, Plus, Pencil, Trash2, Search, MapPin } from 'lucide-react';
import { useSP, spFetch } from '@/lib/sp/context';
import { PageHeader, Card, Btn, Modal, Field, Input, Select, StatusPill, EmptyState, Change } from '@/components/sp/ui';
import { REGIONS, regionName } from '@/lib/sp/regions';
import { fmtDate } from '@/lib/sp/format';
import { toast } from 'sonner';

const TYPES = [
  { id: 'supermarket', key: 'type_supermarket' },
  { id: 'shop', key: 'type_shop' },
  { id: 'market', key: 'type_market' },
];

const emptyForm = {
  name: '', type: 'supermarket', region_code: 'KZ-75', city: 'Алматы',
  address: '', lat: '', lng: '', monitoring_status: 'active', is_demo: 0,
};

export default function StoresPage() {
  const { tr, lang, currentUser } = useSP();
  const [stores, setStores] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [region, setRegion] = useState('all');
  const [type, setType] = useState('all');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const canEdit = !!currentUser;

  const load = () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (region !== 'all') params.set('region', region);
    if (type !== 'all') params.set('type', type);
    fetch('/api/sp/stores?' + params.toString()).then(r => r.json()).then(setStores).catch(() => {});
  };
  useEffect(() => { load(); }, [q, region, type]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (s: any) => {
    setEditing(s);
    setForm({ ...s, lat: s.lat ?? '', lng: s.lng ?? '', address: s.address || '', is_demo: s.is_demo });
    setModal(true);
  };

  const save = async () => {
    try {
      const body = {
        ...form,
        lat: form.lat === '' ? null : parseFloat(String(form.lat).replace(',', '.')),
        lng: form.lng === '' ? null : parseFloat(String(form.lng).replace(',', '.')),
      };
      if (editing) {
        await spFetch('/api/sp/stores', { method: 'PUT', body: JSON.stringify({ id: editing.id, ...body }) });
        toast.success(tr('store_saved'));
      } else {
        await spFetch('/api/sp/stores', { method: 'POST', body: JSON.stringify(body) });
        toast.success(tr('store_created'));
      }
      setModal(false);
      load();
    } catch (e: any) {
      toast.error(e.details ? `${tr('invalid_error')}: ${e.details.join('; ')}` : e.message);
    }
  };

  const del = async (s: any) => {
    if (!confirm(tr('delete_confirm'))) return;
    try {
      await spFetch(`/api/sp/stores?id=${s.id}`, { method: 'DELETE' });
      toast.success(tr('store_deleted'));
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <PageHeader title={tr('stores_title')} subtitle={tr('stores_subtitle')}>
        <Btn onClick={openCreate}><Plus className="w-4 h-4" /> {tr('add_store')}</Btn>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={tr('search_ph')}
            className="pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm w-64 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
        <select value={region} onChange={e => setRegion(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs outline-none focus:border-blue-400">
          <option value="all">{tr('all_regions')}</option>
          {REGIONS.map(r => <option key={r.code} value={r.code}>{regionName(r.code, lang)}</option>)}
        </select>
        <select value={type} onChange={e => setType(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs outline-none focus:border-blue-400">
          <option value="all">{tr('all')}</option>
          {TYPES.map(t => <option key={t.id} value={t.id}>{tr(t.key)}</option>)}
        </select>
        <span className="text-xs text-slate-400 ml-auto">{stores.length} {tr('stores')}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {stores.map(s => (
          <Card key={s.id}>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-[14px] text-slate-900 truncate flex items-center gap-2">
                    <span>{s.type === 'market' ? '🥬' : s.type === 'shop' ? '🏪' : '🛒'}</span>
                    {s.name}
                  </div>
                  <div className="text-[11.5px] text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {s.city} · {regionName(s.region_code, lang)}
                  </div>
                </div>
                <StatusPill status={s.monitoring_status} tr={tr} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 py-2">
                  <div className="text-[10px] text-slate-400">{tr('store_type')}</div>
                  <div className="text-[11.5px] font-semibold text-slate-700 mt-0.5">{tr('type_' + s.type)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                  <div className="text-[10px] text-slate-400">{tr('prices_count')}</div>
                  <div className="text-[11.5px] font-bold text-slate-800 mt-0.5 tabular-nums">{s.prices_count ?? 0}</div>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                  <div className="text-[10px] text-slate-400">{tr('last_checked')}</div>
                  <div className="text-[11.5px] font-semibold text-slate-700 mt-0.5">{s.last_checked_at ? fmtDate(s.last_checked_at, lang) : tr('never')}</div>
                </div>
              </div>
              {s.lat !== null && (
                <div className="mt-2 text-[10.5px] font-mono text-slate-400">{s.lat.toFixed(4)}, {s.lng?.toFixed(4)} {s.is_demo ? '· ' + tr('demo_badge') : ''}</div>
              )}
              <div className="mt-3 flex gap-2">
                <Btn variant="outline" className="flex-1 !py-2" onClick={() => openEdit(s)}><Pencil className="w-3.5 h-3.5" /> {tr('edit')}</Btn>
                {currentUser?.role !== 'specialist' && (
                  <Btn variant="danger" className="!py-2" onClick={() => del(s)}><Trash2 className="w-3.5 h-3.5" /></Btn>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {stores.length === 0 && <EmptyState text={tr('no_stores')} />}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? tr('edit_store') : tr('add_store')} wide>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={tr('store_name')} required>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label={tr('store_type')} required>
            <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {TYPES.map(t => <option key={t.id} value={t.id}>{tr(t.key)}</option>)}
            </Select>
          </Field>
          <Field label={tr('region')} required>
            <Select value={form.region_code} onChange={e => setForm({ ...form, region_code: e.target.value })}>
              {REGIONS.map(r => <option key={r.code} value={r.code}>{regionName(r.code, lang)}</option>)}
            </Select>
          </Field>
          <Field label={tr('city')} required>
            <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label={tr('address')}>
            <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder={tr('demo_addr_note')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr('gps_lat')}><Input type="number" step="0.0001" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} placeholder="43.2220" /></Field>
            <Field label={tr('gps_lng')}><Input type="number" step="0.0001" value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} placeholder="76.8512" /></Field>
          </div>
          <Field label={tr('monitoring')}>
            <Select value={form.monitoring_status} onChange={e => setForm({ ...form, monitoring_status: e.target.value })}>
              <option value="active">{tr('status_active')}</option>
              <option value="paused">{tr('status_paused')}</option>
            </Select>
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setModal(false)}>{tr('cancel')}</Btn>
          <Btn onClick={save}>{tr('save')}</Btn>
        </div>
      </Modal>
    </div>
  );
}
