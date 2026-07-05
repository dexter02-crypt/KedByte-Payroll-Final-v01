import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  const employees = await db.employee.findMany({
    where: companyId ? { companyId, status: "active" } : { status: "active" },
    include: { aeAssessments: { orderBy: { assessedOn: "desc" }, take: 1 } },
  });

  const result = employees.map((e) => {
    const age = new Date().getFullYear() - new Date(e.dob).getFullYear();
    const lastAssessment = e.aeAssessments[0];
    return {
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      dob: e.dob,
      age,
      salaryAnnual: e.salaryAnnual,
      pensionStatus: e.pensionStatus,
      pensionEnrolmentDate: e.pensionEnrolmentDate,
      pensionOptoutDate: e.pensionOptoutDate,
      assessment: lastAssessment ? {
        result: lastAssessment.result,
        action: lastAssessment.action,
        assessedOn: lastAssessment.assessedOn,
      } : null,
    };
  });

  const eligible = result.filter((e) => e.assessment?.result === "eligible").length;
  const enrolled = result.filter((e) => e.pensionStatus === "enrolled").length;
  const optedOut = result.filter((e) => e.pensionStatus === "opted_out").length;

  return NextResponse.json({
    employees: result,
    stats: { eligible, enrolled, optedOut, total: result.length, lastAssessment: "04 Jul 2026 06:00" },
  });
}

export async function POST(req: NextRequest) {
  const { action, employeeId, receivedDate } = await req.json();
  if (action === "optout") {
    const emp = await db.employee.findUnique({ where: { id: employeeId } });
    if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const enrolDate = emp.pensionEnrolmentDate;
    const withinWindow = enrolDate && (Date.now() - enrolDate.getTime()) < 30 * 24 * 60 * 60 * 1000;
    await db.employee.update({
      where: { id: employeeId },
      data: { pensionStatus: "opted_out", pensionOptoutDate: new Date(receivedDate) },
    });
    return NextResponse.json({ mode: withinWindow ? "refund" : "cessation" });
  }
  if (action === "assess") {
    return NextResponse.json({ jobId: "assess-" + Date.now() });
  }
  return NextResponse.json({ ok: true });
}
