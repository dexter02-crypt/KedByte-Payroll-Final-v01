import { NextRequest, NextResponse } from "next/server";
import { getJob, exportFiles } from "@/lib/jobs/runner";

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: "Export not found" }, { status: 404 });
  if (job.status !== "completed") return NextResponse.json({ error: `Export is ${job.status}` }, { status: 409 });
  if (job.result?.expiresAt && new Date(job.result.expiresAt) < new Date()) return NextResponse.json({ error: "Export expired" }, { status: 410 });
  const uid = req.nextUrl.searchParams.get("uid");
  if (uid && job.requesterId && uid !== job.requesterId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const file = exportFiles.get(jobId);
  if (!file) return NextResponse.json({ error: "File no longer available" }, { status: 410 });
  return new NextResponse(file.content, { headers: { "Content-Type": file.mimeType, "Content-Disposition": `attachment; filename="${file.fileName}"`, "Content-Length": String(file.sizeBytes) } });
}
