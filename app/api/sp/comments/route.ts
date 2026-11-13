import { NextRequest } from 'next/server';
import { ensureSeeded, json, err, actor, requireRole } from '@/lib/server/api-helpers';
import { getDb, uid, nowIso, audit, notify } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/sp/comments?ref_type=anomaly&ref_id=
export async function GET(req: NextRequest) {
  const db = ensureSeeded();
  const url = new URL(req.url);
  const refType = url.searchParams.get('ref_type');
  const refId = url.searchParams.get('ref_id');
  if (!refType || !refId) return err('ref_type и ref_id обязательны');
  const rows = db.prepare(`SELECT * FROM comments WHERE ref_type=? AND ref_id=? ORDER BY created_at ASC`).all(refType, refId) as any[];
  return json(rows);
}

// POST /api/sp/comments — { ref_type, ref_id, type, content, decision? }
export async function POST(req: NextRequest) {
  const db = getDb();
  const a = actor(req);
  const b = await req.json();
  if (!b.ref_type || !b.ref_id) return err('ref_type (price|anomaly) и ref_id обязательны');
  if (!b.content || !String(b.content).trim()) return err('Текст комментария обязателен');
  const types = ['comment', 'flag', 'conclusion', 'transfer'];
  if (!types.includes(b.type)) return err('type: comment | flag | conclusion | transfer');
  if (b.type === 'conclusion') {
    const r = requireRole(req, ['analyst', 'admin']);
    if (r instanceof NextResponse) return r;
  }
  if (b.decision && !['confirmed', 'rejected'].includes(b.decision)) return err('decision: confirmed | rejected');
  const id = uid('cmt');
  db.prepare(`INSERT INTO comments (id, ref_type, ref_id, author, role, type, content, decision, created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id, b.ref_type, b.ref_id, a.name, a.role, b.type, String(b.content).trim(), b.decision || null, nowIso());
  audit(db, a.name, a.role, 'comment.create', b.ref_type, b.ref_id, { type: b.type, decision: b.decision || null });
  if (b.type === 'flag') notify(db, 'system', 'Специалист сообщил о некорректной цене', `Запись ${b.ref_id}: ${String(b.content).slice(0, 120)}`, 'warning', b.ref_id);
  if (b.type === 'transfer') notify(db, 'system', 'Запись передана аналитику', `Запись ${b.ref_id} передана на проверку.`, 'info', b.ref_id);
  return json({ id }, 201);
}
