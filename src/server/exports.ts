// ============================================================
// KEDBYTE PAYROLL — SHARED EXPORT SERVICE
// Two delivery modes, one rule: small = direct download, big = async + notify
// Spec §2: every export endpoint calls runExport() once.
// CSV: UTF-8 with BOM, CRLF, RFC-4180 quoting, plain numbers, YYYY-MM-DD dates
// ============================================================

import { createHash } from "crypto";
import { db } from "@/lib/db";
import { enqueue, exportFiles } from "@/lib/jobs/runner";
import { maskNINO } from "@/engine/payroll";

export const ASYNC_THRESHOLD_ROWS = 2000;
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

export type ExportSpec = {
  kind: string; // 'papdis' | 'nest-csv' | 'ae-report' | 'system-bundle' | ...
  filename: string;
  contentType: string; // 'text/csv; charset=utf-8' | 'application/zip' | 'application/xml'
  build: () => Promise<Buffer>; // pure builder — queries + serialises
  estimatedRows: number;
};

// ============ CSV BUILDER (Excel-safe: BOM + CRLF + RFC-4180 quoting) ============
export function toCsv(rows: (string | number | null | undefined)[][], header: string[]): Buffer {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header, ...rows].map((r) => r.map(esc).join(","));
  return Buffer.concat([BOM, Buffer.from(lines.join("\r\n") + "\r\n", "utf8")]);
}

// ============ MONEY FORMATTER (plain numbers for machine files) ============
export function money(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v)) return "";
  return v.toFixed(2); // 1234.56 — no £, no thousands separators
}

// ============ DATE FORMATTER (YYYY-MM-DD) ============
export function dateStr(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

// ============ COMPANY SLUG (for filenames) ============
export function companySlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ============ SHA-256 ============
export function sha256(b: Buffer | string): string {
  return createHash("sha256").update(b).digest("hex");
}

// ============ THE DECISION FUNCTION — every export endpoint calls this ============
export async function runExport(spec: ExportSpec, ctx: { tenantId: string; userId: string }): Promise<
  | { mode: "direct"; body: Buffer; filename: string; contentType: string }
  | { mode: "async"; jobId: string }
> {
  if (spec.estimatedRows <= ASYNC_THRESHOLD_ROWS) {
    // MODE A — direct download
    const body = await spec.build();
    await audit(ctx, "EXPORT_DOWNLOADED", { kind: spec.kind, filename: spec.filename, sha256: sha256(body), mode: "direct" });
    return { mode: "direct" as const, body, filename: spec.filename, contentType: spec.contentType };
  }
  // MODE B — async + notify
  const jobId = await enqueue("export:build" as any, { ...ctx, kind: spec.kind, filename: spec.filename, contentType: spec.contentType }, { requesterId: ctx.userId, tenantId: ctx.tenantId });
  await audit(ctx, "EXPORT_QUEUED", { kind: spec.kind, jobId, estimatedRows: spec.estimatedRows });
  return { mode: "async" as const, jobId };
}

// ============ MODE B WORKER — builds file, stores, indexes, notifies ============
export async function exportWorker(job: { id: string; tenantId: string; userId: string; kind: string; payload: any }) {
  const spec = await buildSpecFor(job.kind, job.payload, job.tenantId);
  const body = await spec.build();
  const key = `exports/${job.tenantId}/${job.id}/${spec.filename}`;

  // Store in memory (production: S3 put)
  exportFiles.set(job.id, { content: body.toString("utf8"), fileName: spec.filename, mimeType: spec.contentType, sizeBytes: body.length });

  // Index in DB (exportsIndex concept — we reuse audit_log for the index in demo)
  await audit({ tenantId: job.tenantId, userId: job.userId }, "EXPORT_READY", {
    kind: spec.kind,
    filename: spec.filename,
    storageKey: key,
    sha256: sha256(body),
    sizeBytes: body.length,
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  });

  // Notify user
  await db.notification.create({
    data: {
      tenantId: job.tenantId,
      userId: job.userId,
      type: "export_ready",
      title: `${spec.filename} is ready`,
      body: `${spec.kind} export · ${(body.length / 1024).toFixed(1)} KB · link expires in 7 days`,
      actionUrl: `/api/exports/${job.id}/download`,
    },
  });
}

// ============ SPEC BUILDER DISPATCH (for MODE B worker) ============
async function buildSpecFor(kind: string, params: any, tenantId: string): Promise<ExportSpec> {
  switch (kind) {
    case "system-bundle":
      return await systemBundleSpec(params.format || "csv-bundle", tenantId);
    case "papdis":
      return await papdisSpec(params.payRunId, tenantId);
    case "nest-csv":
      return await nestCsvSpec(params.payRunId, tenantId);
    case "ae-report":
      return await aeReportSpec(params.companyId, tenantId);
    case "payrun-entries":
      return await payrunEntriesSpec(params.payRunId, tenantId);
    case "employee-list":
      return await employeeListSpec(params.companyId, tenantId);
    case "audit-ledger":
      return await auditLedgerSpec(params.from, params.to, tenantId);
    case "report":
      return await reportSpec(params.type, params.params, tenantId);
    case "gpg":
      return await gpgSpec(params.companyId, params.snapshot, tenantId);
    case "rti-errors-dictionary":
      return await rtiErrorsDictionarySpec(tenantId);
    default:
      throw new Error(`Unknown export kind: ${kind}`);
  }
}

// ============ AUDIT HELPER ============
async function audit(ctx: { tenantId: string; userId: string }, action: string, data: any) {
  await db.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action,
      entityType: "export",
      entityId: data.jobId || data.filename || null,
      afterJson: JSON.stringify(data),
      prevHash: "0".repeat(64),
      currHash: "0".repeat(64),
      seq: Math.floor(Date.now() / 1000),
    },
  });
}

