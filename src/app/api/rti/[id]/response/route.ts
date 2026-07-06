import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/rti/[id]/response — E5 HMRC response XML download
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submission = await db.rtiSubmission.findUnique({ where: { id } });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!submission.hmrcResponse) return NextResponse.json({ error: "No HMRC response available" }, { status: 404 });

  const filename = `fps-response-${submission.correlationId || id}.xml`;
  return new NextResponse(submission.hmrcResponse, {
    headers: {
      "Content-Type": "application/xml",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
