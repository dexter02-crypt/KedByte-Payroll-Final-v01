import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function PUT(req: NextRequest) {
  const { userId, currentPassword, newPassword } = await req.json();
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!currentPassword) return NextResponse.json({ error: "Current password required", fields: { currentPassword: "Required" } }, { status: 401 });
  if (!newPassword || newPassword.length < 12) return NextResponse.json({ error: "Password must be at least 12 characters", fields: { newPassword: "Min 12 chars" } }, { status: 422 });
  const breached = ["password12345", "qwerty123456", "letmein12345"];
  if (breached.includes(newPassword.toLowerCase())) return NextResponse.json({ error: "Password found in breach list", fields: { newPassword: "Breached" } }, { status: 422 });
  await db.user.update({ where: { id: userId }, data: { passwordHash: "$argon2id$demo$" + newPassword.length, tokenVersion: { increment: 1 } } });
  await db.notification.create({ data: { tenantId: "bureau_kedbyte", userId, type: "password_changed", title: "Your password was changed", body: "If this wasn't you, contact your bureau administrator immediately." } });
  return NextResponse.json({ ok: true, message: "Password changed — other sessions revoked" });
}
