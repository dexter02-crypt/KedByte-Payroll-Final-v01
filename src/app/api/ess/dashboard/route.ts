import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.employeeId) return NextResponse.json({ error: "No employee linked" }, { status: 400 });

  const employee = await db.employee.findUnique({
    where: { id: user.employeeId },
    include: { company: true },
  });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  // YTD figures
  const ytd = await db.ytdFigure.findUnique({
    where: { employeeId_taxYear: { employeeId: employee.id, taxYear: "2026-27" } },
  });

  // Latest payslip
  const latestDoc = await db.document.findFirst({
    where: { employeeId: employee.id, type: "payslip" },
    orderBy: { generatedAt: "desc" },
  });
  const latestEntry = latestDoc?.payRunEntryId
    ? await db.payRunEntry.findUnique({ where: { id: latestDoc.payRunEntryId } })
    : null;

  // Recent payslips
  const docs = await db.document.findMany({
    where: { employeeId: employee.id, type: "payslip" },
    orderBy: { generatedAt: "desc" },
    take: 6,
  });

  // Holidays
  const holidays = await db.holiday.findMany({
    where: { employeeId: employee.id },
    orderBy: { startDate: "desc" },
  });
  const pendingHolidays = holidays.filter((h) => h.status === "pending").reduce((s, h) => s + h.days, 0);
  const approvedHolidays = holidays.filter((h) => h.status === "approved").reduce((s, h) => s + h.days, 0);
  const holidayBalance = employee.holidayEntitlementDays - employee.holidayUsedDays - pendingHolidays;

  // Next pay date
  const nextRun = await db.payRun.findFirst({
    where: { companyId: employee.companyId, payDate: { gte: new Date() } },
    orderBy: { payDate: "asc" },
  });

  // Notifications
  const notifications = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return NextResponse.json({
    employee: {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      firstName: employee.firstName,
      company: employee.company.name,
      department: employee.department,
      jobTitle: employee.jobTitle,
      payrollId: employee.payrollId,
    },
    nextPayDate: nextRun?.payDate || null,
    latestNet: latestEntry?.net || null,
    latestPayDate: latestDoc?.generatedAt || null,
    ytd: ytd || { gross: 0, taxable: 0, taxPaid: 0, niEe: 0, net: 0, pensionEe: 0, studentLoan: 0 },
    payslips: docs.map((d) => ({ id: d.id, taxYear: d.taxYear, generatedAt: d.generatedAt, payRunEntryId: d.payRunEntryId })),
    holidayBalance,
    holidayEntitlement: employee.holidayEntitlementDays,
    holidayUsed: employee.holidayUsedDays,
    pendingHolidays,
    notifications,
    isManager: user.isManager,
  });
}
