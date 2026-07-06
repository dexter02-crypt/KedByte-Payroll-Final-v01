import { NextRequest, NextResponse } from "next/server";
<<<<<<< HEAD
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payRun = await db.payRun.findUnique({ where: { id }, include: { company: true } });
  if (!payRun) return NextResponse.json({ error: "Pay run not found" }, { status: 404 });
  const entries = await db.payRunEntry.findMany({ where: { payRunId: id }, include: { employee: true }, orderBy: { employee: { lastName: "asc" } } });
  const slug = payRun.company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const period = `M${String(payRun.taxPeriod).padStart(2, "0")}`;
  const BOM = "\uFEFF";
  const rows = entries.map((e) => [`${e.employee?.firstName} ${e.employee?.lastName}`, e.employee?.payrollId, (e.gross || 0).toFixed(2), (e.tax || 0).toFixed(2), (e.niEmployee || 0).toFixed(2), (e.niEmployer || 0).toFixed(2), (e.pensionEmployee || 0).toFixed(2), (e.pensionEmployer || 0).toFixed(2), (e.studentLoan || 0).toFixed(2), (e.postgradLoan || 0).toFixed(2), (e.net || 0).toFixed(2), e.variancePct !== null ? e.variancePct.toFixed(2) : "", e.status]);
  const csv = BOM + ["Employee,PayrollId,Gross,Tax,NIEmployee,NIEmployer,PensionEmployee,PensionEmployer,StudentLoan,PostgradLoan,Net,VariancePct,Status", ...rows.map((r) => r.map((v) => /[",\n]/.test(String(v)) ? `"${v}"` : v).join(",")).join("\r\n")].join("\r\n") + "\r\n";
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="payrun-${slug}-${payRun.taxYear}-${period}.csv"` } });
=======
import { runExport, payrunEntriesSpec } from "@/server/exports";

// GET /api/payruns/[id]/entries/export — E8 pay run entries CSV (client sign-off)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = { tenantId: "bureau_kedbyte", userId: "user_admin" };
  try {
    const spec = await payrunEntriesSpec(id, ctx.tenantId);
    const r = await runExport(spec, ctx);
    if (r.mode === "direct") {
      return new NextResponse(r.body, {
        headers: { "Content-Type": r.contentType, "Content-Disposition": `attachment; filename="${r.filename}"` },
      });
    }
    return NextResponse.json({ jobId: r.jobId }, { status: 202 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
}
