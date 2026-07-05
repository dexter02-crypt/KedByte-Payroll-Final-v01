# KEDBYTE PAYROLL — PRODUCTION READINESS AUDIT & FIX PROMPT
## v1.0 · 2026-07-05 · Tax Year 2026/27 · Companion to FINAL PRD/TRD v2.0 + Settings Spec v1.0
### HOW TO USE: Hand this entire document to the verification agent (or execute yourself). Work phase by phase, in order. Do not skip phases. Fix issues as found, re-run the phase, then proceed.

---

# OPERATING INSTRUCTIONS FOR THE VERIFYING AGENT

You are auditing a UK payroll bureau SaaS ("Kedbyte Payroll") for production readiness. Your job: **verify every item below, fix what fails, and produce a signed-off report.**

**Working rules:**
1. **Verify by execution, not by reading.** Run the app, run the tests, call the endpoints with curl/fetch, click through flows. Code that "looks right" is not verified.
2. **Fix immediately, smallest correct change first.** After each fix, re-run the failing check AND the phase's regression checks. Never fix maths by changing the expected value — the expected values in this document are statutory and locked.
3. **Report format:** for every checklist item output one line: `[PASS]`, `[FIXED: <what was wrong, one line>]`, or `[BLOCKED: <why>]`. Produce a final summary table per phase with counts.
4. **Severity gates:** Phase 1 (maths) and Phase 6 (security) failures are release blockers — nothing ships until they are 100% PASS. Phases 2–5, 7–9 must be ≥ PASS-or-FIXED. Phase 10 items may be waived with written justification.
5. **Do not introduce new dependencies** to fix issues unless a checklist item explicitly permits it.
6. **Never weaken a guard to make a test pass** (e.g., removing a 409, widening a regex, disabling RLS).

**Environment bootstrap (verify first, fix if broken):**
```
[ ] npm ci completes with zero errors and zero high/critical audit vulnerabilities (npm audit)
[ ] npm run build completes with zero TypeScript errors and zero ESLint errors
[ ] npm test runs and reports results (even if failures — those are Phase 1's job)
[ ] npm run dev boots; / responds 200; no console errors on first paint of /login
[ ] Seed script creates demo tenant: 1 bureau, ≥2 companies, ≥10 employees with varied
    tax codes (1257L, BR, K475, S1257L, 0T W1M1), NI categories (A, C, M, J),
    student loans (plan_2, plan_5, postgrad concurrent), a director, a leaver, an under-21
```

---

# PHASE 1 — CALCULATION ENGINE ACCURACY (RELEASE BLOCKER)

The engine must reproduce these values **to the exact penny**. Any drift = defect in the engine, never in this document.

## 1.1 Canonical vector (must pass before anything else)
Input: £36,000/yr · monthly · tax month 1 · code 1257L cumulative · NI cat A · Plan 2 loan · pension qualifying-earnings 5%/3% relief-at-source · YTD all zero.
```
[ ] gross            = 3,000.00
[ ] tax              =   390.20     (free pay 12,579/12 = 1,048.25 → taxable ⌊1,951.75⌋ = 1,951 → ×20%)
[ ] NI employee      =   156.16     ((3,000 − 1,048) × 8%)
[ ] NI employer      =   387.45     ((3,000 − 417) × 15%)
[ ] pension ee gross =   124.00     (QE = min(3000, 4189.17) − 520 = 2,480 × 5%)
[ ] pension deducted =    99.20     (RAS ×0.80)
[ ] pension er       =    74.40
[ ] student loan     =    49.00     (⌊(3,000 − 2,448.75) × 9%⌋ — WHOLE POUND floor)
[ ] net              = 2,305.44
[ ] employer cost    = 3,461.85
```

