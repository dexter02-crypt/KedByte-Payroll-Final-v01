import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enqueue, checkExportRateLimit, getRecentExports, getJob } from "@/lib/jobs/runner";

// POST /api/settings/system/export — queue data export job (rate-limited 1/day)
export async function POST(req: NextRequest) {
  const { format, actorId } = await req.json();
  const userId = actorId || "user_admin";

  // Rate limit: 1/day per user
  const rate = checkExportRateLimit(userId);
  if (!rate.allowed) {
    return NextResponse.json({
      error: `Export rate limit reached. Next export available ${rate.nextAllowedAt?.toISOString().slice(0, 16).replace("T", " ")}.`,
    }, { status: 429 });
  }

  // Estimate rows — if < 500, stream now; else enqueue
  const empCount = await db.employee.count();
  const companyCount = await db.company.count();
  const runCount = await db.payRun.count();
  const totalRows = empCount + companyCount + runCount;

  // Enqueue async job
  const jobId = await enqueue("system:export", { format, estimatedRows: totalRows }, { requesterId: userId, tenantId: "bureau_kedbyte" });

  // Audit
  await db.auditLog.create({
    data: {
      tenantId: "bureau_kedbyte",
      actorId: userId,
      action: "DATA_EXPORTED",
      entityType: "bureau",
      entityId: "bureau_kedbyte",
      afterJson: JSON.stringify({ format, jobId, estimatedRows: totalRows }),
      prevHash: "0".repeat(64),
      currHash: "0".repeat(64),
      seq: Math.floor(Date.now() / 1000),
    },
  });

  return NextResponse.json({
    jobId,
    status: "queued",
    estimatedRows: totalRows,
    message: "Export job queued — you'll be notified when the bundle is ready (check the bell icon)",
  }, { status: 202 });
}

// GET /api/settings/system/export — list recent exports
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  if (status === "job") {
    // Poll a single job status
    const jobId = req.nextUrl.searchParams.get("jobId");
    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
    const job = getJob(jobId);
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      id: job.id,
      queue: job.queue,
      status: job.status,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    });
  }
  // Recent exports list
  const recent = getRecentExports(5);
  return NextResponse.json({
    exports: recent.map((j) => ({
      id: j.id,
      format: j.payload.format,
      status: j.status,
      fileName: j.result?.fileName,
      sizeBytes: j.result?.sizeBytes,
      rowCount: j.result?.rowCount,
      createdAt: j.createdAt,
      completedAt: j.completedAt,
      expiresAt: j.result?.expiresAt,
    })),
  });
}
