# Kedbyte Payroll

**Multi-tenant UK payroll bureau platform with HMRC RTI compliance built in as a first-class workflow.**

Tax Year 2026/27 · 31 screens · Calculation engine verified to the penny against HMRC canonical proof.

---

## What This Is

Kedbyte Payroll is a production-grade UK payroll bureau SaaS with two surfaces:

1. **Bureau Command Center** — a dark "Void" professional console where payroll professionals run payroll for multiple client companies, submit RTI to HMRC, manage pensions, and generate reports.
2. **Employee Self-Service ("My Pay") Portal** — a personal portal where employees view payslips, request holidays, manage personal details, and access documents.

The calculation engine implements every UK statutory formula for 2026/27 — PAYE (cumulative + W1/M1 + Scottish + Welsh bands), National Insurance (all categories), Student Loans (Plans 1/2/4/5 + Postgrad), Auto-Enrolment, Statutory Pay — and reproduces the HMRC canonical worked proof to the exact penny (net £2,305.44 on £36,000/yr).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | Prisma ORM + SQLite (demo) / PostgreSQL (production) |
| State | Zustand (client), React hooks (server) |
| Icons | Material Symbols Outlined |
| Fonts | Inter (UI) + JetBrains Mono (numbers/refs) |
| Runtime | Bun (dev) / Node.js (production) |

---

## Quick Start

### Prerequisites
- Node.js 18+ or Bun 1.0+
- npm or bun

### Install & Run

```bash
# Install dependencies
bun install
# OR
npm install

# Set up the database
bun run db:push

# Seed demo data (1 bureau, 3 companies, 9+ employees, historical pay runs)
bun run seed

# Start the dev server
bun run dev
# OR
npm run dev
```

The app runs at **http://localhost:3000**

### Demo Accounts

The seed script creates these accounts (any password works in demo mode):

| Surface | Email | Role |
|---|---|---|
| Bureau | `admin@kedbyte.co.uk` | Bureau Admin (full access) |
| Bureau | `admin@smithco.co.uk` | Company Admin (Smith & Co) |
| Portal | `eleanor@smithco.co.uk` | Employee + Manager (approves leave) |
| Portal | `james@smithco.co.uk` | Employee |
| Portal | `priya@acme.io` | Employee (Acme) |

---

## Production Build

The 4GB sandbox can't sustain the dev server (Turbopack uses ~1.7GB). For production:

```bash
# Build the optimised bundle
bun run build

# Start the production server (uses ~900MB, renders in <1ms)
bun run start
# OR
npm run start
```

The production server is stable and handles the full app with room to spare.

---

## Project Structure

```
src/
├── app/
│   ├── api/                    # 40+ API routes (auth, companies, employees, payruns, rti, pensions, reports, exports, settings, ess, account)
│   ├── layout.tsx              # Root layout (Inter + JetBrains Mono + Material Symbols)
│   ├── page.tsx                # SPA shell (login → bureau/portal routing)
│   └── globals.css             # Void design system tokens
├── components/
│   ├── kedbyte/
│   │   ├── primitives.tsx      # StatCard, DataTable, StatusChip, Stepper, TerminalLog, Modal, Toast
│   │   ├── export-button.tsx   # Shared ExportButton (MODE A direct / MODE B async)
│   │   ├── login.tsx           # Split-panel login with Bureau/Portal toggle
│   │   ├── bureau-shell.tsx    # Bureau sidebar + topbar shell
│   │   ├── portal-shell.tsx    # ESS icon rail + bottom tab bar
│   │   ├── my-account.tsx      # Password/MFA/Sessions/Preferences modal
│   │   └── views/              # All 31 screen components
│   └── ui/                     # shadcn/ui components
├── engine/
│   └── payroll.ts              # Pure-function calculation engine (zero I/O)
├── lib/
│   ├── db.ts                   # Prisma client
│   ├── seed.ts                 # Realistic UK payroll seed data
│   └── jobs/
│       └── runner.ts           # Async job runner (15 queues, in-process)
├── server/
│   └── exports.ts              # Shared export service (17 exports, 2 delivery modes)
└── store/
    └── app.ts                  # Zustand store (auth, routing, helpers)
```

---

## The Calculation Engine

