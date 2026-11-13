// SMART PRICE — product matching engine.
// Finds products that are likely the SAME base product but stored under
// different names/packaging ("Молоко 2,5% 1 л" vs "Молоко пастеризованное 1000 мл").
// Similarity = name tokens + category + unit + amount + fatness.

import Database from 'better-sqlite3';
import { Product } from '../sp/types';
import { uid, nowIso } from './db';

const STOP = new Set(['л', 'кг', 'шт', 'г', 'мл', 'лр', 'пастеризованное', 'пастеризованный', 'штук', 'шт.', 'pack', 'pcs']);

export function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/,/g, '.')
    .replace(/\./g, '')
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9 %.-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s: string): string[] {
  return normName(s).split(' ').filter(t => t.length > 1 && !STOP.has(t));
}

export interface MatchCandidate {
  id: string | null;
  product_a: Product;
  product_b: Product;
  confidence: number;
  status: 'suggested' | 'confirmed' | 'rejected';
  confirmed_by: string | null;
  created_at: string;
  reasons: string[];
}

export function scorePair(a: Product, b: Product): { confidence: number; reasons: string[] } {
  if (a.base_key === b.base_key) return { confidence: 1, reasons: ['same base_key'] };
  const reasons: string[] = [];
  let score = 0;
  if (a.category === b.category) { score += 0.15; reasons.push('category'); }
  const ta = new Set(tokens(a.name_ru + ' ' + a.name_kk));
  const tb = new Set(tokens(b.name_ru + ' ' + b.name_kk));
  const inter = [...ta].filter(t => tb.has(t));
  const jaccard = inter.length / Math.max(1, new Set([...ta, ...tb]).size);
  score += jaccard * 0.45;
  if (jaccard > 0.25) reasons.push(`name overlap (${inter.join(', ')})`);
  if (a.unit === b.unit) { score += 0.15; reasons.push('unit'); }
  if (Math.abs(a.amount - b.amount) < 0.05) { score += 0.15; reasons.push('amount'); }
  if (a.fat != null && b.fat != null && Math.abs(a.fat - b.fat) < 0.1) { score += 0.1; reasons.push('fatness'); }
  if (a.brand && b.brand && a.brand.toLowerCase() === b.brand.toLowerCase()) { score += 0.05; reasons.push('brand'); }
  return { confidence: Math.min(0.99, Math.round(score * 100) / 100), reasons };
}

export function buildMatchSuggestions(db: Database.Database): MatchCandidate[] {
  const products = db.prepare('SELECT * FROM products ORDER BY id').all() as Product[];
  const existing = db.prepare('SELECT * FROM matches').all() as any[];
  const out: MatchCandidate[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const a = products[i], b = products[j];
      const key = [a.id, b.id].sort().join('|');
      const { confidence, reasons } = scorePair(a, b);
      if (confidence < 0.45) continue;
      const ex = existing.find(m => [m.product_a_id, m.product_b_id].sort().join('|') === key);
      if (ex) {
        seen.add(key);
        out.push({ id: ex.id, product_a: a, product_b: b, confidence, status: ex.status, confirmed_by: ex.confirmed_by, created_at: ex.created_at, reasons });
      } else if (confidence >= 0.55) {
        const id = uid('mtc');
        db.prepare('INSERT INTO matches (id, product_a_id, product_b_id, confidence, status, created_at) VALUES (?,?,?,?,?,?)')
          .run(id, a.id, b.id, confidence, 'suggested', nowIso());
        out.push({ id, product_a: a, product_b: b, confidence, status: 'suggested', confirmed_by: null, created_at: nowIso(), reasons });
      }
    }
  }
  return out.sort((x, y) => y.confidence - x.confidence);
}

/** Confirm a match: product B is merged into product A's base_key (comparison unifies them). */
export function confirmMatch(db: Database.Database, matchId: string, byUser: string): boolean {
  const m = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as any;
  if (!m) return false;
  db.prepare('UPDATE products SET base_key = ? WHERE id = ?')
    .run(
      (db.prepare('SELECT base_key FROM products WHERE id = ?').get(m.product_a_id) as any)?.base_key,
      m.product_b_id
    );
  db.prepare(`UPDATE matches SET status='confirmed', confirmed_by=? WHERE id=?`).run(byUser, matchId);
  return true;
}

export function rejectMatch(db: Database.Database, matchId: string, byUser: string): boolean {
  const r = db.prepare(`UPDATE matches SET status='rejected', confirmed_by=? WHERE id=? AND status='suggested'`).run(byUser, matchId);
  return r.changes > 0;
}
