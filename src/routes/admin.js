const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { decrypt } = require('../utils/encryption');

const router = express.Router();

// --- Login ---
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const admin = db.get('SELECT * FROM admin_users WHERE username = ?', [username]);
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.adminId = admin.id;
    req.session.adminUsername = admin.username;

    // Generate CSRF token for the session
    const crypto = require('crypto');
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');

    res.json({
      message: 'Login successful',
      csrfToken: req.session.csrfToken,
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- Logout ---
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('sid');
    res.json({ message: 'Logged out' });
  });
});

// --- All routes below require admin auth ---
router.use(requireAdmin);

// --- Analytics ---
router.get('/analytics', (req, res) => {
  try {
    const stats = db.get(`
      SELECT
        (SELECT COUNT(*) FROM link_requests) as total_requests,
        (SELECT COUNT(*) FROM link_requests WHERE created_at > datetime('now', '-1 day')) as today_requests,
        (SELECT COUNT(*) FROM link_requests WHERE created_at > datetime('now', '-7 days')) as week_requests,
        (SELECT COUNT(*) FROM blocked_ips WHERE expires_at IS NULL OR expires_at > datetime('now')) as active_blocks
    `);
    res.json(stats);
  } catch (err) {
    console.error('Analytics error:', err.message);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// --- Logs (paginated, decrypted) ---
router.get('/logs', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const rows = db.all(
      `SELECT id, encrypted_data, iv, auth_tag, ip_address, user_agent, whatsapp_link, created_at
       FROM link_requests ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const countRow = db.get('SELECT COUNT(*) as total FROM link_requests');
    const total = countRow ? countRow.total : 0;

    const logs = rows.map((row) => {
      let phone = '[encrypted]';
      let message = '[encrypted]';

      try {
        const decrypted = JSON.parse(decrypt(row.encrypted_data, row.iv, row.auth_tag));
        phone = decrypted.phone;
        message = decrypted.message;
      } catch {
        // Data may be anonymized or corrupted
      }

      return {
        id: row.id,
        phone,
        message,
        ip_address: row.ip_address,
        user_agent: row.user_agent,
        whatsapp_link: row.whatsapp_link,
        created_at: row.created_at,
      };
    });

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Logs error:', err.message);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// --- Blocked IPs list ---
router.get('/blocked-ips', (req, res) => {
  try {
    const ips = db.all(
      `SELECT * FROM blocked_ips WHERE expires_at IS NULL OR expires_at > datetime('now') ORDER BY blocked_at DESC`
    );
    res.json(ips);
  } catch (err) {
    console.error('Blocked IPs error:', err.message);
    res.status(500).json({ error: 'Failed to fetch blocked IPs' });
  }
});

// --- Block IP ---
router.post('/block-ip', (req, res) => {
  try {
    const { ip, reason } = req.body;
    if (!ip) {
      return res.status(400).json({ error: 'IP address required' });
    }
    db.run(
      `INSERT OR REPLACE INTO blocked_ips (ip_address, reason, is_manual) VALUES (?, ?, 1)`,
      [ip, reason || 'Manually blocked by admin']
    );
    db.save();
    res.json({ message: `IP ${ip} blocked` });
  } catch (err) {
    console.error('Block IP error:', err.message);
    res.status(500).json({ error: 'Failed to block IP' });
  }
});

// --- Unblock IP ---
router.post('/unblock-ip', (req, res) => {
  try {
    const { ip } = req.body;
    if (!ip) {
      return res.status(400).json({ error: 'IP address required' });
    }
    db.run('DELETE FROM blocked_ips WHERE ip_address = ?', [ip]);
    db.save();
    res.json({ message: `IP ${ip} unblocked` });
  } catch (err) {
    console.error('Unblock IP error:', err.message);
    res.status(500).json({ error: 'Failed to unblock IP' });
  }
});

// --- Purge old logs (anonymize) ---
router.delete('/logs/purge', (req, res) => {
  try {
    const { anonymizeOldRecords } = require('../utils/anonymizer');
    const changes = anonymizeOldRecords();
    res.json({ message: `Anonymized ${changes} records older than 30 days` });
  } catch (err) {
    console.error('Purge error:', err.message);
    res.status(500).json({ error: 'Failed to purge logs' });
  }
});

module.exports = router;
