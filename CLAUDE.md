# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ShopSurvey (BaitoSurvey) is an employee retention survey system for multi-store businesses (restaurants, hotels, retail, entertainment). Employees access surveys via QR codes, and admins view engagement analytics through role-based dashboards.

## Commands

```bash
npm run dev          # Start development server on http://localhost:3000
npm run build        # Build for production (includes prisma generate, db push, and seed)
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:migrate   # Create and apply database migrations
npm run db:push      # Push schema changes without migration (dev only)
npm run db:seed      # Seed questions and benchmark data
```

## Default Login Credentials

After running `npm run db:seed`:
- **SysAdmin**: `admin@test.com` / `password123`

## Security

See `SECURITY.md` for comprehensive security documentation including:
- Rate limiting configuration per endpoint
- Audit logging for all admin actions
- Password policy requirements
- Session expiry settings

## Architecture

### Tech Stack
- **Framework**: Next.js 14 with App Router, React 18, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js v5 (beta) with JWT sessions
- **Styling**: Tailwind CSS with Radix UI components
- **Email**: Mailgun for admin invitations

### Directory Structure
```
src/
├── app/
│   ├── (auth)/          # Login, password setup, forgot password
│   ├── (admin)/         # Company admin routes (dashboard, shops, reports)
│   ├── (sysadmin)/      # System admin routes (company management)
│   ├── api/             # REST API endpoints
│   └── survey/[qrCode]/ # Public survey form (accessed via QR)
├── components/
│   ├── ui/              # Reusable UI components (Button, Card, Input, etc.)
│   ├── charts/          # Data visualization (ScoreRadarChart)
│   └── layouts/         # Admin/SysAdmin sidebar layouts
└── lib/
    ├── auth.ts          # NextAuth configuration
    ├── prisma.ts        # Prisma client singleton
    ├── scoring.ts       # Survey scoring algorithms, risk levels, eNPS
    ├── access.ts        # Shop access control (full vs limited admin access)
    ├── rate-limit.ts    # Rate limiting for API endpoints
    ├── audit.ts         # Audit logging for security events
    ├── mailgun.ts       # Email service
    └── qrcode.ts        # QR code generation
```

### Multi-Tenant Data Model
- **SysAdmin**: Platform-level administrators
- **Company**: Tenant organization with industry type and status
- **Shop**: Store locations with optional hierarchical parent/child relationships
- **Admin**: Company-level users with either full access or specific shop assignments (use `src/lib/access.ts` for access checks)
- **Response**: Survey submissions stored with JSON answers
- **Question**: Survey questions with Japanese (`textJa`) and English (`textEn`) text

### Route Groups
- `(auth)` - Public authentication pages
- `(admin)` - Protected company admin area (middleware-enforced)
- `(sysadmin)` - Protected system admin area
- `/survey/[qrCode]` - Public survey form accessed via QR code

### Survey System
The survey has 12 questions organized as follows:

**8 Driver Dimensions (Q1-Q9, 1-5 scale):**
- Q1-Q2: Manager & Leadership (MANAGER_LEADERSHIP)
- Q3: Schedule & Hours (SCHEDULE_HOURS)
- Q4: Teamwork (TEAMWORK)
- Q5: Workload & Staffing (WORKLOAD_STAFFING) - *reverse scored*
- Q6: Respect & Recognition (RESPECT_RECOGNITION)
- Q7: Pay & Benefits (PAY_BENEFITS)
- Q8: Work Environment (WORK_ENVIRONMENT)
- Q9: Skills & Growth (SKILLS_GROWTH)

**Outcome Measures:**
- Q10: Retention Intention (1-5 scale, RETENTION_INTENTION) - outcome measure
- Q11: eNPS (0-10 scale, ENPS) - stored in `Response.enpsScore`
  - 0-6: Detractors, 7-8: Passives, 9-10: Promoters
- Q12: Free text improvement suggestions - stored in `Response.improvementText`

Scoring logic in `src/lib/scoring.ts` calculates:
- 8-dimension driver scores (radar chart)
- Retention intention outcome score
- eNPS (% promoters - % detractors)
- Risk levels (CRITICAL/WARNING/CAUTION/STABLE/EXCELLENT)

