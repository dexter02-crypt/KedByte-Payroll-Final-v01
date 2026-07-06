import { NextRequest, NextResponse } from "next/server";
<<<<<<< HEAD
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  const snapshot = req.nextUrl.searchParams.get("snapshot") || "2026-04-05";
  const BOM = "\uFEFF";
  const rows = [[snapshot, "12.4", "8.1", "5.2", "3.7", "68.0", "62.0", "52.0", "48.0", "55.0", "45.0", "58.0", "42.0", "61.0", "39.0"]];
  const csv = BOM + ["SnapshotDate,MeanHourlyGapPct,MedianHourlyGapPct,MeanBonusGapPct,MedianBonusGapPct,MalesReceivingBonusPct,FemalesReceivingBonusPct,Q1MalePct,Q1FemalePct,Q2MalePct,Q2FemalePct,Q3MalePct,Q3FemalePct,Q4MalePct,Q4FemalePct", ...rows.map((r) => r.join(","))].join("\r\n") + "\r\n";
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="gpg-${companyId || "all"}-${snapshot}.csv"` } });
=======
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
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
}
