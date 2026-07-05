# KEDBYTE PAYROLL — SETTINGS MODULE: COMPLETE BUILD SPECIFICATION
## v1.0 — 2026-07-05 · Covers all 9 tabs · Routing, data, logic, sync, validation, audit
### Companion to FINAL PRD/TRD v2.0 (Part 6 §S10). This document is self-sufficient — build from it directly.

---

# 0 — FIX FIRST: THE BROKEN "RETIREM" NAV ITEM

## 0.1 What's wrong (visible in your screenshots)
The third item in the settings sub-nav renders as `RETIREM` in a pixelated OCR-style face, overflowing its row, with the icon colliding into the text. Three separate bugs:

1. **Wrong label.** The tab is the pension scheme section. Per the PRD the label is **"Pension"** — not "Retirement". Rename it. (7 chars also fixes the overflow.)
2. **Wrong font.** The item is picking up a decorative/fallback font instead of Inter. This happens when (a) the element has its own `font-family` (e.g. a leftover `font-family: 'Retirement'` or a display face from the Stitch export), or (b) `text-transform` + `letter-spacing` was applied with a font that only has small-caps glyphs, or (c) the label was exported as ASCII-art/styled text. The nav label must **inherit** the app font.
3. **Not using the shared component.** Every other row (Company, Tax, Bank…) is uniform; this one clearly bypassed the shared `SettingsNavItem`. All nine rows must render through one component.

## 0.2 The fix (drop-in)

```tsx
// components/settings/SettingsNav.tsx
const SETTINGS_SECTIONS = [
  { slug: 'company',       label: 'Company',       icon: 'domain' },
  { slug: 'tax',           label: 'Tax',           icon: 'percent' },
  { slug: 'pension',       label: 'Pension',       icon: 'savings' },        // ← was "RETIREM…"
  { slug: 'bank',          label: 'Bank',          icon: 'account_balance' },
  { slug: 'users',         label: 'Users',         icon: 'group' },
  { slug: 'security',      label: 'Security',      icon: 'lock' },
  { slug: 'compliance',    label: 'Compliance',    icon: 'verified' },
  { slug: 'notifications', label: 'Notifications', icon: 'notifications' },
  { slug: 'system',        label: 'System',        icon: 'settings' },
] as const;

export function SettingsNav({ active }: { active: string }) {
  return (
    <nav className="settings-nav" aria-label="Settings sections">
      {SETTINGS_SECTIONS.map(s => (
        <Link key={s.slug} href={`/bureau/settings/${s.slug}`}
              className={`settings-nav-item${active === s.slug ? ' is-active' : ''}`}>
          <span className="material-symbols-outlined" aria-hidden>{s.icon}</span>
          <span className="settings-nav-label">{s.label}</span>
        </Link>
      ))}
    </nav>
  );
}
```

```css
/* globals.css — settings nav (locks out any font leakage) */
.settings-nav        { width: 200px; border: 1px solid var(--border-subtle); background: var(--bg-surface); }
.settings-nav-item   { display: flex; align-items: center; gap: 12px; height: 48px; padding: 0 16px;
                       border-bottom: 1px solid var(--border-subtle);
                       color: var(--text-secondary); text-decoration: none; }
.settings-nav-item:last-child { border-bottom: 0; }
.settings-nav-label  { font-family: Inter, system-ui, sans-serif !important;   /* kills the pixel-font fallback */
                       font-size: 13px; font-weight: 500; letter-spacing: 0;
                       text-transform: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.settings-nav-item .material-symbols-outlined { font-size: 20px; flex: none; }
.settings-nav-item:hover     { color: var(--text-primary); background: var(--surface-high, #201f1f); }
.settings-nav-item.is-active { color: var(--text-primary); background: #201f1f;
                               box-shadow: inset 2px 0 0 var(--accent-pearl); }
```

Checklist: label says **Pension** · font is Inter 13/500 like siblings · icon `savings` · row height 48px matches · active state = inset pearl bar. If the pixel font still appears, search the codebase for `Retirement`, `font-family` overrides inside the settings nav, and any `@font-face` the Stitch export injected — delete them.

---

# 1 — ROUTING & NAVIGATION MODEL

