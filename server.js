const config = require('./src/config');
const { initDb } = require('./src/db');
const { startAnonymizationScheduler } = require('./src/utils/anonymizer');
const { startCleanupScheduler } = require('./src/middleware/rateLimiter');

async function start() {
  // Initialize database (must complete before app handles requests)
  await initDb();

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
