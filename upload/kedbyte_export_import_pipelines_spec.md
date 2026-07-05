# KEDBYTE PAYROLL — EXPORT & IMPORT PIPELINES: COMPLETE FIX SPECIFICATION
## v1.0 · 2026-07-06 · Every export/import button in the product: logic, format, storage, delivery, code
### Hand this to the build agent. Section 2 is drop-in code. Section 3 is the full inventory — wire every row.

---

# 1 — THE DESIGN FIX: TWO DELIVERY MODES, ONE RULE

Your current build queues *everything* ("PAPDIS export queued", "Export job queued") and delivers *nothing* — the worker/notification half is missing, and worse, most of these files are tiny and should never have been queued at all.

## 1.1 The rule (apply product-wide)

```
MODE A — DIRECT DOWNLOAD (synchronous):
  When the file can be built in < ~2s (estimate by row count), build it IN the request
  and stream it back with Content-Disposition: attachment. No queue. No toast. No bell.
  The browser just downloads the file. This covers 90% of clicks in a small bureau.

MODE B — ASYNC + NOTIFY (queued):
  When the file is big (full-tenant export, 1,000+ payslip batch, heavy report),
  return 202 {jobId}, show INLINE status where the button was
  ("Preparing… ⟳" → "Ready — Download"), AND send a bell notification with the link.
  File goes to storage; download via a guarded endpoint issuing a short-lived link.

DECISION FUNCTION (one place, used by every export endpoint):
  const ASYNC_THRESHOLD_ROWS = 2_000;          // tune later
  mode = estimatedRows(scope) > ASYNC_THRESHOLD_ROWS ? 'async' : 'direct'
```

**Consequence for your screenshots:** PAPDIS for Acme Corp (2 employees) → MODE A: clicking the button downloads `papdis-acme-corp-2026-M03.csv` immediately. The Settings full-tenant CSV Bundle → MODE B with a working delivery chain.

## 1.2 Filename convention (all exports)
```
{artifact}-{company-slug|tenant}-{taxYear|period|date}.{ext}
papdis-acme-corp-2026-M03.csv · nest-contributions-acme-corp-2026-M03.csv
ae-assessment-acme-corp-2026-07-06.csv · gross-to-net-smith-co-2026-M03.csv
gpg-acme-corp-2026-04-05.csv · bacs-smith-co-2026-M03.std18.txt
fps-smith-co-2026-M01.xml · kedbyte-export-{tenant}-2026-07-06.zip
audit-ledger-2026-06.csv · employee-import-errors-{jobId}.csv
```
All CSVs: UTF-8 **with BOM** (Excel-safe), CRLF, RFC-4180 quoting. Money: plain `1234.56` (no £, no thousands separators — these are machine files). Dates: `YYYY-MM-DD`.

---

# 2 — SHARED IMPLEMENTATION (drop-in code)

## 2.1 The export service — `src/server/exports.ts`

