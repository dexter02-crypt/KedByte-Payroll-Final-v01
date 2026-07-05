import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/settings/users/[id]/unlock — clear failed logins + lockout
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.user.update({
    where: { id },
    data: { failedLogins: 0, lockedUntil: null, status: "active" },
  });

  await db.auditLog.create({
    data: {
      tenantId: "bureau_kedbyte",
      actorId: "user_admin",
      action: "USER_UNLOCKED",
      entityType: "user",
      entityId: id,
      beforeJson: JSON.stringify({ failedLogins: user.failedLogins, lockedUntil: user.lockedUntil }),
      afterJson: JSON.stringify({ failedLogins: 0, lockedUntil: null }),
      prevHash: "0".repeat(64),
      currHash: "0".repeat(64),
      seq: Math.floor(Date.now() / 1000),
    },
  });

  return NextResponse.json({ ok: true, message: "Account unlocked — failed login counter reset" });
}