// ============================================================
// EXPORT SPEC BUILDERS — one per artifact type
// ============================================================

// ============ E14: System bundle (CSV or JSON) ============
export async function systemBundleSpec(format: string, tenantId: string): Promise<ExportSpec> {
  const companies = await db.company.count({ where: { status: { not: "deleted" } } });
  const employees = await db.employee.count({ where: { status: { not: "deleted" } } });
  const payRuns = await db.payRun.count();
  const estimatedRows = companies + employees + payRuns + 50; // +50 for entries/docs

  return {
    kind: "system-bundle",
    filename: format === "json"
      ? `kedbyte-export-${tenantId}-${new Date().toISOString().slice(0, 10)}.json`
      : `kedbyte-export-${tenantId}-${new Date().toISOString().slice(0, 10)}.csv`,
    contentType: format === "json" ? "application/json" : "text/csv; charset=utf-8",
    estimatedRows,
    build: async () => {
      const allCompanies = await db.company.findMany({ where: { status: { not: "deleted" } } });
      const allEmployees = await db.employee.findMany({ where: { status: { not: "deleted" } } });
      const allPayRuns = await db.payRun.findMany();
      const allEntries = await db.payRunEntry.findMany({ include: { employee: true } });
      const allDocs = await db.document.findMany();

      const maskedCompanies = allCompanies.map((c) => [c.name, c.payeRef, c.accountsOfficeRef, c.region, c.paySchedule, c.bankSortCode ? `${c.bankSortCode.slice(0, 2)}-••-••` : "", c.bankAccount ? `••••${c.bankAccount.slice(-4)}` : "", c.status]);
      const maskedEmployees = allEmployees.map((e) => [e.payrollId, e.firstName, e.lastName, e.email, maskNINO(e.nino), e.department, e.jobTitle, money(e.salaryAnnual), e.taxCode, e.niCategory, e.bankSortCode ? `${e.bankSortCode.slice(0, 2)}-••-••` : "", e.bankAccount ? `••••${e.bankAccount.slice(-4)}` : "", e.status, dateStr(e.startDate)]);
      const payRunRows = allPayRuns.map((p) => [`PR-2026-${String(p.taxPeriod).padStart(2, "0")}`, p.taxYear, p.taxPeriod, dateStr(p.payDate), p.status]);
      const entryRows = allEntries.map((e) => [e.employee?.payrollId, `${e.employee?.firstName} ${e.employee?.lastName}`, money(e.gross), money(e.tax), money(e.niEmployee), money(e.niEmployer), money(e.pensionEmployee), money(e.net), e.status]);
      const docRows = allDocs.map((d) => [d.type, d.taxYear || "", d.employeeId || "", d.sha256?.slice(0, 16) + "…", dateStr(d.generatedAt)]);

      if (format === "json") {
        const data = {
          exportedAt: new Date().toISOString(),
          tenant: tenantId,
          companies: maskedCompanies,
          employees: maskedEmployees,
          payRuns: payRunRows,
          payRunEntries: entryRows,
          documents: docRows,
        };
        return Buffer.from(JSON.stringify(data, null, 2), "utf8");
      }
      // CSV bundle — multiple sections
      const sections = [
        { header: "=== COMPANIES ===" },
        ...maskedCompanies.length > 0 ? [toCsv(maskedCompanies, ["name", "payeRef", "aoRef", "region", "paySchedule", "bankSortCode", "bankAccount", "status"])] : [Buffer.from("(no data)\r\n")],
        { header: "=== EMPLOYEES ===" },
        ...maskedEmployees.length > 0 ? [toCsv(maskedEmployees, ["payrollId", "firstName", "lastName", "email", "nino", "department", "jobTitle", "salaryAnnual", "taxCode", "niCategory", "bankSortCode", "bankAccount", "status", "startDate"])] : [Buffer.from("(no data)\r\n")],
        { header: "=== PAY RUNS ===" },
        ...payRunRows.length > 0 ? [toCsv(payRunRows, ["ref", "taxYear", "taxPeriod", "payDate", "status"])] : [Buffer.from("(no data)\r\n")],
        { header: "=== PAY RUN ENTRIES ===" },
        ...entryRows.length > 0 ? [toCsv(entryRows, ["payrollId", "name", "gross", "tax", "niEE", "niER", "pensionEE", "net", "status"])] : [Buffer.from("(no data)\r\n")],
        { header: "=== DOCUMENTS ===" },
        ...docRows.length > 0 ? [toCsv(docRows, ["type", "taxYear", "employeeId", "sha256", "generatedAt"])] : [Buffer.from("(no data)\r\n")],
      ];
      const parts: Buffer[] = [];
      for (const s of sections) {
        if ("header" in s) parts.push(Buffer.from(s.header + "\r\n", "utf8"));
        else parts.push(s);
        parts.push(Buffer.from("\r\n", "utf8"));
      }
      return Buffer.concat(parts);
    },
  };
}

