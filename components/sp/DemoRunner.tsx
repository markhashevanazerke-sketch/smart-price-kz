'use client';
// SMART PRICE — interactive demo scenario (9 steps) for the hackathon pitch.
// Every step performs REAL API calls (price entry, AI detection, comments, decisions).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Play, Pause, Square, CheckCircle2, Loader2, Circle } from 'lucide-react';
import { useSP, spFetch } from '@/lib/sp/context';
import { toast } from 'sonner';
import { fmtKzt, productName } from '@/lib/sp/format';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function findDemoObjects() {
  const [prods, stores] = await Promise.all([
    spFetch('/api/sp/products?base=oil-sunflower'),
    spFetch('/api/sp/stores'),
  ]);
  const product = (prods as any[]).find(p => p.amount === 1 && p.unit === 'l') || (prods as any[])[0];
  const store = (stores as any[]).find(s => s.name === 'SmartMart (демо)' && s.city === 'Алматы') || (stores as any[])[0];
  return { product, store };
}

/** Wait until an element with the given id exists in the DOM. */
async function waitForEl(id: string, timeoutMs = 15000): Promise<HTMLElement | null> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const el = document.getElementById(id);
    if (el) return el;
    await sleep(300);
  }
  return null;
}

function highlight(id: string, on: boolean) {
  document.querySelectorAll('.sp-demo-hl').forEach(e => e.classList.remove('sp-demo-hl'));
  if (on && id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('sp-demo-hl');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

export function DemoRunner() {
  const { tr, lang, users, setCurrentUserId, currentUser, demoRunning, setDemoRunning, demoStep, setDemoStep, setUnread, refreshUsers } = useSP();
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnomaly, setLastAnomaly] = useState<any>(null);
  const [lastEntry, setLastEntry] = useState<any>(null);
  const abortRef = useRef(false);
  const pausedRef = useRef(false);

  const stepTitles = [
    tr('demo_step_1'), tr('demo_step_2'), tr('demo_step_3'), tr('demo_step_4'),
    tr('demo_step_5'), tr('demo_step_6'), tr('demo_step_7'), tr('demo_step_8'), tr('demo_step_9'),
  ];

  const pauseGate = useCallback(async (label: string) => {
    while (pausedRef.current && !abortRef.current) {
      await sleep(300);
    }
    if (abortRef.current) throw new Error('aborted');
    void label;
  }, []);

  const start = useCallback(async () => {
    if (demoRunning) return;
    setStarted(true);
    setFinished(false);
    setError(null);
    setDemoRunning(true);
    abortRef.current = false;
    pausedRef.current = false;
    setPaused(false);
    try {
      const { product, store } = await findDemoObjects();
      if (!product || !store) throw new Error('Demo objects not found');

      // user 1: specialist
      const specialist = users.find(u => u.role === 'specialist');
      const analyst = users.find(u => u.role === 'analyst');
      const admin = users.find(u => u.role === 'admin');

      // STEP 1 — specialist enters a new price
      setDemoStep(1);
      if (specialist) setCurrentUserId(specialist.id);
      await sleep(250);
      router.push('/monitoring?new=1&demo=1');
      const form = await waitForEl('sp-demo-price-form');
      if (form) highlight('sp-demo-price-form', true);
      // animate typing the price
      const priceInput = await waitForEl('sp-demo-price-input');
      if (priceInput) {
        (priceInput as HTMLInputElement).focus();
        await sleep(400);
        for (const ch of '1100') {
          if (abortRef.current) throw new Error('aborted');
          (priceInput as HTMLInputElement).value += ch;
          (priceInput as HTMLInputElement).dispatchEvent(new Event('input', { bubbles: true }));
          await sleep(220);
        }
      }
      await pauseGate('s1');

      // STEP 2 — save the record
      setDemoStep(2);
      await pauseGate('s2');
      let detection: any = null;
      const entry = await spFetch('/api/sp/prices', {
        method: 'POST',
        body: JSON.stringify({ product_id: product.id, store_id: store.id, price: 1100, source: 'demo', note: 'Демо-сценарий' }),
      });
      setLastEntry(entry.entry);
      detection = entry.detection;
      toast.success(tr('price_added') + ` — ${fmtKzt(1100, lang)}`);
      const saveBtn = document.getElementById('sp-demo-save-spin');
      if (saveBtn) highlight('sp-demo-price-form', true);
      await sleep(900);

      // STEP 3 — AI analyzes
      setDemoStep(3);
      highlight('', false);
      toast.info(tr('ai_title') + ': ' + tr('detection_done') + '…');
      await sleep(1600);

      // STEP 4 — suspicious increase detected
      setDemoStep(4);
      const created = detection?.anomalies || [];
      let anomaly = created[0] || null;
      if (!anomaly) {
        // safety net: fetch the newest anomaly for this entry
        const list = await spFetch('/api/sp/analytics?status=new');
        anomaly = (list.rows || []).find((a: any) => a.price_entry_id === entry.entry?.id) || (list.rows || [])[0] || null;
      }
      setLastAnomaly(anomaly);
      if (anomaly) {
        toast.warning(`${tr('type_spike')} +29.4% — ${productName(product, lang)}`);
      }
      await sleep(1200);
      await pauseGate('s4');

      // STEP 5 — dashboard notification
      setDemoStep(5);
      router.push('/dashboard');
      await sleep(700);
      setUnread(u => Math.max(u, 1) as any);
      const bell = await waitForEl('sp-demo-bell');
      if (bell) highlight('sp-demo-bell', true);
      await sleep(1800);

      // STEP 6 — analyst opens the record
      setDemoStep(6);
      if (analyst) setCurrentUserId(analyst.id);
      await sleep(400);
      router.push(`/verification${anomaly ? `?open=${anomaly.id}` : ''}`);
      const modal = await waitForEl('sp-demo-anomaly-modal', 12000);
      if (modal) highlight('sp-demo-anomaly-modal', true);
      await sleep(1400);
      await pauseGate('s6');

      // STEP 7 — review price history
      setDemoStep(7);
      const hist = document.getElementById('sp-demo-history-tab');
      if (hist) {
        highlight('sp-demo-history', true);
      }
      toast.info(tr('price_history'));
      await sleep(2200);

      // STEP 8 — analyst leaves a comment + conclusion
      setDemoStep(8);
      await pauseGate('s8');
      if (anomaly) {
        await spFetch('/api/sp/comments', {
          method: 'POST',
          body: JSON.stringify({
            ref_type: 'anomaly', ref_id: anomaly.id, type: 'conclusion',
            content: lang === 'en'
              ? 'Review complete: the increase of sunflower oil (850 → 1100 ₸, +29.4%) is not supported by market data — peer stores hold prices around 950 ₸. Anomaly confirmed, case transferred to the responsible head for a decision.'
              : 'Проверка завершена: рост подсолнечного масла (850 → 1100 ₸, +29.4%) не подтверждается рыночными данными — в точках того же типа цена держится около 950 ₸. Аномалия подтверждена, кейс передан ответственному руководителю.',
            decision: 'confirmed',
          }),
        });
        await spFetch('/api/sp/analytics/decision', {
          method: 'POST',
          body: JSON.stringify({ id: anomaly.id, status: 'confirmed', note: 'Демо-сценарий: аномалия подтверждена аналитиком' }),
        });
        toast.success(tr('decision_saved'));
      }
      await sleep(1400);

      // STEP 9 — head sees the final result
      setDemoStep(9);
      if (admin) setCurrentUserId(admin.id);
      await sleep(400);
      router.push('/dashboard');
      await sleep(800);
      highlight('', false);
      setFinished(true);
      toast.success('🏁 ' + tr('demo_done'));
    } catch (e: any) {
      if (e.message !== 'aborted') {
        setError(String(e.message || e));
        toast.error(tr('error') + ': ' + String(e.message || e));
      }
    } finally {
      setDemoRunning(false);
      setDemoStep(0);
      highlight('', false);
      refreshUsers();
    }
  }, [demoRunning, users, lang, router, tr, setCurrentUserId, setUnread, refreshUsers, pauseGate, setDemoRunning, setDemoStep]);

  // auto-start on ?demo=1 (from landing / sidebar button)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1' && !demoRunning) {
      params.delete('demo');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
      const t = setTimeout(() => { start(); }, 600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = () => {
    abortRef.current = true;
    pausedRef.current = false;
    setDemoRunning(false);
    setDemoStep(0);
    setStarted(false);
    setFinished(false);
    highlight('', false);
  };

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };

  return (
    <>
      {/* floating control panel */}
      {(demoRunning || started || finished) && (
        <div className="fixed bottom-6 right-6 z-[90] w-[380px] max-w-[92vw] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-[#0D2038] to-[#12315A] text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 w-[18px] h-[18px] text-blue-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[13.5px]">{tr('demo_title')}</div>
              <div className="text-[11px] text-blue-200/70 truncate">
                {finished ? tr('demo_done') : error ? tr('error') : paused ? tr('demo_pause') : demoStep > 0 ? `${demoStep}/9` : tr('demo_subtitle')}
              </div>
            </div>
            {!demoRunning && !finished && (
              <button onClick={start} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold transition-colors">
                <Play className="w-3.5 h-3.5 fill-white" /> {tr('demo_start')}
              </button>
            )}
          </div>

          {/* progress */}
          <div className="px-5 py-3 border-b border-slate-100">
            <div className="flex gap-1">
              {stepTitles.map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${finished || demoStep > i + 1 ? 'bg-emerald-500' : demoStep === i + 1 ? 'bg-blue-500 animate-pulse' : 'bg-slate-200'}`} />
              ))}
            </div>
          </div>

          {/* steps list */}
          <div className="px-5 py-3 max-h-[260px] overflow-y-auto">
            {stepTitles.map((st, i) => {
              const n = i + 1;
              const done = finished || demoStep > n;
              const active = !finished && demoStep === n;
              return (
                <div key={n} className={`flex items-start gap-2.5 py-1.5 ${active ? '' : done ? 'opacity-60' : 'opacity-40'}`}>
                  {done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    : active ? <Loader2 className={`w-4 h-4 text-blue-600 shrink-0 mt-0.5 ${paused ? '' : 'animate-spin'}`} />
                    : <Circle className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />}
                  <div className={`text-[12px] leading-snug ${active ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>{st}</div>
                </div>
              );
            })}
          </div>

          {error && <div className="mx-5 mb-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[11.5px] text-red-700">{error}</div>}

          {/* result summary */}
          {finished && lastAnomaly && (
            <div className="mx-5 mb-3 px-3.5 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-[12px] font-bold text-emerald-800">✓ {tr('demo_done')}</div>
              <div className="text-[11px] text-emerald-700 mt-1 leading-relaxed">
                {productName(lastAnomaly as any, lang)} · {fmtKzt(lastAnomaly.prev_price, lang)} → {fmtKzt(lastAnomaly.new_price, lang)}
                <span className="font-bold text-red-600"> ({lastAnomaly.change_pct > 0 ? '+' : ''}{lastAnomaly.change_pct}%)</span>
              </div>
              <div className="text-[11px] text-emerald-700 mt-1">{tr('stat_confirmed')}: {lastAnomaly.reviewer || tr('role_analyst')}</div>
            </div>
          )}

          {/* controls */}
          <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2">
            {demoRunning && (
              <button onClick={togglePause} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors">
                {paused ? <><Play className="w-3.5 h-3.5" /> {tr('demo_resume')}</> : <><Pause className="w-3.5 h-3.5" /> {tr('demo_pause')}</>}
              </button>
            )}
            <button onClick={stop} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold transition-colors">
              <Square className="w-3.5 h-3.5" /> {finished ? tr('close') : tr('demo_stop')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
