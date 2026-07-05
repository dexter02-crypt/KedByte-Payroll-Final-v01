import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PUT /api/settings/users/[id] — update role/companyIds/status
// POST /api/settings/users/[id]/mfa-reset — clear MFA
// POST /api/settings/users/[id]/unlock — clear lockout

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role, companyIds, status, actorId } = await req.json();

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Guard: cannot demote/disable the LAST active bureau_admin
  if (target.role === "bureau_admin" && (role !== "bureau_admin" || status === "disabled")) {
    const adminCount = await db.user.count({ where: { role: "bureau_admin", status: "active" } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "Cannot demote or disable the last active bureau admin" }, { status: 409 });
    }
  }

  const data: any = {};
  if (role) { data.role = role; data.tokenVersion = { increment: 1 }; }
  if (status) { data.status = status; data.tokenVersion = { increment: 1 }; }
  if (companyIds !== undefined) data.companyId = companyIds[0] || null;

  await db.user.update({ where: { id }, data });

  await db.auditLog.create({
    data: {
      tenantId: "bureau_kedbyte",
      actorId: actorId || "user_admin",
      action: role ? "USER_ROLE_CHANGED" : status === "disabled" ? "USER_DISABLED" : "USER_UPDATED",
      entityType: "user",
      entityId: id,
      beforeJson: JSON.stringify({ role: target.role, status: target.status }),
      afterJson: JSON.stringify({ role: role || target.role, status: status || target.status }),
      prevHash: "0".repeat(64),
      currHash: "0".repeat(64),
      seq: Math.floor(Date.now() / 1000),
    },
  });

  return NextResponse.json({ ok: true });
}
