import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs/runner";

// POST /api/rti/fps — submit FPS for a pay run
// Body: { payRunId, companyId, actorId }
// Returns: 202 { submissionId, status: "queued" }
export async function POST(req: NextRequest) {
  const { payRunId, companyId, actorId } = await req.json();

  if (!payRunId || !companyId) {
    return NextResponse.json({ error: "payRunId and companyId required" }, { status: 400 });
  }

  // Verify pay run exists and is committed
  const payRun = await db.payRun.findUnique({
    where: { id: payRunId },
    include: { company: true },
  });

  if (!payRun) {
    return NextResponse.json({ error: "Pay run not found" }, { status: 404 });
  }

  if (payRun.status !== "committed") {
    return NextResponse.json(
      { error: "Pay run must be committed before FPS submission. Current status: " + payRun.status },
      { status: 409 }
    );
  }

  // Check if FPS already submitted for this pay run
  const existing = await db.rtiSubmission.findFirst({
    where: { payRunId, type: "FPS", status: { in: ["accepted", "submitted", "polling"] } },
  });

  if (existing) {
    return NextResponse.json(
      { error: "FPS already submitted for this pay run", submissionId: existing.id, status: existing.status },
      { status: 409 }
    );
  }

  // Enqueue the RTI submit job
  const jobId = await enqueue("rti:submit", {
    payRunId,
    companyId,
    taxYear: payRun.taxYear,
    taxPeriod: payRun.taxPeriod,
  }, { requesterId: actorId || "user_admin", tenantId: "bureau_kedbyte" });

  // Audit
  await db.auditLog.create({
    data: {
      tenantId: "bureau_kedbyte",
      actorId: actorId || "user_admin",
      action: "FPS_SUBMITTED",
      entityType: "rti_submission",
      entityId: jobId,
      afterJson: JSON.stringify({ payRunId, companyId, taxYear: payRun.taxYear, taxPeriod: payRun.taxPeriod }),
      prevHash: "0".repeat(64),
      currHash: "0".repeat(64),
      seq: Math.floor(Date.now() / 1000),
    },
  });

  return NextResponse.json({
    jobId,
    submissionId: jobId,
    status: "queued",
    message: `FPS queued for ${payRun.company.name} — Period M${payRun.taxPeriod}. You'll be notified when HMRC accepts.`,
  }, { status: 202 });
}