```ts
import { createHash } from 'crypto';

export type ExportSpec = {
  kind: string;                       // 'papdis' | 'nest-csv' | 'ae-report' | 'system-bundle' | ...
  filename: string;
  contentType: string;                // 'text/csv; charset=utf-8' | 'application/zip' | 'application/xml'
  build: () => Promise<Buffer>;       // pure builder — queries + serialises
  estimatedRows: number;
};

const ASYNC_THRESHOLD_ROWS = 2_000;
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

export function toCsv(rows: (string | number | null)[][], header: string[]): Buffer {
  const esc = (v: string | number | null) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header, ...rows].map(r => r.map(esc).join(','));
  return Buffer.concat([BOM, Buffer.from(lines.join('\r\n') + '\r\n', 'utf8')]);
}

/** Every export endpoint calls this once. Handles both modes. */
export async function runExport(spec: ExportSpec, ctx: { tenantId: string; userId: string }) {
  if (spec.estimatedRows <= ASYNC_THRESHOLD_ROWS) {
    const body = await spec.build();                       // MODE A — direct
    await audit(ctx, 'EXPORT_DOWNLOADED', { kind: spec.kind, filename: spec.filename, sha256: sha(body) });
    return { mode: 'direct' as const, body, filename: spec.filename, contentType: spec.contentType };
  }
  const jobId = await enqueue('export:build', { ...ctx, kind: spec.kind });   // MODE B — async
  await audit(ctx, 'EXPORT_QUEUED', { kind: spec.kind, jobId });
  return { mode: 'async' as const, jobId };
}

/** Worker for MODE B — register this processor (it is missing from your build). */
export async function exportWorker(job: { tenantId: string; userId: string; kind: string; params: any }) {
  const spec = buildSpecFor(job.kind, job.params, job.tenantId);   // same builders as MODE A
  const body = await spec.build();
  const key = `exports/${job.tenantId}/${job.id}/${spec.filename}`;
  await storagePut(key, body, spec.contentType);                   // S3 or local /storage
  await db.exportsIndex.insert({ id: job.id, tenantId: job.tenantId, userId: job.userId,
    kind: spec.kind, filename: spec.filename, storageKey: key, sha256: sha(body),
    sizeBytes: body.length, expiresAt: addDays(new Date(), 7) });
  await notify(job.userId, { type: 'export_ready', title: `${spec.filename} is ready`,
    actionUrl: `/api/exports/${job.id}/download` });
  emitWs(`user:${job.userId}`, 'export:ready', { jobId: job.id, filename: spec.filename });
}

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
```

## 2.2 The two endpoints every export shares

```ts
// Route handler pattern — e.g. src/app/api/pensions/contributions/export/route.ts
export async function GET(req: Request) {
  const ctx = await requireRole(req, ['bureau_admin','company_admin','payroll_manager']);
  const { payRunId, format } = params(req);                 // format: 'papdis' | 'nest-csv'
  const spec = format === 'papdis' ? papdisSpec(payRunId, ctx) : nestCsvSpec(payRunId, ctx);
  const r = await runExport(await spec, ctx);
  if (r.mode === 'direct')
    return new Response(r.body, { headers: {
      'Content-Type': r.contentType,
      'Content-Disposition': `attachment; filename="${r.filename}"` } });
  return Response.json({ jobId: r.jobId }, { status: 202 });
}

// Async download — src/app/api/exports/[jobId]/download/route.ts
export async function GET(req, { params }) {
  const ctx = await requireAuth(req);
  const row = await db.exportsIndex.find(params.jobId);
  if (!row || row.tenantId !== ctx.tenantId || row.userId !== ctx.userId) return notFound();
  if (row.expiresAt < new Date()) return gone('Export expired — generate a new one');
  await audit(ctx, 'EXPORT_DOWNLOADED', { jobId: row.id, sha256: row.sha256 });
  return storageStream(row.storageKey, row.filename);       // or 302 to a 5-min signed URL
}
```

## 2.3 The button component (kills the dead-end toast)

```tsx
// components/ExportButton.tsx — use for EVERY export in the product
export function ExportButton({ href, label, icon }: { href: string; label: string; icon?: string }) {
  const [state, setState] = useState<'idle'|'preparing'|'ready'|'error'>('idle');
  const [dl, setDl] = useState<string>();
  useWsEvent('export:ready', e => { if (e.jobId === jobRef.current) { setState('ready'); setDl(`/api/exports/${e.jobId}/download`); }});
  const jobRef = useRef<string>();

  async function click() {
    setState('preparing');
    const res = await fetch(href);
    if (res.status === 200) {                                // MODE A — stream arrived
      await triggerBrowserDownload(res); setState('idle'); return;
    }
    if (res.status === 202) { jobRef.current = (await res.json()).jobId; return; }  // MODE B — wait for WS
    setState('error');
  }
  if (state === 'ready') return <a className="btn-pearl" href={dl} download onClick={() => setState('idle')}>Download {label}</a>;
  return <button className="btn-ghost" onClick={click} disabled={state==='preparing'}>
    {state==='preparing' ? <Spinner/> : <Icon name={icon ?? 'download'}/>} {state==='preparing' ? 'Preparing…' : label}
  </button>;
}
```