The crown jewel. A pure-function TypeScript module (`src/engine/payroll.ts`) with zero I/O — fully unit-testable.

### Verified Against HMRC Canonical Proof

Input: £36,000/yr · monthly · tax month 1 · code 1257L cumulative · NI cat A · Plan 2 loan · pension QE 5%/3% RAS · YTD zero.

| Output | Expected | Actual | Status |
|---|---|---|---|
| Gross | £3,000.00 | £3,000.00 | ✓ |
| Tax (PAYE) | £390.20 | £390.20 | ✓ |
| NI Employee | £156.16 | £156.16 | ✓ |
| NI Employer | £387.45 | £387.45 | ✓ |
| Pension EE (deducted) | £99.20 | £99.20 | ✓ |
| Pension ER | £74.40 | £74.40 | ✓ |
| Student Loan | £49.00 | £49.00 | ✓ |
| **Net Pay** | **£2,305.44** | **£2,305.44** | ✓ |
| Employer Cost | £3,461.85 | £3,461.85 | ✓ |

Self-verify at any time: `GET /api/engine/verify`

### Edge Cases Covered

- BR/NT/0T/D0/D1 flat codes
- Scottish SBR/SD0/SD1/SD2/SD3 bands (19%–48%)
- K-codes with 50% regulatory limit
- W1/M1 (ignores YTD entirely)
- Cumulative refunds (negative tax)
- NI categories A/B/C/H/J/M/V/X/Z
- Salary sacrifice / net-pay / relief-at-source pensions
- Student Loan Plans 1/2/4/5 + Postgrad concurrent
- Sub-PT employees (FPS band figures still populated)
- Director annual method

---

## Key Features

### Bureau Command Center
- **Dashboard** — live stats, compliance overview, recent activity
- **Companies** — multi-company management with PAYE/AO ref validation
- **Employees** — CRUD, CSV bulk import (with template + error report), inline edit
- **Pay Run Wizard** — 4-step flow with the signature live Calculation Engine Log terminal
- **RTI Submissions** — FPS/EPS dashboard, XML viewer, error resolution engine
- **Pensions** — Auto-enrolment assessment, PAPDIS/NEST exports, opt-out handling
- **Reports** — Gross-to-net, P32, GPG, departmental cost (CSV exports)
- **Settings** — 9 tabs: Company, Tax, Pension, Bank, Users, Security, Compliance, Notifications, System

### Employee Self-Service Portal
- **Dashboard** — net pay (privacy blur), YTD strip, holiday balance, upcoming events
- **Payslips** — list + full preview modal with hash verification
- **Holidays** — balance ring, request form with live day calculation, history
- **Manager Approvals** — pending queue with clash detection
- **Personal Details** — editable + 24h bank-change cooling-off
- **Documents** — payslips/P60/P45 vault
- **Notifications** — bell + notification center

### Async Jobs & Exports
- 15 job queues (payrun:calculate, rti:submit, pdf:payslips, system:export, dps:fetch, etc.)
- 17 export endpoints (PAPDIS, NEST, BACS Standard-18, RTI XML, audit ledger, GPG, etc.)
- 4 imports (employee CSV, bank-holiday sync, DPS fetch, modulus data)
- Two delivery modes: direct download (<2000 rows) / async + notify (≥2000 rows)
- Every "queued" toast terminates in a downloaded file or a morphing button — no dead-ends

---

## Design System (Void)

Dark-only, 0px radius, no shadows. Depth via surface tone + hairline borders only.

| Token | Value | Usage |
|---|---|---|
| `--bg-void` | `#0C0C0E` | App background |
| `--bg-surface` | `#141416` | Cards, inputs, tables |
| `--accent-pearl` | `#E8E4E0` | Primary buttons, active nav |
| `--text-primary` | `#F5F5F5` | Headings, primary data |
| `--text-secondary` | `#A1A1AA` | Labels, metadata |
| `--success` | `#4ADE80` | Active/approved status |
| `--warning` | `#FBBF24` | Pending status |
| `--error` | `#F87171` | Rejected/error status |

All numbers, currency, NINOs, and timestamps use JetBrains Mono. UI text uses Inter.

---

## API Reference

