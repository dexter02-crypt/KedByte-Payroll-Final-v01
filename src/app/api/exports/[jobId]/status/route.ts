import { NextResponse } from "next/server";
import { getJob } from "@/lib/jobs/runner";

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: job.id, queue: job.queue, status: job.status, result: job.result, error: job.error, filename: job.result?.fileName });
}
