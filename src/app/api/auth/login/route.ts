import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { email, surface } = await req.json();
  const user = await db.user.findUnique({
    where: { email: (email || "").toLowerCase().trim() },
  });
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  if (surface === "bureau" && user.role === "employee") {
    return NextResponse.json({ error: "This account is an employee account. Use the Employee Portal." }, { status: 403 });
  }
  if (surface === "portal" && user.role !== "employee") {
    return NextResponse.json({ error: "This is a bureau account. Use the Bureau Portal." }, { status: 403 });
  }

  let name = user.email.split("@")[0];
  if (user.employeeId) {
    const emp = await db.employee.findUnique({ where: { id: user.employeeId } });
    if (emp) name = `${emp.firstName} ${emp.lastName}`;
  }

  await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name,
      surface: surface || (user.role === "employee" ? "portal" : "bureau"),
      companyId: user.companyId,
      employeeId: user.employeeId,
      isManager: user.isManager,
    },
  });
}
