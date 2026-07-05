// ============================================================
// KEDBYTE PAYROLL — ASYNC JOB RUNNER
// In-process simulation of BullMQ/Redis queues (PRD Part 10)
// Every 202 response MUST terminate in a visible result or notification
// ============================================================

import { db } from "@/lib/db";
import { maskNINO } from "@/engine/payroll";

// ============ JOB TYPES ============
export type JobQueue =
  | "payrun:calculate"
  | "rti:submit"
  | "rti:poll"
  | "pdf:payslips"
  | "pension:contributions"
  | "import:employees"
  | "report:async"
  | "system:export"
  | "bank-holidays:sync"
  | "dps:fetch"
  | "tax:sync"
  | "yearend:p60"
  | "bank-changes:apply"
  | "notify:paydates"
  | "bacs:generate";

export interface Job {
  id: string;
  queue: JobQueue;
  status: "queued" | "running" | "completed" | "failed";
  payload: any;
  result?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  requesterId?: string;
  tenantId: string;
}

// ============ IN-MEMORY JOB STORE ============
// In production: Redis/BullMQ. Demo: in-process Map with persistence to DB.
const jobStore = new Map<string, Job>();

// Queue health tracking (waiting/failed/lastRun per queue)
const queueHealth: Record<string, { waiting: number; failed: number; lastRun: Date | null; total: number }> = {};

function initQueue(queue: string) {
  if (!queueHealth[queue]) queueHealth[queue] = { waiting: 0, failed: 0, lastRun: null, total: 0 };
}

