import { NextRequest } from 'next/server';
import { ensureSeeded, json, requireRole } from '@/lib/server/api-helpers';
import { getDb } from '@/lib/server/db';
import { getSettings, setSettings } from '@/lib/server/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEYS = ['spike_threshold_pct', 'zscore_threshold', 'outlier_pct', 'window_days'];

export async function GET(req: NextRequest) {
  const db = ensureSeeded();
  return json(getSettings(db));
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const a = requireRole(req, ['analyst', 'admin']);
  if (a instanceof NextResponse) return a;
  const b = await req.json().catch(() => ({}));
  for (const k of KEYS) {
    if (b[k] !== undefined) {
      const v = Number(b[k]);
      if (!isFinite(v) || v <= 0) return json({ error: `Некорректное значение: ${k}` }, 400);
      setSettings(db, k, String(v));
    }
  }
  return json(getSettings(db));
}

import { NextResponse } from 'next/server';
