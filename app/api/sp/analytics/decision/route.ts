import { NextRequest, NextResponse } from 'next/server';
import { getDb, audit } from '@/lib/server/db';
import { requireRole, json, err } from '@/lib/server/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/sp/analytics/decision — analyst/admin decision on an anomaly
export async function POST(req: NextRequest) {
  const db = getDb();
  const a = requireRole(req, ['analyst', 'admin']);
  if (a instanceof NextResponse) return a;
  const b = await req.json();
  const { id, status, decision, note } = b || {};
  const allowed = ['new', 'review', 'confirmed', 'dismissed'];
  if (!id || !allowed.includes(status)) return err('id и status: new | review | confirmed | dismissed');
  const cur = db.prepare('SELECT * FROM anomalies WHERE id=?').get(id) as any;
  if (!cur) return err('Аномалия не найдена', 404);
  db.prepare(`UPDATE anomalies SET status=?, reviewer=?, decision_note=? WHERE id=?`).run(status, a.name, note ?? cur.decision_note, id);
  if ((status === 'confirmed' || status === 'dismissed') && cur.price_entry_id) {
    db.prepare(`UPDATE price_entries SET status=? WHERE id=?`).run(status === 'confirmed' ? 'flagged' : 'verified', cur.price_entry_id);
  }
  audit(db, a.name, a.role, 'anomaly.decision', 'anomaly', id, { status, decision, note });
  return json(db.prepare('SELECT * FROM anomalies WHERE id=?').get(id));
}
