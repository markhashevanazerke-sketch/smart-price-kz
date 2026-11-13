'use client';
// SMART PRICE — Users & roles management.

import React, { useEffect, useState } from 'react';
import { Users, Plus, Pencil, Trash2, ShieldCheck, ClipboardCheck, Crown } from 'lucide-react';
import { useSP, spFetch } from '@/lib/sp/context';
import { PageHeader, Card, Btn, Modal, Field, Input, Select, EmptyState } from '@/components/sp/ui';
import { RoleBadge } from '@/components/sp/Shell';
import { toast } from 'sonner';

const ROLES = [
  { id: 'specialist', key: 'role_specialist', icon: ClipboardCheck, desc: 'add prices, photos, comments' },
  { id: 'analyst', key: 'role_analyst', icon: ShieldCheck, desc: 'analyze, verify anomalies, reports' },
  { id: 'admin', key: 'role_admin', icon: Crown, desc: 'statistics, control, reports' },
];

const emptyForm = { name: '', role: 'specialist', pin: '', lang: 'kk' };

export default function UsersPage() {
  const { tr, lang, currentUser, users, setCurrentUserId } = useSP();
  const [list, setList] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const isAdmin = currentUser?.role === 'admin';

  const load = () => fetch('/api/sp/users').then(r => r.json()).then(setList).catch(() => {});
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (u: any) => { setEditing(u); setForm({ ...u }); setModal(true); };

  const save = async () => {
    try {
      if (editing) {
        await spFetch('/api/sp/users', { method: 'PUT', body: JSON.stringify({ id: editing.id, ...form }) });
        toast.success(tr('user_saved'));
      } else {
        await spFetch('/api/sp/users', { method: 'POST', body: JSON.stringify(form) });
        toast.success(tr('user_created'));
      }
      setModal(false);
      load();
    } catch (e: any) {
      toast.error(e.details ? `${tr('invalid_error')}: ${e.details.join('; ')}` : e.message);
    }
  };

  const del = async (u: any) => {
    if (!confirm(tr('delete_user_confirm'))) return;
    try {
      await spFetch(`/api/sp/users?id=${u.id}`, { method: 'DELETE' });
      toast.success(tr('user_deleted'));
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <PageHeader title={tr('users_title')} subtitle={tr('users_subtitle')}>
        {isAdmin && <Btn onClick={openCreate}><Plus className="w-4 h-4" /> {tr('add_user')}</Btn>}
      </PageHeader>

      {/* roles explainer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        {ROLES.map(r => (
          <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${r.id === 'admin' ? 'bg-amber-50 text-amber-600' : r.id === 'analyst' ? 'bg-violet-50 text-violet-600' : 'bg-sky-50 text-sky-600'}`}>
                <r.icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
              </div>
              <div className="font-bold text-[13.5px] text-slate-800">{tr(r.key)}</div>
            </div>
            <div className="text-[11.5px] text-slate-400 mt-2">{r.desc}</div>
          </div>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                <th className="px-5 py-3 font-semibold">{tr('fullname')}</th>
                <th className="px-4 py-3 font-semibold">{tr('role')}</th>
                <th className="px-4 py-3 font-semibold">{tr('pin')}</th>
                <th className="px-4 py-3 font-semibold text-right">{tr('entries_count')}</th>
                <th className="px-4 py-3 font-semibold text-right">{tr('reviews_count')}</th>
                <th className="px-4 py-3 font-semibold">{tr('status')}</th>
                <th className="px-4 py-3 font-semibold text-right">{tr('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map(u => (
                <tr key={u.id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${u.id === currentUser?.id ? 'bg-blue-50/40' : ''}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#12315A] to-[#1E4E8C] text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {u.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{u.name} {u.id === currentUser?.id && <span className="text-[10px] text-blue-600 font-bold">· {tr('current_user')}</span>}</div>
                        <div className="text-[10.5px] text-slate-400">{u.lang.toUpperCase()}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">•••{u.pin.slice(-2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{u.entries_count ?? 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{u.reviews_count ?? 0}</td>
                  <td className="px-4 py-3">
                    {u.active ? <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">{tr('active')}</span>
                      : <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">{tr('inactive')}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button title={tr('switch_user')} onClick={() => setCurrentUserId(u.id)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 text-[10px] font-bold">→</button>
                      {isAdmin && <button onClick={() => openEdit(u)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"><Pencil className="w-3.5 h-3.5" /></button>}
                      {isAdmin && u.role !== 'admin' && <button onClick={() => del(u)} className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <EmptyState text={tr('no_data')} />}
        </div>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? tr('edit_user') : tr('add_user')}>
        <div className="space-y-4">
          <Field label={tr('fullname')} required><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label={tr('role')} required>
            <Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              {ROLES.map(r => <option key={r.id} value={r.id}>{tr(r.key)}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr('pin')} required><Input value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })} placeholder="1234" /></Field>
            <Field label={tr('language')}>
              <Select value={form.lang} onChange={e => setForm({ ...form, lang: e.target.value })}>
                <option value="kk">Қазақша</option><option value="ru">Русский</option><option value="en">English</option>
              </Select>
            </Field>
          </div>
          {editing && (
            <Field label={tr('status')}>
              <Select value={form.active ? '1' : '0'} onChange={e => setForm({ ...form, active: e.target.value === '1' })}>
                <option value="1">{tr('active')}</option>
                <option value="0">{tr('inactive')}</option>
              </Select>
            </Field>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setModal(false)}>{tr('cancel')}</Btn>
          <Btn onClick={save}>{tr('save')}</Btn>
        </div>
      </Modal>
    </div>
  );
}
