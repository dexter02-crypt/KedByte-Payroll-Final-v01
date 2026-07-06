import { NextRequest, NextResponse } from "next/server";
import { enqueue } from "@/lib/jobs/runner";
<<<<<<< HEAD
=======

// POST /api/bank-holidays/sync — enqueue bank holiday sync job
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
export async function POST(req: NextRequest) {
  const { actorId } = await req.json().catch(() => ({}));
  const jobId = await enqueue("bank-holidays:sync", {}, { requesterId: actorId || "user_admin", tenantId: "bureau_kedbyte" });
  return NextResponse.json({ jobId, status: "queued", message: "Bank holiday sync queued — you'll be notified with the diff report" }, { status: 202 });
}
