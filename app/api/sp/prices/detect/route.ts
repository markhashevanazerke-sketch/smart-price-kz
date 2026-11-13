import { NextRequest, NextResponse } from 'next/server';
import { ensureSeeded, json, requireRole } from '@/lib/server/api-helpers';
import { getDb, audit, nowIso } from '@/lib/server/db';
import { runFullDetection } from '@/lib/server/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/sp/prices/detect — re-run AI detection for last N days (idempotent)
export async function POST(req: NextRequest) {
  const db = ensureSeeded();
  const a = requireRole(req, ['analyst', 'admin']);
  if (a instanceof NextResponse) return a;
  const body = await req.json().catch(() => ({}));
  const days = Math.min(30, Math.max(1, parseInt(body.days || '3', 10)));
  const res = runFullDetection(db, days, { actor: a.name, role: a.role });
  audit(db, a.name, a.role, 'analytics.run', 'anomalies', null, res);
  return json({ ...res, actor: a.name, at: nowIso() });
}