Direct downloads feel instant; async ones morph in place — the bell notification is the backup, not the only path.

---

# 3 — THE COMPLETE INVENTORY: EVERY EXPORT/IMPORT IN THE PRODUCT

Wire each row through §2. Formats are exact — build to these.

## 3.1 PENSIONS (your screenshot — the "PAPDIS export queued" fix)

### E1 · PAPDIS contribution file — Pensions page + Pay Run Step 4 card
`GET /api/pensions/contributions/export?payRunId=&format=papdis` · **MODE A** (rows = enrolled employees in the run)
Filename `papdis-{company}-{taxYear}-M{period}.csv`. Columns (PAPDIS 1.1 subset accepted by People's Pension/Smart/Aviva importers):
```
PapdisVersion,EmployerId,PayrollPeriodStartDate,PayrollPeriodEndDate,ContributionDeductionDate,
FrequencyCode,NINO,Title,Forename,Surname,Gender,BirthDate,
AddressLine1,AddressLine2,City,Postcode,EmailAddress,
PensionableEarnings,EmployeeContributionsAmount,EmployerContributionsAmount,
AssessmentCode,EventCode,EventDate,OptOutDate,DeferralDate
```
Logic per row (from committed `pay_run_entries` × `employees` where pension_status='enrolled'):
`PensionableEarnings = entry.pensionableEarnings (QE base)` · `EmployeeContributionsAmount = pension_employee GROSS (124.00 — the RAS ×0.8 is a payslip deduction fact, the FILE carries the gross contribution; provider adds tax relief)` · `EmployerContributionsAmount = pension_employer` · `FrequencyCode = M1` · `AssessmentCode` map: eligible→1, non_eligible→2, entitled→3 · `EventCode`: enrolment this period→1, opt-out→2, else blank. **Guard:** run must be `committed` (409 otherwise: "Commit the pay run first — contribution files come from committed figures").

### E2 · NEST CSV — same endpoint, `format=nest-csv` · **MODE A**
NEST's own contribution-schedule upload layout:
```
NINO,AlternativeUniqueID,Forename,Surname,PensionableEarnings,
EmployeeContribution,EmployerContribution,ReasonForPartialOrNonPayment
```
Amounts to 2dp; blank reason unless zero-contribution row (then code per NEST list, e.g. `4` = opted out).

### E3 · "Export Report" button (top of Pensions page) — AE assessment report
`GET /api/pensions/assessment/export?companyId=` · **MODE A** · `ae-assessment-{company}-{date}.csv`
```
Employee,PayrollId,NINO(masked),DOB,Age,AnnualisedEarnings,MonthlyEarnings,
AssessmentResult,AssessedOn,PensionStatus,EnrolmentDate,OptOutDate,PostponementEnd
```
One row per active worker (the table you see on screen, plus history flag `?includeHistory=1` → all `ae_assessments` rows). NINO **masked** — this report circulates to clients.

## 3.2 RTI (your first two screenshots)

### E4 · XML Payload "Copy" (modal) — already working; ADD a Download button beside it
`GET /api/rti/:id/xml` · **MODE A** · `fps-{company}-{taxYear}-M{period}.xml` · `application/xml`. Streams `rti_submissions.xml_payload` verbatim (this is the legally significant artifact — never regenerate on download).

### E5 · HMRC response XML download (accepted/rejected detail)
`GET /api/rti/:id/response` · **MODE A** · `fps-response-{correlationId}.xml`.

### E6 · Error dictionary export — "View full dictionary"
`GET /api/rti/errors/dictionary/export` · **MODE A** · CSV of `rti_error_dictionary` (code, category, hmrc_message, cause, resolution_screen, resolution_field).

## 3.3 PAY RUNS

### E7 · BACS file — Step 4 card
`GET /api/payruns/:id/bacs` · **MODE A** · `bacs-{company}-{taxYear}-M{period}.std18.txt` · `text/plain`.
Standard-18 fixed-width: per-credit records (dest sort code 6n, dest account 8n, TX code `99`, **amount in PENCE** 11n zero-padded, originator refs, employee reference = payroll_id 18 chars), contra debit `17` balancing to total net, UHL1 header with processing date = `bacs_submission_date` (Julian YYDDD), trailer with counts/totals. **Guards:** run committed · company bank modulus status ≠ failed · every payee has bank details (else 422 listing employees missing them).

### E8 · Pay run entries export (Review step, for client sign-off)
`GET /api/payruns/:id/entries/export` · **MODE A** · `payrun-{company}-{taxYear}-M{period}.csv`
```
Employee,PayrollId,Gross,Tax,NIEmployee,NIEmployer,PensionEmployee,PensionEmployer,
StudentLoan,PostgradLoan,Net,VariancePct,Status
```

### E9 · Payslip batch PDFs — post-finalize
Already a **MODE B** job (`pdf:payslips`) delivering into `documents` per employee — not a button export. Add optional `GET /api/payruns/:id/payslips/bundle` → **MODE B** zip of all payslips for the run (bureaus email these to non-portal clients). Delivery via §2 chain.

## 3.4 REPORTS

### E10 · Every report's CSV/XLSX button
`GET /api/reports/:type/export?params` · **MODE A** under threshold, **MODE B** above (multi-year, all-company). v1 ships CSV only; XLSX later (never fake an .xlsx by renaming CSV — Excel warns and trust dies).
### E11 · GPG CSV (for the GOV.UK service manual entry)
`GET /api/reports/gpg/export?companyId&snapshot` · **MODE A** · columns exactly the six statutory figures + quartiles:
```
SnapshotDate,MeanHourlyGapPct,MedianHourlyGapPct,MeanBonusGapPct,MedianBonusGapPct,
MalesReceivingBonusPct,FemalesReceivingBonusPct,Q1MalePct,Q1FemalePct,Q2MalePct,Q2FemalePct,
Q3MalePct,Q3FemalePct,Q4MalePct,Q4FemalePct
```

## 3.5 EMPLOYEES

### I1 · Bulk CSV import (the one true IMPORT) — Employee list "Bulk Import"
`POST /api/employees/import` (multipart, ≤5 MB, text/csv only) → **always async** `import:employees` job (validation is the slow part) → WS `import:progress {done,total,errors}` → summary `{inserted, failed}`.
Template (add a **Download template** link next to the button — this kills 80% of import failures):
```
first_name,last_name,email,dob,nino,address_line1,city,postcode,start_date,
starter_declaration,salary_annual,contracted_weekly_hours,department,job_title,
employment_type,tax_code,ni_category,student_loan_plan,postgrad_loan,
sort_code,account_number,account_name
```
Pipeline per row: header map (case/space tolerant) → coerce types → `validateNINO`/`parseTaxCode`/`validateSortCode`+modulus/NMW check → dedupe (nino_hash + name+dob) → insert valid, collect `{row, field, message}` for bad.
### E12 · Import error report
On completion with failures: build `employee-import-errors-{jobId}.csv` (original row + `error_field,error_message` columns) → **MODE B delivery** (it's produced by a job) → notification + inline "Download error report".
### E13 · Employee list export
`GET /api/companies/:id/employees/export` · **MODE A** · masked NINO/bank, same columns as the list view.

## 3.6 SETTINGS / SYSTEM (the original broken pair)

### E14 · CSV Bundle & JSON — full-tenant export
`POST /api/settings/system/export {format}` · **always MODE B** (this is the one legitimately big export) → zip of companies.csv, employees.csv (masked), pay_runs.csv, pay_run_entries.csv, ytd_figures.csv, documents_index.csv, audit_summary.csv — or single `export.json` with the same objects. Rate limit 1/day/format (429 with retry-after). Delivery: full §2 chain + **Recent exports** list on the System tab (`exportsIndex` rows, 7-day expiry, re-download).
### E15 · Audit ledger export — Settings ▸ Compliance (add if missing)
`GET /api/audit/export?from&to` · **MODE A** ≤ 10k rows else **B** · `audit-ledger-{from}-{to}.csv` (seq, at, actor, action, entity, before, after, curr_hash) — the dispute-resolution artifact.
### I2 · Bank-holiday sync — an import, already async
`bank-holidays:sync` job fetching gov.uk JSON → upsert + diff notification ("2 added, 0 removed"). Verify the notification exists; the Sync Now button should morph like §2.3.
### I3 · DPS fetch — an import, already async
Notices in, high-water marks advance; completion notification "P6 ×3 applied, 1 exception".
### I4 · Vocalink modulus data upload (admin, add)
`POST /api/settings/bank/modulus-data` (valacdos.txt + scsubtab.txt) → validate line format → replace tables → audit `MODULUS_DATA_UPDATED` (data updates ~2×/year).

## 3.7 DOCUMENTS (downloads — verify, they're MODE A by nature)
```
E16 payslip PDF (ESS + admin)   GET /api/ess/payslips/:id/download   signed 5-min, audited 'viewed'
E17 P60 / P45                    per viewers                          signed, sha256 verify button works
E18 document vault items         GET /api/documents/:id/download      superseded chain respected
```

---

# 4 — STORAGE & LIFECYCLE (one config, all exports)

```
Layout   exports/{tenantId}/{jobId}/{filename}   ·  payslips|p60|p45/{tenantId}/{employeeId}/…
         bacs/{tenantId}/{payRunId}/…             ·  rti is DB-stored XML (not object storage)
Dev      /storage/** on disk (gitignored)         Prod: S3 + SSE, bucket non-public, signed GETs only
Expiry   exportsIndex.expiresAt = +7 days → weekly cleanup job deletes object + row
         statutory documents (payslips/P60/P45/FPS XML) NEVER auto-expire (retention rules apply)
Integrity sha256 stored at write; download endpoint may re-verify on demand (vault "verify" button)
```

# 5 — SECURITY RULES (every export endpoint)
```
[ ] Role-gated per §PRD 11.1; ESS can only ever download SELF documents
[ ] Tenant + requester ownership checked on /api/exports/:jobId/download (404 on mismatch, never 403 leak)
[ ] Masked fields in ALL circulating exports (PAPDIS/NEST are the exception — providers REQUIRE full NINO;
    therefore E1/E2 are bureau-roles only, audited EXPORT_DOWNLOADED with kind+sha256, and NEVER cached)
[ ] Rate limits: system bundle 1/day; others 30/hour/user
[ ] Content-Type and attachment disposition always set (no inline HTML sniffing of CSVs)
[ ] Import uploads: size cap, CSV mime + extension check, no path use of client filename
```

# 6 — VERIFICATION CHECKLIST (run after wiring)
```
[ ] Pensions ▸ PAPDIS on a committed run downloads INSTANTLY, opens in Excel, columns per E1,
    contribution amounts = gross (124.00 not 99.20) — cross-check one employee by hand
[ ] Pensions ▸ Export Report downloads the assessment CSV with masked NINOs
[ ] Uncommitted run ▸ PAPDIS → 409 with the exact message (no silent queue)
[ ] Step 4 ▸ BACS file: pence amounts, contra balances, processing date = bacs_submission_date
[ ] RTI modal ▸ Download XML = byte-identical to stored payload (diff it)
[ ] Employee import: 10-row file with 2 bad rows → 8 inserted, progress streamed, error CSV lists both
    failures with row numbers; template link downloads
[ ] Settings ▸ CSV Bundle: click → inline Preparing→Download morph, bell notification, zip contents masked,
    second click same day → 429, Recent exports row appears, link dies after expiry
[ ] Every export appears in the audit ledger with sha256
[ ] ESS user cannot fetch another employee's payslip or any /api/exports id not theirs (404)
```

## END — one pipeline, two modes, seventeen exports + four imports, all delivered. Fix order: §2 shared code → E1/E2/E3 (pensions, your screenshot) → E14 (system bundle) → I1/E12 (import + errors) → the rest top to bottom.
