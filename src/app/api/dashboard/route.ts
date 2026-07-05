import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const companies = await db.company.findMany({
    where: { status: { not: "deleted" } },
    orderBy: { name: "asc" },
  });

  let totalPayrollMonth = 0;
  let activeEmployees = 0;
  let pendingRti = 0;
  let overdueRti = 0;

  for (const c of companies) {
    const empCount = await db.employee.count({ where: { companyId: c.id, status: "active" } });
    activeEmployees += empCount;
  }

  // Current tax month committed totals
  const committedRuns = await db.payRun.findMany({
    where: { status: "committed", taxYear: "2026-27" },
  });
  for (const pr of committedRuns) {
    try {
      const t = JSON.parse(pr.totalsJson);
      totalPayrollMonth += t.net || 0;
    } catch {}
  }

  const rtiPending = await db.rtiSubmission.findMany({
    where: { status: { in: ["pending", "submitted", "polling", "rejected"] } },
  });
  pendingRti = rtiPending.length;
  overdueRti = rtiPending.filter((r) => {
    if (!r.pollAfter) return false;
    return new Date(r.pollAfter) < new Date();
  }).length;

  // Recent activity
  const recentEntries = await db.payRunEntry.findMany({
    where: { payRun: { status: "committed" } },
    include: { employee: true, payRun: { include: { company: true } } },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });
  const activity = recentEntries.map((e) => ({
    id: e.id,
    time: e.updatedAt,
    action: "Pay run committed",
    company: e.payRun.company.name,
    user: "Bureau Admin",
    status: "committed",
    net: e.net,
  }));

  // Next pay date
  const today = new Date();
  const futureRuns = await db.payRun.findMany({
    where: { payDate: { gte: today }, status: { in: ["draft", "calculating", "calculated", "review"] } },
    orderBy: { payDate: "asc" },
    take: 1,
  });
  const nextPayDate = futureRuns[0]?.payDate || null;
  const daysToPay = nextPayDate
    ? Math.ceil((new Date(nextPayDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Compliance
  const p60sDone = await db.document.count({ where: { type: "p60" } });

  return NextResponse.json({
    totalPayrollMonth,
    deltaPct: 4.2,
    activeEmployees,
    nextPayDate,
    daysToPay,
    pendingRti,
    overdueRti,
    companyCount: companies.length,
    compliance: {
      taxYear: "2025-26",
      p60s: { done: p60sDone, total: activeEmployees },
      p11ds: { done: 0, total: activeEmployees },
      finalFps: "pending",
      daysRemaining: 90,
    },
    activity,
    companies: companies.map((c) => ({ id: c.id, name: c.name, payeRef: c.payeRef, status: c.status })),
  });
}
