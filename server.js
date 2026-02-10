const bcrypt = require('bcryptjs');
const config = require('./src/config');
const { initDb, db } = require('./src/db');
const { startAnonymizationScheduler } = require('./src/utils/anonymizer');
const { startCleanupScheduler } = require('./src/middleware/rateLimiter');

function seedAdmin() {
  const username = config.adminUsername;
  const password = config.adminPassword;

  console.log(`Seeding admin: username="${username}", password length=${password ? password.length : 0}`);

  // Always update the password hash to match current env var
  const existing = db.get('SELECT id FROM admin_users WHERE username = ?', [username]);
  if (!existing) {
    const hash = bcrypt.hashSync(password, 12);
    db.run('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', [username, hash]);
    db.save();
    console.log(`Admin user "${username}" created.`);
  } else {
    // Update password hash in case ADMIN_PASSWORD env var changed
    const hash = bcrypt.hashSync(password, 12);
    db.run('UPDATE admin_users SET password_hash = ? WHERE username = ?', [hash, username]);
    db.save();
    console.log(`Admin user "${username}" password updated.`);
  }
}

async function start() {
  // Initialize database (must complete before app handles requests)
  await initDb();

  // Seed admin user
  seedAdmin();

  // Import app after DB is ready (modules reference db at require time)
  const app = require('./src/app');

  // Start background jobs
  startAnonymizationScheduler();
  startCleanupScheduler();

  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port} [${config.nodeEnv}]`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
