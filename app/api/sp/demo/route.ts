import { NextRequest, NextResponse } from 'next/server';
import { ensureSeeded, json, createPriceEntry, priceRowWithMeta } from '@/lib/server/api-helpers';
import { getDb, audit, nowIso, today, notify, uid } from '@/lib/server/db';
import { resetDb, seedDemo } from '@/lib/server/seed';
import { detectForEntry } from '@/lib/server/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/sp/demo/reset — restore demo database (test data)
export async function POST(req: NextRequest) {
  const action = (await req.json().catch(() => ({})))?.action || 'status';
  const db = ensureSeeded();
  if (action === 'reset') {
    resetDb(db);
    const res = seedDemo(db, { force: true });
    return json({ ok: true, ...res });
  }
  return json({ ok: true, seeded: !!db.prepare(`SELECT value FROM settings WHERE key='seeded_at'`).get() });
}
