import { NextResponse } from "next/server";
import { runExport, rtiErrorsDictionarySpec } from "@/server/exports";

// GET /api/rti/errors/dictionary/export — E6 error dictionary CSV
export async function GET() {
  const ctx = { tenantId: "bureau_kedbyte", userId: "user_admin" };
  const spec = await rtiErrorsDictionarySpec(ctx.tenantId);
  const r = await runExport(spec, ctx);
  if (r.mode === "direct") {
    return new NextResponse(r.body, {
      headers: { "Content-Type": r.contentType, "Content-Disposition": `attachment; filename="${r.filename}"` },
    });
  }
  return NextResponse.json({ jobId: r.jobId }, { status: 202 });
}
