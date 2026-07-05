# Deployment Guide

## Prerequisites

- Node.js 18+ or Bun 1.0+
- PostgreSQL 14+ (production) or SQLite (demo)
- Redis 7+ (for job queues in production)
- S3-compatible object storage (for exports/documents)
- HMRC Government Gateway credentials (for RTI)

---

## 1. Local Development

```bash
# Clone
git clone https://github.com/dexter02-crypt/KedByte-Payroll-Final-v01.git
cd KedByte-Payroll-Final-v01

# Install
bun install

# Database setup
bun run db:push

# Seed demo data
bun run seed

# Start dev server
bun run dev
```

App runs at http://localhost:3000

---

## 2. Production Build

```bash
# Build optimised bundle
NODE_OPTIONS="--max-old-space-size=2560" bun run build

# Start production server (uses ~900MB RAM)
bun run start
# OR
node_modules/.bin/next start -p 3000
```

---

## 3. Database Migration (SQLite → PostgreSQL)

### Update Prisma schema

Edit `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Update .env

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/kedbyte_payroll"
```

### Push schema

```bash
bun run db:push
bun run seed
```

---

## 4. Environment Variables

Create `.env` in project root:

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/kedbyte_payroll"

# Auth (production)
JWT_SECRET="your-256-bit-secret"
ARGON2_SALT="your-salt"

# HMRC RTI
HMRC_VENDOR_ID="your-vendor-id"
HMRC_TEST_ENDPOINT="https://test-transaction-engine.tax.service.gov.uk"
HMRC_LIVE_ENDPOINT="https://transaction-engine.tax.service.gov.uk"

# Storage (S3)
S3_BUCKET="kedbyte-payroll"
S3_REGION="eu-west-2"
S3_ACCESS_KEY="your-key"
S3_SECRET_KEY="your-secret"

# Redis (job queues)
REDIS_URL="redis://localhost:6379"
```

---

## 5. HMRC RTI Setup

### Step 1: Register as software developer
1. Go to [HMRC software developer registration](https://www.gov.uk/guidance/register-to-use-hmrc-software-development-support)
2. Get your **Vendor ID**
3. Get test Government Gateway credentials per PAYE scheme

### Step 2: Test on HMRC LTS
1. Submit test FPS/EPS to the Live Test Service
2. Verify XML schema and IRmark
3. Submit test scenarios to SDSTeam@hmrc.gov.uk

### Step 3: Get recognition
- HMRC target: ~6 weeks after testing completes
- Once listed, switch endpoint from test to live:
  ```env
  HMRC_ENDPOINT="https://transaction-engine.tax.service.gov.uk"
  ```

### Step 4: Store credentials
- Per-company Government Gateway SenderID + password
- Stored encrypted (AES-256-GCM, envelope encryption with KMS)
- Write-only in the UI (Settings → Security → HMRC Credentials)

---

## 6. Docker Deployment

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

### docker-compose.yml

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/kedbyte
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=kedbyte
      - POSTGRES_PASSWORD=postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
volumes:
  pgdata:
```

### Run

```bash
docker-compose up -d
```

---

## 7. Production Security Checklist

- [ ] Argon2id password hashing (m=64MB, t=3, p=4)
- [ ] JWT access tokens (15min) + rotating refresh tokens (7d)
- [ ] httpOnly + Secure + SameSite=Strict cookies
- [ ] TOTP MFA for bureau_admin role
- [ ] HSTS, X-Content-Type-Options, CSP headers
- [ ] Rate limiting on auth (5/min) and export (1/day) endpoints
- [ ] NINO/bank encryption at rest (AES-256-GCM)
- [ ] Audit log INSERT-only (revoke UPDATE/DELETE from app role)
- [ ] RLS enabled on all tenant-scoped tables (PostgreSQL)
- [ ] S3 bucket non-public, signed GETs only

---

## 8. Health Monitoring

### Health endpoint

```bash
curl http://localhost:3000/api/health
# { "status": "ok", "db": "connected", "version": "1.0.0" }
```

### Engine self-test

```bash
curl http://localhost:3000/api/engine/verify
# { "passed": true, "results": {...} }
```

### Job queue health

```bash
curl http://localhost:3000/api/settings/system/jobs
# Returns all 15 queues with waiting/failed/total counts
```

---

## 9. Backup & Restore

### Database backup

```bash
# PostgreSQL
pg_dump -U postgres kedbyte > backup.sql

# Restore
psql -U postgres kedbyte < backup.sql
```

### Verify audit chain after restore

```bash
curl -X POST http://localhost:3000/api/audit/verify
# Returns { intact: true, firstBreakSeq: null }
```

---

## 10. Troubleshooting

### Server won't start (4GB sandbox)

The dev server (Turbopack) uses ~1.7GB. In a 4GB sandbox, use the production build:

```bash
bun run build
bun run start  # Uses ~900MB
```

### Memory limit

```bash
# Set in .env
NODE_OPTIONS="--max-old-space-size=1024"
```

### Database locked (SQLite)

SQLite doesn't handle concurrent writes. Switch to PostgreSQL for production.

### Export not downloading

1. Check the bell icon (top-right) for `export_ready` notification
2. Check System tab → Recent Exports list
3. Verify `/api/settings/system/jobs` shows the `system:export` queue
