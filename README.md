# WhatsApp Link Generator

A secure web application that generates WhatsApp message links (`https://wa.me/[phone]?text=[message]`) with QR codes, without requiring users to save contacts. Includes an admin dashboard with analytics, log management, and abuse detection.

## Features

- **Link Generation** — Enter a phone number (E.164 format) and optional message to get a shareable WhatsApp link + QR code
- **AES-256-GCM Encryption** — Phone numbers and messages are encrypted at rest in the database
- **Rate Limiting** — Custom implementation: 50 requests per IP per 60 seconds, auto-blocks abusive IPs for 1 hour
- **Admin Dashboard** — Login-protected panel with analytics, paginated request logs (decrypted), and IP block/unblock management
- **CSRF Protection** — Session-bound token via `X-CSRF-Token` header (no deprecated `csurf`)
- **XSS Prevention** — Input sanitization on all request bodies + Content Security Policy via Helmet
- **SQL Injection Prevention** — All queries use parameterized `?` placeholders
- **Secure Sessions** — httpOnly, sameSite strict, secure cookies with server-side session store
- **Password Hashing** — bcrypt with 12 salt rounds
- **Data Anonymization** — Automatic PII anonymization for records older than 30 days

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | SQLite via sql.js (pure JS, no native compilation) |
| Frontend | Vanilla HTML/CSS/JS |
| Auth | express-session + bcryptjs |
| Security | helmet, AES-256-GCM, custom rate limiter |
| QR Codes | qrcode (server-side generation) |

## Project Structure

```
├── server.js                  # Entry point
├── seed-admin.js              # Creates admin user on startup
├── src/
│   ├── app.js                 # Express setup, middleware, routes
│   ├── db.js                  # SQLite connection + schema
│   ├── config.js              # Environment variable loading
│   ├── middleware/
│   │   ├── rateLimiter.js     # 50req/60s + auto-block
│   │   ├── auth.js            # Session-based admin guard
│   │   ├── securityHeaders.js # Helmet + CSRF
│   │   └── inputSanitizer.js  # XSS prevention
│   ├── utils/
│   │   ├── encryption.js      # AES-256-GCM encrypt/decrypt
│   │   ├── validation.js      # E.164 phone, message length
│   │   └── anonymizer.js      # 30-day PII anonymization
│   └── routes/
│       ├── generate.js        # POST /api/generate
│       └── admin.js           # /api/admin/* routes
└── public/                    # Static frontend
    ├── index.html             # Link generator page
    ├── admin.html             # Admin dashboard
    ├── css/style.css
    └── js/
        ├── app.js             # Generator frontend logic
        └── admin.js           # Admin frontend logic
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example env file and edit as needed:

```bash
cp .env.example .env
```

Key variables:
- `ENCRYPTION_KEY` — 64 hex characters (32 bytes). Generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `SESSION_SECRET` — Any long random string
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — Credentials for the admin panel

### 3. Run

```bash
npm start
```

This seeds the admin user and starts the server. Open:
- **http://localhost:3000** — Link generator
- **http://localhost:3000/admin.html** — Admin dashboard

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/generate` | POST | Public | Generate WhatsApp link + QR code |
| `/api/csrf-token` | GET | Public | Get CSRF token for session |
| `/api/admin/login` | POST | Public | Admin login |
| `/api/admin/logout` | POST | Admin | Admin logout |
| `/api/admin/analytics` | GET | Admin | Dashboard statistics |
| `/api/admin/logs` | GET | Admin | Paginated request logs (decrypted) |
| `/api/admin/blocked-ips` | GET | Admin | List blocked IPs |
| `/api/admin/block-ip` | POST | Admin | Manually block an IP |
| `/api/admin/unblock-ip` | POST | Admin | Unblock an IP |
| `/api/admin/logs/purge` | DELETE | Admin | Anonymize records older than 30 days |

## Deployment (Render)

A `render.yaml` is included for one-click deploy to Render free tier:

1. Push this repo to GitHub
2. Connect the repo in Render dashboard
3. Set `ADMIN_PASSWORD` in Render environment variables
4. Deploy

> **Note:** Render free tier has an ephemeral filesystem — the SQLite database resets on each deploy. This is acceptable for a demo.
