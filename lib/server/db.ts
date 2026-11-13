// SMART PRICE — SQLite database layer (better-sqlite3).
// Real working database for the hackathon prototype. File: data/smartprice.db
// The Supabase clients (lib/supabase/*) from LunarEC are kept for future cloud sync.

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = process.env.SMARTPRICE_DB || path.join(DATA_DIR, 'smartprice.db');

let _db: Database.Database | null = null;

function schema(db: Database.Database) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('specialist','analyst','admin')),
      pin TEXT NOT NULL,
      lang TEXT NOT NULL DEFAULT 'kk',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('supermarket','shop','market')),
      region_code TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT,
      lat REAL,
      lng REAL,
      monitoring_status TEXT NOT NULL DEFAULT 'active' CHECK(monitoring_status IN ('active','paused')),
      last_checked_at TEXT,
      is_demo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      base_key TEXT NOT NULL,
      name_kk TEXT NOT NULL,
      name_ru TEXT NOT NULL,
      name_en TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('dairy','groceries','vegetables','other')),
      brand TEXT,
      producer TEXT,
      fat REAL,
      amount REAL NOT NULL,
      unit TEXT NOT NULL CHECK(unit IN ('kg','l','pcs')),
      package TEXT NOT NULL,
      barcode TEXT,
      is_demo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_products_base ON products(base_key);

    CREATE TABLE IF NOT EXISTS price_entries (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      price REAL NOT NULL CHECK(price > 0),
      collected_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','excel','photo','demo')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','flagged')),
      entered_by TEXT,
      note TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_price_lookup ON price_entries(product_id, store_id, collected_at);
    CREATE INDEX IF NOT EXISTS idx_price_date ON price_entries(collected_at);

    CREATE TABLE IF NOT EXISTS anomalies (
      id TEXT PRIMARY KEY,
      price_entry_id TEXT,
      product_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('spike','drop','outlier')),
      severity TEXT NOT NULL CHECK(severity IN ('high','medium','low')),
      change_pct REAL,
      metric TEXT NOT NULL,
      value REAL,
      prev_price REAL,
      new_price REAL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','review','confirmed','dismissed')),
      reviewer TEXT,
      decision_note TEXT,
      detected_at TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(status);

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      price_entry_id TEXT,
      store_id TEXT,
      product_id TEXT,
      photo_b64 TEXT,
      checked_at TEXT NOT NULL,
      employee_name TEXT,
      comment TEXT,
      ocr_price REAL,
      ocr_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      ref_type TEXT NOT NULL CHECK(ref_type IN ('price','anomaly')),
      ref_id TEXT NOT NULL,
      author TEXT NOT NULL,
      role TEXT,
      type TEXT NOT NULL CHECK(type IN ('comment','flag','conclusion','transfer')),
      content TEXT NOT NULL,
      decision TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_comments_ref ON comments(ref_type, ref_id);

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      product_a_id TEXT NOT NULL,
      product_b_id TEXT NOT NULL,
      confidence REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'suggested' CHECK(status IN ('suggested','confirmed','rejected')),
      confirmed_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      role TEXT,
      action TEXT NOT NULL,
      entity TEXT,
      entity_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK(kind IN ('anomaly','system','demo')),
      title TEXT NOT NULL,
      message TEXT,
      severity TEXT NOT NULL DEFAULT 'info' CHECK(severity IN ('info','warning','danger','success')),
      ref_id TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export function getDb(): Database.Database {
  if (_db) return _db;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  schema(db);
  _db = db;
  return db;
}

export const uid = (prefix = 'sp') => `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 18)}`;

export const nowIso = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);

// ---------- audit ----------
export function audit(db: Database.Database, actor: string, role: string, action: string, entity: string, entityId: string | null, details?: unknown) {
  db.prepare(`INSERT INTO audit_log (id, actor, role, action, entity, entity_id, details, created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(uid('aud'), actor, role, action, entity, entityId, details ? JSON.stringify(details) : null, nowIso());
}

export function notify(db: Database.Database, kind: 'anomaly' | 'system' | 'demo', title: string, message: string, severity: 'info' | 'warning' | 'danger' | 'success', refId?: string) {
  db.prepare(`INSERT INTO notifications (id, kind, title, message, severity, ref_id, read, created_at) VALUES (?,?,?,?,?,?,0,?)`)
    .run(uid('ntf'), kind, title, message, severity, refId || null, nowIso());
}