## 1.2 Statutory constants (grep the config; each must equal exactly)
```
[ ] Personal Allowance 12,570 · free-pay convention N×10+9 (1257L → 12,579 — NOT 12,570)
[ ] rUK bands (taxable): 20% ≤37,700 · 40% ≤112,570 · 45% above
[ ] Scottish bands (total income): 19% →16,537 · 20% →29,526 · 21% →43,662 · 42% →75,000 · 45% →125,140 · 48% above
[ ] NI monthly: LEL 559 · PT 1,048 · ST 417 · UEL 4,189 · FUST 2,083
[ ] NI rates: employee 8%/2% (cat B 1.85%) · employer 15% uncapped · Employment Allowance 10,500
[ ] Student loans (annual): P1 26,900 · P2 29,385 · P4 33,795 · P5 25,000 · PGL 21,000 · rates 9/9/9/9/6%
[ ] AE: trigger 10,000 (833/mo) · QE band 520–4,189.17/mo · minimums 8% total / 3% employer
[ ] NMW: 12.71 (21+) · 10.85 (18–20) · 8.00 (16–17/apprentice) — age band is 21+, NOT 23+
[ ] SSP 123.25/wk OR 80% AWE if lower, day-one payable · SMP 194.32 std weeks · SMP recovery 92%/109%
```

## 1.3 Edge-case vectors (run each; add as permanent tests if missing)
```
[ ] BR flat: £3,000 → tax 600.00                    [ ] SD0 flat = 21% (Scottish, not 40%)
[ ] S1257L m1 £3,000 → 392.27 (330.58@19 + 1,082.42@20 + 538@21 — intermediate band bites at £1,413/mo)
[ ] K2000 m1 £1,000 gross → tax capped 500.00, regulatoryLimited=true (50% limit)
[ ] NT → 0 tax always      [ ] 0T W1M1 → full bands, no free pay, no YTD
[ ] Cumulative refund: m2, ytdTaxable 3,000, ytdTaxPaid 600, gross 1,000 → tax NEGATIVE
[ ] W1/M1 ignores YTD entirely (same inputs ± YTD → identical tax)
[ ] Cat C: employee NI = 0, employer 387.45 on £3,000
[ ] Cat M £3,000: employee 156.16, employer 0 (UST 4,189 replaces ST) · at £5,000: employer = (5,000−4,189)×15% = 121.65
[ ] Cat J: flat 2% above PT only     [ ] Cat X: both zero
[ ] NI rounding: exact half-penny rounds DOWN (construct a .005 product and assert)
[ ] Plan 5 £2,500/mo → 37 (whole-pound floor)  ·  Plan 2 + PGL concurrent → BOTH deducted (49 + 6% line)
[ ] Sub-PT employee (£900/mo): NI 0 but FPS band figures populated (AtLEL 559, LELtoPT 341) — NEVER omitted from FPS
[ ] Salary sacrifice: reduces taxable AND NI-able (£36k/5%: employee NI 146.24, eeDeducted 0, er = 74.40+124)
[ ] Net-pay arrangement: reduces taxable only (NI unchanged 156.16)
[ ] Director annual method: £8k/mo cat A → months 1 (NI 0, cumulative 8k < 12,570), month 2 NI on (16k−12,570)×8%,
    verify cumulative-minus-paid each month; December total equals annual liability
[ ] 12-month cumulative property: Σ monthly tax(1257L, £3,000/mo) over m1..m12 = annual liability ± £0.12
[ ] ∀ tested gross: net ≤ gross unless tax < 0 (refund month)
[ ] Pro-rata starter mid-month: basic × workingDaysEmployed/workingDaysInPeriod (verify one concrete case)
```

## 1.4 Engine architecture
```
[ ] Engine is pure functions — zero imports of db/fetch/fs inside src/engine/**
[ ] All money paths use the shared rounding helpers (floorPound/floorPenny/niRound/round2) — grep for
    raw Math.round/toFixed in engine code and replace
[ ] Rates are read per tax year (no 2026/27 literals inline in calc logic outside the config file)
[ ] Recalculating a historical period uses that period's effective-dated config (test: override a
    threshold effective today, recalc yesterday's draft → old value used)
```

---

# PHASE 2 — DATA LAYER & INTEGRITY

