import initSqlJs from 'sql.js';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || join(DATA_DIR, 'waas.db');
let db = null;
let SQL = null;

// Thin wrapper to give us a familiar API
class DbWrapper {
  #db;

  constructor(sqlDb) {
    this.#db = sqlDb;
  }

  exec(sql) {
    this.#db.exec(sql);
    return { changes: this.#db.getRowsModified() };
  }

  prepare(sql) {
    const stmt = this.#db.prepare(sql);
    return new StmtWrapper(stmt);
  }

  get(sql, ...params) {
    const stmt = this.#db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  all(sql, ...params) {
    const stmt = this.#db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  run(sql, ...params) {
    const stmt = this.#db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    stmt.step();
    stmt.free();
    return { changes: this.#db.getRowsModified() };
  }

  pragma(str) {
    this.#db.exec(`PRAGMA ${str}`);
  }

  close() {
    const data = this.#db.export();
    writeFileSync(DB_PATH, Buffer.from(data));
    this.#db.close();
  }

  export() {
    return this.#db.export();
  }
}

class StmtWrapper {
  #stmt;
  constructor(stmt) { this.#stmt = stmt; }
  bind(params) { this.#stmt.bind(params); }
  step() { return this.#stmt.step(); }
  get() { return this.#stmt.getAsObject(); }
  free() { this.#stmt.free(); }
}

export async function initDb() {
  if (SQL === null) {
    SQL = await initSqlJs();
  }

  if (db) return db;

  let sqlDb;
  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    sqlDb = new SQL.Database(buffer);
  } else {
    sqlDb = new SQL.Database();
  }

  db = new DbWrapper(sqlDb);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  return db;
}

function initSchema(d) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('provisioning','active','suspended','deactivated')),
      custom_domain TEXT,
      fallback_subdomain TEXT NOT NULL UNIQUE,
      config_payload TEXT NOT NULL DEFAULT '{}',
      activation_token TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_custom_domain ON tenants(custom_domain) WHERE custom_domain IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
    CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

    CREATE TABLE IF NOT EXISTS content_blocks (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      slot_key TEXT NOT NULL,
      content_payload TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1,
      is_published INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tenant_id, slot_key)
    );

    CREATE INDEX IF NOT EXISTS idx_content_tenant ON content_blocks(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_content_published ON content_blocks(tenant_id, is_published);

    CREATE TABLE IF NOT EXISTS domain_tasks (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      hostname TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','provisioning','active','error','deleted')),
      ssl_status TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_domain_tenant ON domain_tasks(tenant_id);
  `);
}

export async function closeDb() {
  if (db) {
    try { db.close(); } catch (_) {}
    db = null;
  }
}

// Export for routes to get the db instance
export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}
