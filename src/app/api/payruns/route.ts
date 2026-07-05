import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolvePayDate, bacsSubmissionDate } from "@/engine/payroll";

export async function POST(req: NextRequest) {
  const { companyId } = await req.json();
  const bureau = await db.bureau.findFirst();
  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company || !bureau) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  // Derive next tax period
  const latestRun = await db.payRun.findFirst({
    where: { companyId, taxYear: "2026-27" },
    orderBy: { taxPeriod: "desc" },
  });
  const nextPeriod = (latestRun?.taxPeriod || 0) + 1;
  if (nextPeriod > 12) return NextResponse.json({ error: "Tax year complete" }, { status: 400 });

  // Tax month: period 1 = 6 Apr-5 May, period 4 = 6 Jul-5 Aug
  const periodStart = new Date(2026, 3 + nextPeriod - 1, 6);
  const periodEnd = new Date(2026, 3 + nextPeriod, 5);
  const payDate = resolvePayDate(2026, 3 + nextPeriod + 1, company.paySchedule, company.payDateDay || undefined, company.earlyPay);
  const bacsDate = bacsSubmissionDate(payDate);

  const ref = `PR-2026-${String(nextPeriod).padStart(2, "0")}`;

  // Check for existing
  const existing = await db.payRun.findFirst({
    where: { companyId, taxYear: "2026-27", taxPeriod: nextPeriod },
  });
  if (existing) return NextResponse.json({ id: existing.id, ref, existing: true });

  const payRun = await db.payRun.create({
    data: {
      tenantId: bureau.id,
      companyId,
      taxYear: "2026-27",
      taxPeriod: nextPeriod,
      periodStart,
      periodEnd,
      payDate,
      bacsSubmissionDate: bacsDate,
      status: "draft",
      totalsJson: "{}",
    },
  });

  // Seed entries for all active employees
  const employees = await db.employee.findMany({
    where: { companyId, status: "active" },
  });
  for (const emp of employees) {
    await db.payRunEntry.create({
      data: {
        tenantId: bureau.id,
        payRunId: payRun.id,
        employeeId: emp.id,
        overtimeMultiplier: 1.5,
        status: "draft",
      },
    });
  }

  const entries = await db.payRunEntry.findMany({
    where: { payRunId: payRun.id },
    include: { employee: true },
  });

  return NextResponse.json({
    id: payRun.id,
    ref,
    taxYear: "2026-27",
    taxPeriod: nextPeriod,
    periodStart,
    periodEnd,
    payDate,
    bacsSubmissionDate: bacsDate,
    status: "draft",
    entries: entries.map((e) => ({
      id: e.id,
      employeeId: e.employeeId,
      name: `${e.employee.firstName} ${e.employee.lastName}`,
      payrollId: e.employee.payrollId,
      baseSalaryMonthly: e.employee.salaryAnnual / 12,
      salaryAnnual: e.employee.salaryAnnual,
      taxCode: e.employee.taxCode,
      niCategory: e.employee.niCategory,
      department: e.employee.department,
      overtimeHours: e.overtimeHours,
      bonus: e.bonus,
      commission: e.commission,
      gross: e.gross,
      status: e.status,
    })),
  }, { status: 201 });
}
