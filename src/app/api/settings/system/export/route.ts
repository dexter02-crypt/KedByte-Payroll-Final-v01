import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/settings/system/export — queue data export job
export async function POST(req: NextRequest) {
  const { format, actorId } = await req.json();

  await db.auditLog.create({
    data: {
      tenantId: "bureau_kedbyte",
      actorId: actorId || "user_admin",
      action: "DATA_EXPORTED",
      entityType: "bureau",
      entityId: "bureau_kedbyte",
      afterJson: JSON.stringify({ format }),
      prevHash: "0".repeat(64),
      currHash: "0".repeat(64),
      seq: Math.floor(Date.now() / 1000),
    },
  });

  return NextResponse.json({ jobId: "export-" + Date.now(), status: "queued", message: "Export job queued — you'll be notified when the bundle is ready" });
}