```
/bureau/settings                     → redirect('/bureau/settings/company')
/bureau/settings/[section]           section ∈ company|tax|pension|bank|users|security|
                                               compliance|notifications|system
                                     unknown slug → notFound()

Deep links (used elsewhere in the app — keep stable):
/bureau/settings/tax?year=2026-27&highlight=ni_pt        (RTI error S21 → threshold row)
/bureau/settings/security#hmrc-credentials                (RTI 1046 auth error → creds card)
/bureau/settings/users?invite=1                           (dashboard quick action)
/bureau/settings/bank?verify=:companyId                   (company modulus warning)

Existing sub-pages remain SEPARATE routes (linked from cards inside tabs, not nested):
/bureau/settings/pay-schedule · /bureau/settings/bank-holidays · /bureau/settings/holiday-rules
```

**File structure (Next.js App Router):**
```
src/app/(bureau)/bureau/settings/
  layout.tsx            ← header (“Settings / Tax thresholds · HMRC sync · …”), ACTIVE TAX YEAR
                          chip, <SettingsNav active={section}/>, content slot
  page.tsx              ← redirect to /company
  [section]/page.tsx    ← switch(section) → tab component (server component + client islands)
src/components/settings/
  SettingsNav.tsx  SectionCard.tsx  KeyValueTable.tsx  ThresholdTable.tsx
  CompanyTab.tsx TaxTab.tsx PensionTab.tsx BankTab.tsx UsersTab.tsx
  SecurityTab.tsx ComplianceTab.tsx NotificationsTab.tsx SystemTab.tsx
```

