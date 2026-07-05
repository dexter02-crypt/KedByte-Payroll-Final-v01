import { NextRequest, NextResponse } from "next/server";
import { runExport, aeReportSpec } from "@/server/exports";

// GET /api/pensions/assessment/export?companyId=
// E3 AE assessment report — MODE A, masked NINO
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  const ctx = { tenantId: "bureau_kedbyte", userId: "user_admin" };
  const spec = await aeReportSpec(companyId, ctx.tenantId);
  const r = await runExport(spec, ctx);
  if (r.mode === "direct") {
    return new NextResponse(r.body, {
      headers: { "Content-Type": r.contentType, "Content-Disposition": `attachment; filename="${r.filename}"` },
    });
  }
  return NextResponse.json({ jobId: r.jobId }, { status: 202 });
}
