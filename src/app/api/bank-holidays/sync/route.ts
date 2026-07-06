import { NextRequest, NextResponse } from "next/server";
import { enqueue } from "@/lib/jobs/runner";
export async function POST(req: NextRequest) {
  const { actorId } = await req.json().catch(() => ({}));
  const jobId = await enqueue("bank-holidays:sync", {}, { requesterId: actorId || "user_admin", tenantId: "bureau_kedbyte" });
  return NextResponse.json({ jobId, status: "queued", message: "Bank holiday sync queued — you'll be notified with the diff report" }, { status: 202 });
}
