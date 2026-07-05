import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const bankHolidays = await db.bankHoliday.findMany({
    orderBy: { date: "asc" },
  });
  return NextResponse.json({
    bankHolidays: bankHolidays.map((b) => ({
      date: b.date,
      region: b.region,
      name: b.name,
      bacsImpact: b.bacsImpact,
    })),
  });
}