```
[ ] Every tenant-scoped table has tenant_id; every query path scopes by tenant (grep for findMany/SELECT
    without tenant predicate in server code — each hit is a defect)
[ ] Cross-tenant test: create 2 tenants; authenticated as A, attempt to read/patch B's company, employee,
    payrun, payslip, document BY ID → all return 404/403, never data
[ ] UNIQUE constraints enforced and surfaced as 409 with friendly message:
    (tenant_id, paye_ref) · (company_id, payroll_id) · (company_id, tax_year, tax_period)
[ ] All money columns NUMERIC(12,2)/stored as exact decimals — no floats persisted
[ ] ytd_figures roll-forward: commit run m1 then m2; ytd = sum of both; recalc of committed run is BLOCKED
[ ] Finalize is transactional: kill the process mid-finalize (or inject a throw after totals write) →
    on restart, run is either fully committed or fully draft — never half (idempotency key replay returns
    the original result, does not double-roll YTD)
[ ] Soft delete respected everywhere: deleted employee never appears in lists, pay run seeding, FPS, exports
[ ] Encrypted-at-rest fields (nino, bank) are NOT plaintext in the DB file/dump (inspect raw storage);
    nino_hash exists and lookup-by-NINO uses it
[ ] audit_log: INSERT-only (attempt UPDATE/DELETE via app role → fails); chain verify endpoint walks
    genesis→head and returns intact=true; tamper one row manually → verify reports first break
[ ] Seed data passes all its own validators (every seeded NINO/PAYE ref/sort code is format-valid)
```

---

# PHASE 3 — API CONTRACT & VALIDATION

For every endpoint in PRD Part 7 (auth, companies, employees, payruns, rti, pensions, reports, ess, settings, notifications, audit):
```
[ ] Exists at the documented path and method; unknown routes → 404 JSON (not HTML)
[ ] Unauthenticated call → 401; wrong role → 403 (test one per RBAC row of PRD §11.1)
[ ] Response shape matches the documented payload (spot-check: dashboard/summary, payruns/:id/entries,
    rti/:id, settings/tax)
[ ] Errors are structured {type,title,status,detail,fields?} — never a stack trace, never HTML
[ ] Idempotency: POST /payruns/:id/finalize twice with the same Idempotency-Key → second returns
    identical body, no duplicate jobs/YTD; same for company/employee create
[ ] Concurrency: PUT settings with stale If-Match → 409; PATCH employee with stale version → 409
[ ] Validation — send each and confirm 422 with field-level message (and that the record is unchanged):
    [ ] NINO 'QQ123456C' (Q first letter), 'BG123456A' (banned prefix), 'AB123456E' (bad suffix)
    [ ] PAYE ref '1234/AB456' · AO ref '123XA00012345' · sort code '12-34-5' · account '1234567a'
    [ ] tax code 'K47X' / '12570L' handled as invalid, error names the field
    [ ] salary below NMW for age → warning surfaced; finalize without override → blocked
    [ ] pension rates 4%/2% on QE basis → 422 statutory floor
    [ ] holiday request overlapping an approved one → 422; end < start → 422
    [ ] negative/absurd inputs: salary −1, overtime 10,000 hrs, bonus 1e12 → 422 bounds
[ ] Rate limiting active on /auth/* (6th rapid login attempt → 429) and export endpoints
[ ] All list endpoints paginate (cursor/keyset) — request 200 seeded employees, verify no unbounded dump
[ ] No endpoint returns decrypted NINO/bank except the audited admin reveal path; payslip/detail payloads
    carry masked values ('AB 12 •• •• C', '••••5678')
```

---

# PHASE 4 — SCREEN-BY-SCREEN FUNCTIONAL VERIFICATION (all 31)

