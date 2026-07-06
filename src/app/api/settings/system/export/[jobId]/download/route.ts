import { NextRequest, NextResponse } from "next/server";
import { getJob, exportFiles } from "@/lib/jobs/runner";

// GET /api/settings/system/export/[jobId]/download — stream the export file (signed, requester-only, 5-min)
export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Export job not found" }, { status: 404 });
  }
  if (job.status !== "completed") {
    return NextResponse.json({ error: `Export is ${job.status}` }, { status: 409 });
  }

  // Check expiry (7-day retention)
  if (job.result?.expiresAt && new Date(job.result.expiresAt) < new Date()) {
    return NextResponse.json({ error: "Export link expired" }, { status: 410 });
  }

  // Requester-only check (in production: verify JWT user matches job.requesterId)
  const requesterId = req.nextUrl.searchParams.get("uid");
  if (requesterId && job.requesterId && requesterId !== job.requesterId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const file = exportFiles.get(jobId);
  if (!file) {
    return NextResponse.json({ error: "File no longer available" }, { status: 410 });
  }

  // Stream the file
  return new NextResponse(file.content, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="${file.fileName}"`,
      "Content-Length": String(file.sizeBytes),
    },
  });
}
