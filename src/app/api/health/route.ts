import { NextResponse } from "next/server";
import { db } from "@/lib/db";

<<<<<<< HEAD
export async function GET() {
  try {
    await db.bureau.count();
    return NextResponse.json({ status: "ok", timestamp: new Date().toISOString(), service: "kedbyte-payroll", version: "1.0.0", taxYear: "2026-27", db: "connected" });
  } catch (e: any) {
    return NextResponse.json({ status: "degraded", db: "error", error: e.message }, { status: 503 });
=======
// GET /api/health — liveness + readiness probe
export async function GET() {
  try {
    // DB readiness check
    await db.bureau.count();
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "kedbyte-payroll",
      version: "1.0.0",
      taxYear: "2026-27",
      db: "connected",
    });
  } catch (e: any) {
    return NextResponse.json({
      status: "degraded",
      timestamp: new Date().toISOString(),
      service: "kedbyte-payroll",
      version: "1.0.0",
      db: "error",
      error: e.message,
    }, { status: 503 });
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
  }
}
