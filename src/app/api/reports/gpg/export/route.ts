import { NextRequest, NextResponse } from "next/server";
import { runExport, gpgSpec } from "@/server/exports";

// GET /api/reports/gpg/export?companyId&snapshot — E11 GPG CSV (six statutory figures + quartiles)
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  const snapshot = req.nextUrl.searchParams.get("snapshot") || "2026-04-05";
  const ctx = { tenantId: "bureau_kedbyte", userId: "user_admin" };
  const spec = await gpgSpec(companyId, snapshot, ctx.tenantId);
  const r = await runExport(spec, ctx);
  if (r.mode === "direct") {
    return new NextResponse(r.body, {
      headers: { "Content-Type": r.contentType, "Content-Disposition": `attachment; filename="${r.filename}"` },
    });
  }
  return NextResponse.json({ jobId: r.jobId }, { status: 202 });
}
