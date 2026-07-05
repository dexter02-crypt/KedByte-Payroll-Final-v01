# KEDBYTE PAYROLL — FINAL PRD + TRD + ENGINEERING RESEARCH
## Version 2.0 FINAL LOCK — 2026-07-05
## Tax Year: 2026/27 · Screens: 31 · Status: BUILD-READY
### This document supersedes all prior drafts. After this, the only remaining step is code.

---

# DOCUMENT MAP

| Part | Contents |
|------|----------|
| 1 | Product Requirements (PRD): vision, users, roles, feature scope |
| 2 | Design System (extracted from the delivered UI) |
| 3 | Complete Routing Map (every URL in the product) |
| 4 | Database Schema (full DDL, production PostgreSQL) |
| 5 | Calculation Engine — every formula, every function signature, worked proofs |
| 6 | Per-Screen Functional Specification — all 31 screens: components, API calls, functions, state machines, real-time behaviour |
| 7 | Complete API Reference (every endpoint, request/response payloads) |
| 8 | HMRC RTI Integration (GovTalk envelope, IRmark algorithm, lifecycle, DPS) |
| 9 | Pension Integration (NEST web services, PAPDIS) |
| 10 | Jobs, Queues & Real-Time Architecture |
| 11 | Security: auth flows, RBAC matrix, encryption, audit hash-chain |
| 12 | Testing & Acceptance Criteria |
| 13 | Build Phases & Critical Path |

---

# PART 1 — PRODUCT REQUIREMENTS (PRD)

## 1.1 Vision
Kedbyte Payroll is a multi-tenant UK payroll bureau platform: one bureau operates payroll for many client companies, each with many employees, with HMRC RTI compliance built in as a first-class workflow — not an export. Two surfaces: the **Bureau Command Center** (dark "Void" professional console) and the **Employee Self-Service Portal** ("My Pay"). Design promise: *the system is not perceived as fast; it is perceived as present.*

## 1.2 Users & Roles

| Role | Surface | Core jobs |
|------|---------|-----------|
| `bureau_admin` | Bureau | Everything across all client companies: onboarding, pay runs, RTI, pensions, settings |
| `company_admin` | Bureau (scoped) | Own company: employees, pay runs, approvals |
| `payroll_manager` | Bureau (scoped) | Assigned companies: run + review payroll, no settings |
| `employee` | ESS Portal | Payslips, P60s, holidays, personal details |
| `manager` (employee flag) | ESS Portal | + approve direct reports' leave |
| `accountant` | Bureau (read) | Financial reports, aggregates only |

## 1.3 Feature Scope (v1)
1. Multi-company management with HMRC reference validation & bank modulus checking
2. Employee lifecycle: starter (A/B/C declarations, P45 intake) → active → leaver (P45 out via FPS)
3. 4-step Pay Run Wizard with server-side calculation engine (PAYE/NI/SL/pension/statutory), variance detection, approval, FPS generation
4. RTI: FPS + EPS submission via GovTalk Transaction Engine, poll lifecycle, error resolution engine, resubmission
5. Pension auto-enrolment: per-period assessment, opt-out + refund, NEST/PAPDIS contribution files
6. Payslip/P60/P45 generation (print-grade), document vault with hash verification
7. ESS: payslips, holiday requests + manager approval chain, personal details (24h bank-change cooling-off), documents, notifications
8. Reports: gross-to-net, P32-style employer summary, gender pay gap, pension contributions, variance
9. Pay schedule + bank holiday + BACS calendar engine (gov.uk sync)
10. Settings with **effective-dated statutory rate tables** (historical recalculation always deterministic)
11. Hash-chained immutable audit ledger on every mutation
12. Auth: Argon2id + TOTP MFA + rotating refresh tokens + account recovery

Out of scope v1 (phase 2): CIS, attachment-of-earnings orders, apprenticeship levy reporting, multi-currency, Confirmation of Payee, payrolled benefits (P11D flows), Scottish/NI bank-holiday divisions beyond data model.

---

# PART 2 — DESIGN SYSTEM (extracted from delivered UI, authoritative)

## 2.1 Tokens

```css
:root {
  --bg-void:        #0C0C0E;   /* app background */
  --bg-surface:     #141416;   /* cards, inputs, tables, modals */
  --surface-low:    #0f0e0e;   /* recessed wells (terminal log) */
  --surface-high:   #201f1f;   /* hover rows, raised chips */
  --text-primary:   #F5F5F5;   /* headings, primary data */
  --text-secondary: #A1A1AA;   /* labels, metadata */
  --text-tertiary:  #52525B;   /* disabled, timestamps ONLY (fails AA for body) */
  --accent-pearl:   #E8E4E0;   /* primary buttons, active nav, focus rings */
  --accent-ink:     #0C0C0E;   /* text on pearl */
  --success:        #4ADE80;   --warning: #FBBF24;   --error: #F87171;
  --border-subtle:  rgba(245,245,245,0.06);  /* ALL borders/dividers, 1px */
}
```
- **Typography:** Inter (400/500/600/700) for UI; **JetBrains Mono** (500/700) for ALL numbers, currency, timestamps, references, NI numbers, terminal log. Page title 20px/600/-0.01em; section title 13px/600 uppercase tracking; body 14px; data cells 13px mono.
- **Icons:** Material Symbols Outlined (weight 300, optical 20/24).
- **Radius: 0px universally. Shadows: none.** Depth is expressed only by surface tone + hairline borders.
- **Motion:** 200ms ease-out enter / ease-in exit; modal 300ms cubic-bezier(0.32,0.72,0,1); calculation log lines stream in at 60–120ms intervals; `prefers-reduced-motion` collapses all to instant.
- **Layout grammar (from delivered screens):** left **icon rail 72px** (nav: dashboard · business · groups/badge · payments · account_balance · savings · analytics · settings), top **command bar 56px** (product mark, breadcrumb, search, notifications, avatar), content area with 24px gutters. ESS mobile uses bottom tab bar (Home · Pay · Team · Profile).
- **Signature element:** the Step-2 **Calculation Engine Log** — a live terminal (surface-low, mono, timestamped lines, blinking caret) that streams engine progress. This is the product's memorable moment; implement it with real engine events, not fake delays.

## 2.2 Component inventory (all appear in the delivered HTML)
StatCard (label / mono value / delta chip) · DataTable (hairline rows, hover surface-high, sticky header) · StatusChip (ACTIVE green · PENDING amber · REJECTED red · SUSPENDED gray — 11px uppercase mono) · Stepper (4-node, check icons on complete) · TerminalLog · SidePanel payslip preview · Modal (centered, border-subtle, no scrim blur) · FilterBar (dropdown chips) · Wizard footer (ghost Back / pearl Continue) · Toast (bottom-right, border-left status color) · EmptyState (icon + one sentence + one action).

---

# PART 3 — COMPLETE ROUTING MAP

```
PUBLIC
  /login                              S01 Bureau Login            [bureau_login_kedbyte_payroll]
  /portal/login                       S11 Employee Login          [login_employee_portal_kedbyte_payroll]
  /forgot-password                    S19a                        [forgot_password_kedbyte_payroll]
  /reset-password/[token]             S19b                        [create_new_password_kedbyte_payroll]
  /account-recovery                   S19c                        [account_recovery_kedbyte_payroll]

BUREAU  (guard: role ∈ bureau_admin|company_admin|payroll_manager|accountant)
  /bureau/dashboard                   S02                         [dashboard_kedbyte_payroll_admin]
  /bureau/companies                   S03 list                    [company_management_kedbyte_payroll_admin]
  /bureau/companies/new               S03b Add Company modal-page [add_company_registration_kedbyte_payroll_admin]
  /bureau/companies/[id]              S03 detail (tabs: overview·employees·payruns·settings)
  /bureau/companies/[id]/employees    S04 list                    [employee_list_acme_corp_kedbyte_payroll_admin]
  /bureau/employees/new               S04b Add Employee           [add_employee_registration_kedbyte_payroll_admin]
  /bureau/employees/[id]              S04 detail (inline edit, pay history, docs)
  /bureau/payruns                     pay run index (per company)
  /bureau/payruns/[id]/input          S05.1                       [pay_run_wizard_step_1_payroll_input]
  /bureau/payruns/[id]/calculation    S05.2                       [pay_run_wizard_step_2_calculation]
  /bureau/payruns/[id]/review         S05.3                       [pay_run_wizard_step_3_review]
  /bureau/payruns/[id]/submission     S05.4                       [pay_run_wizard_step_4_submission]
  /bureau/payruns/[id]/payslips       S06 review & approval       [payslip_review_approval_kedbyte_payroll]
  /bureau/rti                         S07                         [rti_submission_dashboard_kedbyte_payroll]
  /bureau/rti/[id]                    submission detail + XML viewer
  /bureau/rti/errors                  S21                         [rti_error_code_mapping_resolution_engine]
  /bureau/pensions                    S08                         [pension_auto_enrolment_management]
  /bureau/reports                     S09                         [reports_analytics_kedbyte_payroll]
  /bureau/reports/builder             S09b (optional)             [advanced_analytics_custom_report_builder]
  /bureau/reports/gpg                 S23                         [gender_pay_gap_reporting_kedbyte_payroll]
  /bureau/documents                   S22a admin docs             [document_management_kedbyte_payroll_admin]
  /bureau/documents/p45/[employeeId]  S20b                        [p45_document_viewer_kedbyte_payroll_admin]
  /bureau/settings                    S10 (tabs: Company·Tax·Pension·Bank·Users·Security·Compliance·Notifications·System) [settings_configuration_kedbyte_payroll_admin]
  /bureau/settings/pay-schedule       S22b                        [pay_schedule_configuration_kedbyte_payroll]
  /bureau/settings/bank-holidays      S22c                        [bank_holiday_registry_kedbyte_payroll]
  /bureau/settings/holiday-rules      S22d                        [pro_rata_custom_holiday_settings]
  /bureau/notifications/pay-dates     S22e                        [pay_date_notifications_kedbyte_payroll_admin]

ESS PORTAL  (guard: role = employee)
  /portal/dashboard                   S12                         [dashboard_my_pay_employee_portal_3]
  /portal/payslips                    S13 list                    [payslip_review_my_pay_employee_portal_1]
  /portal/payslips/[id]               S13 viewer (print stylesheet)
  /portal/holidays                    S14                         [holiday_management_my_pay_employee_portal_1]
  /portal/details                     S15                         [personal_details_my_pay_employee_portal_1]
  /portal/documents                   S16                         [document_hub_my_pay_employee_portal]
  /portal/documents/p60/[taxYear]     S20a                        [p60_document_viewer_my_pay_employee_portal]
  /portal/notifications               S17                         [notification_center_my_pay_employee_portal]
  /portal/approvals                   S18 (guard: is_manager)     [manager_leave_approvals_command_center]

API  (all under /api — full contract in Part 7)
```

