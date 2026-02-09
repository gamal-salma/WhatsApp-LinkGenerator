const { db } = require('../db');

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 50;
const AUTO_BLOCK_HOURS = 1;

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;

  // Check if IP is blocked
  const blocked = db.get(
    `SELECT id FROM blocked_ips WHERE ip_address = ? AND (expires_at IS NULL OR expires_at > datetime('now'))`,
    [ip]
  );
  if (blocked) {
    return res.status(403).json({ error: 'Your IP has been temporarily blocked due to excessive requests.' });
  }

  // Count requests in the current window
  const row = db.get(
    `SELECT COUNT(*) as cnt FROM rate_limit_tracking WHERE ip_address = ? AND requested_at > datetime('now', ?)`,
    [ip, `-${WINDOW_SECONDS} seconds`]
  );
  const cnt = row ? row.cnt : 0;

  if (cnt >= MAX_REQUESTS) {
    // Auto-block for 1 hour
    db.run(
      `INSERT OR IGNORE INTO blocked_ips (ip_address, reason, expires_at) VALUES (?, 'Rate limit exceeded', datetime('now', ?))`,
      [ip, `+${AUTO_BLOCK_HOURS} hours`]
    );
    db.save();
    return res.status(429).json({
      error: 'Rate limit exceeded. You have been blocked for 1 hour.',
      retryAfter: AUTO_BLOCK_HOURS * 3600,
    });
  }

  // Record this request
  db.run(`INSERT INTO rate_limit_tracking (ip_address) VALUES (?)`, [ip]);

  // Set rate limit headers
  res.set('X-RateLimit-Limit', String(MAX_REQUESTS));
  res.set('X-RateLimit-Remaining', String(MAX_REQUESTS - cnt - 1));

  next();
}

function startCleanupScheduler() {
  function cleanup() {
    try {
      db.run(`DELETE FROM rate_limit_tracking WHERE requested_at < datetime('now', '-5 minutes')`);
      db.run(`DELETE FROM blocked_ips WHERE expires_at IS NOT NULL AND expires_at < datetime('now') AND is_manual = 0`);
      db.save();
    } catch (err) {
      console.error('Rate limit cleanup error:', err.message);
    }
  }

  // Run once at startup (after a short delay to let DB init)
  setTimeout(cleanup, 2000);
  // Run every 5 minutes
  setInterval(cleanup, 5 * 60 * 1000);
}

module.exports = { rateLimiter, startCleanupScheduler };
