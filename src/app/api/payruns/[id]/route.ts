import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payRun = await db.payRun.findUnique({
    where: { id },
    include: { company: true },
  });
  if (!payRun) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entries = await db.payRunEntry.findMany({
    where: { payRunId: id },
    include: { employee: true },
    orderBy: { employee: { lastName: "asc" } },
  });

  let totals = { gross: 0, tax: 0, niEe: 0, niEr: 0, pensEe: 0, pensEr: 0, net: 0, employerCost: 0, sl: 0, pgl: 0 };
  try { totals = JSON.parse(payRun.totalsJson); } catch {}

  return NextResponse.json({
    id: payRun.id,
    ref: `PR-2026-${String(payRun.taxPeriod).padStart(2, "0")}`,
    companyId: payRun.companyId,
    companyName: payRun.company.name,
    taxYear: payRun.taxYear,
    taxPeriod: payRun.taxPeriod,
    periodStart: payRun.periodStart,
    periodEnd: payRun.periodEnd,
    payDate: payRun.payDate,
    bacsSubmissionDate: payRun.bacsSubmissionDate,
    status: payRun.status,
    totals,
    entries: entries.map((e) => ({
      id: e.id,
      employeeId: e.employeeId,
      name: `${e.employee.firstName} ${e.employee.lastName}`,
      payrollId: e.employee.payrollId,
      department: e.employee.department,
      salaryAnnual: e.employee.salaryAnnual,
      taxCode: e.employee.taxCode,
      niCategory: e.employee.niCategory,
      studentLoanPlan: e.employee.studentLoanPlan,
      postgradLoan: e.employee.postgradLoan,
      overtimeHours: e.overtimeHours,
      overtimeMultiplier: e.overtimeMultiplier,
      bonus: e.bonus,
      commission: e.commission,
      statutoryPay: e.statutoryPay,
      gross: e.gross,
      taxableGross: e.taxableGross,
      niableGross: e.niableGross,
      tax: e.tax,
      niEmployee: e.niEmployee,
      niEmployer: e.niEmployer,
      pensionEmployee: e.pensionEmployee,
      pensionEmployer: e.pensionEmployer,
      studentLoan: e.studentLoan,
      postgradLoan: e.postgradLoan,
      net: e.net,
      variancePct: e.variancePct,
      varianceFlag: e.varianceFlag,
      status: e.status,
      rejectReason: e.rejectReason,
    })),
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { entries } = await req.json();

  for (const e of entries) {
    await db.payRunEntry.update({
      where: { id: e.id },
      data: {
        overtimeHours: e.overtimeHours || 0,
        bonus: e.bonus || 0,
        commission: e.commission || 0,
        statutoryPay: e.statutoryPay || 0,
        adjustmentsJson: JSON.stringify(e.adjustments || []),
      },
    });
  }

  // Recompute provisional gross for echo
  const updatedEntries = await db.payRunEntry.findMany({
    where: { payRunId: id },
    include: { employee: true },
  });
  const echo = updatedEntries.map((e) => {
    const basic = e.employee.salaryAnnual / 12;
    const hourly = e.employee.salaryAnnual / 52 / e.employee.contractedWeeklyHours;
    const overtime = (e.overtimeHours || 0) * hourly * (e.overtimeMultiplier || 1.5);
    const gross = Math.round((basic + overtime + (e.bonus || 0) + (e.commission || 0) + (e.statutoryPay || 0)) * 100) / 100;
    return { id: e.id, gross };
  });

  return NextResponse.json({ ok: true, echo });
}
