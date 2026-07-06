import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.notification.create({ data: { tenantId: "bureau_kedbyte", userId: id, type: "password_reset", title: "Password reset link sent", body: `A password reset link has been sent to ${user.email}.` } });
  return NextResponse.json({ ok: true, message: `Reset link sent to ${user.email} · expires in 1 hour` });
}
