# Deployment Guide — Kedbyte Payroll

Complete guide: from GitHub clone to live production domain.

---

## Table of Contents
1. [Local Development](#1-local-development)
2. [Production Build](#2-production-build)
3. [Environment Variables](#3-environment-variables)
4. [Database Setup](#4-database-setup)
5. [Deploy to Vercel](#5-deploy-to-vercel)
6. [Deploy to VPS / Docker](#6-deploy-to-vps--docker)
7. [Custom Domain Setup](#7-custom-domain-setup)
8. [HMRC RTI Production Setup](#8-hmrc-rti-production-setup)
9. [Post-Deployment Checklist](#9-post-deployment-checklist)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Local Development

### Prerequisites
- **Node.js 18+** or **Bun 1.0+**
- **Git**
- 4GB+ RAM (8GB recommended)

### Steps

```bash
# Clone the repository
git clone https://github.com/dexter02-crypt/KedByte-Payroll-Final-v01.git
cd KedByte-Payroll-Final-v01

# Install dependencies
npm install
# OR (faster)
bun install

# Create .env file
cp .env.example .env
# Edit .env if needed (SQLite is fine for local dev)

# Set up the database
npm run db:push
# OR
bun run db:push

# Seed demo data (1 bureau, 3 companies, 9+ employees, pay runs)
npm run seed
# OR
bun run seed

# Start the development server
npm run dev
# OR
bun run dev
```

The app runs at **http://localhost:3000**

### Demo Accounts

| Surface | Email | Role |
|---|---|---|
| Bureau | `admin@kedbyte.co.uk` | Bureau Admin (full access) |
| Bureau | `admin@smithco.co.uk` | Company Admin (Smith & Co) |
| Portal | `eleanor@smithco.co.uk` | Employee + Manager |
| Portal | `james@smithco.co.uk` | Employee |
| Portal | `priya@acme.io` | Employee (Acme) |

**Any password works in demo mode.**

---

## 2. Production Build

```bash
# Install dependencies
npm install

# Build the optimised production bundle
npm run build

# Start the production server
npm run start
```

The production server:
- Uses ~900MB RAM (vs 1.7GB for dev)
- Renders pages in <1ms
- Serves static assets efficiently
- No hot reload (stable)

### Build Verification

```bash
# Check the build succeeded
npm run build
# Expect: "✓ Compiled successfully" with no errors

# Lint check
npm run lint
# Expect: 0 errors (2 cosmetic warnings about icon fonts are OK)

# Engine self-test
curl http://localhost:3000/api/engine/verify
# Expect: {"passed": true, ...}

# Health check
curl http://localhost:3000/api/health
# Expect: {"status": "ok", "db": "connected", ...}
```

---

## 3. Environment Variables

Create a `.env` file in the project root:

### Local Development (SQLite)
```env
DATABASE_URL="file:./db/custom.db"
NODE_OPTIONS="--max-old-space-size=1024"
```

### Production (PostgreSQL)
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/kedbyte_payroll"

# Application
NODE_ENV="production"
PORT=3000

# Auth (implement for production)
JWT_SECRET="your-256-bit-secret-key-here"
ARGON2_SALT="your-argon2-salt"

# HMRC RTI (when recognised)
HMRC_VENDOR_ID="your-vendor-id"
HMRC_GATEWAY_USER="your-gateway-user"
HMRC_GATEWAY_PASSWORD="your-gateway-password"
HMRC_ENDPOINT="https://transaction-engine.tax.service.gov.uk"

# Object Storage (S3-compatible)
S3_BUCKET="kedbyte-payroll"
S3_REGION="eu-west-2"
S3_ACCESS_KEY="your-access-key"
S3_SECRET_KEY="your-secret-key"

# Redis (for job queues)
REDIS_URL="redis://localhost:6379"
```

### .env.example

A `.env.example` file is included in the repo as a template. Copy it to `.env` and fill in your values:

```bash
cp .env.example .env
```

**Never commit `.env` to git** — it's in `.gitignore`.

---

## 4. Database Setup

### Option A: SQLite (Local Dev / Demo)

SQLite is the default — no setup needed beyond:

```bash
npm run db:push    # Create tables
npm run seed       # Load demo data
```

### Option B: PostgreSQL (Production)

1. **Install PostgreSQL 14+**
   ```bash
   # Ubuntu/Debian
   sudo apt install postgresql postgresql-contrib
   
   # macOS
   brew install postgresql
   ```

2. **Create database and user**
   ```bash
   sudo -u postgres psql
   CREATE DATABASE kedbyte_payroll;
   CREATE USER kedbyte WITH PASSWORD 'your-password';
   GRANT ALL PRIVILEGES ON DATABASE kedbyte_payroll TO kedbyte;
   \q
   ```

3. **Update Prisma schema** — edit `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

4. **Update `.env`**
   ```env
   DATABASE_URL="postgresql://kedbyte:your-password@localhost:5432/kedbyte_payroll"
   ```

5. **Push schema and seed**
   ```bash
   npm run db:push
   npm run seed
   ```

### Database Backups

```bash
# Backup
pg_dump -U kedbyte kedbyte_payroll > backup_$(date +%Y%m%d).sql

# Restore
psql -U kedbyte kedbyte_payroll < backup_20260101.sql
```

---

## 5. Deploy to Vercel

Vercel is the easiest deployment (Next.js native).

### Steps

1. **Push to GitHub** (already done)
   ```
   https://github.com/dexter02-crypt/KedByte-Payroll-Final-v01
   ```

2. **Go to [vercel.com](https://vercel.com)** and sign in with GitHub

3. **Import the repository**
   - Click "New Project"
   - Select `KedByte-Payroll-Final-v01`
   - Vercel auto-detects Next.js

4. **Configure environment variables**
   - In Vercel dashboard → Settings → Environment Variables
   - Add `DATABASE_URL` (use Vercel Postgres or external DB)
   - Add `NODE_ENV=production`

5. **Deploy**
   - Click "Deploy"
   - Vercel builds and deploys automatically
   - You get a `*.vercel.app` URL

6. **Run database migration** (after first deploy)
   ```bash
   # In Vercel dashboard → Terminal, or locally with production DATABASE_URL
   npx prisma db push
   npx tsx src/lib/seed.ts
   ```

### Vercel Postgres (recommended)

1. In Vercel dashboard → Storage → Create Database → Postgres
2. Copy the connection string to your environment variables
3. Vercel auto-provisions and connects the database

---

## 6. Deploy to VPS / Docker

### Option A: Direct VPS (Ubuntu/Debian)

```bash
# SSH into your server
ssh user@your-server-ip

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Clone the repo
git clone https://github.com/dexter02-crypt/KedByte-Payroll-Final-v01.git
cd KedByte-Payroll-Final-v01

# Install, build, start
npm install
npm run build
npm run db:push
npm run seed

# Start with PM2 (keeps it running forever)
pm2 start "npm run start" --name kedbyte-payroll
pm2 startup
pm2 save
```

### Option B: Docker

Create `Dockerfile`:

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
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/db ./db
EXPOSE 3000
CMD ["npm", "start"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:./db/custom.db
      - NODE_ENV=production
    restart: unless-stopped
    volumes:
      - ./db:/app/db
```

Run:

```bash
docker-compose up -d
```

### Option C: Docker with PostgreSQL + Redis

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://kedbyte:password@db:5432/kedbyte
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=production
    depends_on:
      - db
    restart: unless-stopped
  
  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=kedbyte
      - POSTGRES_USER=kedbyte
      - POSTGRES_PASSWORD=password
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped
  
  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  pgdata:
```

---

## 7. Custom Domain Setup

### Option A: Vercel Custom Domain

1. Go to Vercel dashboard → your project → Settings → Domains
2. Add your domain (e.g., `payroll.yourcompany.co.uk`)
3. Vercel gives you DNS records to add:
   ```
   CNAME payroll → cname.vercel-dns.com
   ```
4. Add the DNS record at your domain registrar
5. Wait for DNS propagation (5-30 minutes)
6. Vercel auto-provisions SSL certificate (Let's Encrypt)
7. Your app is live at `https://payroll.yourcompany.co.uk`

### Option B: VPS with Nginx + SSL

1. **Point your domain to your server**
   ```
   A record: payroll.yourcompany.co.uk → your-server-ip
   ```

2. **Install Nginx + Certbot**
   ```bash
   sudo apt install nginx certbot python3-certbot-nginx
   ```

3. **Create Nginx config** — `/etc/nginx/sites-available/kedbyte`
   ```nginx
   server {
       server_name payroll.yourcompany.co.uk;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **Enable + reload Nginx**
   ```bash
   sudo ln -s /etc/nginx/sites-available/kedbyte /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. **Get SSL certificate**
   ```bash
   sudo certbot --nginx -d payroll.yourcompany.co.uk
   ```

6. **Your app is now live at `https://payroll.yourcompany.co.uk`**

### Option C: Cloudflare (CDN + SSL)

1. Add your domain to Cloudflare
2. Change nameservers at your registrar to Cloudflare's
3. Add DNS record:
   ```
   A record: payroll → your-server-ip (Proxied = orange cloud)
   ```
4. Cloudflare auto-provisions SSL
5. Enable "Always Use HTTPS" in Cloudflare dashboard

---

## 8. HMRC RTI Production Setup

To submit real RTI (FPS/EPS) to HMRC, you need HMRC recognition:

### Step 1: Register as Software Developer

1. Go to [HMRC software developer registration](https://www.gov.uk/guidance/register-to-use-hmrc-software-development-support)
2. Register your organisation
3. Get your **Vendor ID**

### Step 2: Get Government Gateway Credentials

1. For each PAYE scheme, get Government Gateway credentials
2. These are the SenderID + password used to authenticate RTI submissions
3. Store them encrypted (Settings → Security → HMRC Credentials)

### Step 3: Test on HMRC Live Test Service (LTS)

1. Submit test FPS/EPS to the LTS endpoint:
   ```
   https://test-transaction-engine.tax.service.gov.uk/submission
   ```
2. Verify your XML validates against the 2026-27 XSD
3. Verify IRmark computation
4. Submit test scenarios to `SDSTeam@hmrc.gov.uk`

### Step 4: Get Recognition

- HMRC target: ~6 weeks after testing completes
- Once listed, switch to live endpoint:
  ```env
  HMRC_ENDPOINT="https://transaction-engine.tax.service.gov.uk"
  ```

### Step 5: Production Credentials

Store per-company HMRC credentials securely:
- Government Gateway SenderID + password per PAYE scheme
- AES-256-GCM encryption at rest
- Write-only in the UI (never returned by GET)
- Audited `HMRC_CREDS_UPDATED` on every change

**Until recognition is obtained, RTI is locked to test endpoints with a visible TEST banner.**

---

## 9. Post-Deployment Checklist

### Essential
- [ ] App deployed and accessible at your domain
- [ ] SSL certificate active (HTTPS working)
- [ ] Database migrated and seeded
- [ ] Environment variables set (DATABASE_URL, etc.)
- [ ] Health endpoint responds: `https://yourdomain.com/api/health`
- [ ] Engine self-test passes: `https://yourdomain.com/api/engine/verify`
- [ ] Login works (test with demo account)
- [ ] All 31 screens render correctly

### Security
- [ ] Replace demo auth with Argon2id + JWT + TOTP MFA
- [ ] Set httpOnly + Secure + SameSite=Strict cookies
- [ ] Add security headers (HSTS, X-Content-Type-Options, CSP)
- [ ] Enable rate limiting on auth endpoints
- [ ] Verify NINO/bank masking in all exports
- [ ] Test IDOR protection (can't access other tenant's data)
- [ ] Audit log chain verifies end-to-end

### Performance
- [ ] Enable gzip/brotli compression (Vercel does this automatically)
- [ ] Set up CDN for static assets (Cloudflare or Vercel Edge)
- [ ] Database connection pooling (PgBouncer for PostgreSQL)
- [ ] Redis for job queues (replace in-process runner)

### Monitoring
- [ ] Set up uptime monitoring (e.g., UptimeRobot)
- [ ] Set up error tracking (Sentry)
- [ ] Set up log aggregation
- [ ] Configure health check alerts on `/api/health`

### Backup
- [ ] Automated daily database backups
- [ ] Test backup restore procedure
- [ ] Document disaster recovery plan

---

## 10. Troubleshooting

### "sandbox is inactive" error

This error only occurs in the Z.ai Code preview environment (4GB RAM limit). **It will never happen on GitHub or production.**

- **Cause:** The 4GB sandbox OOM-kills the Node process
- **Fix on production:** Use a server with 8GB+ RAM — the app uses ~900MB in production mode
- **Fix in sandbox:** Restart the server (I can do this on request)

### Server won't start

```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill any existing process
kill -9 $(lsof -t -i:3000)

# Rebuild and start
npm run build
npm run start
```

### Database errors

```bash
# Reset database
rm db/custom.db
npm run db:push
npm run seed
```

### Build fails

```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

### Memory issues

```bash
# Increase Node memory limit
export NODE_OPTIONS="--max-old-space-size=2048"
npm run build
```

### Prisma client errors

```bash
# Regenerate Prisma client
npx prisma generate

# Push schema
npm run db:push
```

### Export downloads not working

1. Check the notification bell for `export_ready` notification
2. Check System tab → Recent Exports
3. Verify `/api/settings/system/jobs` shows the queue
4. In production, ensure S3 credentials are correct

---

## Quick Reference

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server (port 3000) |
| `npm run build` | Build production bundle |
| `npm run start` | Start production server |
| `npm run db:push` | Create/update database schema |
| `npm run seed` | Load demo data |
| `npm run lint` | Run ESLint |

| URL | Purpose |
|---|---|
| `http://localhost:3000` | App |
| `/api/health` | Health check |
| `/api/engine/verify` | Engine self-test |

| Demo Account | Password |
|---|---|
| `admin@kedbyte.co.uk` | Any password |
| `eleanor@smithco.co.uk` | Any password |

---

## Support

- **GitHub:** https://github.com/dexter02-crypt/KedByte-Payroll-Final-v01
- **Issues:** https://github.com/dexter02-crypt/KedByte-Payroll-Final-v01/issues

---

## License

Proprietary. © Kedbyte Payroll. All rights reserved.
