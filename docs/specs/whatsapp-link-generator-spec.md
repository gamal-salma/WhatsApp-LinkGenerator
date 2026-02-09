# WhatsApp Link Generator - Project Specification

## Project Overview

Build a secure web application that generates WhatsApp message links without requiring users to save contacts. The application includes comprehensive logging, security features, and abuse detection mechanisms.

## Core Features

### 1. Link Generation (MVP)
- **Input Fields:**
  - Phone number (with international format validation)
  - Message text (optional pre-filled message)
- **Output:**
  - Clickable WhatsApp link in format: `https://wa.me/[phone]?text=[encoded_message]`
  - QR code for mobile scanning
  - Copy-to-clipboard functionality

### 2. Data Logging & Analytics
- **Capture for each request:**
  - Phone number (encrypted at rest)
  - Message text (encrypted at rest)
  - IP address (with privacy controls)
  - Timestamp
  - User agent
  - Geographic location (optional, based on IP)
  - Session ID

### 3. Security Features
- **Input Validation:**
  - Phone number format validation (E.164 international format)
  - Message length limits (WhatsApp max: 65,536 characters)
  - SQL injection prevention
  - XSS protection
  
- **Data Protection:**
  - Encrypt PII (phone numbers, messages) using AES-256
  - Secure database configuration
  - Environment variables for sensitive configs
  - HTTPS enforcement

- **Access Control:**
  - Admin dashboard protected by authentication
  - Role-based access control (RBAC)
  - Secure session management

### 4. Abuse Detection System
- **Rate Limiting:**
  - Maximum 50 requests per IP per 60 seconds
  - Automatic IP blocking for 1 hour on violation
  - Configurable thresholds

- **Pattern Detection:**
  - Monitor for suspicious activity
  - Alert on unusual patterns
  - Log all blocked attempts

### 5. Admin Dashboard
- **Analytics View:**
  - Total links generated
  - Requests per day/week/month charts
  - Top countries/regions
  - Most common phone number prefixes
  
- **Log Management:**
  - Searchable, filterable log viewer
  - Export logs (CSV/JSON)
  - Manual IP blocking/unblocking
  
- **Data Retention:**
  - Automatic anonymization after 30 days
  - Manual purge functionality
  - Compliance with privacy regulations

## Technical Stack Recommendations

### Backend
- **Framework:** Node.js with Express.js OR Python with Flask/FastAPI
- **Database:** PostgreSQL (for structured logging) OR MongoDB
- **Encryption:** crypto library (Node.js) or cryptography (Python)
- **Authentication:** JWT tokens or session-based auth

### Frontend
- **Framework:** React with TypeScript OR Vue.js OR vanilla JavaScript
- **Styling:** Tailwind CSS or Bootstrap
- **QR Generation:** qrcode.js library
- **Charts:** Chart.js or Recharts

### Infrastructure
- **Deployment:** Docker containerization
- **Environment:** .env file for configuration
- **Logging:** Winston (Node.js) or Python logging module

## Database Schema

### Tables Required

#### 1. `link_requests`
```sql
CREATE TABLE link_requests (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255),
    phone_number_encrypted TEXT NOT NULL,
    message_encrypted TEXT,
    encryption_iv VARCHAR(255),
    ip_address INET NOT NULL,
    user_agent TEXT,
    country_code VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    anonymized_at TIMESTAMP
);
```

#### 2. `blocked_ips`
```sql
CREATE TABLE blocked_ips (
    id SERIAL PRIMARY KEY,
    ip_address INET UNIQUE NOT NULL,
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unblock_at TIMESTAMP,
    reason VARCHAR(255),
    request_count INTEGER
);
```

#### 3. `admin_users`
```sql
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);
```

#### 4. `rate_limit_tracking`
```sql
CREATE TABLE rate_limit_tracking (
    ip_address INET NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ip_address, window_start)
);
```

## API Endpoints

### Public Endpoints

#### POST `/api/generate`
Generate WhatsApp link
- **Request Body:**
  ```json
  {
    "phoneNumber": "+1234567890",
    "message": "Hello, this is a test message"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "link": "https://wa.me/1234567890?text=Hello%2C%20this%20is%20a%20test%20message",
    "qrCode": "data:image/png;base64,..."
  }
  ```

### Admin Endpoints (Protected)

#### POST `/api/admin/login`
Authenticate admin user

#### GET `/api/admin/logs`
Retrieve filtered logs
- **Query Params:** `?page=1&limit=50&startDate=2024-01-01&endDate=2024-12-31`

#### GET `/api/admin/analytics`
Get dashboard statistics

#### POST `/api/admin/block-ip`
Manually block an IP address

#### DELETE `/api/admin/logs/purge`
Purge old logs (30+ days)

## Security Implementation Details

