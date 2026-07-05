import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const taxYear = req.nextUrl.searchParams.get("taxYear") || "2026-27";
  const submissions = await db.rtiSubmission.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const companies = await db.company.findMany();
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));

  const result = [];
  for (const s of submissions) {
    const entries = await db.payRunEntry.findMany({
      where: { payRunId: s.payRunId || "" },
    });
    const totalPay = entries.reduce((sum, e) => sum + (e.gross || 0), 0);
    const totalTax = entries.reduce((sum, e) => sum + (e.tax || 0), 0);
    result.push({
      id: s.id,
      type: s.type,
      taxYear: s.taxYear,
      taxPeriod: s.taxPeriod,
      companyId: s.companyId,
      companyName: companyMap.get(s.companyId) || "—",
      status: s.status,
      irmark: s.irmark,
      correlationId: s.correlationId,
      submittedAt: s.submittedAt,
      resolvedAt: s.resolvedAt,
      errorCode: s.errorCode,
      errorText: s.errorText,
      totalPay,
      totalTax,
      employeeCount: entries.length,
    });
  }

  const errorDict = await db.rtiErrorDictionary.findMany();

  return NextResponse.json({ submissions: result, errorDictionary: errorDict });
}
