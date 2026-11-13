import { NextRequest } from 'next/server';
import { ensureSeeded, json, requireRole } from '@/lib/server/api-helpers';
import { getDb } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/sp/notifications
export async function GET(req: NextRequest) {
  const db = ensureSeeded();
  const rows = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 30').all() as any[];
  const unread = (db.prepare('SELECT COUNT(*) c FROM notifications WHERE read=0').get() as any).c;
  return json({ rows, unread });
}

// POST /api/sp/notifications/read  { id? } — mark one or all as read
export async function POST(req: NextRequest) {
  const db = getDb();
  const a = requireRole(req, ['specialist', 'analyst', 'admin']);
  if (a instanceof NextResponse) return a;
  const b = await req.json().catch(() => ({}));
  if (b.id) db.prepare('UPDATE notifications SET read=1 WHERE id=?').run(b.id);
  else db.prepare('UPDATE notifications SET read=1').run();
  return json({ ok: true });
}
