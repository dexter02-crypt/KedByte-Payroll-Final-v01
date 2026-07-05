import { NextRequest, NextResponse } from "next/server";
import { enqueue } from "@/lib/jobs/runner";

// POST /api/settings/system/jobs/[queue]/retry-failed — retry failed jobs in a queue
export async function POST(_req: NextRequest, { params }: { params: Promise<{ queue: string }> }) {
  const { queue } = await params;
  // In production: re-enqueue failed jobs from DLQ. Demo: acknowledge.
  const jobId = await enqueue(queue as any, { retry: true }, { requesterId: "user_admin" });
  return NextResponse.json({ ok: true, message: `Retry job enqueued for ${queue}`, jobId });
}
