import { NextRequest } from 'next/server';
import { ensureSeeded, json, requireRole } from '@/lib/server/api-helpers';
import { getDb } from '@/lib/server/db';
import { buildMatchSuggestions, confirmMatch, rejectMatch } from '@/lib/server/matching';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/sp/matching — suggested + existing matches
export async function GET(req: NextRequest) {
  const db = ensureSeeded();
  const rows = buildMatchSuggestions(db);
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const out = status && status !== 'all' ? rows.filter(r => r.status === status) : rows;
  return json({ rows: out });
}

// POST /api/sp/matching/decision
export async function POST(req: NextRequest) {
  const db = getDb();
  const a = requireRole(req, ['analyst', 'admin']);
  if (a instanceof NextResponse) return a;
  const b = await req.json();
  const { id, action, note } = b || {};
  if (action === 'confirm') {
    const ok = confirmMatch(db, id, a.name);
    if (!ok) return json({ error: 'Совпадение не найдено' }, 404);
    const db2 = getDb();
    db2.prepare(`INSERT INTO comments (id, ref_type, ref_id, author, role, type, content, decision, created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(`cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, 'anomaly', id, a.name, a.role, 'conclusion', note || 'Совпадение товаров подтверждено вручную.', 'confirmed', new Date().toISOString());
    return json({ confirmed: true });
  }
  if (action === 'reject') {
    const ok = rejectMatch(db, id, a.name);
    if (!ok) return json({ error: 'Совпадение не найдено или уже обработано' }, 404);
    return json({ rejected: true });
  }
  return json({ error: 'action: confirm | reject' }, 400);
}
