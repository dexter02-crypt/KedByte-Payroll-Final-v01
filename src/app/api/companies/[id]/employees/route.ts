import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employees = await db.employee.findMany({
    where: { companyId: id, status: { not: "deleted" } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return NextResponse.json({
    employees: employees.map((e) => ({
      id: e.id,
      payrollId: e.payrollId,
      firstName: e.firstName,
      lastName: e.lastName,
      name: `${e.firstName} ${e.lastName}`,
      email: e.email,
      nino: e.nino,
      department: e.department,
      jobTitle: e.jobTitle,
      salaryAnnual: e.salaryAnnual,
      taxCode: e.taxCode,
      taxBasis: e.taxBasis,
      niCategory: e.niCategory,
      employmentType: e.employmentType,
      pensionStatus: e.pensionStatus,
      studentLoanPlan: e.studentLoanPlan,
      postgradLoan: e.postgradLoan,
      status: e.status,
      startDate: e.startDate,
      holidayEntitlementDays: e.holidayEntitlementDays,
      holidayUsedDays: e.holidayUsedDays,
    })),
  });
}