// ============ E1: PAPDIS contribution file ============
export async function papdisSpec(payRunId: string, tenantId: string): Promise<ExportSpec> {
  const payRun = await db.payRun.findUnique({ where: { id: payRunId }, include: { company: true } });
  if (!payRun) throw new Error("Pay run not found");
  if (payRun.status !== "committed") throw new Error("409:Commit the pay run first — contribution files come from committed figures");

  const entries = await db.payRunEntry.findMany({
    where: { payRunId, status: "approved", pensionEmployee: { gt: 0 } },
    include: { employee: true },
  });

  const company = payRun.company;
  const slug = companySlug(company.name);
  const period = `M${String(payRun.taxPeriod).padStart(2, "0")}`;

  return {
    kind: "papdis",
    filename: `papdis-${slug}-${payRun.taxYear}-${period}.csv`,
    contentType: "text/csv; charset=utf-8",
    estimatedRows: entries.length,
    build: async () => {
      const rows = entries.map((e) => {
        const ae = e.employee.pensionStatus === "enrolled" ? "1" : e.employee.pensionStatus === "non_eligible" ? "2" : "3";
        return [
          "1.1", // PapdisVersion
          company.id, // EmployerId
          dateStr(payRun.periodStart), // PayrollPeriodStartDate
          dateStr(payRun.periodEnd), // PayrollPeriodEndDate
          dateStr(payRun.payDate), // ContributionDeductionDate
          "M1", // FrequencyCode (monthly)
          e.employee.nino || "", // NINO — FULL (providers require it)
          "", // Title
          e.employee.firstName, // Forename
          e.employee.lastName, // Surname
          e.employee.gender || "", // Gender
          dateStr(e.employee.dob), // BirthDate
          e.employee.addressLine1 || "", // AddressLine1
          "", // AddressLine2
          e.employee.addressCity || "", // City
          e.employee.addressPostcode || "", // Postcode
          e.employee.email || "", // EmailAddress
          money(e.niableGross), // PensionableEarnings (QE base = NI-able gross)
          money(e.pensionEmployee ? e.pensionEmployee / 0.8 : 0), // EmployeeContributionsAmount — GROSS (RAS ×0.8 is payslip deduction; file carries gross)
          money(e.pensionEmployer), // EmployerContributionsAmount
          ae, // AssessmentCode
          "", // EventCode (enrolment this period → 1, opt-out → 2, else blank)
          "", // EventDate
          e.employee.pensionOptoutDate ? dateStr(e.employee.pensionOptoutDate) : "", // OptOutDate
          "", // DeferralDate
        ];
      });
      return toCsv(rows, [
        "PapdisVersion", "EmployerId", "PayrollPeriodStartDate", "PayrollPeriodEndDate", "ContributionDeductionDate",
        "FrequencyCode", "NINO", "Title", "Forename", "Surname", "Gender", "BirthDate",
        "AddressLine1", "AddressLine2", "City", "Postcode", "EmailAddress",
        "PensionableEarnings", "EmployeeContributionsAmount", "EmployerContributionsAmount",
        "AssessmentCode", "EventCode", "EventDate", "OptOutDate", "DeferralDate",
      ]);
    },
  };
}

