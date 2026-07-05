import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.employeeId) return NextResponse.json({ error: "No employee" }, { status: 400 });

  const holidays = await db.holiday.findMany({
    where: { employeeId: user.employeeId },
    orderBy: { startDate: "desc" },
  });
  const emp = await db.employee.findUnique({ where: { id: user.employeeId } });
  const pending = holidays.filter((h) => h.status === "pending").reduce((s, h) => s + h.days, 0);
  const approved = holidays.filter((h) => h.status === "approved").reduce((s, h) => s + h.days, 0);

  return NextResponse.json({
    holidays: holidays.map((h) => ({
      id: h.id,
      startDate: h.startDate,
      endDate: h.endDate,
      days: h.days,
      reason: h.reason,
      status: h.status,
      decidedAt: h.decidedAt,
      decisionNote: h.decisionNote,
    })),
    balance: (emp?.holidayEntitlementDays || 28) - (emp?.holidayUsedDays || 0) - pending,
    entitlement: emp?.holidayEntitlementDays || 28,
    used: emp?.holidayUsedDays || 0,
    pending,
  });
}

export async function POST(req: NextRequest) {
  const { userId, startDate, endDate, reason } = await req.json();
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.employeeId) return NextResponse.json({ error: "No employee" }, { status: 400 });

  const start = new Date(startDate);
  const end = new Date(endDate);
  // Calculate working days (Mon-Fri for simplicity)
  let days = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) days++;
    cur.setDate(cur.getDate() + 1);
  }

  const holiday = await db.holiday.create({
    data: {
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      startDate: start,
      endDate: end,
      days,
      reason,
      status: "pending",
    },
  });

  return NextResponse.json({ id: holiday.id, days, status: "pending" }, { status: 201 });
}
