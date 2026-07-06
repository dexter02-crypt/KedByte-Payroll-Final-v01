import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
<<<<<<< HEAD
import { enqueue, checkExportRateLimit, getRecentExports } from "@/lib/jobs/runner";

// POST /api/settings/system/export — E14 full-tenant export (always MODE B)
=======
import { runExport, systemBundleSpec } from "@/server/exports";
import { checkExportRateLimit, getRecentExports } from "@/lib/jobs/runner";

// POST /api/settings/system/export — E14 full-tenant export (always MODE B — legitimately big)
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
export async function POST(req: NextRequest) {
  const { format, actorId } = await req.json();
  const userId = actorId || "user_admin";

<<<<<<< HEAD
  const rate = checkExportRateLimit(userId + ":" + (format || "csv"));
  if (!rate.allowed) {
    return NextResponse.json({ error: `Export rate limit reached. Next export available ${rate.nextAllowedAt?.toISOString().slice(0, 16).replace("T", " ")}.` }, { status: 429 });
  }

  const jobId = await enqueue("system:export", { format: format || "csv-bundle" }, { requesterId: userId, tenantId: "bureau_kedbyte" });

  await db.auditLog.create({
    data: {
      tenantId: "bureau_kedbyte", actorId: userId, action: "DATA_EXPORTED",
      entityType: "bureau", entityId: "bureau_kedbyte",
      afterJson: JSON.stringify({ format, jobId }),
      prevHash: "0".repeat(64), currHash: "0".repeat(64), seq: Math.floor(Date.now() / 1000),
    },
  });

  return NextResponse.json({ jobId, status: "queued", message: "Export queued — you'll be notified when the bundle is ready (check the bell icon)" }, { status: 202 });
=======
  // Rate limit: 1/day per user per format
  const rate = checkExportRateLimit(userId + ":" + format);
  if (!rate.allowed) {
    return NextResponse.json({
      error: `Export rate limit reached. Next export available ${rate.nextAllowedAt?.toISOString().slice(0, 16).replace("T", " ")}.`,
    }, { status: 429 });
  }

  const ctx = { tenantId: "bureau_kedbyte", userId };
  const spec = await systemBundleSpec(format || "csv-bundle", ctx.tenantId);
  const r = await runExport(spec, ctx);

  if (r.mode === "direct") {
    // Shouldn't happen for system bundle (always > threshold) but handle gracefully
    return new NextResponse(r.body, {
      headers: { "Content-Type": r.contentType, "Content-Disposition": `attachment; filename="${r.filename}"` },
    });
  }

  // Audit queued
  await db.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      actorId: userId,
      action: "DATA_EXPORTED",
      entityType: "bureau",
      entityId: "bureau_kedbyte",
      afterJson: JSON.stringify({ format, jobId: r.jobId }),
      prevHash: "0".repeat(64),
      currHash: "0".repeat(64),
      seq: Math.floor(Date.now() / 1000),
    },
  });

  return NextResponse.json({
    jobId: r.jobId,
    status: "queued",
    message: "Export queued — you'll be notified when the bundle is ready (check the bell icon)",
  }, { status: 202 });
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
}

// GET /api/settings/system/export — list recent exports
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  if (status === "job") {
    const jobId = req.nextUrl.searchParams.get("jobId");
    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
<<<<<<< HEAD
=======
    // Delegate to unified exports status endpoint
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
    const res = await fetch(`http://localhost:3000/api/exports/${jobId}/status`);
    return NextResponse.json(await res.json(), { status: res.status });
  }
  const recent = getRecentExports(5);
  return NextResponse.json({
    exports: recent.map((j) => ({
<<<<<<< HEAD
      id: j.id, format: j.payload.format, status: j.status,
      fileName: j.result?.fileName, sizeBytes: j.result?.sizeBytes,
      rowCount: j.result?.rowCount, createdAt: j.createdAt,
      completedAt: j.completedAt, expiresAt: j.result?.expiresAt,
=======
      id: j.id,
      format: j.payload.format,
      status: j.status,
      fileName: j.result?.fileName,
      sizeBytes: j.result?.sizeBytes,
      rowCount: j.result?.rowCount,
      createdAt: j.createdAt,
      completedAt: j.completedAt,
      expiresAt: j.result?.expiresAt,
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
    })),
  });
}