### Route Protection
Middleware at `src/middleware.ts` handles authentication:
- Public: `/`, `/login`, `/setup-password`, `/forgot-password`, `/survey/*`
- Admin routes (`/dashboard`, `/shops`, `/reports`, `/admins`): require `admin` or `sysadmin` role
- SysAdmin routes (`/sysadmin/*`, `/companies/*`): require `sysadmin` role only
- API routes handle their own authorization

### Survey Email Distribution
Admins can send survey invitations via email:
- `SurveyBatch`: Groups invitations sent at once (manual or CSV import)
- `SurveyInvite`: Individual invitation with unique token, tracks open/completion
- Survey links use token-based URLs for tracking (separate from QR code access)

### CSV Import
- **Admins**: `/api/admins/import` - bulk import company admins
- **Shops**: `/api/shops/import` - bulk import shop locations
- Max file size: 10 MB

### Identity Escrow System
Allows respondents to optionally provide encrypted contact information for follow-up on serious concerns:
- **Encryption**: AES-256-GCM encryption via `src/lib/encryption.ts`
- **Content Flagging**: Auto-detection of harassment, safety, crisis, and discrimination keywords via `src/lib/content-flagging.ts`
- **Response fields**: `encryptedIdentity`, `identityConsent`, `flagged`, `flagReason`
- **Access control**: Only SysAdmin can reveal identities, with audit logging
- **SysAdmin pages**: `/flagged` (flagged responses), `/identity-logs` (access audit trail)
- **Admin dashboard**: Shows count of flagged responses with contact prompt

### Authentication Flow
1. SysAdmin creates company and initial admin
2. Admin receives invitation email with token
3. Admin sets password via `/setup-password?token=xxx`
4. JWT-based sessions with role in token (`sysadmin` or `admin`)

## Key Patterns

- Path alias: `@/*` maps to `./src/*`
- Prisma client singleton at `src/lib/prisma.ts` - always import from there
- UI components follow shadcn/ui patterns with `cn()` utility for className merging
- API routes return JSON with consistent error shapes
- All database column names use snake_case (mapped via `@map()`)
- Rate limit sensitive endpoints using `checkRateLimit()` from `src/lib/rate-limit.ts`
- Log security events using `logAuditEvent()` from `src/lib/audit.ts`
- AI analysis results cached in `ResponseAnalysis` table (keyed by shopId + date range)

## Environment Variables

Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string (add `?sslmode=require` for Railway)
- `NEXTAUTH_URL` - Full app URL with https (e.g., `https://your-app.railway.app`)
- `NEXTAUTH_SECRET` - JWT signing secret (generate with `openssl rand -base64 32`)
- `NEXT_PUBLIC_APP_URL` - Same as NEXTAUTH_URL
- `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `EMAIL_FROM` - Email service
- `ANTHROPIC_API_KEY` - For AI comment analysis
- `OPENAI_API_KEY` - Alternative AI provider (optional)
- `IDENTITY_ENCRYPTION_KEY` - 32-byte base64 key for identity encryption (generate with `openssl rand -base64 32`)

## Railway Deployment

The app is configured for Railway deployment:

1. **Build script** automatically runs:
   - `prisma generate` - Generate Prisma client
   - `prisma db push` - Sync database schema
   - `npx tsx prisma/seed.ts` - Seed initial data
   - `next build` - Build Next.js app

2. **Important configuration**:
   - `trustHost: true` is set in NextAuth for proxy compatibility
   - Auth routes use `runtime = 'nodejs'` for bcryptjs compatibility
   - Health check endpoint available at `/api/health`

3. **Environment variables must have**:
   - Full URLs with `https://` prefix for NEXTAUTH_URL and NEXT_PUBLIC_APP_URL
   - A properly generated NEXTAUTH_SECRET (not placeholder text)

## Reports & Analytics

### Report Tabs
- **概要 (Overview)**: Overall scores, category breakdown, eNPS, radar chart
- **トレンド (Trend)**: 12-month score trends and eNPS history
- **AI分析 (AI Analysis)**: AI-powered comment theme analysis (results are cached)
- **詳細分析 (Advanced Analytics)**: Question-level stats, correlations, patterns, percentile ranking

### Shop Comparison
- Compare up to 5 shops at `/reports/compare`
- Parent shops aggregate data from all descendant shops
- Uses optimized SQL aggregation for performance with large datasets

### Performance Optimizations
- Database-level aggregation using raw SQL for large datasets
- In-memory tree building for shop hierarchies
- Client-side caching for AI analysis results between tab switches
