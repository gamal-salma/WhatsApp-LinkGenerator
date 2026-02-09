const express = require('express');
const path = require('path');
const morgan = require('morgan');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const config = require('./config');
const { securityHeaders, csrfProtection } = require('./middleware/securityHeaders');
const { rateLimiter } = require('./middleware/rateLimiter');
const { sanitizeBody } = require('./middleware/inputSanitizer');
const generateRoutes = require('./routes/generate');
const adminRoutes = require('./routes/admin');

const app = express();

// Trust proxy (Render, etc.)
if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

// Request logging
app.use(morgan('short'));

// Security headers (helmet + custom)
app.use(securityHeaders);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Sessions (in-memory with periodic pruning)
app.use(session({
  store: new MemoryStore({
    checkPeriod: 86400000, // prune expired entries every 24h
  }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: 'sid',
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.nodeEnv === 'production',
    maxAge: 1000 * 60 * 60 * 2, // 2 hours
  },
}));

// Input sanitization for all POST/PUT/PATCH bodies
app.use(sanitizeBody);

// Rate limiting on API routes
app.use('/api/generate', rateLimiter);

// CSRF token endpoint (GET returns token, POST routes check it)
app.get('/api/csrf-token', (req, res) => {
  const crypto = require('crypto');
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.json({ csrfToken: req.session.csrfToken });
});

// CSRF protection on state-changing routes
app.use('/api', csrfProtection);

// API routes
app.use('/api', generateRoutes);
app.use('/api/admin', adminRoutes);

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// 404 for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