// ============ E2: NEST CSV ============
export async function nestCsvSpec(payRunId: string, tenantId: string): Promise<ExportSpec> {
  const payRun = await db.payRun.findUnique({ where: { id: payRunId }, include: { company: true } });
  if (!payRun) throw new Error("Pay run not found");
  if (payRun.status !== "committed") throw new Error("409:Commit the pay run first — contribution files come from committed figures");

  const entries = await db.payRunEntry.findMany({
    where: { payRunId, status: "approved", pensionEmployee: { gt: 0 } },
    include: { employee: true },
  });

  const slug = companySlug(payRun.company.name);
  const period = `M${String(payRun.taxPeriod).padStart(2, "0")}`;

  return {
    kind: "nest-csv",
    filename: `nest-contributions-${slug}-${payRun.taxYear}-${period}.csv`,
    contentType: "text/csv; charset=utf-8",
    estimatedRows: entries.length,
    build: async () => {
      const rows = entries.map((e) => [
        e.employee.nino || "", // NINO — FULL
        e.employee.payrollId, // AlternativeUniqueID
        e.employee.firstName, // Forename
        e.employee.lastName, // Surname
        money(e.niableGross), // PensionableEarnings
        money(e.pensionEmployee ? e.pensionEmployee / 0.8 : 0), // EmployeeContribution — GROSS
        money(e.pensionEmployer), // EmployerContribution
        "", // ReasonForPartialOrNonPayment (blank unless zero-contribution)
      ]);
      return toCsv(rows, [
        "NINO", "AlternativeUniqueID", "Forename", "Surname", "PensionableEarnings",
        "EmployeeContribution", "EmployerContribution", "ReasonForPartialOrNonPayment",
      ]);
    },
  };
}

