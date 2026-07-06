import { NextRequest, NextResponse } from "next/server";
<<<<<<< HEAD
import { db } from "@/lib/db";
import { maskNINO } from "@/engine/payroll";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await db.company.findUnique({ where: { id } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  const employees = await db.employee.findMany({ where: { companyId: id, status: { not: "deleted" } }, orderBy: { lastName: "asc" } });
  const slug = company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const BOM = "\uFEFF";
  const rows = employees.map((e) => [e.payrollId, e.firstName, e.lastName, e.email || "", maskNINO(e.nino), e.department || "", e.jobTitle || "", e.salaryAnnual.toFixed(2), e.taxCode, e.niCategory, e.employmentType, e.studentLoanPlan || "", e.postgradLoan ? "Yes" : "No", e.pensionStatus, e.bankSortCode ? `${e.bankSortCode.slice(0, 2)}-••-••` : "", e.bankAccount ? `••••${e.bankAccount.slice(-4)}` : "", e.status, e.startDate?.toISOString().slice(0, 10) || ""]);
  const csv = BOM + ["PayrollId,FirstName,LastName,Email,NINO(masked),Department,JobTitle,SalaryAnnual,TaxCode,NICategory,EmploymentType,StudentLoanPlan,PostgradLoan,PensionStatus,BankSortCode(masked),BankAccount(masked),Status,StartDate", ...rows.map((r) => r.map((v) => /[",\n]/.test(String(v)) ? `"${v}"` : v).join(",")).join("\r\n")].join("\r\n") + "\r\n";
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="employees-${slug}-${new Date().toISOString().slice(0, 10)}.csv"` } });
=======
import { runExport, employeeListSpec } from "@/server/exports";

// GET /api/companies/[id]/employees/export — E13 employee list CSV (masked NINO/bank)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = { tenantId: "bureau_kedbyte", userId: "user_admin" };
  try {
    const spec = await employeeListSpec(id, ctx.tenantId);
    const r = await runExport(spec, ctx);
    if (r.mode === "direct") {
      return new NextResponse(r.body, {
        headers: { "Content-Type": r.contentType, "Content-Disposition": `attachment; filename="${r.filename}"` },
      });
    }
    return NextResponse.json({ jobId: r.jobId }, { status: 202 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
}
