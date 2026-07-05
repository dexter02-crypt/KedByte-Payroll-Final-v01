import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.employeeId) return NextResponse.json({ error: "No employee" }, { status: 400 });

  const docs = await db.document.findMany({
    where: { employeeId: user.employeeId },
    orderBy: { generatedAt: "desc" },
  });

  const result = [];
  for (const d of docs) {
    let entry = null;
    if (d.payRunEntryId) {
      entry = await db.payRunEntry.findUnique({
        where: { id: d.payRunEntryId },
        include: { payRun: true },
      });
    }
    result.push({
      id: d.id,
      type: d.type,
      taxYear: d.taxYear,
      generatedAt: d.generatedAt,
      sha256: d.sha256,
      storageKey: d.storageKey,
      payRunEntryId: d.payRunEntryId,
      net: entry?.net,
      gross: entry?.gross,
      tax: entry?.tax,
      niEmployee: entry?.niEmployee,
      pensionEmployee: entry?.pensionEmployee,
      studentLoan: entry?.studentLoan,
      period: entry?.payRun.taxPeriod,
      companyName: entry?.payRun.companyId,
    });
  }

  return NextResponse.json({ payslips: result });
}
