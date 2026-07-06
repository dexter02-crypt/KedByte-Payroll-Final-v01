import { NextResponse } from "next/server";
import { getJob } from "@/lib/jobs/runner";

<<<<<<< HEAD
=======
// GET /api/exports/[jobId]/status — poll async export status
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
<<<<<<< HEAD
  return NextResponse.json({ id: job.id, queue: job.queue, status: job.status, result: job.result, error: job.error, filename: job.result?.fileName });
=======
  return NextResponse.json({
    id: job.id,
    queue: job.queue,
    status: job.status,
    result: job.result,
    error: job.error,
    filename: job.result?.fileName,
  });
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
}
