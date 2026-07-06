import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companySlug } from "@/server/exports";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submission = await db.rtiSubmission.findUnique({ where: { id } });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const company = await db.company.findUnique({ where: { id: submission.companyId } });
  const slug = (company?.name || "company").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const period = submission.taxPeriod ? `M${String(submission.taxPeriod).padStart(2, "0")}` : "unknown";
  return new NextResponse(submission.xmlPayload, { headers: { "Content-Type": "application/xml", "Content-Disposition": `attachment; filename="fps-${slug}-${submission.taxYear}-${period}.xml"` } });
}