Route guards: Next.js middleware reads the JWT access cookie → rejects to `/login` or `/portal/login` by audience; layout-level role checks per segment group `(bureau)` / `(portal)`.

---

# PART 4 — DATABASE SCHEMA (PostgreSQL, production DDL)

Multi-tenancy: shared schema + `tenant_id` on every row + **RLS as backstop** + app-layer scoping. Under PgBouncer transaction pooling, tenant context MUST be set per-transaction: `SELECT set_config('app.current_tenant', $1, true)` (SET LOCAL semantics) at the start of every transaction — session-level SET leaks across pooled connections.

```sql
-- ============ TENANCY & IDENTITY ============
CREATE TABLE bureaus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES bureaus(id),
  company_id UUID,                          -- scoping for company_admin / employee
  employee_id UUID,                         -- ESS link
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,              -- Argon2id m=64MB t=3 p=4
  role VARCHAR(30) NOT NULL CHECK (role IN
    ('bureau_admin','company_admin','payroll_manager','employee','accountant')),
  is_manager BOOLEAN NOT NULL DEFAULT false,
  mfa_secret TEXT, mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  mfa_backup_codes JSONB,                   -- 10 × Argon2id hashes
  token_version INT NOT NULL DEFAULT 0,     -- bump to revoke all refresh tokens
  failed_logins INT NOT NULL DEFAULT 0, locked_until TIMESTAMPTZ,
  last_login TIMESTAMPTZ, status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE refresh_tokens (               -- rotation with reuse detection
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  family_id UUID NOT NULL,                  -- token family; reuse ⇒ revoke family
  token_hash TEXT NOT NULL,                 -- SHA-256 of opaque token
  expires_at TIMESTAMPTZ NOT NULL, rotated_at TIMESTAMPTZ, revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============ COMPANIES & EMPLOYEES ============
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES bureaus(id),
  name VARCHAR(255) NOT NULL,
  paye_ref VARCHAR(15) NOT NULL,            -- ^\d{3}/[A-Z0-9]{1,10}$
  accounts_office_ref VARCHAR(14) NOT NULL, -- ^\d{3}P[A-Z]\d{7}[0-9X]$
  address_json JSONB NOT NULL DEFAULT '{}',
  bank_account_enc BYTEA, sort_code_enc BYTEA, account_name VARCHAR(100),
  region VARCHAR(20) NOT NULL DEFAULT 'england_wales',
  pay_schedule VARCHAR(30) NOT NULL DEFAULT 'monthly_last_working_day',
  pay_date_day SMALLINT, bacs_sun CHAR(6),
  early_pay BOOLEAN NOT NULL DEFAULT true,
  small_employer BOOLEAN NOT NULL DEFAULT false,   -- SMP 109% recovery eligibility
  employment_allowance_claimed BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (tenant_id, paye_ref)
);

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, company_id UUID NOT NULL REFERENCES companies(id),
  payroll_id VARCHAR(35) NOT NULL,          -- RTI Payroll ID; UNIQUE per company
  first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL,
  email CITEXT, dob DATE NOT NULL, gender CHAR(1),
  nino_enc BYTEA, nino_hash TEXT,           -- HMAC-SHA256 for exact-match search
  address_json JSONB NOT NULL DEFAULT '{}',
  start_date DATE NOT NULL, leaving_date DATE,
  starter_declaration CHAR(1) CHECK (starter_declaration IN ('A','B','C')),
  p45_prev_pay NUMERIC(12,2), p45_prev_tax NUMERIC(12,2), p45_tax_code VARCHAR(10),
  salary_annual NUMERIC(12,2) NOT NULL,
  contracted_weekly_hours NUMERIC(4,1) NOT NULL DEFAULT 37.5,
  works_pattern JSONB NOT NULL DEFAULT '[true,true,true,true,true,false,false]',
  department VARCHAR(100), job_title VARCHAR(100),
  employment_type VARCHAR(20) NOT NULL DEFAULT 'full_time',
  tax_code VARCHAR(12) NOT NULL DEFAULT '1257L',
  tax_basis VARCHAR(6) NOT NULL DEFAULT 'cumul' CHECK (tax_basis IN ('cumul','w1m1')),
  ni_category CHAR(1) NOT NULL DEFAULT 'A',
  is_director BOOLEAN NOT NULL DEFAULT false, director_appointed DATE,
  student_loan_plan VARCHAR(15),            -- plan_1|plan_2|plan_4|plan_5|null
  postgrad_loan BOOLEAN NOT NULL DEFAULT false,
  bank_account_enc BYTEA, sort_code_enc BYTEA, account_name VARCHAR(100),
  pension_status VARCHAR(20) NOT NULL DEFAULT 'not_assessed',
  pension_enrolment_date DATE, pension_optout_date DATE,
  holiday_entitlement_days NUMERIC(4,1) NOT NULL DEFAULT 28,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (company_id, payroll_id)
);

CREATE TABLE pending_bank_changes (         -- 24h cooling-off (ESS fraud control)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, employee_id UUID NOT NULL REFERENCES employees(id),
  sort_code_enc BYTEA NOT NULL, account_enc BYTEA NOT NULL, account_name VARCHAR(100),
  requested_by UUID NOT NULL, requested_at TIMESTAMPTZ DEFAULT now(),
  activates_at TIMESTAMPTZ NOT NULL,        -- requested_at + 24h
  status VARCHAR(12) NOT NULL DEFAULT 'pending'  -- pending|applied|cancelled
);

-- ============ PAY RUNS ============
CREATE TABLE pay_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, company_id UUID NOT NULL REFERENCES companies(id),
  tax_year VARCHAR(7) NOT NULL,             -- '2026-27'
  tax_period SMALLINT NOT NULL,             -- 1–12 (month) — tax month runs 6th→5th
  period_start DATE NOT NULL, period_end DATE NOT NULL, pay_date DATE NOT NULL,
  bacs_submission_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft','calculating','calculated','review','approved','committed')),
  totals_json JSONB NOT NULL DEFAULT '{}',  -- gross/tax/niEE/niER/pensEE/pensER/net/employerCost
  idempotency_key UUID,                     -- finalisation exactly-once
  calculated_at TIMESTAMPTZ, approved_by UUID, approved_at TIMESTAMPTZ, committed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, tax_year, tax_period)
);

CREATE TABLE pay_run_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, pay_run_id UUID NOT NULL REFERENCES pay_runs(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  -- inputs
  overtime_hours NUMERIC(6,2) DEFAULT 0, overtime_multiplier NUMERIC(3,2) DEFAULT 1.5,
  bonus NUMERIC(12,2) DEFAULT 0, commission NUMERIC(12,2) DEFAULT 0,
  statutory_pay NUMERIC(12,2) DEFAULT 0, statutory_type VARCHAR(10),
  adjustments_json JSONB DEFAULT '[]',
  -- engine outputs (all NUMERIC(12,2))
  gross NUMERIC(12,2), taxable_gross NUMERIC(12,2), niable_gross NUMERIC(12,2),
  tax NUMERIC(12,2), ni_employee NUMERIC(12,2), ni_employer NUMERIC(12,2),
  pension_employee NUMERIC(12,2), pension_employer NUMERIC(12,2),
  student_loan NUMERIC(12,2), postgrad_loan NUMERIC(12,2), net NUMERIC(12,2),
  earnings_at_lel NUMERIC(12,2), earnings_lel_pt NUMERIC(12,2), earnings_pt_uel NUMERIC(12,2),
  variance_pct NUMERIC(6,2), variance_flag VARCHAR(10) DEFAULT 'none',
  status VARCHAR(12) NOT NULL DEFAULT 'draft', -- draft|calculated|approved|rejected
  reject_reason TEXT,
  UNIQUE (pay_run_id, employee_id)
);

CREATE TABLE ytd_figures (                   -- one row per employee per tax year (roll-forward)
  tenant_id UUID NOT NULL, employee_id UUID NOT NULL, tax_year VARCHAR(7) NOT NULL,
  taxable NUMERIC(12,2) DEFAULT 0, tax_paid NUMERIC(12,2) DEFAULT 0,
  niable NUMERIC(12,2) DEFAULT 0, ni_ee NUMERIC(12,2) DEFAULT 0, ni_er NUMERIC(12,2) DEFAULT 0,
  pension_ee NUMERIC(12,2) DEFAULT 0, pension_er NUMERIC(12,2) DEFAULT 0,
  student_loan NUMERIC(12,2) DEFAULT 0, postgrad_loan NUMERIC(12,2) DEFAULT 0,
  gross NUMERIC(12,2) DEFAULT 0, net NUMERIC(12,2) DEFAULT 0,
  last_period SMALLINT DEFAULT 0,
  PRIMARY KEY (employee_id, tax_year)
);

-- ============ RTI ============
CREATE TABLE rti_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, company_id UUID NOT NULL, pay_run_id UUID,
  type VARCHAR(4) NOT NULL CHECK (type IN ('FPS','EPS','NVR')),
  tax_year VARCHAR(7) NOT NULL, tax_period SMALLINT,
  xml_payload TEXT NOT NULL, irmark CHAR(24) NOT NULL,   -- base64 SHA-1 = 28 chars w/ padding? store TEXT
  correlation_id VARCHAR(40),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending','submitted','polling','accepted','rejected','error')),
  poll_after TIMESTAMPTZ, attempts INT DEFAULT 0,
  hmrc_response_xml TEXT, error_code VARCHAR(10), error_text TEXT,
  submitted_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE rti_error_dictionary (
  code VARCHAR(10) PRIMARY KEY, category VARCHAR(20), severity VARCHAR(10),
  hmrc_message TEXT, cause TEXT, resolution_screen VARCHAR(10),
  resolution_field VARCHAR(40), guided_steps JSONB, auto_retry BOOLEAN DEFAULT false
);

CREATE TABLE dps_notices (                   -- incoming P6/P9/SL1/SL2/PGL1/PGL2
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, company_id UUID NOT NULL, employee_id UUID,
  type VARCHAR(6) NOT NULL, payload_json JSONB NOT NULL,
  high_water_mark BIGINT NOT NULL,           -- DPS paging cursor per type
  applied BOOLEAN DEFAULT false, applied_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now()
);

-- ============ PENSIONS / HOLIDAYS / DOCS / AUDIT / CONFIG ============
CREATE TABLE pension_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, company_id UUID NOT NULL REFERENCES companies(id),
  provider VARCHAR(30) NOT NULL,             -- NEST|Peoples|Smart|Aviva|Other
  scheme_ref VARCHAR(60),
  basis VARCHAR(30) NOT NULL DEFAULT 'qualifying_earnings',
  relief VARCHAR(20) NOT NULL DEFAULT 'relief_at_source',
  ee_rate NUMERIC(5,4) NOT NULL DEFAULT 0.05, er_rate NUMERIC(5,4) NOT NULL DEFAULT 0.03,
  status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE ae_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, employee_id UUID NOT NULL, assessed_on DATE NOT NULL,
  age SMALLINT, monthly_earnings NUMERIC(12,2),
  result VARCHAR(15) NOT NULL,               -- eligible|non_eligible|entitled
  action VARCHAR(20),                        -- enrolled|postponed|none
  postponement_end DATE
);

CREATE TABLE holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, employee_id UUID NOT NULL REFERENCES employees(id),
  start_date DATE NOT NULL, end_date DATE NOT NULL, days NUMERIC(4,1) NOT NULL,
  reason VARCHAR(255),
  status VARCHAR(12) NOT NULL DEFAULT 'pending', -- pending|approved|rejected|cancelled
  approver_id UUID, decided_at TIMESTAMPTZ, decision_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, company_id UUID, employee_id UUID,
  type VARCHAR(12) NOT NULL,                 -- payslip|p60|p45|contract|other
  tax_year VARCHAR(7), pay_run_entry_id UUID,
  storage_key TEXT NOT NULL, sha256 CHAR(64) NOT NULL,
  superseded_by UUID, status VARCHAR(12) DEFAULT 'generated',
  generated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE audit_log (                     -- append-only, hash-chained
  seq BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL, actor_id UUID, action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NOT NULL, entity_id UUID,
  before_json JSONB, after_json JSONB, reason TEXT, ip INET,
  prev_hash CHAR(64) NOT NULL, curr_hash CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- enforce append-only:
--   REVOKE UPDATE, DELETE ON audit_log FROM app_role;
--   trigger raising exception on UPDATE/DELETE as belt-and-braces.

CREATE TABLE statutory_config (              -- effective-dated rate tables
  tax_year VARCHAR(7) NOT NULL, effective_from DATE NOT NULL,
  key VARCHAR(60) NOT NULL, value_json JSONB NOT NULL,
  source VARCHAR(120), PRIMARY KEY (tax_year, effective_from, key)
);

CREATE TABLE bank_holidays (
  date DATE NOT NULL, region VARCHAR(20) NOT NULL, name VARCHAR(100),
  bacs_impact BOOLEAN DEFAULT true, PRIMARY KEY (date, region)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, user_id UUID NOT NULL,
  type VARCHAR(40) NOT NULL, title VARCHAR(200) NOT NULL, body TEXT,
  action_url VARCHAR(300), read_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE jobs_outbox (                   -- transactional outbox → queue
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID, queue VARCHAR(40) NOT NULL, payload_json JSONB NOT NULL,
  dispatched BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now()
);

-- ============ INDEXES ============
CREATE INDEX ix_emp_company ON employees(company_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_emp_nino ON employees(nino_hash);
CREATE INDEX ix_emp_name_trgm ON employees USING gin ((first_name||' '||last_name) gin_trgm_ops);
CREATE INDEX ix_payruns ON pay_runs(company_id, tax_year, tax_period DESC);
CREATE INDEX ix_entries ON pay_run_entries(pay_run_id);
CREATE INDEX ix_rti ON rti_submissions(tenant_id, status, poll_after);
CREATE INDEX ix_audit ON audit_log(tenant_id, created_at DESC);
CREATE INDEX ix_holidays_emp ON holidays(employee_id, start_date DESC);
CREATE INDEX ix_docs_emp ON documents(employee_id, type);
CREATE INDEX ix_notif ON notifications(user_id, read_at NULLS FIRST, created_at DESC);

-- ============ RLS (backstop; app scoping is primary) ============
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY t_iso ON employees USING (tenant_id = current_setting('app.current_tenant')::uuid);
-- repeat per tenant-scoped table
```

