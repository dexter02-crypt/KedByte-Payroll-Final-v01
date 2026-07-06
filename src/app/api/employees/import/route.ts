import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateNINO, parseTaxCode, validateSortCode } from "@/engine/payroll";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const companyId = formData.get("companyId") as string;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "File too large — max 5 MB" }, { status: 413 });
  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && file.type !== "text/csv") return NextResponse.json({ error: "Only CSV files accepted" }, { status: 422 });

  const content = await file.text();
  const jobId = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result = await processImport(content, companyId, jobId);
  return NextResponse.json({ jobId, status: "completed", inserted: result.inserted, failed: result.failed, total: result.total, errorFileId: result.failed > 0 ? jobId : null, errors: result.errors.slice(0, 10) }, { status: 202 });
}

async function processImport(csvContent: string, companyId: string, jobId: string) {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { inserted: 0, failed: 0, total: 0, errors: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z_]/g, ""));
  const rows = lines.slice(1);
  const bureau = await db.bureau.findFirst();
  const tenantId = bureau?.id || "bureau_kedbyte";
  let inserted = 0, failed = 0;
  const errors: any[] = [];
  let existingCount = await db.employee.count({ where: { companyId } });

  for (let i = 0; i < rows.length; i++) {
    const cells = parseCsvLine(rows[i]);
    const rowObj: any = {};
    headers.forEach((h, idx) => { rowObj[h] = cells[idx] || ""; });
    const rowNum = i + 2;
    const errorFields: any[] = [];
    if (!rowObj.first_name || !rowObj.last_name) errorFields.push({ field: "name", message: "First name and last name required" });
    if (!rowObj.dob) errorFields.push({ field: "dob", message: "Date of birth required" });
    if (!rowObj.start_date) errorFields.push({ field: "start_date", message: "Start date required" });
    if (!rowObj.salary_annual) errorFields.push({ field: "salary_annual", message: "Annual salary required" });
    if (rowObj.nino && !validateNINO(rowObj.nino)) errorFields.push({ field: "nino", message: "Invalid NINO format" });
    if (rowObj.tax_code) { try { parseTaxCode(rowObj.tax_code); } catch { errorFields.push({ field: "tax_code", message: "Unrecognised tax code" }); } }
    if (rowObj.sort_code && !validateSortCode(rowObj.sort_code)) errorFields.push({ field: "sort_code", message: "Sort code must be 6 digits" });

    if (errorFields.length > 0) { failed++; errors.push({ row: rowNum, data: rowObj, field: errorFields[0].field, message: errorFields[0].message }); continue; }
    try {
      if (rowObj.nino) {
        const existing = await db.employee.findFirst({ where: { nino: rowObj.nino.toUpperCase().replace(/\s/g, "") } });
        if (existing) { failed++; errors.push({ row: rowNum, data: rowObj, field: "nino", message: "Duplicate NINO" }); continue; }
      }
      existingCount++;
      const payrollId = `EMP-${String(existingCount).padStart(5, "0")}`;
      const age = new Date().getFullYear() - new Date(rowObj.dob).getFullYear();
      const monthlyEarnings = parseFloat(rowObj.salary_annual) / 12;
      const aeResult = age >= 22 && age <= 67 && monthlyEarnings > 833 ? "eligible" : "entitled";
      await db.employee.create({ data: { tenantId, companyId, payrollId, firstName: rowObj.first_name, lastName: rowObj.last_name, email: rowObj.email || null, dob: new Date(rowObj.dob), gender: rowObj.gender?.[0] || null, nino: rowObj.nino ? rowObj.nino.toUpperCase().replace(/\s/g, "") : null, addressLine1: rowObj.address_line1 || null, addressCity: rowObj.city || null, addressPostcode: rowObj.postcode || null, startDate: new Date(rowObj.start_date), starterDeclaration: rowObj.starter_declaration || null, salaryAnnual: parseFloat(rowObj.salary_annual), contractedWeeklyHours: parseFloat(rowObj.contracted_weekly_hours) || 37.5, department: rowObj.department || null, jobTitle: rowObj.job_title || null, employmentType: rowObj.employment_type || "full_time", taxCode: rowObj.tax_code || "1257L", taxBasis: "cumul", niCategory: rowObj.ni_category || "A", studentLoanPlan: rowObj.student_loan_plan || null, postgradLoan: rowObj.postgrad_loan === "yes" || rowObj.postgrad_loan === "true", bankSortCode: rowObj.sort_code?.replace(/[-\s]/g, "") || null, bankAccount: rowObj.account_number || null, bankAccountName: rowObj.account_name || null, pensionStatus: aeResult === "eligible" ? "enrolled" : aeResult, pensionEnrolmentDate: aeResult === "eligible" ? new Date(rowObj.start_date) : null, holidayEntitlementDays: 28, status: "active" } });
      inserted++;
    } catch (e: any) { failed++; errors.push({ row: rowNum, data: rowObj, field: "insert", message: e.message }); }
  }
  return { inserted, failed, total: rows.length, errors };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) { if (ch === '"') { if (line[i + 1] === '"') { current += '"'; i++; } else inQuotes = false; } else current += ch; }
    else { if (ch === '"') inQuotes = true; else if (ch === ",") { result.push(current); current = ""; } else current += ch; }
  }
  result.push(current);
  return result;
}
