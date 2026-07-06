import { NextRequest, NextResponse } from "next/server";
<<<<<<< HEAD
import { db } from "@/lib/db";
import { maskNINO } from "@/engine/payroll";

// GET /api/pensions/contributions/export?payRunId=&format=papdis|nest-csv
export async function GET(req: NextRequest) {
  const payRunId = req.nextUrl.searchParams.get("payRunId");
  const format = req.nextUrl.searchParams.get("format") || "papdis";
  if (!payRunId) return NextResponse.json({ error: "payRunId required" }, { status: 400 });

  const payRun = await db.payRun.findUnique({ where: { id: payRunId }, include: { company: true } });
  if (!payRun) return NextResponse.json({ error: "Pay run not found" }, { status: 404 });
  if (payRun.status !== "committed") return NextResponse.json({ error: "Commit the pay run first — contribution files come from committed figures" }, { status: 409 });

  const entries = await db.payRunEntry.findMany({ where: { payRunId, status: "approved", pensionEmployee: { gt: 0 } }, include: { employee: true } });
  const slug = payRun.company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const period = `M${String(payRun.taxPeriod).padStart(2, "0")}`;

  const BOM = "\uFEFF";
  let csv: string;
  let fileName: string;

  if (format === "nest-csv") {
    const rows = entries.map((e) => [e.employee.nino || "", e.employee.payrollId, e.employee.firstName, e.employee.lastName, (e.niableGross || 0).toFixed(2), (e.pensionEmployee ? e.pensionEmployee / 0.8 : 0).toFixed(2), (e.pensionEmployer || 0).toFixed(2), ""]);
    csv = BOM + ["NINO,AlternativeUniqueID,Forename,Surname,PensionableEarnings,EmployeeContribution,EmployerContribution,ReasonForPartialOrNonPayment", ...rows.map((r) => r.map((v) => /[",\n]/.test(String(v)) ? `"${v}"` : v).join(","))].join("\r\n") + "\r\n";
    fileName = `nest-contributions-${slug}-${payRun.taxYear}-${period}.csv`;
  } else {
    const rows = entries.map((e) => ["1.1", payRun.company.id, payRun.periodStart.toISOString().slice(0, 10), payRun.periodEnd.toISOString().slice(0, 10), payRun.payDate.toISOString().slice(0, 10), "M1", e.employee.nino || "", "", e.employee.firstName, e.employee.lastName, e.employee.gender || "", e.employee.dob.toISOString().slice(0, 10), e.employee.addressLine1 || "", "", e.employee.addressCity || "", e.employee.addressPostcode || "", e.employee.email || "", (e.niableGross || 0).toFixed(2), (e.pensionEmployee ? e.pensionEmployee / 0.8 : 0).toFixed(2), (e.pensionEmployer || 0).toFixed(2), e.employee.pensionStatus === "enrolled" ? "1" : "3", "", "", e.employee.pensionOptoutDate ? e.employee.pensionOptoutDate.toISOString().slice(0, 10) : "", ""]);
    csv = BOM + ["PapdisVersion,EmployerId,PayrollPeriodStartDate,PayrollPeriodEndDate,ContributionDeductionDate,FrequencyCode,NINO,Title,Forename,Surname,Gender,BirthDate,AddressLine1,AddressLine2,City,Postcode,EmailAddress,PensionableEarnings,EmployeeContributionsAmount,EmployerContributionsAmount,AssessmentCode,EventCode,EventDate,OptOutDate,DeferralDate", ...rows.map((r) => r.map((v) => /[",\n]/.test(String(v)) ? `"${v}"` : v).join(","))].join("\r\n") + "\r\n";
    fileName = `papdis-${slug}-${payRun.taxYear}-${period}.csv`;
  }

  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${fileName}"` } });
=======
import { runExport, papdisSpec, nestCsvSpec } from "@/server/exports";

// GET /api/pensions/contributions/export?payRunId=&format=papdis|nest-csv
// E1 PAPDIS / E2 NEST CSV — MODE A (rows = enrolled employees in the run)
export async function GET(req: NextRequest) {
  const payRunId = req.nextUrl.searchParams.get("payRunId");
  const format = (req.nextUrl.searchParams.get("format") || "papdis") as "papdis" | "nest-csv";
  if (!payRunId) return NextResponse.json({ error: "payRunId required" }, { status: 400 });

  const ctx = { tenantId: "bureau_kedbyte", userId: "user_admin" };
  try {
    const spec = format === "papdis" ? await papdisSpec(payRunId, ctx.tenantId) : await nestCsvSpec(payRunId, ctx.tenantId);
    const r = await runExport(spec, ctx);
    if (r.mode === "direct") {
      return new NextResponse(r.body, {
        headers: {
          "Content-Type": r.contentType,
          "Content-Disposition": `attachment; filename="${r.filename}"`,
        },
      });
    }
    return NextResponse.json({ jobId: r.jobId }, { status: 202 });
  } catch (e: any) {
    if (e.message?.startsWith("409:")) {
      return NextResponse.json({ error: e.message.slice(4) }, { status: 409 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
}
