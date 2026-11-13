import { NextRequest } from 'next/server';
import { ensureSeeded, json, err, requireRole } from '@/lib/server/api-helpers';
import { getDb, uid, nowIso, audit } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROLES = new Set(['specialist', 'analyst', 'admin']);

export async function GET(req: NextRequest) {
  const db = ensureSeeded();
  const rows = db.prepare(`
    SELECT u.*,
      (SELECT COUNT(*) FROM price_entries pe WHERE pe.entered_by = u.name AND pe.source IN ('manual','excel')) AS entries_count,
      (SELECT COUNT(*) FROM anomalies a WHERE a.reviewer = u.name AND a.status IN ('confirmed','dismissed')) AS reviews_count
    FROM users u ORDER BY u.name
  `).all() as any[];
  return json(rows);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const a = requireRole(req, ['admin']);
  if (a instanceof NextResponse) return a;
  const b = await req.json();
  const errors: string[] = [];
  if (!b.name || !String(b.name).trim()) errors.push('name: ФИО обязательно');
  if (!ROLES.has(b.role)) errors.push('role: specialist | analyst | admin');
  if (!b.pin || !/^\d{4,6}$/.test(String(b.pin))) errors.push('pin: 4–6 цифр');
  if (errors.length) return err('Пользователь некорректен', 400, errors);
  const id = uid('usr');
  db.prepare('INSERT INTO users (id, name, role, pin, lang, active, created_at) VALUES (?,?,?,?,?,1,?)')
    .run(id, b.name, b.role, b.pin, b.lang || 'kk', nowIso());
  audit(db, a.name, a.role, 'user.create', 'user', id, { name: b.name, role: b.role });
  return json(db.prepare('SELECT * FROM users WHERE id=?').get(id), 201);
}

export async function PUT(req: NextRequest) {
  const db = getDb();
  const a = requireRole(req, ['admin']);
  if (a instanceof NextResponse) return a;
  const b = await req.json();
  const cur = db.prepare('SELECT * FROM users WHERE id=?').get(b.id) as any;
  if (!cur) return err('Пользователь не найден', 404);
  db.prepare('UPDATE users SET name=?, role=?, pin=?, lang=?, active=? WHERE id=?')
    .run(b.name || cur.name, ROLES.has(b.role) ? b.role : cur.role,
      b.pin && /^\d{4,6}$/.test(String(b.pin)) ? b.pin : cur.pin, b.lang || cur.lang,
      b.active === false || b.active === 0 ? 0 : 1, b.id);
  audit(db, a.name, a.role, 'user.update', 'user', b.id, b);
  return json(db.prepare('SELECT * FROM users WHERE id=?').get(b.id));
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const a = requireRole(req, ['admin']);
  if (a instanceof NextResponse) return a;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return err('id обязателен');
  const cur = db.prepare('SELECT * FROM users WHERE id=?').get(id) as any;
  if (!cur) return err('Пользователь не найден', 404);
  if (cur.role === 'admin') {
    const admins = (db.prepare(`SELECT COUNT(*) c FROM users WHERE role='admin' AND active=1`).get() as any).c;
    if (admins <= 1) return err('Нельзя удалить последнего активного администратора', 409);
  }
  db.prepare('DELETE FROM users WHERE id=?').run(id);
  audit(db, a.name, a.role, 'user.delete', 'user', id, { name: cur.name });
  return json({ deleted: true });
}
