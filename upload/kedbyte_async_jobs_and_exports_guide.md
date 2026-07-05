# KEDBYTE PAYROLL — ASYNC JOBS, EXPORTS & DELIVERY: TECHNICAL GUIDE
## v1.0 · 2026-07-06 · Explains the "Export job queued" pattern + every flow like it, with build/verify logic

---

# 1 — WHAT "EXPORT JOB QUEUED" MEANS (it is NOT an error)

## 1.1 The pattern
Clicking **CSV Bundle** or **JSON** does not build the file in the browser request. Building a full-tenant export (companies, employees, pay runs, documents index) can take seconds to minutes, so the click only does step 1 of a 5-step chain:

```
[1] CLICK      POST /api/settings/system/export {format:'csv-bundle'|'json'}
               → server validates (role=bureau_admin, rate limit 1/day)
               → inserts a job row / enqueues `system:export`
               → responds 202 {jobId}
               → UI shows the toast you saw: "Export job queued — you'll be notified…"
[2] WORKER     picks up the job:
               → queries all tenant data (RLS-scoped)
               → MASKS encrypted fields (NINO → AB 12 •• •• C, bank → ••••5678 — never decrypted)
               → writes files: companies.csv, employees.csv, pay_runs.csv, pay_run_entries.csv,
                 documents_index.csv, audit_summary.csv (or one export.json)
               → zips → kedbyte-export-{tenant}-{date}.zip
[3] STORE      uploads zip to object storage (S3 bucket `exports/{tenantId}/{jobId}.zip`)
               In the demo build: saved to local disk e.g. /storage/exports/…
[4] NOTIFY     inserts a notifications row for the requesting user:
               { type:'export_ready', title:'Your data export is ready',
                 action_url:'/api/settings/system/export/{jobId}/download' }
               + WebSocket push `notification:new` → bell badge lights up (top-right)
               + optional email with the same link
[5] DOWNLOAD   user opens the bell → clicks the notification → GET the action_url
               → server checks it's YOUR jobId (tenant + requester match)
               → issues a short-lived signed URL (5 min) → browser downloads the zip
               → documents/audit row: DATA_EXPORTED (already logged at [1], download logged too)
```

**So: the file "goes" to object storage, and the LINK comes to you via the notification bell (and email if enabled).** The toast is the receipt for step 1.

## 1.2 If nothing ever arrives — the diagnostic checklist
This is the most common half-built state. Check in order:

```
[ ] Is there a worker actually consuming the `system:export` queue?
    → Settings ▸ System ▸ job health table should show system:export with a LAST RUN.
      (Your screenshot shows payrun:calculate / rti:submit / pdf:payslips / notify:paydates —
       if system:export is missing from that table, the queue exists but no processor is registered. FIX: register it.)
[ ] Does the job write a notifications row on completion? (SELECT * FROM notifications WHERE type='export_ready')
[ ] Does the bell subscribe to WS `notification:new` and refetch? (open bell after clicking export)
[ ] Does GET /api/settings/system/export/:jobId/download exist and stream/redirect to the file?
[ ] Is there a storage path configured (S3 creds or local /storage dir writable)?
[ ] Rate limit check: a second click the same day should return 429 with a clear message,
    not silently queue nothing.
```
Minimum acceptance: click export → within ~30s the bell shows "Your data export is ready" → clicking it downloads a zip whose CSVs open in Excel and contain **masked** NINO/bank values.

## 1.3 UX improvements worth adding (recommended, small)
1. **Job status inline**: after the toast, swap the button area for a mini status row: `Preparing export… ⟳` → `Ready — Download` (subscribes to the same WS event). Users shouldn't have to know about the bell.
2. **Recent exports list** on the System tab: last 5 exports with date, size, expiry, re-download link (reads the jobs/documents rows). Exports expire after 7 days (cleanup job).
3. **Small = instant**: if the tenant has < 500 rows total, skip the queue and stream the zip directly in the request (< 2s). Keep the async path for everything bigger. One code path decides: `estimateRows(tenant) < 500 ? streamNow() : enqueue()`.
4. **Email delivery toggle** next to the buttons ("Also email me the link").
5. **Scoped exports**: per-company export from the company detail page (same pipeline, filtered).