Encryption columns (`*_enc`): AES-256-GCM, 96-bit random nonce prepended, envelope-encrypted with a per-tenant data key wrapped by KMS master key. `nino_hash` = HMAC-SHA256(kms_search_key, NINO) for exact-match lookup without decryption.

---

# PART 5 — CALCULATION ENGINE: EVERY FORMULA, FUNCTION & PROOF

The engine is a pure-function TypeScript module (`src/engine/`) with zero I/O — fully unit-testable. All statutory constants live in `config/taxYear2026.ts` keyed by tax year (never mutated; new year = new file + `statutory_config` rows).

## 5.1 Statutory constants (2026/27, all verified)

| Constant | Value | Constant | Value |
|---|---|---|---|
| Personal Allowance | £12,570 (frozen→2031) | NI LEL (monthly) | £559 (£129/wk) |
| Emergency code | 1257L | NI PT employee (monthly) | £1,048 |
| rUK basic 20% (taxable) | £0–£37,700 | NI ST employer (monthly) | £417 (£5,000/yr) |
| rUK higher 40% | £37,701–£112,570 | NI UEL/UST/AUST/VUST (monthly) | £4,189 |
| rUK additional 45% | >£112,570 | NI Freeport UST (monthly) | £2,083 |
| Scot starter 19% | total £12,571–£16,537 | Employee NI main / upper | 8% / 2% |
| Scot basic 20% | →£29,526 | Employee reduced (cat B) | 1.85% |
| Scot intermediate 21% | →£43,662 | Employer NI | 15%, no cap |
| Scot higher 42% | →£75,000 | Employment Allowance | £10,500 |
| Scot advanced 45% | →£125,140 | AE trigger | £10,000/yr (£833/mo) |
| Scot top 48% | above | AE QE band monthly | £520 – £4,189.17 |
| SL Plan 1 | £26,900 @9% | AE minimums | 8% total / 3% employer |
| SL Plan 2 | £29,385 @9% (frozen→2030) | NLW 21+ | £12.71 (1 Apr 2026) |
| SL Plan 4 | £33,795 @9% | NMW 18–20 / 16–17 / appr. | £10.85 / £8.00 / £8.00 |
| SL Plan 5 (FIRST LIVE YEAR) | £25,000 @9% | SSP | £123.25/wk OR 80% AWE if lower; DAY ONE |
| Postgraduate | £21,000 @6% | SMP | wks1–6: 90% AWE; wks7–39: min(£194.32, 90% AWE) |
| | | SMP recovery | 92% std / 109% small employer (≤£45k prior Class 1) |

## 5.2 Money rounding rules (HMRC conventions — encode exactly)

```
floorPound(v)  = ⌊v⌋            → taxable pay to date; student loan deduction
floorPenny(v)  = ⌊v·100⌋/100    → tax due to date (truncate)
niRound(v)     = nearest penny, exact half-penny rounds DOWN   → every NI product
round2(v)      = commercial 2dp → pension contributions, display sums
```

## 5.3 Tax code parser — `parseTaxCode(input: string): ParsedTaxCode`

```
Normalise: uppercase, collapse spaces.
W1/M1 detection: trailing " W1" | " M1" | "X"  → week1Month1=true, strip.
Regime: leading 'S' → scotland; leading 'C' → wales (rates mirror rUK today; keep flag).
Flat codes: BR 20% · D0 40% · D1 45% · SBR 20% · SD0 21% · SD1 42% · SD2 45% · SD3 48% · CBR/CD0/CD1.
NT → no tax.   0T → zero free pay, full progressive bands.
K-codes: K{n} → annualAdditionalPay = n×10+9  (ADDED to taxable).
Suffix codes: {n}[L|M|N|T] → annualFreePay = n×10+9   ← Table A convention: 1257L = £12,579, NOT £12,570.
Unknown → throw (surface as field validation).
```

## 5.4 PAYE — `calculatePAYE({taxCode, period, grossTaxableThisPeriod, ytdTaxable, ytdTaxPaid}) → {tax, taxablePayToDate, freePayToDate, regulatoryLimited, code}`

Cumulative method (default):
```
p            = tax month 1..12         (W1/M1 ⇒ p=1, YTD figures ignored)
grossToDate  = ytdTaxable + grossThis
freePayToDate= annualFreePay × p / 12                 (round2)
addlToDate   = annualAdditionalPay × p / 12           (K codes)
taxableToDate= floorPound(max(0, grossToDate − freePayToDate + addlToDate))
bands pro-rated: bandCeiling_toDate = annualCeiling × p/12
taxDueToDate = Σ slice×rate over pro-rated bands      (floorPenny)
tax          = taxDueToDate − ytdTaxPaid              (negative ⇒ REFUND through payroll)
REGULATORY LIMIT: tax ≤ 50% × grossTaxableThisPeriod  (K & 0T protection; excess carries fwd)
```
Flat codes: `taxDueToDate = floorPenny(floorPound(grossToDate) × flatRate)`.
Taxable gross definition: gross earnings − net-pay-arrangement pension − salary-sacrifice; **relief-at-source pension does NOT reduce taxable pay**.

