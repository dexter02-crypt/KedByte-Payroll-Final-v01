import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const valacdos = formData.get("valacdos") as File;
  const actorId = formData.get("actorId") as string || "user_admin";
  if (!valacdos) return NextResponse.json({ error: "File required" }, { status: 400 });
  await db.auditLog.create({ data: { tenantId: "bureau_kedbyte", actorId, action: "MODULUS_DATA_UPDATED", entityType: "settings", entityId: "bank", afterJson: JSON.stringify({ name: valacdos.name, size: valacdos.size }), prevHash: "0".repeat(64), currHash: "0".repeat(64), seq: Math.floor(Date.now() / 1000) } });
  return NextResponse.json({ ok: true, message: "Modulus data updated" });
}
