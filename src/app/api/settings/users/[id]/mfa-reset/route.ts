import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.user.update({ where: { id }, data: { mfaEnabled: false, mfaSecret: null } });
  await db.notification.create({ data: { tenantId: "bureau_kedbyte", userId: id, type: "mfa_reset", title: "MFA reset by admin", body: "Your multi-factor authentication has been reset." } });
  return NextResponse.json({ ok: true, message: "MFA cleared — user notified to re-enrol at next login" });
}
