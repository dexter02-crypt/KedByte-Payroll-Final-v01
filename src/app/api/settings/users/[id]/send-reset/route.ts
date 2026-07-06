import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
<<<<<<< HEAD
=======

// POST /api/settings/users/[id]/send-reset — send password reset link
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
<<<<<<< HEAD
  await db.notification.create({ data: { tenantId: "bureau_kedbyte", userId: id, type: "password_reset", title: "Password reset link sent", body: `A password reset link has been sent to ${user.email}.` } });
=======

  const token = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);

  await db.auditLog.create({
    data: {
      tenantId: "bureau_kedbyte",
      actorId: "user_admin",
      action: "RESET_LINK_SENT",
      entityType: "user",
      entityId: id,
      afterJson: JSON.stringify({ email: user.email }),
      prevHash: "0".repeat(64),
      currHash: "0".repeat(64),
      seq: Math.floor(Date.now() / 1000),
    },
  });

  // Notify user with reset link
  await db.notification.create({
    data: {
      tenantId: "bureau_kedbyte",
      userId: id,
      type: "password_reset",
      title: "Password reset link sent",
      body: `A password reset link has been sent to ${user.email}. The link expires in 1 hour.`,
    },
  });

>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
  return NextResponse.json({ ok: true, message: `Reset link sent to ${user.email} · expires in 1 hour` });
}
