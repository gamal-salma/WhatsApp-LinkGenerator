# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhatsApp Link Generator — a web application that generates WhatsApp message links (`https://wa.me/[phone]?text=[encoded_message]`) with QR codes, without requiring users to save contacts. Includes an admin dashboard with analytics, log management, and abuse detection.

**Status:** Greenfield project. Only the specification exists at `docs/specs/whatsapp-link-generator-spec.md`. No code has been implemented yet.

## Architecture (per spec)

The project should be structured as a separate **frontend** and **backend**:

- **Backend:** Node.js/Express or Python/Flask/FastAPI with PostgreSQL or MongoDB
- **Frontend:** React+TypeScript or Vue.js or vanilla JS with Tailwind/Bootstrap
- **Deployment:** Docker containerized

### API Surface

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/generate` | POST | Public | Generate WhatsApp link + QR code |
| `/api/admin/login` | POST | Public | Admin authentication |
| `/api/admin/logs` | GET | Admin | Filtered log retrieval |
| `/api/admin/analytics` | GET | Admin | Dashboard statistics |
| `/api/admin/block-ip` | POST | Admin | Manual IP blocking |
| `/api/admin/logs/purge` | DELETE | Admin | Purge logs older than 30 days |

### Database Tables

Four tables: `link_requests`, `blocked_ips`, `admin_users`, `rate_limit_tracking`. Full schemas are in the spec document.

### Key Security Requirements

- **Encryption:** AES-256-GCM for phone numbers and messages at rest
- **Rate limiting:** 50 requests/IP/60 seconds; auto-block for 1 hour on violation
- **Auth:** JWT or session-based for admin; bcrypt (12 salt rounds) for passwords
- **Validation:** E.164 phone format, 65,536 char message limit, XSS/SQLi prevention
- **Data retention:** Auto-anonymize PII after 30 days
- **GDPR:** Right to be forgotten endpoint, data export

## Implementation Order (per spec)

1. Initialize project structure (frontend/backend dirs, git, package manager)
2. Backend: server, DB connection, encryption utils, API endpoints, rate limiting, auth
3. Frontend: link generation form, QR code, admin dashboard, charts
4. Security hardening: input validation, CSRF protection, secure headers, logging
5. Testing and documentation

## Environment Variables Needed

`ENCRYPTION_KEY` (32 bytes for AES-256), database credentials, admin JWT secret. Use `.env` file; never commit secrets.
