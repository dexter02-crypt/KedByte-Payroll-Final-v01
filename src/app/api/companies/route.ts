import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const companies = await db.company.findMany({
    where: { status: { not: "deleted" } },
    orderBy: { name: "asc" },
  });
  const result = [];
  for (const c of companies) {
    const empCount = await db.employee.count({ where: { companyId: c.id, status: "active" } });
    const latestRun = await db.payRun.findFirst({
      where: { companyId: c.id },
      orderBy: { payDate: "desc" },
    });
    result.push({
      id: c.id,
      name: c.name,
      payeRef: c.payeRef,
      accountsOfficeRef: c.accountsOfficeRef,
      region: c.region,
      paySchedule: c.paySchedule,
      status: c.status,
      employeeCount: empCount,
      nextPayDate: latestRun?.payDate || null,
    });
  }
  return NextResponse.json({ companies: result });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const bureau = await db.bureau.findFirst();
  if (!bureau) return NextResponse.json({ error: "No bureau" }, { status: 500 });

  const company = await db.company.create({
    data: {
      tenantId: bureau.id,
      name: body.name,
      payeRef: body.payeRef,
      accountsOfficeRef: body.accountsOfficeRef,
      addressLine1: body.address?.line1,
      addressCity: body.address?.city,
      addressPostcode: body.address?.postcode,
      bankSortCode: body.bank?.sortCode?.replace(/[-\s]/g, ""),
      bankAccount: body.bank?.account,
      bankAccountName: body.bank?.name,
      region: body.region || "england_wales",
      paySchedule: body.paySchedule?.rule || "monthly_last_working_day",
      payDateDay: body.paySchedule?.day,
      earlyPay: body.paySchedule?.earlyPay ?? true,
      status: "active",
    },
  });

  // Seed pension scheme
  if (body.pension) {
    await db.pensionScheme.create({
      data: {
        tenantId: bureau.id,
        companyId: company.id,
        provider: body.pension.provider,
        basis: body.pension.basis || "qualifying_earnings",
        relief: body.pension.relief || "relief_at_source",
        eeRate: body.pension.eeRate ?? 0.05,
        erRate: body.pension.erRate ?? 0.03,
      },
    });
  }

  return NextResponse.json({ id: company.id, ...company }, { status: 201 });
}
