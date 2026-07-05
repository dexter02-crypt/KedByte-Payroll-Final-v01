import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/settings/users/invite — creates invited user + token
export async function POST(req: NextRequest) {
  const { email, role, companyIds, actorId } = await req.json();

  if (!email || !role) {
    return NextResponse.json({ error: "Email and role required" }, { status: 422 });
  }

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing && existing.status === "active") {
    return NextResponse.json({ error: "User with this email already exists", fields: { email: "Duplicate" } }, { status: 409 });
  }

  const user = await db.user.create({
    data: {
      tenantId: "bureau_kedbyte",
      email: email.toLowerCase().trim(),
      passwordHash: "$invited$", // placeholder — set on accept
      role,
      companyId: companyIds?.[0] || null,
      status: "invited",
    },
  });

  await db.auditLog.create({
    data: {
      tenantId: "bureau_kedbyte",
      actorId: actorId || "user_admin",
      action: "USER_INVITED",
      entityType: "user",
      entityId: user.id,
      afterJson: JSON.stringify({ email, role, companyIds }),
      prevHash: "0".repeat(64),
      currHash: "0".repeat(64),
      seq: Math.floor(Date.now() / 1000),
    },
  });

  return NextResponse.json({ id: user.id, inviteToken: "inv-" + Math.random().toString(36).slice(2, 12), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() }, { status: 201 });
}
