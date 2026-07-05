import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companySlug } from "@/server/exports";

// GET /api/rti/[id]/xml — E4 FPS XML payload download (byte-identical to stored)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submission = await db.rtiSubmission.findUnique({ where: { id } });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch company separately (no relation defined on RtiSubmission)
  const company = await db.company.findUnique({ where: { id: submission.companyId } });
  const slug = companySlug(company?.name || "company");
  const period = submission.taxPeriod ? `M${String(submission.taxPeriod).padStart(2, "0")}` : "unknown";
  const filename = `fps-${slug}-${submission.taxYear}-${period}.xml`;

  return new NextResponse(submission.xmlPayload, {
    headers: {
      "Content-Type": "application/xml",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
