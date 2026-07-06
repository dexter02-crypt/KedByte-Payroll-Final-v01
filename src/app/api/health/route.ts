import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await db.bureau.count();
    return NextResponse.json({ status: "ok", timestamp: new Date().toISOString(), service: "kedbyte-payroll", version: "1.0.0", taxYear: "2026-27", db: "connected" });
  } catch (e: any) {
    return NextResponse.json({ status: "degraded", db: "error", error: e.message }, { status: 503 });
  }
}