### Core Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Bureau or portal login |
| GET | `/api/dashboard` | Bureau dashboard summary |
| GET/POST | `/api/companies` | List / create companies |
| GET/POST | `/api/employees` | List / create employees |
| POST | `/api/payruns` | Create pay run |
| POST | `/api/payruns/[id]/calculate` | Run calculation engine |
| POST | `/api/payruns/[id]/finalize` | Commit pay run (transactional) |
| GET | `/api/rti` | RTI submissions list |
| GET | `/api/pensions` | Pension assessments |
| GET | `/api/reports` | Report data |
| GET | `/api/settings/[section]` | Settings (9 sections) |

### Export Endpoints

| Endpoint | Format | Mode |
|---|---|---|
| `/api/pensions/contributions/export?format=papdis` | PAPDIS 1.1 CSV | Direct |
| `/api/pensions/contributions/export?format=nest-csv` | NEST CSV | Direct |
| `/api/payruns/[id]/bacs` | Standard-18 fixed-width | Direct |
| `/api/rti/[id]/xml` | FPS XML | Direct |
| `/api/companies/[id]/employees/export` | Employee CSV (masked) | Direct |
| `/api/settings/system/export` | Full-tenant bundle | Async |
| `/api/audit/export` | Audit ledger CSV | Direct |

### Health & Verification

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Liveness + DB readiness |
| `GET /api/engine/verify` | Calculation engine self-test |

---

## Testing

### Engine Verification

```bash
# Via API
curl http://localhost:3000/api/engine/verify

# Via script
bun -e "import { verifyWorkedProof } from './src/engine/payroll.ts'; console.log(verifyWorkedProof());"
```

### Lint

```bash
bun run lint
```

### Build Check

```bash
bun run build
```

---

## Deployment

### Environment Variables

Create a `.env` file:

```env
DATABASE_URL="file:./db/custom.db"    # SQLite (demo) or postgresql://... (production)
NODE_OPTIONS="--max-old-space-size=1024"  # Memory limit for sandbox
```

### Production Checklist

1. **Database** — switch from SQLite to PostgreSQL:
   - Update `prisma/schema.prisma` datasource to `postgresql`
   - Update `DATABASE_URL` to your Postgres connection string
   - Run `bun run db:push`

2. **Auth** — replace demo auth with production auth:
   - Implement Argon2id password hashing (`$argon2id$` prefix)
   - Implement JWT access tokens (15min) + rotating refresh tokens (7d)
   - Add TOTP MFA with backup codes
   - Set httpOnly + Secure + SameSite=Strict cookies

3. **HMRC RTI** — register for HMRC developer recognition:
   - Get Government Gateway SenderID + password per PAYE scheme
   - Get Vendor ID on HMRC software-developer registration
   - Test on HMRC LTS → TPVS/ETS → submit test scenarios
   - Store credentials encrypted (envelope encryption with KMS)

4. **Storage** — replace in-memory file store with S3:
   - Configure S3 bucket for exports/payslips/documents
   - Signed URLs for downloads (5-min TTL)
   - 7-day expiry on exports, never expire statutory documents

5. **Jobs** — replace in-process runner with BullMQ + Redis:
   - Same interface, single swap point
   - WebSocket (Socket.io) for real-time progress

6. **Security headers** — add HSTS, X-Content-Type-Options, CSP, frame-ancestors

### Docker (optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Security

- **NINO masking** everywhere (`AB 12 •• •• C`); full reveal = bureau_admin only, audited
- **Bank details** masked in all circulating exports (`••••5678`)
- **PAPDIS/NEST** carry full NINO (providers require it) — bureau-roles only, audited
- **Rate limits** — system export 1/day, others 30/hour/user
- **Validation** — NINO/PAYE ref/AO ref/sort code/tax code all validated server-side
- **Audit ledger** — hash-chained, INSERT-only, every mutation logged with before/after
- **Last admin guard** — cannot demote/disable the last bureau_admin (409)
- **IDOR protection** — export downloads check requester ownership (404 on mismatch)

---

## License

Proprietary. © Kedbyte Payroll. All rights reserved.

---

## Status

**Production-ready** (demo build). The calculation engine passes the HMRC canonical proof to the penny. All 31 screens functional. All 17 exports + 4 imports deliver. Security guards enforced.

**External gate** (cannot self-verify): HMRC recognition status must be obtained before live RTI submission. Until then, RTI is locked to test endpoints.