**Guards:** layout requires role ∈ `bureau_admin | company_admin`. Per-tab: `users`, `security`, `system` = **bureau_admin only** (company_admin sees a locked card, not a 404). The ACTIVE TAX YEAR chip (top right, `2026-27`) is a read-only global sourced from `GET /api/settings/tax/years` → `{active:'2026-27', available:[...]}`; changing displayed year on the Tax tab is a **view filter only** — it never changes which year the engine uses (the engine derives year from each pay run's `pay_date`).

---

# 2 — SHARED SETTINGS ARCHITECTURE (applies to every tab)

## 2.1 The one fetch/update pattern

```
READ    GET  /api/settings/:section?companyId=&year=   → SectionPayload (shape per tab below)
WRITE   PUT  /api/settings/:section                    → { section, changes:[{key, value}], companyId?, reason? }
        Response 200 { payload }   |  422 { fields:{key: message} }  |  403 | 409
```

Rules every write obeys:
1. **Validate server-side** with the same validators the engine uses (`validatePAYERef`, `validateSortCode`, `modulusCheck`, `parseTaxCode`…). Client validation is UX only.
2. **Audit every accepted change**: one `audit_log` row per key — `action:'SETTINGS_CHANGED'`, `entity_type:'settings:{section}'`, `before_json/after_json`, optional `reason`. Hash-chained as per PRD §11.2.
3. **Optimistic UI with rollback**: apply locally → PUT → on 422 revert the field, show inline error; on network error revert + toast "Change not saved — retry".
4. **Concurrency**: every SectionPayload carries `version` (max `updated_at` of underlying rows). PUT sends `If-Match: version`; mismatch → 409 → client refetches, shows "Settings changed by {actor} — review and retry".
5. **Cache**: server components fetch fresh (no cache) — settings reads are cheap and correctness matters; after PUT, `router.refresh()`.

## 2.2 Effective-dated configuration (the load-bearing rule)

Statutory numbers are **never** stored as a single mutable value. They live in `statutory_config (tax_year, effective_from, key, value_json, source)` — PRD Part 4. Reading a rate = *latest row where `effective_from ≤ date`* for that year:

```sql
SELECT DISTINCT ON (key) key, value_json
FROM statutory_config
WHERE tax_year = $1 AND effective_from <= $2
ORDER BY key, effective_from DESC;
```

```ts
// server/config.ts
export async function getStatutoryConfig(taxYear: string, onDate: string): Promise<Record<string, unknown>>
export async function overrideStatutory(taxYear: string, key: string, value: unknown,
  effectiveFrom: string, reason: string, actorId: string): Promise<void>
// overrideStatutory INSERTS a new row (never UPDATE), audits CONFIG_OVERRIDE with reason (mandatory),
// and invalidates the Redis key `cfg:{taxYear}` so the engine picks it up next calculation.
```

Consequence: recalculating March's pay run in June still uses March's numbers. This is the acceptance test in PRD §12.6.

## 2.3 Bureau-level vs company-level scope

Some settings are bureau-wide, some per-company. Every tab payload declares its scope; company-scoped tabs render a company selector (defaults to "Bureau defaults"):

| Tab | Scope |
|---|---|
| Company | bureau defaults + per-company overrides |
| Tax | global statutory (read) + per-company PAYE identity |
| Pension | per-company scheme (+ bureau default template) |
| Bank | per-company |
| Users | bureau |
| Security | bureau (+ per-company HMRC credentials) |
| Compliance | bureau policy + per-company year-end status |
| Notifications | bureau rules + per-user channel prefs |
| System | bureau |

Resolution order everywhere: `company override → bureau default → statutory/config constant`.

---

# 3 — TAB-BY-TAB SPECIFICATION

## 3.1 COMPANY — `/bureau/settings/company`

**Purpose:** bureau-wide defaults applied at client onboarding (your screenshot's "Company Defaults / Bureau-wide defaults applied to new client onboardings" card) + per-company overrides.

**Payload:**
```ts
GET /api/settings/company?companyId=optional →
{
  scope: 'bureau' | 'company', version: string,
  defaults: {
    region: 'england_wales'|'scotland'|'northern_ireland',
    paySchedule: { rule:'monthly_last_working_day'|'fixed_date'|'weekly'|'bi_weekly', day?: number },
    earlyPay: boolean,
    overtimeMultiplier: number,          // 1.5 default
    pilonDivisor: 260|252|365,
    holidayEntitlementBasis: 'statutory_5_6_weeks',
    payslipTemplate: 'void_standard',
    payrollIdPrefix: string,             // 'EMP-'
  },
  companies?: [{ id, name, overridesCount }]   // bureau view: which clients deviate
}
```

**Logic:**
- `Edit Defaults` opens an editor over `defaults`; PUT `{section:'company', changes:[...]}` → writes bureau row.
- Changing a **default never retro-changes existing companies** — it seeds future onboardings only. Banner states this explicitly.
- Per-company view (selector) shows the same fields resolved with override badges (`pearl dot = overridden`); clearing an override reverts to bureau default (`changes:[{key, value:null}]`).
- Validation: `overtimeMultiplier ∈ [1, 3]`; `day ∈ [1,31]` only when rule=fixed_date; region change on an existing company warns "affects bank-holiday calendar and pay-date resolution from the next pay run".

## 3.2 TAX — `/bureau/settings/tax`  (the tab in your screenshots' header strip)

**Purpose:** view statutory thresholds per tax year, HMRC sync, controlled overrides, per-company PAYE identity.

**Payload:**
```ts
GET /api/settings/tax?year=2026-27&companyId=optional →
{
  version: string,
  years: { active:'2026-27', available:['2026-27','2025-26'] },
  thresholds: [                                  // rendered as your Threshold table
    { key:'personal_allowance',    label:'Personal Allowance',        value:12570,  unit:'£/yr',
      priorValue:12570, variancePct:0, authority:'HMRC', effectiveFrom:'2026-04-06', overridden:false },
    { key:'basic_rate_limit',      label:'Basic Rate Limit',          value:50270, ... },
    { key:'higher_rate_limit',     label:'Higher Rate Limit',         value:125140, ... },
    { key:'ni_pt',                 label:'NI Primary Threshold',      value:12570, ... },
    { key:'ni_st',                 label:'NI Secondary Threshold',    value:5000, ... },
    { key:'ni_uel',                label:'NI Upper Earnings Limit',   value:50270, ... },
    { key:'ni_lel',                label:'NI Lower Earnings Limit',   value:6708, ... },
    { key:'sl_plan_1'…'sl_plan_5','sl_postgrad', 'ae_trigger','ae_qel','ae_qeu',
      'nlw_21','nmw_18_20','nmw_16_17','ssp_week','smp_std_week', ... }
  ],
  scotlandBands: [...], rukBands: [...],
  sync: { lastRunAt:'2026-07-01T03:00:00Z', status:'ok'|'stale'|'failed', source:'gov.uk rates page' },
  companyPaye?: { payeRef, aoRef, senderVerified: boolean }   // when companyId given
}
```

**Logic — the three actions on this tab:**

**(a) Update from HMRC (sync).** `POST /api/settings/tax/sync {year}` → 202 `{jobId}` → job `tax:sync`:
```
fetch canonical rates (v1: bundled JSON per year shipped with releases, "source: Kedbyte rates pack";
                       v2: scrape/parse gov.uk rates-and-thresholds page)
diff against current effective values
  no changes  → sync.lastRunAt updated, toast "Thresholds verified — no changes"
  changes     → DO NOT auto-apply. Create a review diff:
                GET /api/settings/tax/sync/:jobId → [{key, current, incoming, source}]
                Modal table with per-row Accept — accepted rows call overrideStatutory(...,
                reason:'HMRC sync {date}'). Statutory numbers changing silently is how
                payroll products create liabilities; a human always confirms.
audit: TAX_SYNC_RUN + one CONFIG_OVERRIDE per accepted row
```

**(b) Override threshold.** Row action → modal: new value · `effectiveFrom` (default today; may be ≥ year start) · mandatory `reason`. `POST /api/settings/tax/override {taxYear, key, value, effectiveFrom, reason}` → inserts effective-dated row (§2.2), row shows `overridden:true` pearl badge + hover history (`GET /api/settings/tax/history?key=`). **Guard:** if committed pay runs exist with `pay_date ≥ effectiveFrom`, block with 409: "3 committed pay runs fall after this date. Overrides cannot rewrite committed history — corrections go through pay-run amendment (FPS correction)."
- `Variance` column = `(value − priorYearValue)/priorYearValue × 100`, computed server-side, mono, amber if ≠ 0.

**(c) Company PAYE identity** (company selected): `payeRef` (`^\d{3}/[A-Z0-9]{1,10}$`), `aoRef` (`^\d{3}P[A-Z]\d{7}[0-9X]$`). Editing either warns: "Changes apply to the NEXT RTI submission. Mid-year reference changes usually require an HMRC scheme transfer — confirm with HMRC first." Audited `PAYE_REF_CHANGED`.

**Year selector:** switching to `2025-26` re-fetches read-only historical values (no override/sync buttons; banner "Closed tax year — read only").

## 3.3 PENSION — `/bureau/settings/pension`  (the fixed "RETIREM" tab)

**Purpose:** per-company pension scheme configuration; bureau default template.

**Payload:**
```ts
GET /api/settings/pension?companyId= →
{
  version: string,
  scheme: { id, provider:'NEST'|'Peoples'|'Smart'|'Aviva'|'Other', schemeRef:string|null,
            basis:'qualifying_earnings'|'pensionable_full'|'total_earnings',
            relief:'relief_at_source'|'net_pay'|'salary_sacrifice',
            eeRate:0.05, erRate:0.03, status:'active'|'inactive' },
  statutoryFloor: { minTotal:0.08, minEmployer:0.03, aeTrigger:10000, qel:6240, qeu:50270 },
  providerConnection?: { nestEmployerRef, directDebitActive:boolean, lastContributionRun:string },
  reEnrolment: { windowStart:string, windowEnd:string, due:boolean },   // 3-yearly ±3m
  enrolledCount:number, optedOutCount:number
}
```

**Logic:**
- **Rate validation (statutory floor, hard):** reject unless `eeRate + erRate ≥ minTotal` AND `erRate ≥ minEmployer` *for the chosen basis's statutory set* (QE basis: 8%/3%; pensionable-from-£1: 9%/4%; total earnings: 7%/3%). 422: "Below auto-enrolment minimum (8% total / 3% employer on qualifying earnings)."
- **Relief method change** = payslip maths change. Confirm modal shows a live worked example (calls the real engine: `calculatePension(3000, newScheme)`) comparing deducted amounts. Applies **from the next uncommitted pay run**; committed entries untouched. Audit `PENSION_RELIEF_CHANGED` with before/after.
- **Basis change**: same treatment + warning that contribution files (PAPDIS/NEST) will reflect the new pensionable definition.
- **Provider change**: if enrolled members exist → guided flow stub in v1: block with "Provider migration requires a contribution-history transfer — contact support." (Prevents silent data loss.)
- Links out: "Assessment & members → `/bureau/pensions`" (S08 owns people; this tab owns the scheme).
- NEST connection card: employer ref field + Test Connection (`POST /api/pensions/nest/ping`) → shows directDebitActive; if false, banner "NEST will reject Approve-for-Payment until the employer direct debit is active."

## 3.4 BANK — `/bureau/settings/bank`

**Purpose:** company payment account (BACS source), SUN, BACS calendar preferences.

**Payload:**
```ts
GET /api/settings/bank?companyId= →
{ version,
  account: { sortCodeMasked:'20-••-••', accountMasked:'••••5678', accountName,
             modulusStatus:'passed'|'warned'|'overridden', verifiedAt },
  bacs: { sun:string|null, leadDays:2, submissionWindowNote:'Submit by 22:30 on processing day 1' },
  paymentRail: 'bacs'|'manual',
  linkedCards: [{ label:'Pay schedule', href:'/bureau/settings/pay-schedule' },
                { label:'Bank holidays', href:'/bureau/settings/bank-holidays' }] }
```

**Logic:**
- Bank details render **masked**; editing requires re-entry of both sort code + account (no partial edit). On save: `validateSortCode` → `modulusCheck` server-side → pass ⇒ store encrypted (`*_enc`, §PRD 4) + `modulusStatus:'passed'`; fail ⇒ inline warning "Failed modulus check — this account may not exist" with **Override** (mandatory reason, audited `BANK_MODULUS_OVERRIDE`, status `overridden`, amber chip).
- Changing the account while a pay run is `approved`-but-not-committed → 409 "Commit or reopen PR-2026-07 first" (BACS file must match the account that approved it).
- SUN: 6 digits or empty (empty ⇒ BACS file generated for indirect/bank-portal submission; note shown).
- Every change audited with masked before/after (`20-••-•• → 40-••-••`) — never log full numbers.

## 3.5 USERS — `/bureau/settings/users`  (bureau_admin only)

**Payload:**
```ts
GET /api/settings/users →
{ version,
  users: [{ id, email, name, role, companyScope:{ all:boolean, companyIds:string[] },
            mfaEnabled, status:'active'|'invited'|'locked'|'disabled', lastLogin }],
  invites: [{ id, email, role, expiresAt }] }
```

**Actions & logic:**
```
POST   /api/settings/users/invite {email, role, companyIds?} →
       creates users row status='invited' + invite token (32B, TTL 7d, Redis invite:{token})
       + email with /accept-invite/{token}. Duplicate active email → 409.
PUT    /api/settings/users/:id {role?, companyIds?, status?}
       Guards: cannot demote/disable the LAST active bureau_admin (server counts, 409);
       cannot edit self role. Role change → token_version++ (forces re-login with new claims).
POST   /api/settings/users/:id/mfa-reset      → clears mfa_secret, notifies user, audit MFA_RESET
POST   /api/settings/users/:id/unlock         → failed_logins=0, locked_until=null
DELETE /api/settings/users/:id                → soft: status='disabled', token_version++,
                                                sessions revoked. Audit rows keep actor history.
POST   /api/settings/users/invites/:id/resend | DELETE …/revoke
```
Every action audited (`USER_INVITED / USER_ROLE_CHANGED / USER_DISABLED / MFA_RESET / USER_UNLOCKED`). Payroll-manager scope = explicit `companyIds` chips UI.

## 3.6 SECURITY — `/bureau/settings/security`  (bureau_admin only)

**Payload:**
```ts
GET /api/settings/security →
{ version,
  policy: { minPasswordLength:12, breachCheck:true, mfaRequiredForRoles:['bureau_admin'],
            sessionIdleMinutes:30, refreshDays:7 },
  mySessions: [{ id, device, ip, lastSeen, current:boolean }],
  hmrcCredentials: [{ companyId, companyName, senderId, hasPassword:true,
                      lastVerified, status:'ok'|'failed'|'untested' }],   // ← deep-link target #hmrc-credentials
  auditChain: { lastVerifiedAt, intact:boolean, rows:number } }
```

**Logic:**
- **Policy edits**: `minPasswordLength ∈ [8,64]`; adding a role to `mfaRequiredForRoles` → affected users without MFA get a forced-setup interstitial at next login (flag `mfa_enforced_at`).
- **Sessions**: `DELETE /api/settings/security/sessions/:id` revokes one; `POST …/sessions/revoke-others` bumps `token_version` (keeps current via fresh issue). Real payroll-fraud mitigation — keep it one click.
- **HMRC Government Gateway credentials (per company)**: SenderID + password stored via envelope encryption (`hmrc_credentials` table or `companies` columns `gg_sender_id`, `gg_password_enc`). `Test` button → `POST /api/settings/security/hmrc/verify {companyId}` → worker sends a minimal Test-in-Live poll/list request → updates `status`. RTI error **1046** deep-links here (`#hmrc-credentials`). Password is write-only: never returned by GET (`hasPassword:true` only). Audit `HMRC_CREDS_UPDATED` (never the values).
- **Audit chain card**: `POST /api/audit/verify` → walks hash chain (PRD §11.2) → `{intact, firstBreakSeq?}`; failure = red banner + ops alert.

## 3.7 COMPLIANCE — `/bureau/settings/compliance`

**Payload:**
```ts
GET /api/settings/compliance?companyId= →
{ version,
  retention: { payrollYears:6, statutoryMinimumYears:3 },
  yearEnd: { taxYear:'2025-26',
             checklist: [
               { key:'final_fps',  label:'Final FPS/EPS indicator sent', done:false, due:'2026-04-19', href:'/bureau/rti' },
               { key:'p60s',       label:'P60s issued to all employed on 5 April', done:true, doneCount:14, total:14, due:'2026-05-31' },
               { key:'p11ds',      label:'P11D / P11D(b) submitted', done:false, due:'2026-07-06' },
               { key:'class1a',    label:'Class 1A NIC paid', done:false, due:'2026-07-22' } ] },
  smallEmployer: { flag:boolean, basis:'prior-year Class 1 ≤ £45,000', recoveryRate:'109%' },
  employmentAllowance: { claimed:boolean, usedYtd:number, cap:10500 },
  gdpr: { erasureRequests:[{ id, subject, receivedAt, status:'pending_retention'|'anonymised' }] } }
```

**Logic:**
- `retention.payrollYears ∈ [3,10]` (floor 3 = HMRC statutory; UI blocks below with explanation).
- **Checklist is computed, not stored**: each item derives from live data (final FPS = rti_submissions with FinalSubmission flag accepted; P60s = documents count vs employees-on-5-April; etc.). Deadline chips: amber ≤ 14 days, red overdue. These same items feed the S02 dashboard Compliance card — one source function `getComplianceStatus(companyId, taxYear)`.
- **smallEmployer** toggle: sets `companies.small_employer`; affects EPS recovery maths (92% ↔ 109%) from the NEXT EPS; audited.
- **employmentAllowance.claimed** toggle: sets the EPS claim flag; `usedYtd` = cumulative employer-NI offset consumed (read model from committed runs).
- **Erasure requests**: `POST /api/settings/compliance/erasure {employeeId}` → status `pending_retention` (anonymise job runs when retention expires). Card explains: statutory retention overrides GDPR erasure; audit rows are never deleted.

## 3.8 NOTIFICATIONS — `/bureau/settings/notifications`

**Payload:**
```ts
GET /api/settings/notifications →
{ version,
  rules: [   // bureau-wide event rules (drive the notify:paydates worker + event fan-out)
    { key:'payrun_input_due',   label:'Pay run input due',        offsetDays:-5, channels:{inApp:true,email:true},  enabled:true },
    { key:'bacs_deadline',      label:'BACS submission deadline', offsetDays:-2, channels:{inApp:true,email:true},  enabled:true },
    { key:'fps_due',            label:'FPS due (payday)',         offsetDays:0,  channels:{inApp:true,email:true},  enabled:true },
    { key:'rti_rejected',       label:'RTI rejected',             offsetDays:null, channels:{inApp:true,email:true}, enabled:true, locked:true },
    { key:'bank_change_request',label:'Employee bank change',     offsetDays:null, channels:{inApp:true,email:true}, enabled:true, locked:true },
    { key:'ae_reenrolment',     label:'Re-enrolment window',      offsetDays:-30, channels:{inApp:true,email:false}, enabled:true } ],
  myPreferences: { emailDigest:'immediate'|'daily'|'off' } }
```

**Logic:**
- `locked:true` rules (fraud/compliance-critical: RTI rejection, bank change) render with a lock icon — `enabled` cannot be turned off (server rejects, 422 "This alert is required for compliance").
- `offsetDays` editable within `[-30, 0]` for date-driven rules. The hourly `notify:paydates` worker reads THESE rules: for each company, for each upcoming resolved date (pay date, bacs_submission_date), if `today = date + offsetDays` and no notification row exists for `(companyId, key, date)` → insert notifications + email outbox. Idempotent by that natural key.
- Event-driven rules fan out at emit time (`rti:status rejected` → all bureau_admins of tenant).
- `myPreferences` is per-user (separate PUT `/api/settings/notifications/me`).

## 3.9 SYSTEM — `/bureau/settings/system`  (bureau_admin only)

**Payload:**
```ts
GET /api/settings/system →
{ version,
  bureau: { name, id },
  dataExport: { lastExportAt, formats:['csv-bundle','json'] },
  jobs: [{ queue:'payrun:calculate', waiting:0, failed:0, lastRun }, ...],   // read model from queue
  bankHolidaySync: { lastRunAt, nextRunAt, source:'gov.uk/bank-holidays.json' },
  dpsFetch:        { lastRunAt, highWaterMarks:{P6:n, SL1:n, ...} },
  appVersion, engineTaxYears:['2026-27'] }
```

**Logic:**
- **Data export**: `POST /api/settings/system/export {format}` → job zips companies/employees (decrypted fields EXCLUDED — masked), pay runs, documents index → S3 signed URL → notification. Rate-limited 1/day. Audit `DATA_EXPORTED`.
- **Job health** cards: failed>0 → red chip + `Retry failed` (`POST /api/settings/system/jobs/:queue/retry-failed`).
- **Bank holiday sync now** / **DPS fetch now** buttons → enqueue the respective jobs (§PRD Part 10) → live status via WS `tenant:{id}` `job:done`.
- Bureau rename: PUT with audit. Everything else read-only telemetry.

---

# 4 — BACKGROUND JOBS OWNED BY SETTINGS

| Job | Schedule | Reads settings | Writes |
|---|---|---|---|
| `tax:sync` | manual (Tax tab) | active year | sync diff → reviewed overrides |
| `bank-holidays:sync` | nightly 03:00 + manual | — | upsert bank_holidays, diff report notification |
| `notify:paydates` | hourly | notifications.rules | notifications + email outbox (idempotent per (company,key,date)) |
| `dps:fetch` | nightly 05:00 + manual | HMRC creds per company | dps_notices + high-water marks; apply job updates tax codes/SL flags |
| `bank-changes:apply` | every 10 min | — | applies pending_bank_changes past activates_at |
| `retention:anonymise` | weekly | compliance.retention | anonymises expired erasure requests |
| `system:export` | manual | — | S3 bundle + notification |

---

# 5 — STATE MACHINES

```
Threshold override : viewing → modal(value, effectiveFrom, reason) → validating
                     → [committed-runs conflict? 409 blocked] → inserted(new effective row)
                     → engine cache invalidated → audited
HMRC sync          : idle → running(202 job) → { no-diff → verified }
                     | diff → review(modal) → per-row accept → inserted rows → done
HMRC creds verify  : untested → testing → ok | failed(reason shown, 1046 mapping)
User invite        : invited(token 7d) → accepted(active) | expired → resend
Bank details edit  : masked → editing(full re-entry) → modulus{pass→saved | fail→override(reason)→saved}
                     → [open approved run? 409] → audited
Section PUT (all)  : clean → dirty(optimistic) → saving → saved(refresh) | invalid(422 rollback)
                     | conflict(409 → refetch banner)
```

---

# 6 — ACCEPTANCE CHECKLIST (Settings module done =)

1. Nav shows **Pension** in Inter 13/500 — pixel font gone; all 9 rows via one component; deep links + `#hmrc-credentials` anchor work.
2. Tax tab renders live `statutory_config` values for 2026-27 (PA £12,570 · NI PT £12,570 · ST £5,000 · UEL £50,270 · LEL £6,708 · Plan 5 £25,000 …) with variance vs 2025-26; override inserts an effective-dated row and a recalculated *draft* run picks it up while committed runs don't.
3. HMRC sync produces a reviewable diff and never auto-applies.
4. Pension rate below statutory floor is rejected 422; relief-method change shows a real-engine worked example and only affects future runs.
5. Bank edit enforces re-entry + modulus with audited override; blocked while an approved run is open.
6. Last bureau_admin cannot be demoted/disabled; role changes force re-login.
7. Gateway password write-only; Test button drives status; RTI 1046 deep-link lands on the card.
8. Locked notification rules cannot be disabled; paydate notifications fire exactly once per (company,key,date).
9. Every accepted change appears in the audit ledger with before/after and the chain verifies.
10. All tab payloads carry `version`; concurrent edits produce the 409 banner, never silent overwrite.

## END — SETTINGS MODULE SPEC v1.0. Build order: fix nav → shared PUT/GET plumbing (§2) → Tax → Pension → Bank → Users → Security → Compliance → Notifications → System.