---

# 2 — EVERY ASYNC FLOW IN THE PRODUCT (same pattern, same verification)

All of these follow **click → 202 + toast → worker → store/write → notify → view/download**. Each row lists where the result lands and how to verify the chain.

| # | Trigger (screen) | Queue | Result lands in | User is told via | Verify by |
|---|---|---|---|---|---|
| 1 | Pay run Step 2 "Calculate" | `payrun:calculate` | pay_run_entries rows (figures) | live terminal log + progress (WS `calc:progress`), auto-advance on done | totals on Step 3 match engine |
| 2 | Finalize (Step 4) | outbox → several | see 3–6 | step-4 cards flip states live | all four cards reach done |
| 3 | Payslip generation | `pdf:payslips` | documents rows + files in storage `payslips/…` | S06 progress + ESS notification "payslip ready" per employee | employee portal shows/downloads payslip |
| 4 | FPS/EPS submit | `rti:submit` → `rti:poll` | rti_submissions row (status, correlation, response XML) | S07 row updates via WS `rti:status`; rejected → notification + S21 | mock TE: submitted→polling→accepted |
| 5 | Pension contributions | `pension:contributions` | PAPDIS/NEST file in storage + provider response | S05.4 card / S08 | file downloads, columns per spec |
| 6 | BACS file | generated at finalize | storage `bacs/…` | Step 4 card Download | Standard-18 fields, pence amounts |
| 7 | Employee CSV import | `import:employees` | employees rows + row-error report file | modal progress (WS `import:progress`) + summary | 8/10 good rows insert, error CSV downloads |
| 8 | Heavy reports | `report:async` | report file in storage | notification with download link | same as export chain |
| 9 | Data export (this page) | `system:export` | zip in storage `exports/…` | notification + (email) | §1.2 checklist |
| 10 | Bank holiday Sync Now | `bank-holidays:sync` | bank_holidays rows | toast + diff report notification ("2 dates added") | Dates Stored count changes |
| 11 | DPS Fetch Now | `dps:fetch` | dps_notices rows + applied tax-code/SL changes | notification "3 notices applied, 1 exception" | high-water marks advance (your card shows P6 1247, SL1 89, P9 34) |
| 12 | Tax "Update from HMRC" | `tax:sync` | a DIFF for review (never auto-applies) | modal with per-row Accept | accepted rows appear as effective-dated overrides |
| 13 | P60 year-end run | `yearend:p60` | documents rows per employee | admin summary + ESS notifications | P60 viewer per employee |
| 14 | Bank-change cooling-off | `bank-changes:apply` (10-min scheduler) | employees bank fields updated after 24h | admin alert at request; employee confirm at apply | pending row → applied at activates_at |
| 15 | Pay-date reminders | `notify:paydates` (hourly) | notifications rows | bell/email | fires once per (company,key,date) |

**The one rule:** every 202 response MUST eventually produce either a visible result-in-place (rows/status) or a notification with a link. A queued job with no delivery path is a bug. Audit each row above against your build.

---

# 3 — THE NOTIFICATION CENTER IS THE DELIVERY HUB

Everything asynchronous lands at the bell (top-right, red dot in your screenshot) and, for employees, at `/portal/notifications`.

```
Data:   notifications { user_id, type, title, body, action_url, read_at }
API:    GET /api/notifications?cursor · PUT /api/notifications/:id/read · PUT …/read-all
Push:   WS room user:{id} event notification:new → increment badge, prepend item
Types → destinations:
  export_ready        → signed download        payslip_ready (ESS) → /portal/payslips/:id
  rti_rejected        → /bureau/rti/errors     holiday_decision    → /portal/holidays
  bank_change_request → employee detail        pay-date reminders  → /bureau/payruns
  sync/diff reports   → relevant settings tab
```
Verify: unread badge count = SQL count; clicking marks read; action_url lands on the right screen with the right record.

