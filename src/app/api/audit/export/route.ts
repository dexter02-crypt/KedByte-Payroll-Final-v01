import { NextRequest, NextResponse } from "next/server";
import { runExport, auditLedgerSpec } from "@/server/exports";

// GET /api/audit/export?from&to — E15 audit ledger CSV (dispute-resolution artifact)
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from") || "";
  const to = req.nextUrl.searchParams.get("to") || "";
  const ctx = { tenantId: "bureau_kedbyte", userId: "user_admin" };
  const spec = await auditLedgerSpec(from, to, ctx.tenantId);
  const r = await runExport(spec, ctx);
  if (r.mode === "direct") {
    return new NextResponse(r.body, {
      headers: { "Content-Type": r.contentType, "Content-Disposition": `attachment; filename="${r.filename}"` },
    });
  }
  return NextResponse.json({ jobId: r.jobId }, { status: 202 });
}
