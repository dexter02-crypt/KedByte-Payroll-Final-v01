import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.employeeId) return NextResponse.json({ error: "No employee" }, { status: 400 });
  const emp = await db.employee.findUnique({ where: { id: user.employeeId } });
  return NextResponse.json({
    employee: emp ? {
      id: emp.id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone,
      emergencyContact: emp.emergencyContact,
      addressLine1: emp.addressLine1,
      addressCity: emp.addressCity,
      addressPostcode: emp.addressPostcode,
      bankSortCode: emp.bankSortCode,
      bankAccount: emp.bankAccount,
      bankAccountName: emp.bankAccountName,
      nino: emp.nino,
      dob: emp.dob,
      department: emp.department,
      jobTitle: emp.jobTitle,
    } : null,
  });
}

export async function PUT(req: NextRequest) {
  const { userId, fields, bankChange } = await req.json();
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.employeeId) return NextResponse.json({ error: "No employee" }, { status: 400 });

  if (bankChange) {
    // 24h cooling-off
    const activatesAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.pendingBankChange.create({
      data: {
        tenantId: user.tenantId,
        employeeId: user.employeeId,
        sortCode: bankChange.sortCode,
        account: bankChange.account,
        accountName: bankChange.name,
        requestedBy: userId,
        activatesAt,
        status: "pending",
      },
    });
    // Apply immediately for demo (in prod, scheduler applies at activatesAt)
    await db.employee.update({
      where: { id: user.employeeId },
      data: {
        bankSortCode: bankChange.sortCode,
        bankAccount: bankChange.account,
        bankAccountName: bankChange.name,
      },
    });
    return NextResponse.json({ activatesAt, coolingOff: true });
  }

  if (fields) {
    await db.employee.update({
      where: { id: user.employeeId },
      data: {
        addressLine1: fields.addressLine1,
        addressCity: fields.addressCity,
        addressPostcode: fields.addressPostcode,
        phone: fields.phone,
        emergencyContact: fields.emergencyContact,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