Walk each screen against PRD Part 6. For EVERY screen check the generic five first:
```
GENERIC (×31): [ ] route guard correct  [ ] loading state (no layout jump)  [ ] empty state with action
               [ ] error state (kill API → friendly retry, no white screen)  [ ] no console errors/warnings
```
Then screen-specific:
```
S01 Login        [ ] MFA appears only when enabled; auto-submit on 6th digit; lockout after 5 fails (423 + time)
                 [ ] refresh rotation: old refresh token reuse → session family revoked
S02 Dashboard    [ ] stats match SQL ground truth (run the aggregate query by hand and compare)
                 [ ] commit a pay run in another tab → stats/activity update via WS without reload
S03 Companies    [ ] search/filter/sort/pagination compose correctly; delete blocked with open pay runs (409 toast)
S03b Add Company [ ] modulus fail → warning + audited override path; duplicate PAYE ref → field error;
                 [ ] created company appears with correct resolved next pay date
S04 Employees    [ ] inline edit optimistic + rollback on 422 (visible revert); every edit in audit ledger
                 [ ] CSV import: file with 2 bad rows of 10 → 8 inserted, 2 row-errors downloadable; progress streams
S04b Add Employee[ ] starter A/B/C → 1257L / 1257L-W1M1 / BR auto-set; P45 path carries opening YTD
                 [ ] live AE status correct for: age 21 (entitled/non-eligible), 25 @ £30k (eligible), 70 (non-eligible)
S05.1 Input      [ ] autosave (edit, wait, hard-refresh → values persist); provisional gross = basic+OT+adds
S05.2 Calc       [ ] terminal log lines are REAL engine progress events (throttle network, watch ordering);
                 [ ] progress %, live totals sum correctly; one bad employee → run completes with error banner count
S05.3 Review     [ ] on-screen tax/NI/net for the £36k seeded employee match Phase 1.1 to the penny
                 [ ] variance flags: seed prev-month run, change salary +30% → warn chip; +60% → error chip
                 [ ] single-entry recalculate after input edit updates only that row
S05.4 Submission [ ] finalize once → committed; buttons reflect job states live; BACS file downloads,
                     Standard-18 fields correct (amounts in PENCE, contra record balances to total net)
                 [ ] bacs_submission_date = 2 working days before pay date over the seeded holiday calendar
S06 Payslips     [ ] batch approve/reject transactional (reject 3, approve rest — counts right)
                 [ ] preview payslip figures = entry figures; regenerated payslip supersedes (old kept, marked)
S07 RTI          [ ] generated FPS XML validates against bundled 26-27 schema/shape; IRmark present and
                     recomputable (recompute over Body → matches embedded value)
                 [ ] Plan 5 StudentLoanRecovered PlanType="05" emitted for the plan_5 employee
                 [ ] sub-PT employee present with band figures; leaver carries LeavingDate; starter carries declaration
                 [ ] lifecycle mock: submitted→polling→accepted updates row via WS; rejected → S21 link
S21 RTI Errors   [ ] each seeded error code maps to dictionary entry with guided deep link that actually lands
                     (1046 → settings#hmrc-credentials; NINO error → employee field)
                 [ ] resubmit creates new submission linked supersedes, regenerated XML differs
S08 Pensions     [ ] Assess Now updates statuses per §5.7 matrix; opt-out inside window → refund line on next run
                 [ ] PAPDIS export columns per PRD Part 9.2, one row per enrolled employee-period
S09 Reports      [ ] gross-to-net totals = committed run totals; export CSV opens clean in Excel (BOM/encoding)
S23 GPG          [ ] hand-compute mean/median/quartiles on seed data → screen matches; overtime excluded
S10 Settings     [ ] ALL NINE tabs render real content (no 'coming soon' remains); nav shows 'Pension' in Inter
                 [ ] threshold override inserts effective-dated row; committed-run conflict → 409 explain
                 [ ] HMRC sync produces reviewable diff, never auto-applies
S22b-e           [ ] pay-schedule 12-month preview matches resolvePayDate over holiday calendar incl. Easter shift
                 [ ] bank-holiday sync upserts + diff report; custom closure affects preview
                 [ ] pay-date notification fires once per (company,key,date) — run scheduler twice, no dupes
S11-S18 ESS      [ ] employee JWT cannot reach ANY /bureau route or another employee's payslip by ID
                 [ ] holiday days calc respects works_pattern + bank holidays (request over a holiday → day excluded)
                 [ ] manager sees only direct reports; approve/reject notifies employee
                 [ ] bank change: activates_at = +24h; admin notified immediately; scheduler applies after;
                     employee cancel works before activation
S13/S20 Docs     [ ] payslip/P60 print stylesheet → clean A4 B/W (print preview); signed URL expires (fetch after
                     expiry → 403); document sha256 verify button detects a tampered object
S19 Auth recovery[ ] forgot-password always 200; token single-use + 1h TTL; reset revokes all sessions
```

---

# PHASE 5 — ROUTING, GUARDS, NAVIGATION

