# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ShopSurvey is an employee retention survey system for multi-store businesses (restaurants, hotels, retail, entertainment). Employees access surveys via QR codes, and admins view engagement analytics through role-based dashboards.

## Commands

```bash
npm run dev          # Start development server on http://localhost:3000
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:migrate   # Create and apply database migrations
npm run db:push      # Push schema changes without migration (dev only)
npm run db:seed      # Seed questions and benchmark data
```

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
11 questions covering 8 categories plus eNPS and free text:
- Q1-Q9: 5-point scale (Q5 is reverse-scored)
- Q10: 0-10 eNPS scale
- Q11: Free text comments

Scoring logic in `src/lib/scoring.ts` calculates category averages, overall engagement, eNPS (promoters - detractors), and risk levels (CRITICAL/WARNING/CAUTION/STABLE/EXCELLENT).

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

## Environment Variables

Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_URL` - App URL for auth callbacks
- `NEXTAUTH_SECRET` - JWT signing secret
- `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `EMAIL_FROM` - Email service
- `NEXT_PUBLIC_APP_URL` - Public app URL for QR codes
