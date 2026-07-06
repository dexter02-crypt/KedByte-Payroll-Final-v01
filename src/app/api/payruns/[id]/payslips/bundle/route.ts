import { NextRequest, NextResponse } from "next/server";
import { enqueue } from "@/lib/jobs/runner";

// GET /api/payruns/[id]/payslips/bundle — E9 payslip batch zip (MODE B)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobId = await enqueue("pdf:payslips" as any, { payRunId: id, bundle: true }, { requesterId: "user_admin", tenantId: "bureau_kedbyte" });
  return NextResponse.json({ jobId, status: "queued", message: "Payslip bundle queued — you'll be notified when ready" }, { status: 202 });
}
