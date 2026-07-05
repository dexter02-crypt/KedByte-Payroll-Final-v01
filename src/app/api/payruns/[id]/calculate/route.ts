import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateEmployee } from "@/engine/payroll";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payRun = await db.payRun.findUnique({
    where: { id },
    include: { company: true },
  });
  if (!payRun) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.payRun.update({ where: { id }, data: { status: "calculating" } });

  const entries = await db.payRunEntry.findMany({
    where: { payRunId: id },
    include: { employee: true },
  });

  const pensionScheme = await db.pensionScheme.findFirst({
    where: { companyId: payRun.companyId, status: "active" },
  });

  let totals = { gross: 0, tax: 0, niEe: 0, niEr: 0, pensEe: 0, pensEr: 0, net: 0, employerCost: 0, sl: 0, pgl: 0 };
  let errors = 0;
  const progressLog: { i: number; total: number; employeeId: string; line: string }[] = [];

  let i = 0;
  for (const entry of entries) {
    i++;
    const emp = entry.employee;

    // YTD figures
    const ytd = await db.ytdFigure.findUnique({
      where: { employeeId_taxYear: { employeeId: emp.id, taxYear: "2026-27" } },
    });

    // Previous net for variance
    const prevEntries = await db.payRunEntry.findMany({
      where: { employeeId: emp.id, payRun: { status: "committed" } },
      orderBy: { updatedAt: "desc" },
      take: 1,
    });
    const prevNet = prevEntries[0]?.net;

    try {
      const result = calculateEmployee({
        salaryAnnual: emp.salaryAnnual,
        contractedWeeklyHours: emp.contractedWeeklyHours,
        taxCode: emp.taxCode,
        niCategory: emp.niCategory,
        studentLoanPlan: emp.studentLoanPlan,
        postgradLoan: emp.postgradLoan,
        pensionEnrolled: emp.pensionStatus === "enrolled" && !!pensionScheme,
        period: payRun.taxPeriod,
        overtimeHours: entry.overtimeHours || 0,
        overtimeMultiplier: entry.overtimeMultiplier || 1.5,
        bonus: entry.bonus || 0,
        commission: entry.commission || 0,
        statutoryPay: entry.statutoryPay || 0,
        adjustments: [],
        ytdTaxable: ytd?.taxable || 0,
        ytdTaxPaid: ytd?.taxPaid || 0,
        pensionBasis: pensionScheme?.basis || "qualifying_earnings",
        pensionRelief: pensionScheme?.relief || "relief_at_source",
        pensionEeRate: pensionScheme?.eeRate || 0.05,
        pensionErRate: pensionScheme?.erRate || 0.03,
        prevNet: prevNet || undefined,
      });

      await db.payRunEntry.update({
        where: { id: entry.id },
        data: {
          gross: result.gross,
          taxableGross: result.taxableGross,
          niableGross: result.niableGross,
          tax: result.tax,
          niEmployee: result.niEmployee,
          niEmployer: result.niEmployer,
          pensionEmployee: result.pensionEmployee,
          pensionEmployer: result.pensionEmployer,
          studentLoan: result.studentLoan,
          postgradLoan: result.postgradLoan,
          net: result.net,
          earningsAtLel: result.earningsAtLel,
          earningsLelPt: result.earningsLelPt,
          earningsPtUel: result.earningsPtUel,
          variancePct: result.variancePct,
          varianceFlag: result.varianceFlag,
          prevNet: prevNet,
          status: "calculated",
        },
      });

      totals.gross += result.gross;
      totals.tax += result.tax;
      totals.niEe += result.niEmployee;
      totals.niEr += result.niEmployer;
      totals.pensEe += result.pensionEmployee;
      totals.pensEr += result.pensionEmployer;
      totals.net += result.net;
      totals.employerCost += result.employerCost;
      totals.sl += result.studentLoan;
      totals.pgl += result.postgradLoan;

      const lastLog = result.log[result.log.length - 1];
      progressLog.push({ i, total: entries.length, employeeId: emp.id, line: lastLog?.text || "" });
    } catch (e: any) {
      errors++;
      await db.payRunEntry.update({
        where: { id: entry.id },
        data: { status: "error", rejectReason: e.message },
      });
    }
  }

  // Round totals
  for (const k of Object.keys(totals)) (totals as any)[k] = Math.round((totals as any)[k] * 100) / 100;

  await db.payRun.update({
    where: { id },
    data: { status: "calculated", totalsJson: JSON.stringify(totals), calculatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, totals, errors, progressLog });
}
