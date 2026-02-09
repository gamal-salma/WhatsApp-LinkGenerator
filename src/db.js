const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data.db');

let db = null;

/**
 * Wrapper around sql.js that provides a simpler API similar to better-sqlite3.
 * sql.js is pure JS (no native compilation needed).
 */
const dbWrapper = {
  /** Run a statement that doesn't return rows (INSERT, UPDATE, DELETE, CREATE) */
  run(sql, params = []) {
    db.run(sql, params);
    return { changes: db.getRowsModified() };
  },

  /** Get a single row */
  get(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    let row = null;
    if (stmt.step()) {
      const columns = stmt.getColumnNames();
      const values = stmt.get();
      row = {};
      columns.forEach((col, i) => { row[col] = values[i]; });
    }
    stmt.free();
    return row;
  },

  /** Get all matching rows */
  all(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    const columns = stmt.getColumnNames();
    while (stmt.step()) {
      const values = stmt.get();
      const row = {};
      columns.forEach((col, i) => { row[col] = values[i]; });
      rows.push(row);
    }
    stmt.free();
    return rows;
  },

  /** Execute raw SQL (for CREATE TABLE, etc.) */
  exec(sql) {
    db.exec(sql);
  },

  /** Save database to disk */
  save() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  },

  /** Get the raw sql.js database object */
  raw() {
    return db;
  },
};

/** Initialize the database (must be called before using dbWrapper) */
async function initDb() {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS link_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      encrypted_data TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      user_agent TEXT,
      whatsapp_link TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blocked_ips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT UNIQUE NOT NULL,
      reason TEXT NOT NULL,
      blocked_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT,
      is_manual INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS rate_limit_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT NOT NULL,
      requested_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_rate_limit_ip_time
      ON rate_limit_tracking(ip_address, requested_at);

    CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip
      ON blocked_ips(ip_address);

    CREATE INDEX IF NOT EXISTS idx_link_requests_created
      ON link_requests(created_at);
  `);

  dbWrapper.save();
  console.log('Database initialized.');
}

// Auto-save every 30 seconds
setInterval(() => {
  if (db) {
    try { dbWrapper.save(); } catch { /* ignore */ }
  }
}, 30000);

module.exports = { db: dbWrapper, initDb };
