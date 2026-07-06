import { NextResponse } from "next/server";
<<<<<<< HEAD
import { db } from "@/lib/db";

export async function GET() {
  const dict = await db.rtiErrorDictionary.findMany({ orderBy: { code: "asc" } });
  const BOM = "\uFEFF";
  const rows = dict.map((d) => [d.code, d.category || "", d.severity || "", d.hmrcMessage || "", d.cause || "", d.resolutionScreen || "", d.resolutionField || ""]);
  const csv = BOM + ["code,category,severity,hmrc_message,cause,resolution_screen,resolution_field", ...rows.map((r) => r.map((v) => /[",\n]/.test(String(v)) ? `"${v}"` : v).join(",")).join("\r\n")].join("\r\n") + "\r\n";
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="rti-error-dictionary-${new Date().toISOString().slice(0, 10)}.csv"` } });
=======
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
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
}
