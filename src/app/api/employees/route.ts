import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assessAutoEnrolment, parseTaxCode, validateNINO } from "@/engine/payroll";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const bureau = await db.bureau.findFirst();
  if (!bureau) return NextResponse.json({ error: "No bureau" }, { status: 500 });

  // Validate NINO if provided
  if (body.nino && !validateNINO(body.nino)) {
    return NextResponse.json({ error: "Invalid NINO format", fields: { nino: "Must match HMRC format (e.g. AB123456C)" } }, { status: 422 });
  }

  // Validate tax code if provided (try parse)
  if (body.taxCode) {
    try { parseTaxCode(body.taxCode); } catch {
      return NextResponse.json({ error: "Invalid tax code", fields: { taxCode: "Unrecognised tax code format" } }, { status: 422 });
    }
  }

  // Generate payroll ID
  const count = await db.employee.count({ where: { companyId: body.companyId } });
  const payrollId = `EMP-${String(count + 1).padStart(5, "0")}`;

  // Tax code from starter declaration if not provided
  let taxCode = body.taxCode || "1257L";
  let taxBasis = "cumul";
  if (!body.p45 && body.starterDeclaration) {
    if (body.starterDeclaration === "A") { taxCode = "1257L"; taxBasis = "cumul"; }
    else if (body.starterDeclaration === "B") { taxCode = "1257L"; taxBasis = "w1m1"; }
    else if (body.starterDeclaration === "C") { taxCode = "BR"; taxBasis = "w1m1"; }
  }

  // AE assessment
  const dob = new Date(body.dob);
  const age = new Date().getFullYear() - dob.getFullYear();
  const monthlyEarnings = body.salaryAnnual / 12;
  const ae = assessAutoEnrolment(age, monthlyEarnings);

  const employee = await db.employee.create({
    data: {
      tenantId: bureau.id,
      companyId: body.companyId,
      payrollId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      dob,
      gender: body.gender,
      nino: body.nino,
      addressLine1: body.address?.line1,
      addressCity: body.address?.city,
      addressPostcode: body.address?.postcode,
      startDate: new Date(body.startDate),
      starterDeclaration: body.starterDeclaration,
      p45PrevPay: body.p45?.prevPay,
      p45PrevTax: body.p45?.prevTax,
      p45TaxCode: body.p45?.taxCode,
      salaryAnnual: body.salaryAnnual,
      contractedWeeklyHours: body.contractedWeeklyHours || 37.5,
      department: body.department,
      jobTitle: body.jobTitle,
      employmentType: body.employmentType || "full_time",
      taxCode,
      taxBasis,
      niCategory: body.niCategory || "A",
      studentLoanPlan: body.studentLoanPlan,
      postgradLoan: body.postgradLoan || false,
      bankSortCode: body.bank?.sortCode?.replace(/[-\s]/g, ""),
      bankAccount: body.bank?.account,
      bankAccountName: body.bank?.name,
      pensionStatus: ae.result === "eligible" ? "enrolled" : ae.result,
      pensionEnrolmentDate: ae.result === "eligible" ? new Date(body.startDate) : null,
      holidayEntitlementDays: 28,
      status: body.status || "active",
    },
  });

  // Create AE assessment record
  await db.aeAssessment.create({
    data: {
      tenantId: bureau.id,
      employeeId: employee.id,
      assessedOn: new Date(),
      age,
      monthlyEarnings,
      result: ae.result,
      action: ae.action,
      postponementEnd: ae.action === "postponed" ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) : null,
    },
  });

  return NextResponse.json({
    id: employee.id,
    payrollId,
    taxCode,
    taxBasis,
    aeAssessment: { result: ae.result, enrolmentDate: ae.result === "eligible" ? body.startDate : null },
  }, { status: 201 });
}
