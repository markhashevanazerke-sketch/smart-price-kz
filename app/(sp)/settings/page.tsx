'use client';
// SMART PRICE — Settings: profile, language, AI parameters, demo reset, about.

import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, BrainCircuit, RotateCcw, Info, Database } from 'lucide-react';
import { useSP, spFetch } from '@/lib/sp/context';
import { PageHeader, Card, CardBody, Btn, Field, Input, Select } from '@/components/sp/ui';
import { LANGS } from '@/lib/sp/i18n';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { tr, lang, setLang, currentUser, refreshUsers } = useSP();
  const [settings, setSettings] = useState<any>({});
  const [resetting, setResetting] = useState(false);
  const canAI = currentUser?.role === 'analyst' || currentUser?.role === 'admin';

  useEffect(() => {
    fetch('/api/sp/settings').then(r => r.json()).then(setSettings).catch(() => {});
  }, []);

  const saveAI = async () => {
    try {
      await spFetch('/api/sp/settings', { method: 'POST', body: JSON.stringify(settings) });
      toast.success(tr('settings_saved'));
    } catch (e: any) { toast.error(e.message); }
  };

  const resetDemo = async () => {
    if (!confirm(tr('reset_demo_confirm'))) return;
    setResetting(true);
    try {
      await fetch('/api/sp/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset' }) });
      toast.success(tr('reset_done'));
      refreshUsers();
      setTimeout(() => window.location.reload(), 1200);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <PageHeader title={tr('settings_title')} subtitle={tr('settings_subtitle')} />

      <div className="space-y-4">
        {/* profile */}
        <Card>
          <CardBody>
            <h3 className="font-bold text-slate-800 text-[14px] mb-4 flex items-center gap-2"><SettingsIcon className="w-4 h-4 text-slate-400" /> {tr('profile')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <div className="text-[11px] text-slate-400">{tr('current_user')}</div>
                <div className="font-bold text-slate-800 mt-1">{currentUser?.name || '—'}</div>
                <div className="text-[11.5px] text-slate-500 mt-0.5">{currentUser ? tr('role_' + currentUser.role) : '—'}</div>
              </div>
              <Field label={tr('language_label')}>
                <Select value={lang} onChange={e => setLang(e.target.value as any)}>
                  {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
                </Select>
              </Field>
            </div>
          </CardBody>
        </Card>

        {/* AI */}
        <Card>
          <CardBody>
            <h3 className="font-bold text-slate-800 text-[14px] mb-1 flex items-center gap-2"><BrainCircuit className="w-4 h-4 text-slate-400" /> {tr('ai_settings')}</h3>
            <p className="text-[11.5px] text-slate-400 mb-4">{tr('ai_disclaimer')}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label={tr('threshold_spike')}>
                <Input type="number" step="1" disabled={!canAI} value={settings.spike_threshold_pct ?? ''} onChange={e => setSettings({ ...settings, spike_threshold_pct: e.target.value })} />
              </Field>
              <Field label={tr('threshold_z')}>
                <Input type="number" step="0.1" disabled={!canAI} value={settings.zscore_threshold ?? ''} onChange={e => setSettings({ ...settings, zscore_threshold: e.target.value })} />
              </Field>
              <Field label={tr('threshold_outlier')}>
                <Input type="number" step="1" disabled={!canAI} value={settings.outlier_pct ?? ''} onChange={e => setSettings({ ...settings, outlier_pct: e.target.value })} />
              </Field>
              <Field label={tr('window')}>
                <Input type="number" step="1" disabled={!canAI} value={settings.window_days ?? ''} onChange={e => setSettings({ ...settings, window_days: e.target.value })} />
              </Field>
            </div>
            {canAI && (
              <div className="mt-4 flex justify-end">
                <Btn onClick={saveAI}>{tr('save_settings')}</Btn>
              </div>
            )}
          </CardBody>
        </Card>

        {/* demo */}
        <Card>
          <CardBody>
            <h3 className="font-bold text-slate-800 text-[14px] mb-4 flex items-center gap-2"><RotateCcw className="w-4 h-4 text-slate-400" /> {tr('demo_settings')}</h3>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-[12.5px] text-slate-500 max-w-md">{tr('reset_demo_confirm')}</div>
              <Btn variant="danger" onClick={resetDemo} disabled={resetting}>
                <RotateCcw className="w-4 h-4" /> {resetting ? '...' : tr('reset_demo')}
              </Btn>
            </div>
          </CardBody>
        </Card>

        {/* about */}
        <Card>
          <CardBody>
            <h3 className="font-bold text-slate-800 text-[14px] mb-3 flex items-center gap-2"><Info className="w-4 h-4 text-slate-400" /> {tr('about')}</h3>
            <p className="text-[12.5px] text-slate-500 leading-relaxed">{tr('about_text')}</p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 mb-1"><Database className="w-3.5 h-3.5" /> {tr('db_info')}</div>
                <div className="text-[11.5px] text-slate-500 leading-relaxed">{tr('data_info')}</div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <div className="text-[11px] font-bold text-slate-500 mb-1">OCR</div>
                <div className="text-[11.5px] text-slate-500 leading-relaxed">{tr('ocr_info')}</div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
