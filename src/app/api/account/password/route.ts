import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
<<<<<<< HEAD
=======

// PUT /api/account/password — change my own password (logged in)
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
export async function PUT(req: NextRequest) {
  const { userId, currentPassword, newPassword } = await req.json();
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
<<<<<<< HEAD
  if (!currentPassword) return NextResponse.json({ error: "Current password required", fields: { currentPassword: "Required" } }, { status: 401 });
  if (!newPassword || newPassword.length < 12) return NextResponse.json({ error: "Password must be at least 12 characters", fields: { newPassword: "Min 12 chars" } }, { status: 422 });
  const breached = ["password12345", "qwerty123456", "letmein12345"];
  if (breached.includes(newPassword.toLowerCase())) return NextResponse.json({ error: "Password found in breach list", fields: { newPassword: "Breached" } }, { status: 422 });
  await db.user.update({ where: { id: userId }, data: { passwordHash: "$argon2id$demo$" + newPassword.length, tokenVersion: { increment: 1 } } });
  await db.notification.create({ data: { tenantId: "bureau_kedbyte", userId, type: "password_changed", title: "Your password was changed", body: "If this wasn't you, contact your bureau administrator immediately." } });
=======

  // Verify current password (demo: accept "demo1234" or any non-empty)
  if (!currentPassword) {
    return NextResponse.json({ error: "Current password required", fields: { currentPassword: "Required" } }, { status: 401 });
  }

  // Policy check: ≥12 chars
  if (!newPassword || newPassword.length < 12) {
    return NextResponse.json({ error: "Password must be at least 12 characters", fields: { newPassword: "Min 12 chars" } }, { status: 422 });
  }

  // Breach list check (demo: block common passwords)
  const breached = ["password12345", "qwerty123456", "letmein12345"];
  if (breached.includes(newPassword.toLowerCase())) {
    return NextResponse.json({ error: "Password found in breach list — choose another", fields: { newPassword: "Breached" } }, { status: 422 });
  }

  // Hash new password (demo: store plaintext hash marker; production: Argon2id)
  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: "$argon2id$demo$" + newPassword.length,
      tokenVersion: { increment: 1 }, // revoke all other sessions
    },
  });

  // Audit
  await db.auditLog.create({
    data: {
      tenantId: "bureau_kedbyte",
      actorId: userId,
      action: "PASSWORD_CHANGED",
      entityType: "user",
      entityId: userId,
      prevHash: "0".repeat(64),
      currHash: "0".repeat(64),
      seq: Math.floor(Date.now() / 1000),
    },
  });

  // Notify
  await db.notification.create({
    data: {
      tenantId: "bureau_kedbyte",
      userId,
      type: "password_changed",
      title: "Your password was changed",
      body: "If this wasn't you, contact your bureau administrator immediately.",
    },
  });

>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
  return NextResponse.json({ ok: true, message: "Password changed — other sessions revoked" });
}
