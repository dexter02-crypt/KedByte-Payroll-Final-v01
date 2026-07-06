import { NextRequest, NextResponse } from "next/server";
<<<<<<< HEAD
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payRun = await db.payRun.findUnique({ where: { id }, include: { company: true } });
  if (!payRun) return NextResponse.json({ error: "Pay run not found" }, { status: 404 });
  if (payRun.status !== "committed") return NextResponse.json({ error: "Commit the pay run first" }, { status: 409 });
  const entries = await db.payRunEntry.findMany({ where: { payRunId: id, status: "approved" }, include: { employee: true } });
  const slug = payRun.company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const period = `M${String(payRun.taxPeriod).padStart(2, "0")}`;
  const lines: string[] = ["VOL1KEDBYTE1                        1", "HDR1AKEDBYTE                                                                      "];
  let totalPence = 0;
  for (const e of entries) {
    const amountPence = Math.round((e.net || 0) * 100);
    totalPence += amountPence;
    const sortCode = (e.employee?.bankSortCode || "000000").padEnd(6, "0").slice(0, 6);
    const account = (e.employee?.bankAccount || "00000000").padEnd(8, "0").slice(0, 8);
    const ref = (e.employee?.payrollId || "").padEnd(18).slice(0, 18);
    lines.push(sortCode + account + "99" + String(amountPence).padStart(11, "0") + ref);
  }
  lines.push("00000000000000" + "17" + String(totalPence).padStart(11, "0") + "CONTRA".padEnd(18));
  lines.push("EOF1A" + String(entries.length + 1).padStart(6, "0") + String(totalPence).padStart(12, "0").padEnd(74));
  const content = lines.join("\r\n") + "\r\n";
  return new NextResponse(content, { headers: { "Content-Type": "text/plain", "Content-Disposition": `attachment; filename="bacs-${slug}-${payRun.taxYear}-${period}.std18.txt"` } });
=======
import { runExport, bacsSpec } from "@/server/exports";

// GET /api/payruns/[id]/bacs — E7 BACS Standard-18 file
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = { tenantId: "bureau_kedbyte", userId: "user_admin" };
  try {
    const spec = await bacsSpec(id, ctx.tenantId);
    const r = await runExport(spec, ctx);
    if (r.mode === "direct") {
      return new NextResponse(r.body, {
        headers: { "Content-Type": r.contentType, "Content-Disposition": `attachment; filename="${r.filename}"` },
      });
    }
    return NextResponse.json({ jobId: r.jobId }, { status: 202 });
  } catch (e: any) {
    if (e.message?.startsWith("409:")) return NextResponse.json({ error: e.message.slice(4) }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
}
