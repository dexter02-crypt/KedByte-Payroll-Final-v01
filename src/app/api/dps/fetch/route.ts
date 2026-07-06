import { NextRequest, NextResponse } from "next/server";
import { enqueue } from "@/lib/jobs/runner";
export async function POST(req: NextRequest) {
  const { actorId } = await req.json().catch(() => ({}));
  const jobId = await enqueue("dps:fetch", {}, { requesterId: actorId || "user_admin", tenantId: "bureau_kedbyte" });
  return NextResponse.json({ jobId, status: "queued", message: "DPS fetch queued — you'll be notified with applied/exception counts" }, { status: 202 });
}
