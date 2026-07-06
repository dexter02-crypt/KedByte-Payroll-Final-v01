import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companySlug } from "@/server/exports";

<<<<<<< HEAD
=======
// GET /api/rti/[id]/xml — E4 FPS XML payload download (byte-identical to stored)
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submission = await db.rtiSubmission.findUnique({ where: { id } });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
<<<<<<< HEAD
  const company = await db.company.findUnique({ where: { id: submission.companyId } });
  const slug = (company?.name || "company").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const period = submission.taxPeriod ? `M${String(submission.taxPeriod).padStart(2, "0")}` : "unknown";
  return new NextResponse(submission.xmlPayload, { headers: { "Content-Type": "application/xml", "Content-Disposition": `attachment; filename="fps-${slug}-${submission.taxYear}-${period}.xml"` } });
=======

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
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
}
