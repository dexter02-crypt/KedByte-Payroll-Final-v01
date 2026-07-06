import { NextRequest, NextResponse } from "next/server";
import { enqueue } from "@/lib/jobs/runner";
<<<<<<< HEAD
export async function POST(_req: NextRequest, { params }: { params: Promise<{ queue: string }> }) {
  const { queue } = await params;
=======

// POST /api/settings/system/jobs/[queue]/retry-failed — retry failed jobs in a queue
export async function POST(_req: NextRequest, { params }: { params: Promise<{ queue: string }> }) {
  const { queue } = await params;
  // In production: re-enqueue failed jobs from DLQ. Demo: acknowledge.
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
  const jobId = await enqueue(queue as any, { retry: true }, { requesterId: "user_admin" });
  return NextResponse.json({ ok: true, message: `Retry job enqueued for ${queue}`, jobId });
}
