# Security Policy & Features

This document tracks all security measures implemented in the ShopSurvey application.

---

## Table of Contents
1. [Authentication & Sessions](#authentication--sessions)
2. [Password Policy](#password-policy)
3. [Rate Limiting](#rate-limiting)
4. [Security Headers](#security-headers)
5. [Audit Logging](#audit-logging)
6. [Input Validation](#input-validation)
7. [Access Control](#access-control)
8. [Data Protection](#data-protection)
9. [API Security](#api-security)
10. [Dependency Security](#dependency-security)

---

## Authentication & Sessions

### Implementation
- **Framework**: NextAuth.js v5 with JWT strategy
- **Password Hashing**: bcryptjs with cost factor 12
- **File**: `src/lib/auth.ts`

### Session Configuration
| Setting | Value | Description |
|---------|-------|-------------|
| Strategy | JWT | Stateless token-based sessions |
| Max Age | 24 hours | Session expiration time |
| Update Age | 1 hour | Token refresh interval on activity |
| Trust Host | true | Required for proxy deployments (Railway) |

### Token Security
- Invite tokens: UUID v4, 7-day expiry
- Password reset tokens: UUID v4, 7-day expiry
- Tokens cleared after single use

---

## Password Policy

### Requirements
| Rule | Requirement |
|------|-------------|
| Minimum Length | 8 characters |
| Uppercase | At least 1 character (A-Z) |
| Lowercase | At least 1 character (a-z) |
| Numbers | At least 1 digit (0-9) |
| Special Characters | At least 1 (!@#$%^&* etc.) |

### Implementation
- **File**: `src/app/api/auth/setup-password/route.ts`
- **Validation**: Zod schema with regex patterns

### Error Messages (Japanese)
- `パスワードは8文字以上必要です`
- `パスワードには大文字を含めてください`
- `パスワードには小文字を含めてください`
- `パスワードには数字を含めてください`
- `パスワードには特殊文字を含めてください`

---

## Rate Limiting

### Implementation
- **File**: `src/lib/rate-limit.ts`
- **Storage**: In-memory Map (consider Redis for multi-instance)
- **Cleanup**: Expired entries purged every 5 minutes

### Rate Limits by Endpoint

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| Login | 5 requests | 15 minutes | IP address |
| Password Setup | 5 requests | 15 minutes | IP address |
| Password Reset | 3 requests | 1 hour | IP address |
| Survey Response | 10 requests | 1 hour | IP address |
| Survey Email Send | 100 requests | 1 hour | Admin ID |
| General API | 100 requests | 1 minute | IP address |

### Response
- HTTP Status: 429 Too Many Requests
- Header: `Retry-After: <seconds>`
- Body: `{ error: "リクエスト回数の上限に達しました...", retryAfter: <seconds> }`

### Protected Endpoints
- `POST /api/auth/setup-password`
- `POST /api/auth/forgot-password`
- `POST /api/responses`

---

## Security Headers

### Implementation
- **File**: `next.config.js`
- **Applied to**: All routes (`/:path*`)

### Headers Configured

| Header | Value | Purpose |
|--------|-------|---------|
| X-Frame-Options | DENY | Prevent clickjacking |
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| X-XSS-Protection | 1; mode=block | Browser XSS filter |
| Referrer-Policy | strict-origin-when-cross-origin | Control referrer info |
| Permissions-Policy | camera=(), microphone=(), geolocation=() | Disable browser features |
| Strict-Transport-Security | max-age=31536000; includeSubDomains | Force HTTPS (1 year) |
| Content-Security-Policy | See below | XSS/injection protection |

### Content Security Policy

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self' https:;
frame-ancestors 'none';
```

---

## Audit Logging

### Implementation
- **Files**: `src/lib/audit.ts`, `prisma/schema.prisma`
- **Storage**: PostgreSQL `audit_logs` table

### Tracked Events

| Action | Description | Tracked Data |
|--------|-------------|--------------|
| LOGIN_SUCCESS | Successful login | User ID, email |
| LOGIN_FAILURE | Failed login attempt | Email, IP |
| LOGOUT | User logout | User ID |
| PASSWORD_CHANGED | Password set/changed | User ID |
| PASSWORD_RESET_REQUESTED | Reset email sent | User ID, email |
| ADMIN_CREATED | New admin created | Admin ID, creator |
| ADMIN_UPDATED | Admin modified | Admin ID, changes |
| ADMIN_DELETED | Admin removed | Admin ID |
| ADMIN_INVITED | Invitation sent | Email, access level |
| SHOP_CREATED | New shop created | Shop ID |
| SHOP_UPDATED | Shop modified | Shop ID |
| SHOP_DELETED | Shop removed | Shop ID |
| COMPANY_CREATED | New company created | Company ID |
| COMPANY_UPDATED | Company modified | Company ID |
| ACCESS_DENIED | Unauthorized access attempt | Resource, user |

### Log Entry Fields
- `id`: Unique identifier
- `action`: Event type (enum)
- `userId`: Acting user ID
- `userEmail`: Acting user email
- `userRole`: User role at time of action
- `targetType`: Resource type (admin, shop, etc.)
- `targetId`: Resource ID
- `ipAddress`: Client IP
- `userAgent`: Browser/client info
- `details`: JSON additional context
- `createdAt`: Timestamp

---

## Input Validation

### Implementation
- **Library**: Zod
- **Pattern**: Validate at API boundary, before database operations

### Validated Inputs

| Endpoint | Validated Fields |
|----------|------------------|
| Survey Response | Q1-Q9 (1-5), Q10 (0-10), shopId |
| Admin Invite | name, email, isFullAccess, shopIds |
| Shop Create | name, parentId, address |
| Password Setup | token, password (complexity) |
| Forgot Password | email format |

### File Upload Limits
| File Type | Max Size |
|-----------|----------|
| CSV Import (Admins) | 10 MB |
| CSV Import (Shops) | 10 MB |

---

## Access Control

### Role Hierarchy
1. **SysAdmin**: Platform-level, manages companies
2. **Admin (Full Access)**: Company-level, all shops
3. **Admin (Limited)**: Company-level, assigned shops only

### Route Protection

| Route Pattern | Required Role |
|---------------|---------------|
| `/sysadmin/*`, `/companies/*` | sysadmin |
| `/dashboard`, `/shops`, `/reports`, `/admins` | admin or sysadmin |
| `/survey/*` | Public (no auth) |
| `/login`, `/setup-password`, `/forgot-password` | Public |

### API Authorization Pattern
1. Verify session exists
2. Check user role matches requirement
3. Verify company ownership (admin.companyId)
4. Verify resource access (shop hierarchy)

### Shop Access Control
- **File**: `src/lib/access.ts`
- Full access admins: All company shops
- Limited admins: Only assigned shops + descendants

---

## Data Protection

### Sensitive Data Handling

| Data Type | Protection |
|-----------|------------|
| Passwords | bcrypt hash (cost 12), never logged |
| Invite Tokens | Not returned in API responses |
| API Keys | Server-side only, not exposed to client |
| Session Tokens | HttpOnly cookies (via NextAuth) |

### Database Security
- Prisma ORM prevents SQL injection
- Parameterized queries for raw SQL
- Company isolation on all queries

### Environment Variables
- `.env` excluded from git
- `.env.example` provided as template
- Secrets never logged (except truncated for debug)

---

## API Security

### Response Hardening
- Minimal data in responses (no tokens, internal IDs where unnecessary)
- Generic error messages (prevent enumeration)
- Consistent error shapes

### Email Enumeration Prevention
- Forgot password always returns success
- No distinction between valid/invalid emails

### CORS
- Default Next.js CORS (same-origin)
- API routes handle own authorization

---

## Dependency Security

### Security-Related Packages
| Package | Version | Purpose |
|---------|---------|---------|
| bcryptjs | ^2.4.3 | Password hashing |
| zod | ^3.23.0 | Input validation |
| next-auth | ^5.0.0-beta.19 | Authentication |
| @prisma/client | ^5.22.0 | Database ORM |

### Vulnerability Management
- Run `npm audit` regularly
- Update dependencies for security patches
- Monitor NextAuth v5 for stable release

### Last Security Audit
- **Date**: 2026-01-16
- **Vulnerabilities Fixed**:
  - form-data critical vulnerability
  - cookie moderate vulnerability in @auth/core

---

## Verification Checklist

### Test Security Headers
```bash
curl -I https://your-domain.com
# Verify: X-Frame-Options, CSP, HSTS, etc.
```

### Test Rate Limiting
1. Attempt 6+ failed logins → Should block
2. Request 4+ password resets → Should block
3. Submit 11+ survey responses → Should block

### Test Password Policy
1. Try "password" → Should fail (no uppercase, numbers, special)
2. Try "Password1!" → Should succeed

### Test Audit Logging
```sql
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
```

---

## Future Improvements

### Planned
- [ ] Redis-based rate limiting for multi-instance deployments
- [ ] Two-factor authentication (2FA)
- [ ] Login notifications via email
- [ ] Session management UI (view/revoke sessions)
- [ ] IP allowlisting for admin access

### Considered
- [ ] WebAuthn/Passkeys support
- [ ] Security event webhooks
- [ ] Automated security scanning in CI/CD
- [ ] Penetration testing

---

## Reporting Security Issues

If you discover a security vulnerability, please report it to:
- Email: security@techcrew.co.jp

Please do not create public GitHub issues for security vulnerabilities.

---

*Last Updated: 2026-01-16*