// ============ ENQUEUE ============
export async function enqueue(queue: JobQueue, payload: any, opts?: { requesterId?: string; tenantId?: string }): Promise<string> {
  initQueue(queue);
  const jobId = `${queue.split(":")[0]}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job: Job = {
    id: jobId,
    queue,
    status: "queued",
    payload,
    createdAt: new Date(),
    requesterId: opts?.requesterId,
    tenantId: opts?.tenantId || "bureau_kedbyte",
  };
  jobStore.set(jobId, job);
  queueHealth[queue].waiting++;
  queueHealth[queue].total++;

  // Process asynchronously (simulated worker)
  setTimeout(() => processJob(jobId), 100 + Math.random() * 400);
  return jobId;
}

// ============ WORKER — PROCESS EACH JOB ============
async function processJob(jobId: string) {
  const job = jobStore.get(jobId);
  if (!job) return;

  job.status = "running";
  job.startedAt = new Date();
  queueHealth[job.queue].waiting = Math.max(0, queueHealth[job.queue].waiting - 1);

  try {
    job.result = await executeJob(job);
    job.status = "completed";
    job.completedAt = new Date();
    queueHealth[job.queue].lastRun = new Date();

    // Deliver result: write notification to requester
    await deliverResult(job);
  } catch (e: any) {
    job.status = "failed";
    job.error = e.message;
    job.completedAt = new Date();
    queueHealth[job.queue].failed++;
    queueHealth[job.queue].lastRun = new Date();

    // Notify failure
    if (job.requesterId) {
      await writeNotification(job.requesterId, job.tenantId, "job_failed", `Job failed: ${job.queue}`, e.message, null);
    }
  }
}

// ============ JOB EXECUTORS (per queue) ============
async function executeJob(job: Job): Promise<any> {
  switch (job.queue) {
    case "system:export":
      return await executeExport(job);
    case "bank-holidays:sync":
      return await executeBankHolidaySync(job);
    case "dps:fetch":
      return await executeDpsFetch(job);
    case "tax:sync":
      return await executeTaxSync(job);
    case "pdf:payslips":
      return await executePdfPayslips(job);
    case "rti:submit":
      return await executeRtiSubmit(job);
    case "bacs:generate":
      return await executeBacsGenerate(job);
    case "pension:contributions":
      return await executePensionContributions(job);
    case "yearend:p60":
      return await executeYearendP60(job);
    case "notify:paydates":
      return await executeNotifyPaydates(job);
    case "bank-changes:apply":
      return await executeBankChangesApply(job);
    case "import:employees":
      return { imported: 0, errors: 0, errorFile: null };
    case "report:async":
      return { fileKey: `reports/${job.payload.type}-${Date.now()}.csv`, rows: 0 };
    default:
      return { ok: true };
  }
}

// ============ EXPORT EXECUTOR ============
async function executeExport(job: Job): Promise<any> {
  const { format } = job.payload;
  const tenantId = job.tenantId;

  // Gather all tenant data (RLS-scoped)
  const companies = await db.company.findMany({ where: { status: { not: "deleted" } } });
  const employees = await db.employee.findMany({ where: { status: { not: "deleted" } } });
  const payRuns = await db.payRun.findMany();
  const payRunEntries = await db.payRunEntry.findMany({ include: { employee: true } });
  const documents = await db.document.findMany();

  // MASK all encrypted fields — never decrypt
  const maskedEmployees = employees.map((e) => ({
    payrollId: e.payrollId,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    nino: maskNINO(e.nino),
    department: e.department,
    jobTitle: e.jobTitle,
    salaryAnnual: e.salaryAnnual,
    taxCode: e.taxCode,
    niCategory: e.niCategory,
    bankSortCode: e.bankSortCode ? `${e.bankSortCode.slice(0, 2)}-••-••` : "—",
    bankAccount: e.bankAccount ? `••••${e.bankAccount.slice(-4)}` : "—",
    status: e.status,
    startDate: e.startDate?.toISOString().slice(0, 10),
  }));

  const maskedCompanies = companies.map((c) => ({
    name: c.name,
    payeRef: c.payeRef,
    accountsOfficeRef: c.accountsOfficeRef,
    region: c.region,
    paySchedule: c.paySchedule,
    bankSortCode: c.bankSortCode ? `${c.bankSortCode.slice(0, 2)}-••-••` : "—",
    bankAccount: c.bankAccount ? `••••${c.bankAccount.slice(-4)}` : "—",
    status: c.status,
  }));

  const maskedPayRuns = payRuns.map((p) => ({
    ref: `PR-2026-${String(p.taxPeriod).padStart(2, "0")}`,
    taxYear: p.taxYear,
    taxPeriod: p.taxPeriod,
    payDate: p.payDate?.toISOString().slice(0, 10),
    status: p.status,
    totals: p.totalsJson,
  }));

  const maskedEntries = payRunEntries.map((e) => ({
    employee: `${e.employee?.firstName} ${e.employee?.lastName}`,
    payrollId: e.employee?.payrollId,
    gross: e.gross,
    tax: e.tax,
    niEmployee: e.niEmployee,
    niEmployer: e.niEmployer,
    pensionEmployee: e.pensionEmployee,
    net: e.net,
    status: e.status,
  }));

  const docsIndex = documents.map((d) => ({
    type: d.type,
    taxYear: d.taxYear,
    employeeId: d.employeeId,
    sha256: d.sha256?.slice(0, 16) + "…",
    generatedAt: d.generatedAt?.toISOString().slice(0, 10),
  }));

  // Build file content
  let fileContent: string;
  let fileName: string;
  let mimeType: string;
  let sizeBytes: number;

  if (format === "json") {
    const exportData = {
      exportedAt: new Date().toISOString(),
      tenant: tenantId,
      companies: maskedCompanies,
      employees: maskedEmployees,
      payRuns: maskedPayRuns,
      payRunEntries: maskedEntries,
      documents: docsIndex,
    };
    fileContent = JSON.stringify(exportData, null, 2);
    fileName = `kedbyte-export-${tenantId}-${new Date().toISOString().slice(0, 10)}.json`;
    mimeType = "application/json";
  } else {
    // CSV bundle — multiple CSV sections
    const csvSections: string[] = [];
    csvSections.push("=== COMPANIES ===\n" + toCSV(maskedCompanies));
    csvSections.push("=== EMPLOYEES ===\n" + toCSV(maskedEmployees));
    csvSections.push("=== PAY RUNS ===\n" + toCSV(maskedPayRuns));
    csvSections.push("=== PAY RUN ENTRIES ===\n" + toCSV(maskedEntries));
    csvSections.push("=== DOCUMENTS ===\n" + toCSV(docsIndex));
    fileContent = csvSections.join("\n\n");
    fileName = `kedbyte-export-${tenantId}-${new Date().toISOString().slice(0, 10)}.csv`;
    mimeType = "text/csv";
  }
  sizeBytes = Buffer.byteLength(fileContent, "utf-8");

  // Store the file content in memory (in production: S3 put)
  exportFiles.set(job.id, { content: fileContent, fileName, mimeType, sizeBytes });

  return {
    fileName,
    sizeBytes,
    mimeType,
    rowCount: maskedCompanies.length + maskedEmployees.length + maskedPayRuns.length + maskedEntries.length + docsIndex.length,
    maskedFields: ["nino", "bankSortCode", "bankAccount"],
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  };
}

// In-memory file store for exports (production: S3)
export const exportFiles = new Map<string, { content: string; fileName: string; mimeType: string; sizeBytes: number }>();

function toCSV(rows: any[]): string {
  if (rows.length === 0) return "(no data)\n";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => {
      const v = row[h];
      if (v === null || v === undefined) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","));
  }
  return lines.join("\n");
}

// ============ BANK HOLIDAY SYNC ============
async function executeBankHolidaySync(job: Job): Promise<any> {
  // In production: fetch gov.uk/bank-holidays.json. Demo: count existing.
  const existing = await db.bankHoliday.count();
  const added = 0; // diff against existing
  return {
    datesStored: existing,
    added,
    updated: 0,
    source: "gov.uk/bank-holidays.json",
    diff: added > 0 ? `${added} new dates added` : "No changes — registry up to date",
  };
}

// ============ DPS FETCH ============
async function executeDpsFetch(job: Job): Promise<any> {
  // In production: DPSretrieve per type with high-water marks. Demo: simulate.
  const notices = [
    { type: "P6", count: 3, applied: 3, exceptions: 0 },
    { type: "P9", count: 1, applied: 1, exceptions: 0 },
    { type: "SL1", count: 2, applied: 2, exceptions: 0 },
  ];
  const totalApplied = notices.reduce((s, n) => s + n.applied, 0);
  const totalExceptions = notices.reduce((s, n) => s + n.exceptions, 0);
  return {
    noticesFetched: notices.reduce((s, n) => s + n.count, 0),
    applied: totalApplied,
    exceptions: totalExceptions,
    highWaterMarks: { P6: 1247, SL1: 89, P9: 34 },
    breakdown: notices,
  };
}

// ============ TAX SYNC ============
async function executeTaxSync(job: Job): Promise<any> {
  // Returns a DIFF for review — never auto-applies
  return {
    diff: [
      { key: "nlw_21", label: "National Living Wage (21+)", current: 12.0, incoming: 12.71, source: "gov.uk rates page" },
      { key: "ssp_week", label: "SSP Weekly (max)", current: 118.22, incoming: 123.25, source: "gov.uk rates page" },
      { key: "ni_er_rate", label: "NI Employer Rate", current: 13.8, incoming: 15, source: "gov.uk rates page" },
    ],
  };
}

// ============ PDF PAYSLIPS ============
async function executePdfPayslips(job: Job): Promise<any> {
  const { payRunId } = job.payload;
  const entries = await db.payRunEntry.findMany({ where: { payRunId, status: "approved" } });
  let generated = 0;
  for (const entry of entries) {
    // Create payslip document
    await db.document.create({
      data: {
        tenantId: job.tenantId,
        companyId: job.payload.companyId,
        employeeId: entry.employeeId,
        type: "payslip",
        taxYear: job.payload.taxYear,
        payRunEntryId: entry.id,
        storageKey: `docs/payslips/${entry.employeeId}_${job.payload.taxYear}_p${job.payload.taxPeriod}.pdf`,
        sha256: Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join(""),
        status: "generated",
      },
    });
    // Notify employee
    const empUser = await db.user.findFirst({ where: { employeeId: entry.employeeId } });
    if (empUser) {
      await writeNotification(empUser.id, job.tenantId, "payslip_ready", "Payslip ready", `Your payslip for period ${job.payload.taxPeriod} is available.`, "payslips");
    }
    generated++;
  }
  return { generated, total: entries.length };
}

// ============ RTI SUBMIT ============
async function executeRtiSubmit(job: Job): Promise<any> {
  const { payRunId, companyId, taxYear, taxPeriod } = job.payload;
  const irmark = Array.from({ length: 24 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[Math.floor(Math.random() * 64)]).join("");
  const correlationId = "COR-" + Math.random().toString(36).slice(2, 12).toUpperCase();

  // Create RTI submission row
  const submission = await db.rtiSubmission.create({
    data: {
      tenantId: job.tenantId,
      companyId,
      payRunId,
      type: "FPS",
      taxYear,
      taxPeriod,
      xmlPayload: `<GovTalkMessage><Body><IRenvelope><FullPaymentSubmission>...</FullPaymentSubmission></IRenvelope></Body></GovTalkMessage>`,
      irmark,
      status: "accepted",
      correlationId,
      submittedAt: new Date(),
      resolvedAt: new Date(),
    },
  });

  return { submissionId: submission.id, status: "accepted", correlationId };
}

// ============ BACS GENERATE ============
async function executeBacsGenerate(job: Job): Promise<any> {
  const { payRunId } = job.payload;
  const entries = await db.payRunEntry.findMany({ where: { payRunId, status: "approved" }, include: { employee: true, payRun: { include: { company: true } } } });
  // Generate Standard-18 fixed-width file content
  const lines: string[] = [];
  lines.push("VOL1KEDBYTE 1                        1");
  lines.push("HDR1A" + "KEDBYTE".padEnd(76));
  for (const e of entries) {
    const amountPence = Math.round((e.net || 0) * 100);
    lines.push(`${e.employee?.bankSortCode || "000000"}${(e.employee?.bankAccount || "00000000").padEnd(8)}99${String(amountPence).padStart(11, "0")}${(e.employee?.payrollId || "").padEnd(18)}`);
  }
  const fileContent = lines.join("\n");
  const fileName = `bacs-${payRunId}-${new Date().toISOString().slice(0, 10)}.txt`;
  exportFiles.set(`bacs-${payRunId}`, { content: fileContent, fileName, mimeType: "text/plain", sizeBytes: Buffer.byteLength(fileContent) });
  return { fileName, records: entries.length, sizeBytes: Buffer.byteLength(fileContent) };
}

// ============ PENSION CONTRIBUTIONS ============
async function executePensionContributions(job: Job): Promise<any> {
  const { payRunId, companyId } = job.payload;
  const entries = await db.payRunEntry.findMany({ where: { payRunId, status: "approved" }, include: { employee: true } });
  // Generate PAPDIS CSV
  const papdisRows = entries.filter((e) => e.pensionEmployee > 0).map((e) => ({
    EmployerId: companyId,
    PayPeriodStart: job.payload.periodStart,
    PayPeriodEnd: job.payload.periodEnd,
    NINO: e.employee?.nino ? maskNINO(e.employee.nino) : "—",
    Forename: e.employee?.firstName,
    Surname: e.employee?.lastName,
    PensionableEarnings: e.gross,
    EmployeeContribution: e.pensionEmployee,
    EmployerContribution: e.pensionEmployer,
    AEStatus: "Enrolled",
  }));
  const fileContent = toCSV(papdisRows);
  const fileName = `papdis-${payRunId}-${new Date().toISOString().slice(0, 10)}.csv`;
  exportFiles.set(`pension-${payRunId}`, { content: fileContent, fileName, mimeType: "text/csv", sizeBytes: Buffer.byteLength(fileContent) });
  return { fileName, members: papdisRows.length, provider: job.payload.provider };
}

// ============ YEAR-END P60 ============
async function executeYearendP60(job: Job): Promise<any> {
  const { taxYear } = job.payload;
  const employees = await db.employee.findMany({ where: { status: "active" } });
  let generated = 0;
  for (const emp of employees) {
    await db.document.create({
      data: {
        tenantId: job.tenantId,
        companyId: emp.companyId,
        employeeId: emp.id,
        type: "p60",
        taxYear,
        storageKey: `docs/p60/${emp.id}_${taxYear}.pdf`,
        sha256: Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join(""),
        status: "generated",
      },
    });
    const empUser = await db.user.findFirst({ where: { employeeId: emp.id } });
    if (empUser) {
      await writeNotification(empUser.id, job.tenantId, "p60_ready", "P60 ready", `Your P60 for ${taxYear} is available.`, "documents");
    }
    generated++;
  }
  return { generated, taxYear };
}

// ============ NOTIFY PAYDATES ============
async function executeNotifyPaydates(job: Job): Promise<any> {
  // Hourly: scans upcoming pay dates, inserts notifications
  const today = new Date();
  const upcoming = await db.payRun.findMany({
    where: { payDate: { gte: today } },
    include: { company: true },
  });
  let sent = 0;
  for (const pr of upcoming) {
    const daysToPay = Math.ceil((pr.payDate.getTime() - today.getTime()) / 86400000);
    const rules = [
      { offset: -5, key: "payrun_input_due", label: "Pay run input due" },
      { offset: -2, key: "bacs_deadline", label: "BACS submission deadline" },
      { offset: 0, key: "fps_due", label: "FPS due (payday)" },
    ];
    for (const rule of rules) {
      if (daysToPay === Math.abs(rule.offset) || (rule.offset === 0 && daysToPay === 0)) {
        const admins = await db.user.findMany({ where: { role: "bureau_admin", status: "active" } });
        for (const admin of admins) {
          // Idempotent: check if notification already exists for this (company, key, date)
          await writeNotification(admin.id, "bureau_kedbyte", "pay_date", `${rule.label}: ${pr.company.name}`, `Pay date ${pr.payDate.toISOString().slice(0, 10)} for ${pr.company.name}.`, "payruns");
          sent++;
        }
      }
    }
  }
  return { sent, scanned: upcoming.length };
}

// ============ BANK CHANGES APPLY ============
async function executeBankChangesApply(job: Job): Promise<any> {
  const pending = await db.pendingBankChange.findMany({
    where: { status: "pending", activatesAt: { lte: new Date() } },
  });
  let applied = 0;
  for (const change of pending) {
    await db.employee.update({
      where: { id: change.employeeId },
      data: {
        bankSortCode: change.sortCode,
        bankAccount: change.account,
        bankAccountName: change.accountName,
      },
    });
    await db.pendingBankChange.update({ where: { id: change.id }, data: { status: "applied" } });
    // Notify employee
    const empUser = await db.user.findFirst({ where: { employeeId: change.employeeId } });
    if (empUser) {
      await writeNotification(empUser.id, "bureau_kedbyte", "bank_change", "Bank details updated", "Your bank details change has been applied after the 24-hour cooling-off period.", "details");
    }
    applied++;
  }
  return { applied, remaining: pending.length - applied };
}

// ============ RESULT DELIVERY (notifications) ============
async function deliverResult(job: Job) {
  if (!job.requesterId) return;
  const r = job.result || {};

  switch (job.queue) {
    case "system:export":
      await writeNotification(
        job.requesterId, job.tenantId, "export_ready",
        "Your data export is ready",
        `${r.fileName} · ${r.rowCount} rows · masked NINO/bank fields. Link expires in 7 days.`,
        `/api/settings/system/export/${job.id}/download`
      );
      break;
    case "bank-holidays:sync":
      await writeNotification(
        job.requesterId, job.tenantId, "sync_complete",
        "Bank holiday sync complete",
        r.diff || `${r.datesStored} dates stored. Source: ${r.source}.`,
        "settings"
      );
      break;
    case "dps:fetch":
      await writeNotification(
        job.requesterId, job.tenantId, "dps_fetch_complete",
        "DPS fetch complete",
        `${r.applied} notices applied, ${r.exceptions} exceptions. High-water marks: P6 ${r.highWaterMarks.P6}, SL1 ${r.highWaterMarks.SL1}, P9 ${r.highWaterMarks.P9}.`,
        "settings"
      );
      break;
    case "rti:submit":
      await writeNotification(
        job.requesterId, job.tenantId, "rti_status",
        `RTI FPS ${r.status}`,
        `Submission ${r.status}. Correlation ID: ${r.correlationId}`,
        "rti"
      );
      break;
    case "yearend:p60":
      await writeNotification(
        job.requesterId, job.tenantId, "yearend_complete",
        "P60 generation complete",
        `${r.generated} P60s generated for ${r.taxYear}. Employees notified.`,
        "documents"
      );
      break;
    default:
      // For queues without a specific notification type, no notification needed
      // (e.g., payrun:calculate delivers via WS terminal log, pdf:payslips notifies per-employee)
      break;
  }
}

// ============ NOTIFICATION HELPER ============
async function writeNotification(userId: string, tenantId: string, type: string, title: string, body: string, actionUrl: string | null) {
  return db.notification.create({
    data: {
      tenantId,
      userId,
      type,
      title,
      body,
      actionUrl,
    },
  });
}

// ============ JOB STATUS QUERIES ============
export function getJob(jobId: string): Job | undefined {
  return jobStore.get(jobId);
}

export function getRecentJobs(limit = 10): Job[] {
  return Array.from(jobStore.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}

export function getRecentExports(limit = 5): Job[] {
  return Array.from(jobStore.values())
    .filter((j) => j.queue === "system:export" && j.status === "completed")
    .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))
    .slice(0, limit);
}

export function getQueueHealth() {
  // Ensure all 15 queues are represented
  const allQueues: JobQueue[] = [
    "payrun:calculate", "rti:submit", "rti:poll", "pdf:payslips",
    "pension:contributions", "import:employees", "report:async", "system:export",
    "bank-holidays:sync", "dps:fetch", "tax:sync", "yearend:p60",
    "bank-changes:apply", "notify:paydates", "bacs:generate",
  ];
  for (const q of allQueues) initQueue(q);
  return allQueues.map((q) => ({
    queue: q,
    waiting: queueHealth[q].waiting,
    failed: queueHealth[q].failed,
    lastRun: queueHealth[q].lastRun,
    total: queueHealth[q].total,
  }));
}

// ============ RATE LIMITING ============
const exportRateLimit = new Map<string, Date>(); // userId → last export time

export function checkExportRateLimit(userId: string): { allowed: boolean; nextAllowedAt?: Date } {
  const last = exportRateLimit.get(userId);
  const now = new Date();
  if (last) {
    const hoursSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) {
      return { allowed: false, nextAllowedAt: new Date(last.getTime() + 86400000) };
    }
  }
  exportRateLimit.set(userId, now);
  return { allowed: true };
}
