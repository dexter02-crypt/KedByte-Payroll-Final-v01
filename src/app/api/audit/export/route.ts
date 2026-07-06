import { NextRequest, NextResponse } from "next/server";
<<<<<<< HEAD
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from") || "";
  const to = req.nextUrl.searchParams.get("to") || "";
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
  const toDate = to ? new Date(to) : new Date();
  const logs = await db.auditLog.findMany({ where: { createdAt: { gte: fromDate, lte: toDate } }, orderBy: { createdAt: "desc" }, take: 10000 });
  const BOM = "\uFEFF";
  const rows = logs.map((l) => [l.seq, l.createdAt.toISOString().slice(0, 10), l.actorId || "", l.action, l.entityType, l.entityId || "", l.beforeJson || "", l.afterJson || "", l.currHash]);
  const csv = BOM + ["seq,at,actor,action,entity,entityId,before,after,curr_hash", ...rows.map((r) => r.map((v) => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(",")).join("\r\n")].join("\r\n") + "\r\n";
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="audit-ledger-${fromDate.toISOString().slice(0, 10)}-${toDate.toISOString().slice(0, 10)}.csv"` } });
=======
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
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
}
