import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.user.update({ where: { id }, data: { failedLogins: 0, lockedUntil: null, status: "active" } });
  return NextResponse.json({ ok: true, message: "Account unlocked — failed login counter reset" });
}
