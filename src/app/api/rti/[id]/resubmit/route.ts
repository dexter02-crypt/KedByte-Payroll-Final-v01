import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs/runner";

// POST /api/rti/[id]/resubmit — resubmit a rejected/failed FPS
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submission = await db.rtiSubmission.findUnique({
    where: { id },
    include: { payRun: { include: { company: true } } },
  });

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (!submission.payRun) {
    return NextResponse.json({ error: "Original pay run not found" }, { status: 404 });
  }

  // Enqueue a new RTI submit job (creates a new submission row linked via supersedes)
  const jobId = await enqueue("rti:submit", {
    payRunId: submission.payRunId,
    companyId: submission.companyId,
    taxYear: submission.taxYear,
    taxPeriod: submission.taxPeriod || undefined,
    supersedesId: submission.id,
  }, { requesterId: "user_admin", tenantId: "bureau_kedbyte" });

  await db.auditLog.create({
    data: {
      tenantId: "bureau_kedbyte",
      actorId: "user_admin",
      action: "FPS_RESUBMITTED",
      entityType: "rti_submission",
      entityId: submission.id,
      afterJson: JSON.stringify({ newJobId: jobId, supersedesId: submission.id }),
      prevHash: "0".repeat(64),
      currHash: "0".repeat(64),
      seq: Math.floor(Date.now() / 1000),
    },
  });

  return NextResponse.json({
    jobId,
    newSubmissionId: jobId,
    supersedes: submission.id,
    status: "queued",
    message: `FPS resubmission queued for ${submission.payRun.company.name}. Regenerated XML from current data.`,
  }, { status: 202 });
}
