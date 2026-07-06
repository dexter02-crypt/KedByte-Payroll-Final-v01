import { NextRequest, NextResponse } from "next/server";
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
}
