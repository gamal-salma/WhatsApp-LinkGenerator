require('dotenv').config();

const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.db');

async function seed() {
  const SQL = await initSqlJs();

  let db;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Ensure the table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123456';

  // Check if user already exists
  const stmt = db.prepare('SELECT id FROM admin_users WHERE username = ?');
  stmt.bind([username]);
  const exists = stmt.step();
  stmt.free();

  if (!exists) {
    const hash = bcrypt.hashSync(password, 12);
    db.run('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', [username, hash]);
    console.log(`Admin user "${username}" created.`);
  } else {
    console.log(`Admin user "${username}" already exists, skipping.`);
  }

  // Save to disk
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  db.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