// ============ E3: AE Assessment report ============
export async function aeReportSpec(companyId: string | null, tenantId: string): Promise<ExportSpec> {
  const where = companyId ? { companyId, status: "active" } : { status: "active" };
  const employees = await db.employee.findMany({
    where,
    include: { aeAssessments: { orderBy: { assessedOn: "desc" }, take: 1 } },
  });

  const company = companyId ? await db.company.findUnique({ where: { id: companyId } }) : null;
  const slug = company ? companySlug(company.name) : "all-companies";

  return {
    kind: "ae-report",
    filename: `ae-assessment-${slug}-${new Date().toISOString().slice(0, 10)}.csv`,
    contentType: "text/csv; charset=utf-8",
    estimatedRows: employees.length,
    build: async () => {
      const rows = employees.map((e) => {
        const age = new Date().getFullYear() - new Date(e.dob).getFullYear();
        const lastAssessment = e.aeAssessments[0];
        return [
          `${e.firstName} ${e.lastName}`,
          e.payrollId,
          maskNINO(e.nino), // MASKED — circulates to clients
          dateStr(e.dob),
          age,
          money(e.salaryAnnual),
          money(e.salaryAnnual / 12),
          lastAssessment?.result || "not_assessed",
          lastAssessment ? dateStr(lastAssessment.assessedOn) : "",
          e.pensionStatus,
          e.pensionEnrolmentDate ? dateStr(e.pensionEnrolmentDate) : "",
          e.pensionOptoutDate ? dateStr(e.pensionOptoutDate) : "",
          lastAssessment?.postponementEnd ? dateStr(lastAssessment.postponementEnd) : "",
        ];
      });
      return toCsv(rows, [
        "Employee", "PayrollId", "NINO(masked)", "DOB", "Age", "AnnualisedEarnings", "MonthlyEarnings",
        "AssessmentResult", "AssessedOn", "PensionStatus", "EnrolmentDate", "OptOutDate", "PostponementEnd",
      ]);
    },
  };
}

// ============ E8: Pay run entries export ============
export async function payrunEntriesSpec(payRunId: string, tenantId: string): Promise<ExportSpec> {
  const payRun = await db.payRun.findUnique({ where: { id: payRunId }, include: { company: true } });
  if (!payRun) throw new Error("Pay run not found");
  const entries = await db.payRunEntry.findMany({ where: { payRunId }, include: { employee: true }, orderBy: { employee: { lastName: "asc" } } });
  const slug = companySlug(payRun.company.name);
  const period = `M${String(payRun.taxPeriod).padStart(2, "0")}`;

  return {
    kind: "payrun-entries",
    filename: `payrun-${slug}-${payRun.taxYear}-${period}.csv`,
    contentType: "text/csv; charset=utf-8",
    estimatedRows: entries.length,
    build: async () => {
      const rows = entries.map((e) => [
        `${e.employee?.firstName} ${e.employee?.lastName}`,
        e.employee?.payrollId,
        money(e.gross),
        money(e.tax),
        money(e.niEmployee),
        money(e.niEmployer),
        money(e.pensionEmployee),
        money(e.pensionEmployer),
        money(e.studentLoan),
        money(e.postgradLoan),
        money(e.net),
        e.variancePct !== null ? e.variancePct.toFixed(2) : "",
        e.status,
      ]);
      return toCsv(rows, [
        "Employee", "PayrollId", "Gross", "Tax", "NIEmployee", "NIEmployer",
        "PensionEmployee", "PensionEmployer", "StudentLoan", "PostgradLoan", "Net", "VariancePct", "Status",
      ]);
    },
  };
}

// ============ E13: Employee list export ============
export async function employeeListSpec(companyId: string, tenantId: string): Promise<ExportSpec> {
  const company = await db.company.findUnique({ where: { id: companyId } });
  const employees = await db.employee.findMany({ where: { companyId, status: { not: "deleted" } }, orderBy: { lastName: "asc" } });
  const slug = companySlug(company?.name || "company");

  return {
    kind: "employee-list",
    filename: `employees-${slug}-${new Date().toISOString().slice(0, 10)}.csv`,
    contentType: "text/csv; charset=utf-8",
    estimatedRows: employees.length,
    build: async () => {
      const rows = employees.map((e) => [
        e.payrollId,
        e.firstName,
        e.lastName,
        e.email || "",
        maskNINO(e.nino), // MASKED
        e.department || "",
        e.jobTitle || "",
        money(e.salaryAnnual),
        e.taxCode,
        e.niCategory,
        e.employmentType,
        e.studentLoanPlan || "",
        e.postgradLoan ? "Yes" : "No",
        e.pensionStatus,
        e.bankSortCode ? `${e.bankSortCode.slice(0, 2)}-••-••` : "", // MASKED
        e.bankAccount ? `••••${e.bankAccount.slice(-4)}` : "", // MASKED
        e.status,
        dateStr(e.startDate),
      ]);
      return toCsv(rows, [
        "PayrollId", "FirstName", "LastName", "Email", "NINO(masked)", "Department", "JobTitle",
        "SalaryAnnual", "TaxCode", "NICategory", "EmploymentType", "StudentLoanPlan", "PostgradLoan",
        "PensionStatus", "BankSortCode(masked)", "BankAccount(masked)", "Status", "StartDate",
      ]);
    },
  };
}

