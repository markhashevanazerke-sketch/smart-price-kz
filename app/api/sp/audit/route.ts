import { NextRequest } from 'next/server';
import { ensureSeeded, json, err } from '@/lib/server/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/sp/audit?limit=&actor=&action=
export async function GET(req: NextRequest) {
  const db = ensureSeeded();
  const url = new URL(req.url);
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '200', 10)));
  const actor = url.searchParams.get('actor');
  const action = url.searchParams.get('action');
  const where: string[] = [];
  const args: any[] = [];
  if (actor) { where.push('actor = ?'); args.push(actor); }
  if (action) { where.push('action LIKE ?'); args.push(`%${action}%`); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(`SELECT * FROM audit_log ${whereSql} ORDER BY created_at DESC LIMIT ?`).all(...args, limit) as any[];
  const actors = db.prepare(`SELECT DISTINCT actor, role FROM audit_log ORDER BY actor`).all() as any[];
  return json({ rows, actors });
}