```
[ ] Every route in PRD Part 3 resolves; unknown → styled 404
[ ] Middleware matrix: for each role in §11.1 visit one allowed + one forbidden route → correct outcome
[ ] Deep links with params/anchors work cold (paste URL in fresh session → login → redirected back to target)
[ ] Breadcrumbs and left-rail active states correct on every section
[ ] Browser back through the pay-run wizard never resubmits (no duplicate POST on back/refresh)
[ ] Sign out clears cookies, revokes refresh, lands on login; protected route after → login redirect
```

---

# PHASE 6 — SECURITY (RELEASE BLOCKER)

```
[ ] Passwords Argon2id (inspect hash prefix $argon2id$); policy ≥12 chars enforced server-side
[ ] JWT: access ≤15 min; refresh rotation with family reuse-detection (replay old token → 401 + family dead)
[ ] Cookies httpOnly + Secure + SameSite=Strict; no token in localStorage/sessionStorage anywhere (grep)
[ ] CSRF: state-changing request from foreign origin rejected (origin/SameSite verified by test)
[ ] IDOR sweep: every :id route tested with another tenant's and another employee's id → 403/404
[ ] SQLi probe on search/filter params (' OR 1=1 --) → parameterized, no error leak
[ ] XSS probe: employee name '<img src=x onerror=alert(1)>' renders inert on every surface it appears
    (list, payslip, audit ledger, notification)
[ ] Secrets: no keys/passwords in repo (scan), all via env; .env not committed; HMRC gateway password
    write-only (GET never returns it)
[ ] Security headers on responses: HSTS, X-Content-Type-Options, frame-ancestors/deny, sensible CSP
[ ] File upload (CSV import): content-type + size limit + non-CSV rejected; no path traversal on any
    file/storage_key handling
[ ] Audit coverage: perform one mutation of each class (auth, employee, salary, settings, approval,
    NINO reveal, bank override) → each present in ledger with actor + before/after; chain verifies after all
[ ] Error responses and logs never contain NINO, bank numbers, or password material (grep logs after test run)
[ ] Locked account, disabled user, and revoked session cannot act via still-live access token beyond 15 min
```

---

# PHASE 7 — JOBS, REAL-TIME, RESILIENCE

```
[ ] Calc job: 100+ employee run completes; progress events ordered; UI never shows fake/simulated progress
[ ] Kill worker mid-calc → run status recoverable (re-trigger recalculates cleanly, no duplicate entries)
[ ] Outbox: finalize writes outbox rows in-transaction; dispatcher relays; handler retry is idempotent
    (force one failure → retry does not duplicate payslips/FPS)
[ ] RTI poll backoff: mock TE returning 'still processing' 5× → intervals grow, cap respected, attempts bounded
[ ] Transport failure → retry ladder then dead-letter + visible ops alert (System tab shows failed count)
[ ] WS auth: connect with tampered/foreign-tenant token → refused; user A never receives tenant B events
    (subscribe both, emit for B, assert A silent)
[ ] WS drop/reconnect during calc → UI resumes with correct state (refetch on reconnect)
[ ] Scheduler jobs (paydates, bank-holidays, bank-changes:apply) are idempotent — run each twice, zero dupes
[ ] Demo/in-process queue is behind the same interface as production queue (single swap point, no fork logic)
```

---

# PHASE 8 — UI / DESIGN-SYSTEM CONFORMANCE (Void/Pearl)

```
[ ] Tokens exact: bg #0C0C0E · surface #141416 · pearl #E8E4E0 · text #F5F5F5/#A1A1AA/#52525B ·
    success #4ADE80 · warning #FBBF24 · error #F87171 · borders rgba(245,245,245,0.06)
[ ] border-radius 0 EVERYWHERE (grep computed styles for radius > 0; browser default buttons/inputs reset)
[ ] No box-shadows (grep); depth via surface tone only
[ ] ALL numbers/currency/refs/timestamps/NINOs in JetBrains Mono (sweep: dashboard stats, tables, payslip,
    terminal, chips); UI text in Inter — no fallback pixel/serif faces anywhere (the RETIREM class of bug:
    check every nav, every heading, after fonts loaded AND with fonts blocked)
[ ] Currency formatting: £1,234.56 — two decimals always, thousands separators, negatives as −£123.45
    consistently; no floating-point display artifacts (£99.19999)
[ ] Dates: one format per context (15 Jul 2026 / 09:41), UK timezone (Europe/London) — no ISO leaking to UI
[ ] Status chips: consistent vocabulary and colors across screens (ACTIVE/PENDING/ACCEPTED/REJECTED…)
[ ] Empty/loading/error states styled (no browser-default anything); toasts consistent position/behavior
[ ] Focus states visible on every interactive element (keyboard-tab the wizard end to end)
[ ] prefers-reduced-motion collapses animations incl. the terminal stream
[ ] Responsive: bureau usable at 1280 & 1024 (tables scroll, nothing overlaps); ESS portal correct on 390px
    with bottom tab bar; no horizontal scroll anywhere
[ ] Text contrast: --text-tertiary never used for body copy (AA 4.5:1 check on any gray-on-dark pairings)
[ ] Print: payslip/P60 print stylesheets — pure white A4, black text, no nav/rails/backgrounds
```