New-starter code assignment (no P45): Statement A → 1257L cumul · B → 1257L W1/M1 · C → BR · none → 0T W1/M1. With P45: use P45 code + prior pay/tax as opening YTD (unless code is BR/0T/D-prefix → don't carry pay/tax).

## 5.5 National Insurance — `calculateNI(E, category) → {employee, employer, earningsAtLEL, earningsLELtoPT, earningsPTtoUEL}`

Per-period, non-cumulative (except directors). NI-able gross = gross − salary-sacrifice (RAS and net-pay pension do NOT reduce NI-able).
```
EMPLOYEE:                                    EMPLOYER (15% above threshold):
A,H,M,V: 8%×(min(E,UEL)−PT)₊ + 2%×(E−UEL)₊   A,B,C,J: threshold = ST (£417)
B      : 1.85% main band + 2% upper           H,M,V,Z: threshold = UEL £4,189 (0% below — replaces ST)
J,Z    : 2% × (E−PT)₊  (deferment flat)       Freeport letters: threshold = £2,083
C,X    : 0                                    X: 0
Every product niRound()ed (nearest penny, half DOWN).
```
FPS band reporting (mandatory even when NI=0): earnings at LEL, LEL→PT, PT→UEL — sub-PT employees still earn State Pension qualifying years and MUST appear on FPS.

Directors — `calculateDirectorNI(cumulativeEarnings, category, eePaidYTD, erPaidYTD, weeksAsDirector)`:
annual thresholds (PT £12,570 / UEL £50,270 / ST £5,000) pro-rated by weeks/52 for mid-year appointments; compute NI on cumulative earnings, subtract YTD paid. Alternative (table) method = normal monthly + mandatory annual true-up in final period.

Employment Allowance: cumulative employer-NI offset up to £10,500/scheme/year, consumed run-by-run, claimed via EPS flag; never offsets Class 1A/1B.

## 5.6 Student loans — `calculateStudentLoan(E, plan)` → `floorPound(max(0, E − threshold_m) × rate)`

Monthly thresholds: P1 £2,241.67 · P2 £2,448.75 · P4 £2,816.25 · P5 £2,083.33 · PGL £1,750.00. One undergraduate plan max; **postgraduate runs CONCURRENTLY** (separate 6% deduction). Started by DPS SL1/PGL1, stopped by SL2/PGL2. Base = NI-able gross.

## 5.7 Pensions — `calculatePension(E, scheme) → {pensionableEarnings, eeGross, eeDeducted, er, reducesTaxable, reducesNIable}`

```
basis = qualifying_earnings: base = max(0, min(E, 4189.17) − 520)
        pensionable_full | total_earnings: base = E
eeGross = base × eeRate      er = base × erRate
relief branching:
  relief_at_source : eeDeducted = eeGross × 0.80  (provider reclaims 20%); taxable & NI-able unchanged
  net_pay          : eeDeducted = eeGross; reducesTaxable = eeGross      (NI-able unchanged)
  salary_sacrifice : eeDeducted = 0; er += eeGross; reduces BOTH taxable and NI-able
```
Assessment — `assessAutoEnrolment(age, monthlyEarnings, spa=67)`:
eligible (age 22–SPA AND earnings>£833/mo → AUTO-ENROL) · non_eligible (16–74 with earnings>trigger outside age band, or earnings in QE band → may opt in, employer must contribute) · entitled (16–74, ≤QEL → may join, no employer duty). SPA rises 66→67 between Apr 2026–Mar 2028 by DOB — implement `getStatePensionAge(dob)` from GOV.UK timetable, not a constant. Postponement ≤3 months. Opt-out window 1 month → full refund via negative deduction; re-enrolment every 3 years.

## 5.8 Statutory pay
```
sspWeeklyRate(awe)               = min(123.25, 0.80×awe)         ← 2026/27 low-earner rule
sspForAbsence(awe, days, qdays)  = round2(rate/qdays × days)     ← day-one payable; 28-week max/PIW; PIWs link ≤56 days apart
smpForWeek(awe, w)               = w≤6 ? 0.90×awe : min(194.32, 0.90×awe)   (w 1..39)
smpEligible(awe, weeks)          = awe ≥ 129 AND weeks ≥ 26 (by Qualifying Week = EWC−15wks; AWE from 8wks up to QW)
Recovery via EPS: 92% or 109% (small employer). SSP not recoverable.
```

## 5.9 Gross assembly & net
```
hourly    = salary / 52 / contracted_weekly_hours     (NEVER hardcode 37.5)
basic     = salary / 12                               (salaried: 1/12 regardless of month length)
overtime  = hours × hourly × multiplier (default 1.5)
gross     = basic + overtime + bonus + commission + statutory ± adjustments
pro-rata starter/leaver: basic × workingDaysEmployed / workingDaysInPeriod
NET = gross − tax − niEE − pensionDeducted − SL − PGL − attachments(v2)
EMPLOYER COST = gross + niER + pensionER
```

## 5.10 Pay dates, BACS, holidays
```
resolvePayDate(y, m, rule, fixedDay, earlyPay):
  monthly_last_working_day → walk back from month-end over Sat/Sun/bank-holidays
  fixed_date               → min(day, daysInMonth); non-working ⇒ earlyPay? previous working day
bacsSubmissionDate(payDate) = 2 BACS processing days before payday (3-day cycle: submit D1 → process D2 → credit D3)
  BACS calendar = weekends + ENGLAND & WALES holidays ALWAYS (even Scottish employers)
holidayEntitlementDays(dpw) = min(28, 5.6 × dpw);  accrual starter = ceil(ent × months/12 × 2)/2
irregular hours accrual = 12.07% of hours worked;  leaver PILON day rate = salary/260 (divisor configurable)
Bank holiday source: nightly sync https://www.gov.uk/bank-holidays.json → bank_holidays table (3 divisions).
```

## 5.11 Validators
```
NINO   : ^(?!BG|GB|NK|KN|NT|TN|ZZ)[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]$   (strip spaces, uppercase)
PAYEref: ^\d{3}/[A-Z0-9]{1,10}$        AOref: ^\d{3}P[A-Z]\d{7}[0-9X]$
Sort   : 6 digits; Account: 8 digits (pad legacy).  Modulus: Vocalink valacdos.txt weights
         (MOD10 | MOD11 | DBLAL over 14 digits, exceptions 1–14, scsubtab substitutions; data updated ~2×/yr, admin-uploadable)
NMW    : (salary/52)/hours ≥ rate(age); warn on breach, BLOCK finalize without audited override; check POST-sacrifice pay
```

## 5.12 Gender Pay Gap maths (snapshot 5 April, 250+ employees)
```
hourlyRate_i = (ordinary pay + allowances in snapshot period) / hours    — EXCLUDE overtime; exclude nil/reduced-pay leave
meanGap%   = (mean_M − mean_F)/mean_M × 100        medianGap% analogous
bonusGap   : same over 12 months of bonuses; bonusProportion per gender
quartiles  : rank ALL by hourly rate → 4 equal-count bands → %M/%F each (ties: preserve gender ratio)
Publication: NO public write API — generate six figures + CSV for manual GPG-service entry.
```

## 5.13 WORKED PROOF — canonical validation vector (must pass in CI)

£36,000/yr · monthly · month 1 · 1257L cumul · cat A · Plan 2 · AE 5%/3% QE basis · relief at source:
```
gross      = 3,000.00
tax        : freePay 12,579/12 = 1,048.25 → taxable ⌊1,951.75⌋ = 1,951 → ×20% = 390.20
NI ee      : (3,000 − 1,048) × 8%                                      = 156.16
NI er      : (3,000 −   417) × 15%                                     = 387.45
pension    : QE = min(3000, 4189.17) − 520 = 2,480
             eeGross 124.00 → deducted ×0.8                            =  99.20 ; er = 74.40
SL Plan 2  : ⌊(3,000 − 2,448.75) × 9%⌋ = ⌊49.61⌋                       =  49.00
NET        = 3,000 − 390.20 − 156.16 − 99.20 − 49                      = 2,305.44
EMPLOYER   = 3,000 + 387.45 + 74.40                                    = 3,461.85
```
Additional CI vectors (fixtures file): BR flat · SBR/SD0 Scottish · K475 with 50% cap trip · 0T W1M1 · NT · cat C pensioner · cat M under-21 (er NI = 0 below £4,189) · cat J deferment · Plan 5 · PGL concurrent · net-pay pension · salary sacrifice (NI-able reduced) · director annual method crossing PT in M7 · refund month (mid-year code increase) · leaver pro-rata. Cross-validate against HMRC Basic PAYE Tools + published 2026-27 HMRC test data before go-live.

---

# PART 6 — PER-SCREEN FUNCTIONAL SPECIFICATION (ALL 31)

Format per screen: **Route · UI source · Reads · Writes/Actions · Functions invoked · State machine · Real-time · Errors/Edge**.

### S01 Bureau Login — `/login` [bureau_login_kedbyte_payroll]
Centered 360px card: KEDBYTE mark, "Bureau Portal / Payroll professionals only", email, password (visibility toggle, zxcvbn strength meter labelled "Vault-grade"), conditional 6-digit TOTP field (auto-submit on 6th digit), pearl Sign In.
- **Calls:** `POST /api/auth/login` → `{mfaRequired,mfaToken}` | tokens; `POST /api/auth/mfa/verify`.
- **Functions:** `verifyArgon2id`, `verifyTOTP(secret, code, window=±1)`, `issueTokens(user)` (access 15m JWT + refresh 7d rotating family), Redis sliding-window rate limit (5/min/IP+email), lockout: `failed_logins≥5 ⇒ locked_until=now()+15m`.
- **State:** `empty → filling → validating → loading → mfa_pending → loading → success(redirect /bureau/dashboard) | error(toast, clear TOTP)`.
- **Edge:** locked account → 423 with remaining time; backup code path; audit `AUTH_LOGIN`/`AUTH_FAILED`.

### S02 Bureau Dashboard — `/bureau/dashboard` [dashboard_kedbyte_payroll_admin]
Header "Bureau Dashboard / System overview and immediate actions" + quick actions (Run Payroll · Add Employee · Generate Report). Stat cards: Total Payroll This Month (£, mono, delta chip) · Active Employees · Next Pay Date (+days chip) · Pending RTI (overdue badge). Compliance Overview card (P60s issued x/y · P11Ds · Final FPS status · days-remaining countdown). Recent Activity ledger table (Time·Action·User·Status) + "View Ledger".
- **Reads:** `GET /api/dashboard/summary` (Redis-cached 45s, rebuilt by worker on `payrun:committed`/`rti:resolved` events) · `GET /api/activity?cursor=` (keyset on audit_log).
- **Functions:** `aggregateDashboard(tenantId)` = Σ committed pay_runs this tax month; `nextPayDate = min(resolvePayDate(...))` across active companies; `pendingRTI = count(rti_submissions status∈pending,polling,rejected)`, overdue = pay_date < today AND no accepted FPS; compliance from documents + rti tables.
- **Real-time:** WS room `tenant:{id}` events `payrun:committed`, `rti:status`, `employee:changed` → patch stat cards + prepend activity rows (no refetch).
- **Edge:** zero companies → EmptyState "Add a company to get started".

### S03 Company Management — `/bureau/companies` [company_management_kedbyte_payroll_admin]
Table: Company (name + mono PAYE ref) · Employees · Next Pay Date · Status chip · edit/delete. FilterBar: search, Status dropdown, density toggle. "+ Add" → S03b.
- **Reads:** `GET /api/companies?search&status&cursor&sort` — keyset pagination `(name,id)`, pg_trgm search, per-company employee counts via lateral join; next pay date computed by `resolvePayDate`.
- **Writes:** `DELETE /api/companies/:id` (soft; blocked if uncommitted pay runs exist → 409).
- **Edge:** suspended companies excluded from batch operations; RLS scoping.

### S03b Add Company — `/bureau/companies/new` [add_company_registration_kedbyte_payroll_admin]
Sections exactly as designed: Company Details (Name, Tax Reference, Accounts Office Ref, Registered Address) · Bank Details (Sort Code, Account Number, Account Name) · Payroll Configuration (Pay Schedule Monthly/Weekly/Bi-Weekly, Pension Provider NEST/Aviva/Smart, Base Currency).
- **Calls:** `POST /api/companies` (draft autosave `PUT /api/companies/draft` debounced 800ms).
- **Functions:** `validatePAYERef`, `validateAORef`, `validateSortCode`, `modulusCheck(sort, account)` (server-side, valacdos data), duplicate `UNIQUE(tenant_id,paye_ref)` → field error; on create: seed `pension_schemes` row + first `pay_runs` shell? no — schedule only; audit `COMPANY_CREATED`.
- **State:** `draft → validating → creating → created(redirect detail)`. Modulus fail = warning (allow override w/ reason, audited) — modulus pass ≠ account exists.

### S04 Employee List — `/bureau/companies/[id]/employees` [employee_list_acme_corp...]
Breadcrumb "Employees › Acme Corp". Actions: Bulk Import (CSV) · Add Employee. Filters: Department · Status · Tax Code · Pension · More. Columns: Employee (name+EMP id) · Department · Salary (mono) · Tax Code · NI Number **masked `AB 12 •• •• C`** · Status · Pension chip (Enrolled/Opted Out) · Next Pay Date · edit/view.
- **Reads:** `GET /api/companies/:id/employees?filters&cursor` (virtualized client rows ≥200).
- **Writes:** inline `PATCH /api/employees/:id {field, value}` — **optimistic UI**: apply locally → server validates (`validateNINO`, NMW check via `nmwHourly`, tax code parse) → on 422 rollback with slide animation + field toast; every accepted change audited with before/after JSON. Salary edits: `effective_date` picker; NMW breach ⇒ warning chip, block silent save.
- **Bulk import:** `POST /api/employees/import` (multipart) → job `import:employees` → pipeline per row: header map → type coercion → NINO/format validation → dedupe (nino_hash, payroll_id) → NMW → insert valid rows, collect row-errors → WS progress `import:progress {done,total,errors[]}` → summary modal (accept-valid / download error CSV).
- **NI masking:** decrypt server-side, render masked; full value only on employee detail for `bureau_admin` with audit `NINO_VIEWED`.

### S04b Add Employee — `/bureau/employees/new` [add_employee_registration...]
Fields exactly as designed: names, email, DOB, NI Number (live ✓/✗ icon), Start Date, Department, Job Title, Employment Type (FT/PT/Contract), Annual Salary, Pay Frequency, Tax Code, bank (Sort/Account with modulus ✓), Pension panel showing **live Auto-enrolment Status: "Eligible Jobholder"**. Buttons: Save as Draft · Activate.
- **Calls:** `POST /api/employees {status:'draft'|'active'}`.
- **Functions on submit:** `validateNINO` · `parseTaxCode` (starter logic: no P45 → statement A/B/C ⇒ 1257L / 1257L-W1M1 / BR; P45 present → carry code + prior pay/tax into `ytd_figures` opening) · `assessAutoEnrolment(ageAt(startDate), salary/12)` → write `ae_assessments` + set `pension_status`; eligible ⇒ enrolment date = start (or postponement) · `holidayEntitlementDays` from works_pattern · payroll_id generation `EMP-{seq}` · flag for next FPS as starter · audit `EMP_CREATED`.
- **Edge:** rehire → same payroll_id? NO — new payroll_id + FPS "Payroll ID changed" indicator OFF (new employment); NINO absent allowed (DOB+gender+address mandatory then); under-16 ⇒ NI cat X.

### S05.1 Pay Run Input — `/bureau/payruns/[id]/input` [step_1_payroll_input]
Header: "Pay Run: PR-2026-07 · Step 1 of 4", PAY PERIOD chip, PAY DATE chip. Stepper Input→Calculation→Review→Submission. Grid: Employee · Base Salary(ro) · Hours · Overtime · Bonus · Commission · Adjustments(+) · Gross Pay (live) · Status.
- **Create:** `POST /api/payruns {companyId}` → server derives next `tax_period`, `period_start/end` (tax month 6th→5th? No — calendar period per schedule; tax_period from pay_date), `pay_date = resolvePayDate(...)`, `bacs_submission_date = bacsSubmissionDate(payDate)`; seeds entries for all active employees + leavers-with-final-pay.
- **Autosave:** `PUT /api/payruns/:id/entries` debounced 800ms `{entries:[{employeeId, overtimeHours, bonus, commission, adjustments[]}]}` — server recomputes provisional gross only (`basic + overtime×hourly×mult + additions`) and echoes; full engine NOT run here.
- **Guards:** run must be `draft`; concurrent editor lock via `updated_at` version header → 409 "reloaded newer draft".
- **Continue →** transitions to S05.2 and enqueues calc job.

### S05.2 Calculation — `/bureau/payruns/[id]/calculation` [step_2_calculation]
THE signature screen. Left: **Calculation Engine Log** terminal (surface-low, mono, RUNNING badge) streaming timestamped lines: `> INITIALIZING PAY RUN ENGINE…`, `> LOADING TAX CODES AND THRESHOLDS… OK`, `> Processing record 7 of 124`. Right: Live Summary (Total Gross · Tax · NI · Net, mono) + progress bar %.
- **Trigger:** `POST /api/payruns/:id/calculate` → 202 `{jobId}`; status → `calculating`.
- **Worker job `payrun:calculate`:** load company, scheme, entries, `ytd_figures`; FOR EACH entry → `calculateEmployee({...})` (Part 5 orchestrator: gross → pension → taxable/NI-able → PAYE → NI (director branch) → SL/PGL → net) → persist entry outputs + FPS band figures → emit WS `calc:progress {i,total,employeeId,runningTotals}` every row (throttle 50ms) → variance: `variance_pct = (net − prevNet)/prevNet×100`, flag warn >±20%, error >±50% → write `totals_json`, status `calculated`, emit `calc:done`.
- **Real-time:** client subscribes `payrun:{id}`; log lines rendered from progress events (REAL engine events — never simulated); on `calc:done` auto-advance CTA.
- **Failure:** engine throw on one employee ⇒ entry status `error` with message (e.g. "Unrecognised tax code K47X"), job continues, `calc:done {errors:n}` → banner "3 records need attention" linking S05.3 filtered.
- **Idempotent:** recalculate allowed while status∈(calculated, review) — wipes outputs, reruns.

### S05.3 Review — `/bureau/payruns/[id]/review` [step_3_review]
"Audit & Finalise". Table: Employee · Gross · Tax · NI · Pension · Net Pay · **Variance** (signed mono, amber/red per flag). Row click → payslip side panel.
- **Reads:** `GET /api/payruns/:id/entries?status=calculated` + variance join vs `tax_period−1`.
- **Writes:** `PUT /api/payruns/:id/entries/:eid/approve|reject {reason}` · `POST /api/payruns/:id/approve-all` (skips flagged unless `force:true` per-entry ack) · edit inputs ⇒ back-transition to draft for that entry + recalc single (`POST .../entries/:eid/recalculate` runs engine for one row synchronously — <50ms).
- **Gate:** Continue enabled when all entries approved|rejected; rejected entries excluded from FPS and carried to next run? NO — rejected = removed from this run with audited reason.

### S05.4 Submission — `/bureau/payruns/[id]/submission` [step_4_submission]
Vertical timeline: DATA INGEST ✓ · CALCULATION ✓ · APPROVAL ✓ · SUBMISSION (active). Summary chips: TOTAL NET PAY · EMPLOYEES · PERIOD. Action cards: **RTI FPS** (submit→status) · **Pension Contributions** "Send to NEST" · **BACS File** download · **Payslip Distribution** · final "Pay run complete → View Reports / Return to Dashboard".
- **Finalize:** `POST /api/payruns/:id/finalize {idempotencyKey}` — SINGLE DB TRANSACTION: status→committed · roll `ytd_figures` forward (+= each entry) · leavers: stamp leaving_date for FPS · outbox rows: `rti:submit-fps`, `pdf:payslips`, `pension:contributions`, `bacs:generate`, `notify:payslips-ready`. Duplicate key ⇒ 200 replay of original result (exactly-once).
- **BACS:** `generateStandard18(entries, company)` — fixed-width UDL: VOL1/HDR labels, per-credit records (dest sort, dest account, TX 99, amount in PENCE, reference = payroll_id), contra debit record (TX 17), UHL processing-day header = `bacs_submission_date`; download link (SUN required for direct submission; most bureaus route via bank indirect).
- **Cards update live** from WS: `rti:status`, `pdf:progress`, `pension:status`.

### S06 Payslip Review & Approval — `/bureau/payruns/[id]/payslips` [payslip_review_approval]
Left: employee list w/ checkboxes, Net Pay, status; "Approval Progress 35/47" meter; Approve/Reject Selected. Right: full payslip preview (company header, PAYE ref, employee, NI masked, tax code, Payments/Deductions tables, zoom 50/100/150%, pager "1 of 47").
- **Reads:** `GET /api/payruns/:id/payslips` · `GET /api/payslips/:entryId/preview` (HTML render of engine outputs — same template as PDF).
- **Writes:** `POST /api/payruns/:id/payslips/approve {entryIds[]}` / `reject {entryIds[], reason}` (batch, transactional, audited per entry).
- **PDF pipeline (post-finalize job `pdf:payslips`):** queued batch → render payslip HTML template → PDF (Puppeteer worker, concurrency = cores−1, ~2–3s each; demo build: print-stylesheet HTML) → S3 put → `documents` row {sha256, storage_key} → WS `pdf:progress {done,total}` → ESS notification per employee. Regeneration after correction: new document row, old marked `superseded_by`.

### S07 RTI Submission Dashboard — `/bureau/rti` [rti_submission_dashboard]
Filters: Tax Year · Period · Company · Status · Type. Table: Period (2026 M04 mono) · Company · Type · FPS Status · EPS Status · Total Pay · Total Tax · Submitted At · **View XML**. Header action: Submit FPS (manual/late) — plus EPS composer (nil return, recovery amounts, Employment Allowance flag).
- **Reads:** `GET /api/rti?filters` · `GET /api/rti/:id` (detail: envelope, IRmark, correlation, response XML pretty-printed, timeline).
- **Writes:** `POST /api/rti/fps {payRunId}` · `POST /api/rti/eps {companyId, taxPeriod, fields}` · `POST /api/rti/:id/resubmit`.
- **Lifecycle (worker, Part 8):** `pending → submitted(correlationId) → polling(poll_after=now+interval, backoff ×2 cap 30m, attempts≤20) → accepted(delete-request sent) | rejected(parse GovTalkErrors → rti_errors → notify) | error(transport, retry 1m/5m/30m/2h/8h then dead-letter)`.
- **Real-time:** WS `rti:status {id, status}` patches rows; overdue banner: pay_date passed without accepted FPS ⇒ late-filing warning (HMRC penalties).

### S21 RTI Error Resolution — `/bureau/rti/errors` [rti_error_code_mapping_resolution_engine]
Rejected submissions grouped by error; each: code, HMRC message, plain-English cause, **guided steps** (deep links: employee field / company settings / credentials), affected employees, Resubmit button.
- **Reads:** `GET /api/rti/errors` (join rti_submissions × rti_error_dictionary).
- **Seed dictionary:** 1046 auth (→ Settings▸HMRC creds) · 5001 ref mismatch · 6010/6020 schema (engineering alert) · 7801 AO/office mismatch · 7802 scheme ceased · 7806 not registered for year · RIM NINO invalid (→S04 field) · RIM DOB/gender · RIM duplicate payment ID. Import HMRC business-rules spreadsheet as seed data.
- **Resubmit:** regenerates XML from CURRENT data (corrected YTD), new IRmark, new submission row linked `supersedes_id`.

### S08 Pension Auto-Enrolment — `/bureau/pensions` [pension_auto_enrolment_management]
Header stats: 47 eligible · 12 enrolled · 3 opted out · "Last assessment 04 Jul 2026 06:00". Filters: Company · Status · Assessment date · Show historical. Table: Employee (+DOB) · Age · Earnings(Ann) · Status chip (Eligible/Enrolled/Entitled/Opted Out) · Enrolment Date · Action. Buttons: Assess Now · Export Report.
- **Writes:** `POST /api/pensions/assess {companyId}` → job iterates employees → `assessAutoEnrolment` → status transitions (eligible+unenrolled ⇒ enrol: set enrolment_date, create comms task, include in next contribution file) → `ae_assessments` history rows. `POST /api/pensions/optout {employeeId, receivedDate}` → inside window? refund via negative deduction next run : cessation. `GET /api/pensions/contributions/export?format=papdis|nest-csv` (Part 9).
- **Scheduled:** assessment job runs with every pay-run calc + nightly for age-22 birthdays; re-enrolment sweep every 3y ±3m window.

### S09 Reports — `/bureau/reports` [reports_analytics] (+ builder)
Report cards → parameterised runs: Gross-to-Net · Employer P32-style (tax+NI due per tax month = FPS totals − EPS recoveries − Employment Allowance) · Pension contributions · Variance · Cost by department. Small = synchronous `GET /api/reports/:type?params`; heavy = `POST /api/reports/:type/async` → job → S3 file → notification. Exports CSV/XLSX. Builder (S09b): saved report definitions JSON {columns, filters, groupBy} interpreted server-side — v1 optional.

### S23 GPG — `/bureau/reports/gpg` [gender_pay_gap_reporting]
`GET /api/reports/gpg?companyId&snapshot=2026-04-05` → Part 5.12 maths → six figures + quartile chart + CSV export + "publication checklist" (manual GPG service entry — no API exists).

### S10 Settings — `/bureau/settings` [settings_configuration_kedbyte_payroll_admin]
Tabs: Company · Tax · Pension · Bank · Users · Security · Compliance · Notifications · System. Tax tab (as designed): "Tax Year: 2026/27" selector, Thresholds table (Parameter · Value · Variance vs prior yr · Authority=HMRC) read from `statutory_config`; "Update from HMRC" = sync job stub; **Override threshold** = new effective-dated row (NEVER mutate; reason required; audited `CONFIG_OVERRIDE`). Users tab: invite, role assign, MFA reset (audited). Security: session list + revoke (bump token_version), password policy. HMRC credentials (Gateway SenderID/password) stored encrypted, per company.

### S22b Pay Schedule — `/bureau/settings/pay-schedule` [pay_schedule_configuration]
Per company: rule (fixed_date | monthly_last_working_day | weekly | bi-weekly), day picker, early-pay toggle, BACS lead preview — live 12-month calendar preview via `resolvePayDate` + `bacsSubmissionDate` showing shifted dates with reason chips ("moved: bank holiday").

### S22c Bank Holidays — `/bureau/settings/bank-holidays` [bank_holiday_registry]
Table by region/year from `bank_holidays`; Sync Now (`POST /api/bank-holidays/sync` → fetch gov.uk JSON, upsert, diff report); add custom closure (company-scoped, bacs_impact flag).

### S22d Holiday Rules — `/bureau/settings/holiday-rules` [pro_rata_custom_holiday]
Config: entitlement basis, accrual method (annual grant | 12.07% accrual), rounding (half-day up), carry-over cap, PILON divisor (260/252/365), bank-holidays-included toggle. Feeds `holidayEntitlementDays`/`accruedHoliday`.

### S22e Pay Date Notifications — `/bureau/notifications/pay-dates` [pay_date_notifications_admin]
Rules table: T−5 "input due", T−3 "BACS deadline" (=bacs_submission_date−0), T−0 "FPS due today", overdue escalation. Scheduler job `notify:paydates` hourly scans upcoming dates → notifications + email outbox.

### S22a Documents Admin — `/bureau/documents` [document_management_admin] & S20b P45 — `/bureau/documents/p45/[employeeId]`
Vault table: type, employee, tax year, generated, SHA-256 (verify button re-hashes stored object), superseded chain. P45 viewer: Parts 1A/2/3 print layout from final `ytd_figures` at leaving; **P45 is NOT filed to HMRC** — leaver goes on FPS (leaving date + final YTD); PDF is for the employee. Retention: payroll docs 6y (3y statutory minimum); erasure requests → anonymise after retention, never hard-delete audit.

### S11 ESS Login — `/portal/login` [login_employee_portal_kedbyte_payroll]
Same auth machinery, JWT `aud:'portal'`; company-branded variant supported (logo per company). First-login: invite token → set password → optional MFA.

### S12 ESS Dashboard — `/portal/dashboard` [dashboard_my_pay_3]
Cards: Next Pay Date · latest Net Pay (blur-until-tap privacy) · YTD strip (gross/tax/NI/net from `ytd_figures`) · recent payslips · holiday balance (entitlement − approved − pending). `GET /api/ess/dashboard` single aggregate. Bottom tabs Home/Pay/Team/Profile.

### S13 Payslips — `/portal/payslips[/[id]]` [payslip_review_my_pay_1]
List by tax year; viewer = same payslip template, print stylesheet (A4, B/W); `GET /api/ess/payslips/:id/download` → 5-min signed URL; view/download audited (`status: viewed`).

### S14 Holidays — `/portal/holidays` [holiday_management_my_pay_1]
Balance ring + request form (date range → `days = businessDays(start,end,works_pattern) − bankHolidays(region)` live) + history. `POST /api/ess/holidays` → status pending → notify manager (WS + email). Overlap validation; negative-balance block (allow-to-negative config).

### S18 Manager Approvals — `/portal/approvals` [manager_leave_approvals_command_center]
Guard `is_manager`. Pending queue (direct reports via `manager_id` — add column employees.manager_id) · Approve/Reject w/ note · team calendar clash indicator (overlapping approved leave in team). Writes `PUT /api/holidays/:id/approve|reject` → notify employee. Delegation: manager may set delegate_user_id + date range (v1.1).

### S15 Personal Details — `/portal/details` [personal_details_my_pay_1]
Editable: address, phone, emergency contact (immediate). **Bank details: 24h cooling-off** — `PUT /api/ess/bank` writes `pending_bank_changes {activates_at: now+24h}` → immediate notification to employee (both old-email confirm) + bureau admin alert; scheduler job applies at activation; employee can cancel; admin can expedite (audited). Name/DOB/NINO changes: request-only → admin task (RTI-sensitive fields).

### S16 Document Hub — `/portal/documents` [document_hub] & S20a P60 — `/portal/documents/p60/[taxYear]`
Category tabs (Payslips · P60 · P45 · Contracts). P60: generated by year-end job for everyone employed 5 April, issued by 31 May; viewer print-grade; signed URL downloads; hash shown for verification.

### S17 Notifications — `/portal/notifications` [notification_center]
`GET /api/notifications?cursor` · mark read/all · types: payslip_ready, holiday_decision, bank_change, p60_ready, pay_date. WS push `user:{id}` room; unread badge in shell.

### S19 Auth Recovery — `/forgot-password`, `/reset-password/[token]`, `/account-recovery`
Forgot: always 200 (no enumeration); token = 32B random base64url → Redis `reset:{token}=userId` TTL 3600 → plain-text email link. Reset: validate → Argon2id hash → `token_version++` (revoke all sessions) → confirm email. Recovery (MFA lost): backup code path OR identity escalation to bureau admin (manual reset, audited `MFA_RESET`).

---
# PART 7 — COMPLETE API REFERENCE

All endpoints JSON over HTTPS; auth via httpOnly access-token cookie; errors RFC-7807 style `{type, title, status, detail, fields?}`. Mutations require `Idempotency-Key` header where marked [IDEM]. Every mutation writes audit_log.

## 7.1 Auth
| Method Path | Body → Response |
|---|---|
| POST /api/auth/login | {email,password} → {mfaRequired,mfaToken} \| set-cookies + {user} |
| POST /api/auth/mfa/verify | {mfaToken,code} → set-cookies + {user} |
| POST /api/auth/refresh | (cookie) → rotated cookies · reuse-detected ⇒ 401 + family revoked |
| POST /api/auth/logout | → clears cookies, revokes refresh |
| POST /api/auth/forgot-password | {email} → 200 always (no enumeration) |
| GET  /api/auth/reset/:token/validate | → {valid, email?} |
| POST /api/auth/reset | {token, newPassword} → 200; token_version++ revokes all sessions |
| POST /api/auth/mfa/setup · /verify-setup · /disable | TOTP provisioning (otpauth URL + QR), 10 backup codes |

## 7.2 Core resources (representative payloads)

```
GET /api/dashboard/summary →
{ totalPayrollMonth: 142350.00, deltaPct: 4.2, activeEmployees: 1247,
  nextPayDate: "2026-07-15", daysToPay: 4, pendingRti: 3, overdueRti: 1,
  compliance: { taxYear:"2025-26", p60s:{done:14,total:14}, p11ds:{done:0,total:14},
                finalFps:"pending", daysRemaining:3 } }

POST /api/companies [IDEM]
{ name, payeRef:"123/AB456", aoRef:"123PA00012345", address:{line1,city,postcode},
  bank:{sortCode:"20-00-00", account:"12345678", name}, region:"england_wales",
  paySchedule:{rule:"monthly_last_working_day"|"fixed_date", day?:28, earlyPay:true},
  pension:{provider:"NEST", eeRate:0.05, erRate:0.03,
           relief:"relief_at_source", basis:"qualifying_earnings"} }
→ 201 {id,...} | 422 {fields:{payeRef:"Invalid format"}} | 409 duplicate PAYE ref

POST /api/employees [IDEM]
{ companyId, firstName, lastName, email, dob, nino?, address,
  startDate, starterDeclaration?:"A"|"B"|"C",
  p45?:{prevPay, prevTax, taxCode},
  salaryAnnual, contractedWeeklyHours, worksPattern:[7 bool],
  department, jobTitle, employmentType, taxCode?, niCategory?,
  studentLoanPlan?:"plan_1"|"plan_2"|"plan_4"|"plan_5", postgradLoan?:bool,
  bank?:{sortCode,account,name}, status:"draft"|"active" }
→ 201 { id, payrollId:"EMP-00188", taxCode:"1257L", taxBasis:"cumul",
        aeAssessment:{result:"eligible", enrolmentDate:"2026-08-01"} }

PATCH /api/employees/:id  {field, value, effectiveDate?, reason?} → 200 | 422 (optimistic-UI rollback)
POST  /api/employees/import  (multipart CSV) → 202 {jobId}

POST /api/payruns [IDEM] {companyId} → 201
{ id, ref:"PR-2026-07", taxYear:"2026-27", taxPeriod:4,
  periodStart:"2026-07-01", periodEnd:"2026-07-31",
  payDate:"2026-07-31", bacsSubmissionDate:"2026-07-29",
  entries:[{id, employeeId, name, baseSalaryMonthly, ...inputs zeroed}] }

PUT  /api/payruns/:id/entries  {entries:[{id, overtimeHours, bonus, commission,
       adjustments:[{label, amount, taxable:bool, niable:bool}]}]}  → provisional gross echo
POST /api/payruns/:id/calculate → 202 {jobId}
GET  /api/payruns/:id/entries?status= →
  [{ id, employee:{id,name,payrollId}, gross, tax, niEmployee, niEmployer,
     pensionEmployee, pensionEmployer, studentLoan, postgradLoan, net,
     variancePct, varianceFlag:"none"|"warn"|"error", status }]
PUT  /api/payruns/:id/entries/:eid/approve | /reject {reason}
POST /api/payruns/:id/entries/:eid/recalculate      (single-row synchronous engine, <50ms)
POST /api/payruns/:id/approve-all {force?:[entryIds acknowledging variance flags]}
POST /api/payruns/:id/finalize [IDEM] → 200 {status:"committed", jobs:{fps,payslips,pension,bacs}}
GET  /api/payruns/:id/bacs → text/plain Standard-18 file

POST /api/rti/fps {payRunId} → 202 {submissionId}
POST /api/rti/eps {companyId, taxYear, taxPeriod, noPayment?:bool,
                   smpRecovered?, nicCompensation?, employmentAllowance?:bool} → 202
GET  /api/rti?taxYear&period&companyId&status&type&cursor → rows for S07 table
GET  /api/rti/:id → {xml, irmark, correlationId, timeline:[{at,event}], responseXml?, errors:[...]}
POST /api/rti/:id/resubmit [IDEM] → 202 {newSubmissionId, supersedes}

POST /api/pensions/assess {companyId} → 202 {jobId}
POST /api/pensions/optout {employeeId, receivedDate} → {mode:"refund"|"cessation"}
GET  /api/pensions/contributions/export?payRunId&format=papdis|nest-csv → file

GET  /api/reports/:type?params → data     POST /api/reports/:type/async → 202 {jobId}
GET  /api/reports/gpg?companyId&snapshot → {meanGap, medianGap, bonusMeanGap,
     bonusMedianGap, bonusProportionM, bonusProportionF, quartiles:[4×{m,f}]}

ESS:  GET /api/ess/dashboard · GET /api/ess/payslips[/:id/download → 5-min signed URL] ·
      POST /api/ess/holidays {startDate,endDate,reason} → {days, status:"pending"} ·
      PUT /api/holidays/:id/approve|reject {note} ·
      PUT /api/ess/bank {sortCode,account,name} → {activatesAt: now+24h} ·
      GET/PUT /api/ess/details · GET /api/notifications?cursor · PUT /api/notifications/:id/read

Settings: GET/PUT /api/settings/:section ·
      POST /api/settings/tax/override {taxYear, key, value, reason} → new effective-dated row ·
      POST /api/bank-holidays/sync · GET/PUT /api/settings/hmrc-credentials (encrypted at rest)
Audit: GET /api/audit?entity&cursor · GET /api/audit/verify?from&to → chain-integrity report
```

## 7.3 WebSocket events (Socket.io; rooms authorized from JWT at handshake)
```
room tenant:{id} : payrun:committed · rti:status {id,status,errorCode?} · employee:changed
room payrun:{id} : calc:progress {i,total,employeeId,runningTotals} · calc:done {errors} · pdf:progress
room user:{id}   : notification:new {...}
Handshake: cookie JWT verified → join only permitted rooms; tenant mismatch ⇒ disconnect.
```

---

# PART 8 — HMRC RTI INTEGRATION (implementation-exact)

## 8.1 Endpoints & credentials
```
LIVE submit/poll : https://transaction-engine.tax.service.gov.uk/submission | /poll
TEST (ETS/TPVS)  : https://test-transaction-engine.tax.service.gov.uk/submission | /poll
Credentials      : Government Gateway SenderID + password per PAYE scheme (encrypted at rest)
Vendor ID        : issued on HMRC software-developer registration → ChannelRouting/Channel/URI
Recognition path : LTS offline validation → TPVS/ETS round-trip → submit test-scenario outputs
                   to SDSTeam@hmrc.gov.uk → recognition listing. HMRC target ≈6 weeks after
                   your testing completes. THE CRITICAL PATH — start Phase 0.
```

## 8.2 GovTalk FPS envelope (2026-27 namespace `.../FullPaymentSubmission/26-27/1`)
```xml
<GovTalkMessage xmlns="http://www.govtalk.gov.uk/CM/envelope">
 <EnvelopeVersion>2.0</EnvelopeVersion>
 <Header>
  <MessageDetails>
   <Class>HMRC-PAYE-RTI-FPS</Class>
   <Qualifier>request</Qualifier>        <!-- lifecycle: request→acknowledgement→poll→response→delete -->
   <Function>submit</Function>
   <CorrelationID/>                      <!-- empty on submit; echoed in acknowledgement -->
   <Transformation>XML</Transformation>
   <GatewayTest>0</GatewayTest>          <!-- 1 = Test-in-Live -->
  </MessageDetails>
  <SenderDetails><IDAuthentication>
   <SenderID>{gatewayUser}</SenderID>
   <Authentication><Method>clear</Method><Role>principal</Role>
     <Value>{gatewayPassword}</Value></Authentication>
  </IDAuthentication></SenderDetails>
 </Header>
 <GovTalkDetails>
  <Keys><Key Type="TaxOfficeNumber">123</Key>
        <Key Type="TaxOfficeReference">AB456</Key></Keys>
  <TargetDetails><Organisation>IR</Organisation></TargetDetails>
  <ChannelRouting><Channel><URI>{vendorId}</URI>
    <Product>Kedbyte Payroll</Product><Version>1.0</Version></Channel></ChannelRouting>
 </GovTalkDetails>
 <Body>
  <IRenvelope xmlns="http://www.govtalk.gov.uk/taxation/PAYE/RTI/FullPaymentSubmission/26-27/1">
   <IRheader>
    <Keys><Key Type="TaxOfficeNumber">123</Key>
          <Key Type="TaxOfficeReference">AB456</Key></Keys>  <!-- MUST match GovTalkDetails/Keys -->
    <PeriodEnd>2026-08-05</PeriodEnd>
    <IRmark Type="generic">{IRMARK}</IRmark>
    <Sender>Bureau</Sender>
   </IRheader>
   <FullPaymentSubmission>
    <EmpRefs><OfficeNo>123</OfficeNo><PayeRef>AB456</PayeRef>
      <AORef>123PA00012345</AORef></EmpRefs>
    <RelatedTaxYear>26-27</RelatedTaxYear>
    <Employee>                                   <!-- repeats per pay_run_entry -->
     <EmployeeDetails>
      <NINO>AB123456C</NINO>
      <Name><Fore>Eleanor</Fore><Sur>Vance</Sur></Name>
      <Address>...</Address><BirthDate>1985-05-14</BirthDate><Gender>F</Gender>
     </EmployeeDetails>
     <Employment>
      <PayId>EMP-00142</PayId>
      <Starter>StartDate + declaration A/B/C</Starter>   <!-- new starters only -->
      <LeavingDate>...</LeavingDate>                     <!-- leavers; replaces P45 filing -->
      <FiguresToDate><TaxablePay/><TotalTax/><StudentLoansTD/>
        <PostgradLoansTD/><EmpeePenContribnsPaidTD/>...</FiguresToDate>
      <Payment>
       <PayFreq>M1</PayFreq><PmtDate>2026-07-31</PmtDate>
       <MonthNo>4</MonthNo><PeriodsCovered>1</PeriodsCovered>
       <HoursWorked>D</HoursWorked>              <!-- A:<16h B:16–23.99 C:24–29.99 D:30+ E:other -->
       <TaxCode>1257L</TaxCode>
       <TaxablePay>3000.00</TaxablePay>
       <TaxDeductedOrRefunded>390.20</TaxDeductedOrRefunded>
       <StudentLoanRecovered PlanType="02">49.00</StudentLoanRecovered>
                              <!-- 2026-27: PlanType 05 supported; 05 is DEFAULT when unknown -->
       <PostgradLoanRecovered>...</PostgradLoanRecovered>
      </Payment>
      <NIlettersAndValues>
       <NIletter>A</NIletter>
       <GrossEarningsForNICsInPd>3000.00</GrossEarningsForNICsInPd>
       <AtLELYTD/><LELtoPTYTD/><PTtoUELYTD/>     <!-- band figures MANDATORY even when NI = 0 -->
       <TotalEmpNICInPd>387.45</TotalEmpNICInPd>          <!-- employER -->
       <EmpeeContribnsInPd>156.16</EmpeeContribnsInPd>    <!-- employEE -->
      </NIlettersAndValues>
     </Employment>
    </Employee>
   </FullPaymentSubmission>
  </IRenvelope>
 </Body>
</GovTalkMessage>
```
**2026-27 schema deltas:** Student Loan **Plan 5** (data item 192, default when plan unknown) · NI **SPBP** items 221 (recovered YTD) / 222 (NIC compensation YTD) / 223 (SPBP YTD) + item 225 NI workplace postcode · EPS de-minimis state-aid items REMOVED · Small Employers Relief compensation 9%. Bind exact element names from the official 2026-27 RTI Data Item Guide before coding schema classes.

## 8.3 IRmark — `computeIRmark(bodyXml: string): { base64: string; base32: string }`
```
1. Extract the <Body> element; the GovTalk envelope namespace must be INHERITED onto it
   (missing/stray namespaces on Body = the classic IRmark-invalid rejection).
2. Blank the IRmark element's text content (element remains).
3. Canonicalise with standard W3C XML C14N 1.0 (without comments).
4. digest = SHA-1(canonical bytes) → 20 raw bytes.
5. Embedded IRmark = base64(digest) [28 chars]; user-visible receipt form = base32(digest).
HMRC's own step-by-step guide: do NOT hand-roll C14N — use a proven library (xml-crypto, libxml).
Demo build: we emit deterministic canonical-form XML so base64(sha1(body)) is exact;
production swaps in library C14N behind the same function signature.
```

## 8.4 Submission worker state machine (queues `rti:submit`, `rti:poll`)
```
submit : build XML → IRmark → POST /submission
   ← acknowledgement {CorrelationID, ResponseEndPoint{PollInterval}}
   persist correlation_id · status=polling · poll_after = now + PollInterval
poll   : POST /poll {Class, Qualifier:"poll", Function:"submit", CorrelationID}
   ← acknowledgement (still processing) ⇒ backoff ×1.5, cap 30 min, attempts ≤ 20
   ← response ⇒ business ACCEPTED → send delete-request → status=accepted → WS + notify
   ← error    ⇒ parse GovTalkErrors[] → rti_errors rows → status=rejected → S21 workflow
transport failure ⇒ retry 1m/5m/30m/2h/8h → dead-letter + ops alert
HMRC auto-deletes correlations after 60 days — treat missing correlation on poll as expired.
```

## 8.5 DPS incoming-notices worker (`dps:fetch`, nightly 05:00 + on-demand)
```
DPSrequestToken  (WS-Security UsernameToken over HTTPS; token TTL 4 h)
for type in [P6, P9, SL1, SL2, PGL1, PGL2, AR, NOT]:
    DPSretrieve(type, highWaterMark)   — ≈1,500 notices/call cap
    upsert dps_notices · advance the stored high_water_mark (the ONLY cursor state)
apply job:
  P6/P9  → update employee tax_code (+ basis + effective date) · audit CODE_NOTICE_APPLIED · notify
  SL1/PGL1 → start loan (plan from notice; unknown plan ⇒ Plan 5 default in 2026-27)
  SL2/PGL2 → stop loan
  unmatched NINO ⇒ exceptions queue surfaced on S21.
```

---

# PART 9 — PENSION INTEGRATION

## 9.1 NEST web services (async, idempotent)
Sequence per committed pay run: **Enrol Workers** (new eligibles; 30-day idempotency window keyed on payload digest — byte-identical resubmits dedupe, so serialize deterministically) → **Update Contributions** (per schedule row: NINO, pensionable earnings, ee/er amounts; 15-minute idempotency window) → **Approve for Payment** (same-calendar-day idempotency). TLS + per-employer NEST credentials on every call; processing is asynchronous — poll retrieval endpoints; workers appear on contribution schedules ≈1 h after processing. Employer direct debit must be active before approval succeeds — surface as a pre-flight check on the S05.4 card.

## 9.2 PAPDIS export (provider-agnostic fallback)
CSV per PAPDIS 1.1 — one row per employee-period: EmployerId · PayPeriodStart/End · PayrollFrequency · NINO · Forename · Surname · DOB · Gender · PensionableEarnings · EmployeeContribution · EmployerContribution · AEStatus · EnrolmentDate · OptOutDate. Generated from committed pay_run_entries; downloadable from S05.4 card and S08 export. Covers People's Pension, Smart Pension, Aviva, Standard Life imports.

---

# PART 10 — JOBS, QUEUES, REAL-TIME

```
Queues (BullMQ/Redis in production; demo build = in-process async runner behind the same interface):
  payrun:calculate      concurrency 2/tenant · emits progress events per record
  rti:submit, rti:poll  poll scheduled by poll_after
  pdf:payslips          concurrency = cores − 1 (Puppeteer)
  pension:assess, pension:contributions
  import:employees
  notify:paydates       hourly cron          bank-holidays:sync  nightly 03:00
  dps:fetch             nightly 05:00        bank-changes:apply  every 10 min (24 h cooling-off)
  yearend:p60           triggered 6 April

Transactional outbox: finalize writes jobs_outbox rows in the SAME transaction as status=committed;
a dispatcher relays outbox → queues (at-least-once; every handler idempotent by natural key).
Dead-letter queue per queue + ops notification on entry.

Real-time: Socket.io hosted on the worker process (Redis adapter for multi-instance);
SSE fallback for calc progress. NEVER simulate progress — the terminal log renders real engine events.
```

---

# PART 11 — SECURITY

## 11.1 RBAC matrix (middleware + per-query scoping; RLS backstop)
| Capability | bureau_admin | company_admin | payroll_mgr | accountant | employee |
|---|---|---|---|---|---|
| Companies CRUD | ALL | own (read) | assigned (read) | — | — |
| Employees CRUD | ALL | own | assigned (edit) | — | self (limited) |
| Pay run execute/approve | YES | YES | YES | — | — |
| RTI submit / resolve | YES | YES | view | — | — |
| Settings / rate override | YES | own subset | — | — | — |
| Financial reports | ALL | own | assigned | aggregates | — |
| Audit ledger | ALL | own | — | — | — |
| ESS self-service | — | — | — | — | YES (+ manager approvals if flagged) |

## 11.2 Crypto, audit, retention
- Argon2id (m=64 MB, t=3, p=4). Password policy: 12+ chars + HIBP k-anonymity breach check (no forced composition rules per NIST 800-63B).
- Field encryption: AES-256-GCM, 96-bit nonce prepended; envelope encryption (per-tenant DEK wrapped by KMS KEK). `nino_hash` = HMAC-SHA256 with a dedicated search key.
- TLS 1.2+, HSTS, SameSite=Strict cookies + origin check (CSRF), rate limits on auth and exports.
- Audit hash chain: `curr_hash = SHA-256(prev_hash ‖ canonicalJSON(row))`; genesis constant; `GET /api/audit/verify` walks and reports first break; DB role INSERT-only + trigger blocking UPDATE/DELETE.
- NINO masked everywhere (`AB 12 •• •• C`); full reveal = bureau_admin only, audited `NINO_VIEWED`.
- Retention: payroll records 3 years statutory minimum (default 6); GDPR erasure = anonymisation AFTER retention expiry — statutory retention overrides erasure; audit rows never deleted.

---

# PART 12 — TESTING & ACCEPTANCE CRITERIA

1. **Engine golden files (CI-blocking):** 25+ vectors incl. the £36k canonical proof (§5.13) — exact-penny assertions on tax/NI/SL/pension/net; cross-validated against HMRC Basic PAYE Tools and published 2026-27 HMRC test data.
2. **Property tests:** ∀ gross ∈ [0, £50k/mo]: net ≤ gross (except refund months); NI band figures sum to E; Σ monthly cumulative tax over 12 months = annual liability ± £0.12 rounding drift; SL deduction is a whole £.
3. **RTI:** generated XML validates against the 2026-27 XSD; IRmark verified on HMRC LTS; RIM-rule fixtures for every dictionary code; duplicate-submission guard test.
4. **Tenancy (pgTAP):** cross-tenant SELECT under wrong `app.current_tenant` returns 0 rows on every scoped table.
5. **E2E (Playwright):** login+MFA → add company (modulus warn path) → add employee (AE eligible) → pay-run 4 steps with live calc log → payslip approve → FPS accepted (mocked TE) → ESS sees payslip → holiday request → manager approval → 24 h bank-change cooling-off enforced. Axe: 0 critical violations.
6. **Acceptance gates:** on-screen figures reproduce the canonical vector to the penny; variance flags fire at ±20/±50%; audit chain verifies end-to-end; recalculating a historical period uses that period's effective-dated rates.

---

# PART 13 — BUILD PHASES (critical path = HMRC recognition)

```
P0  wk 0–2   HMRC developer registration → Vendor ID + test credentials  ── clock starts
             Repo, CI, Postgres schema + RLS, auth (JWT/TOTP/refresh), audit chain
P1  wk 2–8   Calculation engine + golden tests · Companies/Employees CRUD + import
             Pay-run wizard end-to-end (queued calc + WebSocket terminal log)
P2  wk 6–14  RTI client (envelope, IRmark, submit/poll/delete) on LTS → TPVS/ETS
             → recognition scenario pack to SDST → listing
             DPS ingest · Pensions (NEST + PAPDIS) · Payslip PDF pipeline
P3  wk 12–18 ESS portal complete · Reports + GPG · Settings/effective-dated rates · Notifications
P4  wk 16–20 Year-end (P60 job, final FPS indicator) · hardening, pen-test, load test · pilot bureau
GO-LIVE GATE: recognition listed + golden tests green + pilot parallel-run matches
              incumbent software to the penny for one full pay cycle.
```

## END — FINAL PRD/TRD v2.0 · 31 screens · build-ready. Next instruction: BUILD.
