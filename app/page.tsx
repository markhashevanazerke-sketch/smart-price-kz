'use client';
// SMART PRICE — landing / launch page (hackathon demo entry point).

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tag, TrendingUp, MapPinned, ShieldCheck, Languages, Database, Play } from 'lucide-react';

const FEATURES = [
  { icon: TrendingUp, kk: 'Мониторинг пен динамикасы', ru: 'Мониторинг и динамика цен', en: 'Price monitoring & dynamics', d_kk: 'Барлық баға жазбалары, тарих, өзгеріс пайызы', d_ru: 'Все записи цен, история, процент изменения', d_en: 'All price records, history, change %' },
  { icon: MapPinned, kk: 'Қазақстан картасы', ru: 'Карта Казахстана', en: 'Kazakhstan map', d_kk: 'Аймақтар, сауда нүктелері, баға деңгейлері', d_ru: 'Регионы, торговые точки, ценовые уровни', d_en: 'Regions, stores, price levels' },
  { icon: ShieldCheck, kk: 'AI аномалия детекторы', ru: 'AI-детектор аномалий', en: 'AI anomaly detector', d_kk: 'z-score, порог, рынокты салыстыру', d_ru: 'z-score, порог, сравнение с рынком', d_en: 'z-score, threshold, cross-store' },
  { icon: Database, kk: 'Жұмыс істейтін БД', ru: 'Рабочая база данных', en: 'Working database', d_kk: 'SQLite + REST API, CRUD, экспорт Excel', d_ru: 'SQLite + REST API, CRUD, Excel export', d_en: 'SQLite + REST API, CRUD, Excel export' },
];

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0B1D33] text-white relative overflow-hidden">
      {/* backdrop */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#1E4E8C]/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full bg-[#0E3A66]/50 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 py-14 flex flex-col min-h-screen">
        {/* top bar */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center shadow-lg shadow-blue-900/50">
              <Tag className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-bold text-lg tracking-wide">SMART PRICE</div>
              <div className="text-[11px] text-blue-200/70 tracking-widest uppercase">Food Price Intelligence</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-full bg-amber-400/15 border border-amber-300/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> DEMO MODE
            </span>
            <Link href="/lunarec" className="text-xs text-blue-200/60 hover:text-white transition-colors ml-2">LunarEC ↗</Link>
          </div>
        </header>

        {/* hero */}
        <main className="flex-1 flex flex-col justify-center py-16">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-200 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 w-fit mb-8">
            <Languages className="w-3.5 h-3.5" /> Хакатон 2026 · Кейс №3 · Қазақстан / Kazakhstan
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight">
            Цены на продукты.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-sky-400">Под контролем.</span>
          </h1>
          <p className="mt-6 text-lg text-blue-100/70 max-w-2xl leading-relaxed">
            Единая система сбора, сравнения и анализа цен на социально значимые продукты в торговых точках Казахстана.
            AI-модуль автоматически выявляет подозрительные колебания — без обвинений, только сигналы для проверки.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              onClick={() => router.push('/dashboard?demo=1')}
              className="group flex items-center gap-3 px-7 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold text-lg shadow-xl shadow-blue-900/40 transition-all hover:-translate-y-0.5"
            >
              <Play className="w-5 h-5 fill-white group-hover:scale-110 transition-transform" />
              Запустить демонстрацию
            </button>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-7 py-4 rounded-2xl bg-white/5 border border-white/15 hover:bg-white/10 text-white font-semibold transition-all"
            >
              Открыть платформу
            </Link>
          </div>

          <p className="mt-6 text-xs text-blue-200/50 max-w-xl">
            ⚠ Все данные в системе — тестовые (демонстрационные). Адреса торговых точек синтетические и не являются реальными.
          </p>

          {/* features */}
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 hover:bg-white/[0.07] transition-colors">
                <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-400/20 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-blue-300" />
                </div>
                <div className="font-semibold text-sm">{f.ru}</div>
                <div className="text-xs text-blue-200/60 mt-1.5 leading-relaxed">{f.d_ru}</div>
              </div>
            ))}
          </div>
        </main>

        <footer className="flex items-center justify-between text-xs text-blue-200/40 pt-8 border-t border-white/10">
          <span>SMART PRICE · на архитектуре LunarEC (Next.js 14 + TypeScript + SQLite)</span>
          <span>3 языка: Қазақша · Русский · English</span>
        </footer>
      </div>
    </div>
  );
}