---

# PHASE 9 — ACCESSIBILITY & UX QUALITY

```
[ ] axe scan on: login, dashboard, employee list, all 4 wizard steps, payslip viewer, settings/tax,
    ESS dashboard → zero critical/serious
[ ] Full keyboard path: login → create employee → run payroll → approve → finalize without a mouse
[ ] Tables: proper th/scope; icon-only buttons have aria-labels; form errors announced (aria-live) and
    focus moves to first invalid field
[ ] Modals trap focus, Esc closes, focus returns to trigger
[ ] Terminal log has an accessible text alternative (log region readable by SR, not just decoration)
[ ] Destructive actions (delete company, reject payslips, revoke sessions) require confirmation naming
    the object ("Delete Acme Corp?") — never one-click
[ ] Every async action gives immediate feedback (<100ms visual acknowledgment)
```

---

# PHASE 10 — BUILD, DEPLOYMENT & OPERATIONS READINESS

```
[ ] Production build: no dev flags, source maps decision explicit, bundle scan → no server secrets in client JS
[ ] Environment matrix documented and validated at boot (app refuses to start with missing required env,
    prints which — without printing values)
[ ] DB migrations are ordered, idempotent, reversible where possible; fresh-DB migrate+seed from zero works
[ ] Health endpoints: /api/health (liveness) + readiness incl. DB check → used by deploy platform
[ ] Structured logs with request id + tenant id (sampled check); PII-free (re-verify grep from 6)
[ ] Error tracking wired (Sentry or equivalent) and a test error arrives with release tag
[ ] Backup/restore rehearsed once: dump → restore to scratch → app boots against it, audit chain still verifies
[ ] Graceful shutdown: SIGTERM drains in-flight jobs (calc job survives a deploy)
[ ] Load sanity: 20 concurrent users browsing + one 100-employee calc → p95 API < 500ms, no errors
[ ] Timezone/DST: server UTC, display Europe/London; pay date resolution correct across the Oct DST boundary
[ ] Legal/ops pages: support link works; version visible in System tab
[ ] PRODUCTION GATE (external, cannot be self-verified): HMRC recognition status recorded — live Transaction
    Engine credentials + vendor ID present ONLY if recognition passed; otherwise RTI locked to test endpoints
    with a visible TEST banner. Verify the endpoint switch is env-driven and the banner logic works.
```

---

# FINAL REPORT TEMPLATE (agent must output)

```
KEDBYTE PAYROLL — PRODUCTION AUDIT REPORT · <date> · commit <sha>
Phase 1 Engine:        n PASS / n FIXED / n BLOCKED     ← must be 0 BLOCKED
Phase 2 Data:          …
Phase 3 API:           …
Phase 4 Screens:       …
Phase 5 Routing:       …
Phase 6 Security:      …                                ← must be 0 BLOCKED
Phase 7 Jobs/RT:       …
Phase 8 Design:        …
Phase 9 A11y:          …
Phase 10 Deploy:       …
FIXES APPLIED: bulleted list (file → one-line change rationale)
RESIDUAL RISKS / WAIVERS: item · justification · owner
VERDICT: SHIP / SHIP-WITH-WAIVERS / DO-NOT-SHIP
```

## END — AUDIT PROMPT v1.0. Execute phases in order. Maths and security gate the release.
