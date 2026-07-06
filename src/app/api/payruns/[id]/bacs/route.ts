import { NextRequest, NextResponse } from "next/server";
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
}
