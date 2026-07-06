import { NextRequest, NextResponse } from "next/server";
<<<<<<< HEAD
import { db } from "@/lib/db";
import { maskNINO } from "@/engine/payroll";

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  const where = companyId ? { companyId, status: "active" } : { status: "active" };
  const employees = await db.employee.findMany({ where, include: { aeAssessments: { orderBy: { assessedOn: "desc" }, take: 1 } } });
  const company = companyId ? await db.company.findUnique({ where: { id: companyId } }) : null;
  const slug = company ? company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "all-companies";
  const BOM = "\uFEFF";
  const rows = employees.map((e) => {
    const age = new Date().getFullYear() - new Date(e.dob).getFullYear();
    const lastAssessment = e.aeAssessments[0];
    return [`${e.firstName} ${e.lastName}`, e.payrollId, maskNINO(e.nino), e.dob.toISOString().slice(0, 10), age, e.salaryAnnual, (e.salaryAnnual / 12).toFixed(2), lastAssessment?.result || "not_assessed", lastAssessment ? lastAssessment.assessedOn.toISOString().slice(0, 10) : "", e.pensionStatus, e.pensionEnrolmentDate ? e.pensionEnrolmentDate.toISOString().slice(0, 10) : "", e.pensionOptoutDate ? e.pensionOptoutDate.toISOString().slice(0, 10) : "", lastAssessment?.postponementEnd ? lastAssessment.postponementEnd.toISOString().slice(0, 10) : ""];
  });
  const csv = BOM + ["Employee,PayrollId,NINO(masked),DOB,Age,AnnualisedEarnings,MonthlyEarnings,AssessmentResult,AssessedOn,PensionStatus,EnrolmentDate,OptOutDate,PostponementEnd", ...rows.map((r) => r.map((v) => /[",\n]/.test(String(v)) ? `"${v}"` : v).join(",")).join("\r\n")].join("\r\n") + "\r\n";
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ae-assessment-${slug}-${new Date().toISOString().slice(0, 10)}.csv"` } });
=======
import { runExport, aeReportSpec } from "@/server/exports";

// GET /api/pensions/assessment/export?companyId=
// E3 AE assessment report — MODE A, masked NINO
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  const ctx = { tenantId: "bureau_kedbyte", userId: "user_admin" };
  const spec = await aeReportSpec(companyId, ctx.tenantId);
  const r = await runExport(spec, ctx);
  if (r.mode === "direct") {
    return new NextResponse(r.body, {
      headers: { "Content-Type": r.contentType, "Content-Disposition": `attachment; filename="${r.filename}"` },
    });
  }
  return NextResponse.json({ jobId: r.jobId }, { status: 202 });
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
}
