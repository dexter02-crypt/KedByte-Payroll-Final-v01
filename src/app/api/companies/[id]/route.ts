import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await db.company.findUnique({ where: { id } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const employees = await db.employee.findMany({
    where: { companyId: id, status: { not: "deleted" } },
    orderBy: { lastName: "asc" },
  });
  const payRuns = await db.payRun.findMany({
    where: { companyId: id },
    orderBy: { taxPeriod: "desc" },
    take: 12,
  });
  const pensionSchemes = await db.pensionScheme.findMany({ where: { companyId: id } });
  return NextResponse.json({ company, employees, payRuns, pensionSchemes });
}
