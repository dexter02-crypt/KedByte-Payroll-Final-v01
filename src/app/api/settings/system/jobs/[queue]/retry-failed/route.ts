import { NextRequest, NextResponse } from "next/server";
import { enqueue } from "@/lib/jobs/runner";
export async function POST(_req: NextRequest, { params }: { params: Promise<{ queue: string }> }) {
  const { queue } = await params;
  const jobId = await enqueue(queue as any, { retry: true }, { requesterId: "user_admin" });
  return NextResponse.json({ ok: true, message: `Retry job enqueued for ${queue}`, jobId });
}
