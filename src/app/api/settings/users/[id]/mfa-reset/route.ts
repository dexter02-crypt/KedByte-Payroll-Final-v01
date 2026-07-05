import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/settings/users/[id]/mfa-reset — clear MFA secret, notify user
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.user.update({
    where: { id },
    data: { mfaEnabled: false, mfaSecret: null },
  });

  await db.auditLog.create({
    data: {
      tenantId: "bureau_kedbyte",
      actorId: "user_admin",
      action: "MFA_RESET",
      entityType: "user",
      entityId: id,
      beforeJson: JSON.stringify({ mfaEnabled: user.mfaEnabled }),
      afterJson: JSON.stringify({ mfaEnabled: false }),
      prevHash: "0".repeat(64),
      currHash: "0".repeat(64),
      seq: Math.floor(Date.now() / 1000),
    },
  });

  // Notify user
  await db.notification.create({
    data: {
      tenantId: "bureau_kedbyte",
      userId: id,
      type: "mfa_reset",
      title: "MFA reset by admin",
      body: "Your multi-factor authentication has been reset. Please set up MFA again at next login.",
    },
  });

  return NextResponse.json({ ok: true, message: "MFA cleared — user notified to re-enrol at next login" });
}