// ============ E15: Audit ledger export ============
export async function auditLedgerSpec(from: string, to: string, tenantId: string): Promise<ExportSpec> {
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
  const toDate = to ? new Date(to) : new Date();
  const count = await db.auditLog.count({ where: { createdAt: { gte: fromDate, lte: toDate } } });

  return {
    kind: "audit-ledger",
    filename: `audit-ledger-${dateStr(fromDate)}-${dateStr(toDate)}.csv`,
    contentType: "text/csv; charset=utf-8",
    estimatedRows: count,
    build: async () => {
      const logs = await db.auditLog.findMany({
        where: { createdAt: { gte: fromDate, lte: toDate } },
        orderBy: { createdAt: "desc" },
        take: 10000,
      });
      const rows = logs.map((l) => [
        l.seq,
        dateStr(l.createdAt),
        l.actorId || "",
        l.action,
        l.entityType,
        l.entityId || "",
        l.beforeJson || "",
        l.afterJson || "",
        l.currHash,
      ]);
      return toCsv(rows, ["seq", "at", "actor", "action", "entity", "entityId", "before", "after", "curr_hash"]);
    },
  };
}

// ============ E10: Report export ============
export async function reportSpec(type: string, params: any, tenantId: string): Promise<ExportSpec> {
  return {
    kind: "report",
    filename: `${type}-${new Date().toISOString().slice(0, 10)}.csv`,
    contentType: "text/csv; charset=utf-8",
    estimatedRows: 12, // monthly data
    build: async () => {
      const committedRuns = await db.payRun.findMany({ where: { status: "committed", taxYear: "2026-27" } });
      const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
      const monthlyData: Record<number, any> = {};
      for (const pr of committedRuns) {
        try {
          const t = JSON.parse(pr.totalsJson);
          if (!monthlyData[pr.taxPeriod]) monthlyData[pr.taxPeriod] = { gross: 0, tax: 0, niEe: 0, niEr: 0, net: 0, pensEe: 0, pensEr: 0 };
          monthlyData[pr.taxPeriod].gross += t.gross || 0;
          monthlyData[pr.taxPeriod].tax += t.tax || 0;
          monthlyData[pr.taxPeriod].niEe += t.niEe || 0;
          monthlyData[pr.taxPeriod].niEr += t.niEr || 0;
          monthlyData[pr.taxPeriod].net += t.net || 0;
          monthlyData[pr.taxPeriod].pensEe += t.pensEe || 0;
          monthlyData[pr.taxPeriod].pensEr += t.pensEr || 0;
        } catch {}
      }
      const rows = Object.keys(monthlyData).sort((a, b) => Number(a) - Number(b)).map((k) => [
        months[Number(k) - 1] || `M${k}`,
        money(monthlyData[Number(k)].gross),
        money(monthlyData[Number(k)].tax),
        money(monthlyData[Number(k)].niEe + monthlyData[Number(k)].niEr),
        money(monthlyData[Number(k)].pensEe + monthlyData[Number(k)].pensEr),
        money(monthlyData[Number(k)].net),
      ]);
      return toCsv(rows, ["Month", "Gross", "Tax", "NI", "Pension", "Net"]);
    },
  };
}

