// ============================================================
// KEDBYTE PAYROLL — ASYNC JOB RUNNER
// In-process simulation of BullMQ/Redis queues
// Every job produces a result + notification (no dead-ends)
// ============================================================

import { db } from "@/lib/db";
import { maskNINO } from "@/engine/payroll";

export type JobQueue =
  | "payrun:calculate" | "rti:submit" | "rti:poll" | "pdf:payslips"
  | "pension:contributions" | "import:employees" | "report:async"
  | "system:export" | "bank-holidays:sync" | "dps:fetch" | "tax:sync"
  | "yearend:p60" | "bank-changes:apply" | "notify:paydates" | "bacs:generate";

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

const jobStore = new Map<string, Job>();
const queueHealth: Record<string, { waiting: number; failed: number; lastRun: Date | null; total: number }> = {};

function initQueue(queue: string) {
  if (!queueHealth[queue]) queueHealth[queue] = { waiting: 0, failed: 0, lastRun: null, total: 0 };
}

// In-memory file store for exports (production: S3)
export const exportFiles = new Map<string, { content: string; fileName: string; mimeType: string; sizeBytes: number }>();

export async function enqueue(queue: JobQueue, payload: any, opts?: { requesterId?: string; tenantId?: string }): Promise<string> {
  initQueue(queue);
  const jobId = `${queue.split(":")[0]}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job: Job = {
    id: jobId, queue, status: "queued", payload,
    createdAt: new Date(),
    requesterId: opts?.requesterId,
    tenantId: opts?.tenantId || "bureau_kedbyte",
  };
  jobStore.set(jobId, job);
  queueHealth[queue].waiting++;
  queueHealth[queue].total++;
  setTimeout(() => processJob(jobId), 200 + Math.random() * 800);
  return jobId;
}

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
    await deliverResult(job);
  } catch (e: any) {
    job.status = "failed";
    job.error = e.message;
    job.completedAt = new Date();
    queueHealth[job.queue].failed++;
    queueHealth[job.queue].lastRun = new Date();
    if (job.requesterId) {
      await writeNotification(job.requesterId, job.tenantId, "job_failed", `Job failed: ${job.queue}`, e.message, null);
    }
  }
}

async function executeJob(job: Job): Promise<any> {
  switch (job.queue) {
    case "system:export": return await executeExport(job);
    case "bank-holidays:sync": return await executeBankHolidaySync(job);
    case "dps:fetch": return await executeDpsFetch(job);
    case "tax:sync": return { diff: [{ key: "nlw_21", label: "National Living Wage (21+)", current: 12.0, incoming: 12.71, source: "gov.uk" }] };
    case "pdf:payslips": return await executePdfPayslips(job);
    case "rti:submit": return await executeRtiSubmit(job);
    case "bacs:generate": return await executeBacsGenerate(job);
    case "pension:contributions": return await executePensionContributions(job);
    case "yearend:p60": return await executeYearendP60(job);
    case "notify:paydates": return { sent: 0 };
    case "bank-changes:apply": return { applied: 0 };
    case "payrun:calculate": return { ok: true };
    case "import:employees": return { imported: 0, errors: 0 };
    case "report:async": return { fileKey: `reports/${job.payload.type}-${Date.now()}.csv` };
    default: return { ok: true };
  }
}

// ============ EXPORT EXECUTOR ============
async function executeExport(job: Job): Promise<any> {
  const { format } = job.payload;
  const tenantId = job.tenantId;
  const companies = await db.company.findMany({ where: { status: { not: "deleted" } } });
  const employees = await db.employee.findMany({ where: { status: { not: "deleted" } } });
  const payRuns = await db.payRun.findMany();
  const payRunEntries = await db.payRunEntry.findMany({ include: { employee: true } });
  const documents = await db.document.findMany();

  const maskedEmployees = employees.map((e) => ({
    payrollId: e.payrollId, firstName: e.firstName, lastName: e.lastName,
    email: e.email, nino: maskNINO(e.nino), department: e.department,
    jobTitle: e.jobTitle, salaryAnnual: e.salaryAnnual, taxCode: e.taxCode,
    niCategory: e.niCategory,
    bankSortCode: e.bankSortCode ? `${e.bankSortCode.slice(0, 2)}-••-••` : "—",
    bankAccount: e.bankAccount ? `••••${e.bankAccount.slice(-4)}` : "—",
    status: e.status, startDate: e.startDate?.toISOString().slice(0, 10),
  }));

  const maskedCompanies = companies.map((c) => ({
    name: c.name, payeRef: c.payeRef, accountsOfficeRef: c.accountsOfficeRef,
    region: c.region, paySchedule: c.paySchedule,
    bankSortCode: c.bankSortCode ? `${c.bankSortCode.slice(0, 2)}-••-••` : "—",
    bankAccount: c.bankAccount ? `••••${c.bankAccount.slice(-4)}` : "—",
    status: c.status,
  }));

  const payRunRows = payRuns.map((p) => ({
    ref: `PR-2026-${String(p.taxPeriod).padStart(2, "0")}`, taxYear: p.taxYear,
    taxPeriod: p.taxPeriod, payDate: p.payDate?.toISOString().slice(0, 10), status: p.status,
  }));

  const entryRows = payRunEntries.map((e) => ({
    employee: `${e.employee?.firstName} ${e.employee?.lastName}`,
    payrollId: e.employee?.payrollId, gross: e.gross, tax: e.tax,
    niEmployee: e.niEmployee, niEmployer: e.niEmployer,
    pensionEmployee: e.pensionEmployee, net: e.net, status: e.status,
  }));

  const docRows = documents.map((d) => ({
    type: d.type, taxYear: d.taxYear || "", employeeId: d.employeeId || "",
    sha256: d.sha256?.slice(0, 16) + "…", generatedAt: d.generatedAt?.toISOString().slice(0, 10),
  }));

  let fileContent: string;
  let fileName: string;
  let mimeType: string;

  if (format === "json") {
    fileContent = JSON.stringify({ exportedAt: new Date().toISOString(), tenant: tenantId, companies: maskedCompanies, employees: maskedEmployees, payRuns: payRunRows, payRunEntries: entryRows, documents: docRows }, null, 2);
    fileName = `kedbyte-export-${tenantId}-${new Date().toISOString().slice(0, 10)}.json`;
    mimeType = "application/json";
  } else {
    const BOM = "\uFEFF";
    const sections = [
      "=== COMPANIES ===", toCSV(maskedCompanies, ["name","payeRef","aoRef","region","paySchedule","bankSortCode","bankAccount","status"]),
      "=== EMPLOYEES ===", toCSV(maskedEmployees, ["payrollId","firstName","lastName","email","nino","department","jobTitle","salaryAnnual","taxCode","niCategory","bankSortCode","bankAccount","status","startDate"]),
      "=== PAY RUNS ===", toCSV(payRunRows, ["ref","taxYear","taxPeriod","payDate","status"]),
      "=== PAY RUN ENTRIES ===", toCSV(entryRows, ["payrollId","name","gross","tax","niEE","niER","pensionEE","net","status"]),
      "=== DOCUMENTS ===", toCSV(docRows, ["type","taxYear","employeeId","sha256","generatedAt"]),
    ];
    fileContent = BOM + sections.join("\r\n\r\n") + "\r\n";
    fileName = `kedbyte-export-${tenantId}-${new Date().toISOString().slice(0, 10)}.csv`;
    mimeType = "text/csv; charset=utf-8";
  }

  const sizeBytes = Buffer.byteLength(fileContent, "utf8");
  exportFiles.set(job.id, { content: fileContent, fileName, mimeType, sizeBytes });

  return {
    fileName, sizeBytes, mimeType,
    rowCount: maskedCompanies.length + maskedEmployees.length + payRunRows.length + entryRows.length + docRows.length,
    maskedFields: ["nino", "bankSortCode", "bankAccount"],
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  };
}

function toCSV(rows: any[], header: string[]): string {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header, ...rows.map((r) => Array.isArray(r) ? r : header.map((h) => r[h]))];
  return lines.map((r) => r.map(esc).join(",")).join("\r\n");
}

async function executeBankHolidaySync(job: Job) {
  const existing = await db.bankHoliday.count();
  return { datesStored: existing, added: 0, source: "gov.uk/bank-holidays.json", diff: "No changes — registry up to date" };
}

async function executeDpsFetch(job: Job) {
  return { noticesFetched: 6, applied: 6, exceptions: 0, highWaterMarks: { P6: 1247, SL1: 89, P9: 34 } };
}

async function executePdfPayslips(job: Job) {
  const { payRunId } = job.payload;
  const entries = await db.payRunEntry.findMany({ where: { payRunId, status: "approved" } });
  let generated = 0;
  for (const entry of entries) {
    await db.document.create({ data: { tenantId: job.tenantId, companyId: job.payload.companyId, employeeId: entry.employeeId, type: "payslip", taxYear: job.payload.taxYear, payRunEntryId: entry.id, storageKey: `docs/payslips/${entry.employeeId}_${job.payload.taxYear}_p${job.payload.taxPeriod}.pdf`, sha256: Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join(""), status: "generated" } });
    const empUser = await db.user.findFirst({ where: { employeeId: entry.employeeId } });
    if (empUser) await writeNotification(empUser.id, job.tenantId, "payslip_ready", "Payslip ready", `Your payslip for period ${job.payload.taxPeriod} is available.`, "payslips");
    generated++;
  }
  return { generated, total: entries.length };
}

async function executeRtiSubmit(job: Job) {
  const irmark = Array.from({ length: 24 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[Math.floor(Math.random() * 64)]).join("");
  const correlationId = "COR-" + Math.random().toString(36).slice(2, 12).toUpperCase();
  const submission = await db.rtiSubmission.create({ data: { tenantId: job.tenantId, companyId: job.payload.companyId, payRunId: job.payload.payRunId, type: "FPS", taxYear: job.payload.taxYear, taxPeriod: job.payload.taxPeriod, xmlPayload: `<GovTalkMessage><Body><IRenvelope><FullPaymentSubmission>...</FullPaymentSubmission></IRenvelope></Body></GovTalkMessage>`, irmark, status: "accepted", correlationId, submittedAt: new Date(), resolvedAt: new Date() } });
  return { submissionId: submission.id, status: "accepted", correlationId };
}

async function executeBacsGenerate(job: Job) {
  const { payRunId } = job.payload;
  const entries = await db.payRunEntry.findMany({ where: { payRunId, status: "approved" }, include: { employee: true } });
  const lines: string[] = ["VOL1KEDBYTE1                        1", "HDR1AKEDBYTE                                                                      "];
  let totalPence = 0;
  for (const e of entries) {
    const amountPence = Math.round((e.net || 0) * 100);
    totalPence += amountPence;
    const sortCode = (e.employee?.bankSortCode || "000000").padEnd(6, "0").slice(0, 6);
    const account = (e.employee?.bankAccount || "00000000").padEnd(8, "0").slice(0, 8);
    const ref = (e.employee?.payrollId || "").padEnd(18).slice(0, 18);
    lines.push(sortCode + account + "99" + String(amountPence).padStart(11, "0") + ref);
  }
  lines.push("00000000000000" + "17" + String(totalPence).padStart(11, "0") + "CONTRA".padEnd(18));
  lines.push("EOF1A" + String(entries.length + 1).padStart(6, "0") + String(totalPence).padStart(12, "0").padEnd(74));
  const fileContent = lines.join("\r\n") + "\r\n";
  const fileName = `bacs-${payRunId}-${new Date().toISOString().slice(0, 10)}.txt`;
  exportFiles.set(`bacs-${payRunId}`, { content: fileContent, fileName, mimeType: "text/plain", sizeBytes: Buffer.byteLength(fileContent) });
  return { fileName, records: entries.length, sizeBytes: Buffer.byteLength(fileContent) };
}

async function executePensionContributions(job: Job) {
  const { payRunId } = job.payload;
  const entries = await db.payRunEntry.findMany({ where: { payRunId, status: "approved", pensionEmployee: { gt: 0 } }, include: { employee: true } });
  const rows = entries.map((e) => [job.payload.companyId, job.payload.periodStart, job.payload.periodEnd, e.employee?.nino || "", e.employee?.firstName, e.employee?.lastName, e.gross, e.pensionEmployee, e.pensionEmployer, "1", "", "", "", ""]);
  const fileContent = "\uFEFF" + toCSV(rows, ["EmployerId","PayPeriodStart","PayPeriodEnd","NINO","Forename","Surname","PensionableEarnings","EmployeeContribution","EmployerContribution","AssessmentCode","EventCode","EventDate","OptOutDate","DeferralDate"]);
  const fileName = `papdis-${payRunId}-${new Date().toISOString().slice(0, 10)}.csv`;
  exportFiles.set(`pension-${payRunId}`, { content: fileContent, fileName, mimeType: "text/csv; charset=utf-8", sizeBytes: Buffer.byteLength(fileContent) });
  return { fileName, members: entries.length };
}

async function executeYearendP60(job: Job) {
  const { taxYear } = job.payload;
  const employees = await db.employee.findMany({ where: { status: "active" } });
  let generated = 0;
  for (const emp of employees) {
    await db.document.create({ data: { tenantId: job.tenantId, companyId: emp.companyId, employeeId: emp.id, type: "p60", taxYear, storageKey: `docs/p60/${emp.id}_${taxYear}.pdf`, sha256: Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join(""), status: "generated" } });
    const empUser = await db.user.findFirst({ where: { employeeId: emp.id } });
    if (empUser) await writeNotification(empUser.id, job.tenantId, "p60_ready", "P60 ready", `Your P60 for ${taxYear} is available.`, "documents");
    generated++;
  }
  return { generated, taxYear };
}

async function deliverResult(job: Job) {
  if (!job.requesterId) return;
  const r = job.result || {};
  switch (job.queue) {
    case "system:export":
      await writeNotification(job.requesterId, job.tenantId, "export_ready", "Your data export is ready", `${r.fileName} · ${r.rowCount} rows · masked NINO/bank fields. Link expires in 7 days.`, `/api/exports/${job.id}/download`);
      break;
    case "bank-holidays:sync":
      await writeNotification(job.requesterId, job.tenantId, "sync_complete", "Bank holiday sync complete", r.diff || `${r.datesStored} dates stored.`, "settings");
      break;
    case "dps:fetch":
      await writeNotification(job.requesterId, job.tenantId, "dps_fetch_complete", "DPS fetch complete", `${r.applied} notices applied, ${r.exceptions} exceptions.`, "settings");
      break;
    case "rti:submit":
      await writeNotification(job.requesterId, job.tenantId, "rti_status", `RTI FPS ${r.status}`, `Submission ${r.status}. Correlation ID: ${r.correlationId}`, "rti");
      break;
    case "yearend:p60":
      await writeNotification(job.requesterId, job.tenantId, "yearend_complete", "P60 generation complete", `${r.generated} P60s generated for ${r.taxYear}.`, "documents");
      break;
  }
}

async function writeNotification(userId: string, tenantId: string, type: string, title: string, body: string, actionUrl: string | null) {
  return db.notification.create({ data: { tenantId, userId, type, title, body, actionUrl } });
}

export function getJob(jobId: string): Job | undefined { return jobStore.get(jobId); }
export function getRecentJobs(limit = 10): Job[] { return Array.from(jobStore.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit); }
export function getRecentExports(limit = 5): Job[] { return Array.from(jobStore.values()).filter((j) => j.queue === "system:export" && j.status === "completed").sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)).slice(0, limit); }
export function getQueueHealth() {
  const allQueues: JobQueue[] = ["payrun:calculate","rti:submit","rti:poll","pdf:payslips","pension:contributions","import:employees","report:async","system:export","bank-holidays:sync","dps:fetch","tax:sync","yearend:p60","bank-changes:apply","notify:paydates","bacs:generate"];
  for (const q of allQueues) initQueue(q);
  return allQueues.map((q) => ({ queue: q, waiting: queueHealth[q].waiting, failed: queueHealth[q].failed, lastRun: queueHealth[q].lastRun, total: queueHealth[q].total }));
}

const exportRateLimit = new Map<string, Date>();
export function checkExportRateLimit(userId: string): { allowed: boolean; nextAllowedAt?: Date } {
  const last = exportRateLimit.get(userId);
  const now = new Date();
  if (last) {
    const hoursSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) return { allowed: false, nextAllowedAt: new Date(last.getTime() + 86400000) };
  }
  exportRateLimit.set(userId, now);
  return { allowed: true };
}
