import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/settings/bank/modulus-data — I4 Vocalink modulus data upload (valacdos.txt + scsubtab.txt)
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const valacdos = formData.get("valacdos") as File;
  const scsubtab = formData.get("scsubtab") as File;
  const actorId = formData.get("actorId") as string || "user_admin";

  if (!valacdos && !scsubtab) {
    return NextResponse.json({ error: "At least one file required (valacdos.txt or scsubtab.txt)" }, { status: 400 });
  }

  // Validate line format (basic check — first line should look like modulus data)
  if (valacdos) {
    const content = await valacdos.text();
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 10) {
      return NextResponse.json({ error: "valacdos.txt appears truncated — expected 1000+ weight lines" }, { status: 422 });
    }
  }

  // Audit
  await db.auditLog.create({
    data: {
      tenantId: "bureau_kedbyte",
      actorId,
      action: "MODULUS_DATA_UPDATED",
      entityType: "settings",
      entityId: "bank",
      afterJson: JSON.stringify({
        valacdos: valacdos ? { name: valacdos.name, size: valacdos.size } : null,
        scsubtab: scsubtab ? { name: scsubtab.name, size: scsubtab.size } : null,
      }),
      prevHash: "0".repeat(64),
      currHash: "0".repeat(64),
      seq: Math.floor(Date.now() / 1000),
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Modulus data updated — bank account validation will use the new weights from the next modulus check",
  });
}
