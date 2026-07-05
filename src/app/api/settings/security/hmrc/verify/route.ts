import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/settings/security/hmrc/verify — test HMRC Government Gateway credentials
export async function POST(req: NextRequest) {
  const { companyId, actorId } = await req.json();
  // In production: worker sends minimal Test-in-Live poll/list request to HMRC
  // For demo: simulate verification
  await new Promise((r) => setTimeout(r, 1200));

  await db.auditLog.create({
    data: {
      tenantId: "bureau_kedbyte",
      actorId: actorId || "user_admin",
      action: "HMRC_CREDS_VERIFIED",
      entityType: "company",
      entityId: companyId,
      afterJson: JSON.stringify({ status: "ok" }),
      prevHash: "0".repeat(64),
      currHash: "0".repeat(64),
      seq: Math.floor(Date.now() / 1000),
    },
  });

  return NextResponse.json({ status: "ok", message: "Government Gateway credentials verified · Test-in-Live accepted" });
}