---

# 4 — PASSWORD & CREDENTIAL MANAGEMENT (where everything lives)

Three distinct flows — make sure all three exist:

## 4.1 Change my own password (logged in)
**Where:** click your avatar/name (bottom-left "admin / admin@kedbyte.co.uk") → **My Account** → Change Password. If this menu doesn't exist yet, build it: route `/bureau/account` (and `/portal/account` for ESS) with sections Password · MFA · Sessions · Email preferences.
```
PUT /api/account/password  { currentPassword, newPassword }
→ verify current (Argon2id) → policy check (≥12 chars + breach list)
→ hash new → save → token_version++ EXCEPT current session (re-issue its tokens)
→ notification + email "Your password was changed" → audit PASSWORD_CHANGED
Errors: 401 wrong current · 422 policy (message says why)
```

## 4.2 Forgot password (logged out)
**Where:** `/forgot-password` link on both login screens. Email → always "sent" (no enumeration) → 1-hour single-use token link → `/reset-password/[token]` → new password → all sessions revoked → login.

## 4.3 Admin-forced resets (for your staff / client users)
**Where:** Settings ▸ **Users** (bureau_admin only): per-user actions **Send reset link**, **Reset MFA**, **Unlock account**. Employees who lose access ask their bureau admin. All audited.

## 4.4 Not passwords but nearby (don't confuse them)
- **HMRC Government Gateway credentials** (per company): Settings ▸ **Security ▸ HMRC Credentials** — write-only password field + Test button. This is the company's HMRC identity for RTI, not a user password.
- **MFA (TOTP)**: My Account ▸ MFA — QR enrol, 10 backup codes, disable-with-password. Admin can force-reset via Users tab.

---

# 5 — "MORE OPTIONS LIKE THESE" — the System tab, fully explained (your screenshot, card by card)

1. **Job health table** (`payrun:calculate · rti:submit · pdf:payslips · notify:paydates`): live read of the queues — WAITING = jobs not yet picked up (your `rti:submit 1` means one FPS is waiting for the worker/poll cycle — normal if a run was just finalized; investigate if it sits > few minutes), FAILED = needs the Retry action (add a `Retry failed` button per row if missing), LAST RUN = last completed job. Add `system:export`, `import:employees`, `dps:fetch`, `bank-holidays:sync` rows so every queue is visible.
2. **Bank Holiday Sync** — Sync Now = flow #10. "Dates Stored 8" = England & Wales 2026 set. Next Scheduled shows the nightly cron.
3. **DPS Notice Fetch** — flow #11. The high-water marks (P6 1247, SL1 89, P9 34) are HMRC paging cursors: the last notice index fetched per type. They only ever increase; they are health indicators, not counts of pending items. Add a "notices applied last run: n / exceptions: n" line for operator value.
4. **Data Export** — §1 above. The caption on your screen ("Rate-limited 1/day · decrypted fields excluded (masked) · audit logged") is the policy, correctly stated.

---

# 6 — BUILD CHECKLIST FOR THIS PAGE (close the gaps)

```
[ ] system:export worker registered + visible in job table
[ ] export completion → notification with working download link (signed, 5-min, requester-only)
[ ] inline status swap after click (Preparing… → Download) via WS
[ ] Recent exports list with 7-day expiry + cleanup job
[ ] Retry-failed button per queue row (POST /api/settings/system/jobs/:queue/retry-failed)
[ ] My Account page exists with Change Password + MFA + Sessions (both surfaces)
[ ] Users tab has Send-reset-link / Reset-MFA / Unlock actions
[ ] Every flow in the §2 table verified end-to-end once
```

## END — every "queued" toast in this product must terminate in a visible result or a bell notification with a link. That's the contract.
