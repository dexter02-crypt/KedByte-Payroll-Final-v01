import { NextRequest, NextResponse } from "next/server";
import { runExport, reportSpec } from "@/server/exports";

// GET /api/reports/[type]/export?params — E10 report CSV export
export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const ctx = { tenantId: "bureau_kedbyte", userId: "user_admin" };
  const paramsObj = Object.fromEntries(req.nextUrl.searchParams.entries());
  const spec = await reportSpec(type, paramsObj, ctx.tenantId);
  const r = await runExport(spec, ctx);
  if (r.mode === "direct") {
    return new NextResponse(r.body, {
      headers: { "Content-Type": r.contentType, "Content-Disposition": `attachment; filename="${r.filename}"` },
    });
  }
  return NextResponse.json({ jobId: r.jobId }, { status: 202 });
}
