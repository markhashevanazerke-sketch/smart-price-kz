// Shared formatting helpers for the SMART PRICE UI.

export const fmtKzt = (v: number | null | undefined, lang: string = 'ru'): string => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  const s = Math.round(v).toLocaleString(lang === 'en' ? 'en-US' : lang === 'kk' ? 'kk-KZ' : 'ru-RU');
  return `${s} ₸`;
};

export const fmtPct = (v: number | null | undefined): string => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
};

export const fmtDate = (iso: string | null | undefined, lang: string = 'ru'): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'kk' ? 'kk-KZ' : 'ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const fmtDateTime = (iso: string | null | undefined, lang: string = 'ru'): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(lang === 'en' ? 'en-GB' : 'ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const unitLabel = (unit: string, lang: string = 'ru'): string => {
  if (unit === 'kg') return lang === 'en' ? 'kg' : 'кг';
  if (unit === 'l') return lang === 'en' ? 'L' : 'л';
  return lang === 'en' ? 'pcs' : lang === 'kk' ? 'дана' : 'шт';
};

export const productName = (p: { name_ru?: string; name_kk?: string; name_en?: string } | undefined | null, lang: string = 'ru'): string => {
  if (!p) return '—';
  if (lang === 'kk') return p.name_kk || p.name_ru || p.name_en || '—';
  if (lang === 'en') return p.name_en || p.name_ru || '—';
  return p.name_ru || p.name_kk || p.name_en || '—';
};
