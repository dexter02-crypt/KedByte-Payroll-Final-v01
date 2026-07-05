import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || "gross-to-net";

  // Aggregate from committed pay runs
  const committedRuns = await db.payRun.findMany({
    where: { status: "committed", taxYear: "2026-27" },
  });

  const monthlyData: Record<number, { gross: number; tax: number; niEe: number; niEr: number; net: number; pensEe: number; pensEr: number; employerCost: number }> = {};
  for (const pr of committedRuns) {
    try {
      const t = JSON.parse(pr.totalsJson);
      if (!monthlyData[pr.taxPeriod]) monthlyData[pr.taxPeriod] = { gross: 0, tax: 0, niEe: 0, niEr: 0, net: 0, pensEe: 0, pensEr: 0, employerCost: 0 };
      monthlyData[pr.taxPeriod].gross += t.gross || 0;
      monthlyData[pr.taxPeriod].tax += t.tax || 0;
      monthlyData[pr.taxPeriod].niEe += t.niEe || 0;
      monthlyData[pr.taxPeriod].niEr += t.niEr || 0;
      monthlyData[pr.taxPeriod].net += t.net || 0;
      monthlyData[pr.taxPeriod].pensEe += t.pensEe || 0;
      monthlyData[pr.taxPeriod].pensEr += t.pensEr || 0;
      monthlyData[pr.taxPeriod].employerCost += t.employerCost || 0;
    } catch {}
  }

  const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const monthly = Object.keys(monthlyData).sort((a, b) => Number(a) - Number(b)).map((k) => ({
    period: Number(k),
    label: months[Number(k) - 1] || `M${k}`,
    ...monthlyData[Number(k)],
  }));

  // Totals
  const totals = monthly.reduce((acc, m) => ({
    gross: acc.gross + m.gross,
    tax: acc.tax + m.tax,
    niEe: acc.niEe + m.niEe,
    niEr: acc.niEr + m.niEr,
    net: acc.net + m.net,
    pensEe: acc.pensEe + m.pensEe,
    pensEr: acc.pensEr + m.pensEr,
    employerCost: acc.employerCost + m.employerCost,
  }), { gross: 0, tax: 0, niEe: 0, niEr: 0, net: 0, pensEe: 0, pensEr: 0, employerCost: 0 });

  // Department breakdown
  const entries = await db.payRunEntry.findMany({
    where: { payRun: { status: "committed" } },
    include: { employee: true },
  });
  const deptMap: Record<string, { gross: number; net: number; count: number }> = {};
  for (const e of entries) {
    const dept = e.employee.department || "Unassigned";
    if (!deptMap[dept]) deptMap[dept] = { gross: 0, net: 0, count: 0 };
    deptMap[dept].gross += e.gross || 0;
    deptMap[dept].net += e.net || 0;
    deptMap[dept].count += 1;
  }
  const departments = Object.entries(deptMap).map(([name, v]) => ({ name, ...v }));

  return NextResponse.json({
    type,
    monthly,
    totals,
    departments,
    p32: {
      // P32-style: tax + NI due per tax month
      months: monthly.map((m) => ({
        period: m.period,
        label: m.label,
        taxDue: m.tax,
        niEeDue: m.niEe,
        niErDue: m.niEr,
        totalDue: m.tax + m.niEe + m.niEr,
        employmentAllowance: 0,
        netDue: m.tax + m.niEe + m.niEr,
      })),
      totalDue: totals.tax + totals.niEe + totals.niEr,
    },
  });
}
