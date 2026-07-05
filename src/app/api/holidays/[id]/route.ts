import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "approve" || id === "reject") {
    // Manager approvals list
    const userId = _req.nextUrl.searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user?.employeeId) return NextResponse.json({ error: "No employee" }, { status: 400 });

    // Direct reports' pending holidays
    const reports = await db.employee.findMany({
      where: { managerId: user.employeeId },
    });
    const reportIds = reports.map((r) => r.id);
    const pending = await db.holiday.findMany({
      where: { employeeId: { in: reportIds }, status: "pending" },
      include: { employee: true },
      orderBy: { startDate: "asc" },
    });
    return NextResponse.json({
      pending: pending.map((h) => ({
        id: h.id,
        employeeId: h.employeeId,
        employeeName: `${h.employee.firstName} ${h.employee.lastName}`,
        department: h.employee.department,
        startDate: h.startDate,
        endDate: h.endDate,
        days: h.days,
        reason: h.reason,
      })),
      reportCount: reports.length,
    });
  }

  // Approve/reject a specific holiday
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  if (id === "approve" || id === "reject") {
    const { holidayId, note, approverId } = body;
    const status = id === "approve" ? "approved" : "rejected";
    const holiday = await db.holiday.update({
      where: { id: holidayId },
      data: { status, approverId, decidedAt: new Date(), decisionNote: note },
      include: { employee: true },
    });

    // If approved, increment used days
    if (status === "approved") {
      await db.employee.update({
        where: { id: holiday.employeeId },
        data: { holidayUsedDays: { increment: holiday.days } },
      });
    }

    // Notify employee
    const empUser = await db.user.findFirst({ where: { employeeId: holiday.employeeId } });
    if (empUser) {
      await db.notification.create({
        data: {
          tenantId: holiday.tenantId,
          userId: empUser.id,
          type: "holiday_decision",
          title: `Holiday ${status}`,
          body: `Your request (${holiday.startDate.toISOString().slice(0, 10)} to ${holiday.endDate.toISOString().slice(0, 10)}) was ${status}.${note ? " Note: " + note : ""}`,
        },
      });
    }

    return NextResponse.json({ ok: true, status });
  }

  return NextResponse.json({ ok: true });
}