### 1. Encryption Strategy
```javascript
// Example: AES-256-GCM encryption
const algorithm = 'aes-256-gcm';
const key = process.env.ENCRYPTION_KEY; // 32 bytes
const iv = crypto.randomBytes(16);

function encrypt(text) {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
        encrypted: encrypted.toString('hex'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}
```

### 2. Rate Limiting Logic
```javascript
async function checkRateLimit(ipAddress) {
    const now = new Date();
    const windowStart = new Date(now - 60000); // 60 seconds ago
    
    const requestCount = await db.query(
        'SELECT COUNT(*) FROM rate_limit_tracking WHERE ip_address = $1 AND window_start > $2',
        [ipAddress, windowStart]
    );
    
    if (requestCount > 50) {
        await blockIP(ipAddress, 3600); // Block for 1 hour
        return false;
    }
    
    return true;
}
```

### 3. Input Validation
```javascript
function validatePhoneNumber(phone) {
    // E.164 format: +[country code][number]
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
}

function sanitizeMessage(message) {
    // Remove potential XSS vectors
    return message
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .slice(0, 65536); // WhatsApp limit
}
```

### 4. Password Hashing (Admin Users)
```javascript
const bcrypt = require('bcrypt');
const saltRounds = 12;

async function hashPassword(password) {
    return await bcrypt.hash(password, saltRounds);
}

async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}
```

## Privacy & Compliance

### Data Retention Policy
- **Active logs:** Stored with full data for 30 days
- **After 30 days:** Automatically anonymize by:
  - Removing phone numbers
  - Removing message content
  - Masking IP addresses (keep only first 2 octets)
  - Keeping only aggregate statistics

### GDPR Considerations
- Implement "Right to be Forgotten" endpoint
- Provide data export functionality
- Clear privacy policy on frontend
- Cookie consent banner if using analytics

## User Interface Requirements

### Homepage (Public)
- Clean, minimal design
- Phone number input with country code selector
- Message textarea with character counter
- "Generate Link" button
- Display generated link with copy button
- QR code display
- Privacy notice

### Admin Dashboard
- Login page
- Navigation sidebar with sections:
  - Analytics Overview
  - Log Viewer
  - IP Management
  - Settings
- Responsive design for mobile access

## Testing Requirements

### Unit Tests
- Phone number validation functions
- Encryption/decryption functions
- Rate limiting logic
- Input sanitization

### Integration Tests
- API endpoint responses
- Database operations
- Authentication flow

### Security Tests
- SQL injection attempts
- XSS attack vectors
- Rate limit enforcement
- Unauthorized access attempts

## Deployment Checklist

- [ ] Set up environment variables (.env file)
- [ ] Configure database with proper indexes
- [ ] Enable HTTPS/SSL certificates
- [ ] Set up automated backups
- [ ] Configure firewall rules
- [ ] Set up logging and monitoring
- [ ] Create initial admin user
- [ ] Test all security features
- [ ] Set up automated data anonymization cron job
- [ ] Document API for future extensions

## Future Enhancement Ideas

### Phase 2 Features
1. **User Accounts:**
   - Save link generation history
   - Personal analytics
   - Favorite contacts

2. **Bulk Generation:**
   - Upload CSV of contacts
   - Generate multiple links at once
   - Campaign tracking

3. **REST API for Developers:**
   - API key management
   - Rate limiting per API key
   - Comprehensive API documentation

4. **Advanced Analytics:**
   - Link click tracking (with privacy consent)
   - Conversion metrics
   - A/B testing for messages

5. **Multi-Platform Support:**
   - Telegram link generation
   - Signal link generation
   - Generic messaging links

## Success Metrics

- Successfully generate valid WhatsApp links
- Zero security vulnerabilities in penetration testing
- All PII properly encrypted at rest
- Rate limiting blocks >95% of abuse attempts
- Admin dashboard loads analytics in <2 seconds
- 100% test coverage for security-critical functions

---

## Getting Started Instructions for Claude Code

1. **Initialize Project:**
   - Create project structure with separate frontend/backend directories
   - Set up version control (git)
   - Initialize package management (npm/pip)

2. **Backend First:**
   - Set up Express/Flask server
   - Configure database connection
   - Implement encryption utilities
   - Create API endpoints
   - Add rate limiting middleware
   - Implement authentication

3. **Frontend Development:**
   - Build link generation form
   - Integrate QR code generation
   - Create admin dashboard UI
   - Add charts and analytics views

4. **Security Hardening:**
   - Implement all input validation
   - Add CSRF protection
   - Configure secure headers
   - Set up logging

5. **Testing & Documentation:**
   - Write unit and integration tests
   - Document API endpoints
   - Create deployment guide
   - Write user manual

This specification provides a complete blueprint for building a production-ready WhatsApp Link Generator with enterprise-level security features suitable for your Software Engineering and Cybersecurity assignment.