// ============ E11: GPG export ============
export async function gpgSpec(companyId: string | null, snapshot: string, tenantId: string): Promise<ExportSpec> {
  return {
    kind: "gpg",
    filename: `gpg-${companyId || "all"}-${snapshot}.csv`,
    contentType: "text/csv; charset=utf-8",
    estimatedRows: 1, // single summary row
    build: async () => {
      // Demo GPG figures (production: compute from Part 5.12 maths)
      const rows = [[
        snapshot,
        "12.4", // MeanHourlyGapPct
        "8.1", // MedianHourlyGapPct
        "5.2", // MeanBonusGapPct
        "3.7", // MedianBonusGapPct
        "68.0", // MalesReceivingBonusPct
        "62.0", // FemalesReceivingBonusPct
        "52.0", "48.0", // Q1
        "55.0", "45.0", // Q2
        "58.0", "42.0", // Q3
        "61.0", "39.0", // Q4
      ]];
      return toCsv(rows, [
        "SnapshotDate", "MeanHourlyGapPct", "MedianHourlyGapPct", "MeanBonusGapPct", "MedianBonusGapPct",
        "MalesReceivingBonusPct", "FemalesReceivingBonusPct",
        "Q1MalePct", "Q1FemalePct", "Q2MalePct", "Q2FemalePct",
        "Q3MalePct", "Q3FemalePct", "Q4MalePct", "Q4FemalePct",
      ]);
    },
  };
}

// ============ E6: RTI error dictionary export ============
export async function rtiErrorsDictionarySpec(tenantId: string): Promise<ExportSpec> {
  const count = await db.rtiErrorDictionary.count();
  return {
    kind: "rti-errors-dictionary",
    filename: `rti-error-dictionary-${new Date().toISOString().slice(0, 10)}.csv`,
    contentType: "text/csv; charset=utf-8",
    estimatedRows: count,
    build: async () => {
      const dict = await db.rtiErrorDictionary.findMany({ orderBy: { code: "asc" } });
      const rows = dict.map((d) => [d.code, d.category || "", d.severity || "", d.hmrcMessage || "", d.cause || "", d.resolutionScreen || "", d.resolutionField || ""]);
      return toCsv(rows, ["code", "category", "severity", "hmrc_message", "cause", "resolution_screen", "resolution_field"]);
    },
  };
}

// ============ E7: BACS Standard-18 file ============
export async function bacsSpec(payRunId: string, tenantId: string): Promise<ExportSpec> {
  const payRun = await db.payRun.findUnique({ where: { id: payRunId }, include: { company: true } });
  if (!payRun) throw new Error("Pay run not found");
  if (payRun.status !== "committed") throw new Error("409:Commit the pay run first — BACS files come from committed figures");
  const entries = await db.payRunEntry.findMany({ where: { payRunId, status: "approved" }, include: { employee: true } });
  const slug = companySlug(payRun.company.name);
  const period = `M${String(payRun.taxPeriod).padStart(2, "0")}`;

  return {
    kind: "bacs",
    filename: `bacs-${slug}-${payRun.taxYear}-${period}.std18.txt`,
    contentType: "text/plain",
    estimatedRows: entries.length,
    build: async () => {
      // Standard-18 fixed-width file
      const lines: string[] = [];
      // VOL1 header
      lines.push("VOL1" + (payRun.company.bacsSun || "KEDBYT").padEnd(6) + "1                        1");
      // HDR1
      lines.push("HDR1A" + "KEDBYTE".padEnd(76));
      // Per-credit records (TX 99)
      let totalPence = 0;
      for (const e of entries) {
        const amountPence = Math.round((e.net || 0) * 100);
        totalPence += amountPence;
        const sortCode = (e.employee?.bankSortCode || "000000").padEnd(6, "0").slice(0, 6);
        const account = (e.employee?.bankAccount || "00000000").padEnd(8, "0").slice(0, 8);
        const ref = (e.employee?.payrollId || "").padEnd(18).slice(0, 18);
        lines.push(sortCode + account + "99" + String(amountPence).padStart(11, "0") + ref);
      }
      // Contra debit record (TX 17) — balances to total net
      const companySort = (payRun.company.bankSortCode || "000000").padEnd(6, "0").slice(0, 6);
      const companyAccount = (payRun.company.bankAccount || "00000000").padEnd(8, "0").slice(0, 8);
      lines.push(companySort + companyAccount + "17" + String(totalPence).padStart(11, "0") + "CONTRA".padEnd(18));
      // EOF1
      lines.push("EOF1A" + String(entries.length + 1).padStart(6, "0") + String(totalPence).padStart(12, "0").padEnd(74));
      return Buffer.from(lines.join("\r\n") + "\r\n", "utf8");
    },
  };
}
