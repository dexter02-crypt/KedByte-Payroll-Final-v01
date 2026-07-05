import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/settings/tax/override — inserts an effective-dated statutory_config row (never UPDATE)
export async function POST(req: NextRequest) {
  const { taxYear, key, value, effectiveFrom, reason, actorId } = await req.json();

  if (!reason || !reason.trim()) {
    return NextResponse.json({ error: "Reason is mandatory for threshold overrides", fields: { reason: "Required" } }, { status: 422 });
  }

  // Guard: check for committed pay runs after effectiveFrom
  const effDate = new Date(effectiveFrom);
  const committedRuns = await db.payRun.findMany({
    where: { status: "committed", payDate: { gte: effDate } },
    select: { id: true, ref: true },
    take: 5,
  });
  if (committedRuns.length > 0) {
    return NextResponse.json({
      error: `${committedRuns.length} committed pay run(s) fall after this date. Overrides cannot rewrite committed history — corrections go through pay-run amendment (FPS correction).`,
      conflicts: committedRuns.map((r) => r.id),
    }, { status: 409 });
  }

  // Insert effective-dated row (never mutate existing)
  await db.statutoryConfig.create({
    data: {
      taxYear,
      effectiveFrom: effDate,
      key,
      valueJson: JSON.stringify(value),
      source: `Override by ${actorId || "admin"}: ${reason}`,
    },
  });

  // Audit
  await db.auditLog.create({
    data: {
      tenantId: "bureau_kedbyte",
      actorId: actorId || "user_admin",
      action: "CONFIG_OVERRIDE",
      entityType: "settings:tax",
      entityId: key,
      beforeJson: JSON.stringify({ priorValue: null }),
      afterJson: JSON.stringify({ value, effectiveFrom }),
      reason,
      prevHash: "0".repeat(64),
      currHash: "0".repeat(64),
      seq: Math.floor(Date.now() / 1000),
    },
  });

  return NextResponse.json({ ok: true, message: `Override inserted for ${key} effective ${effectiveFrom}` });
}
