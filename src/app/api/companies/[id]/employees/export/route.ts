import { NextRequest, NextResponse } from "next/server";
import { runExport, employeeListSpec } from "@/server/exports";

// GET /api/companies/[id]/employees/export — E13 employee list CSV (masked NINO/bank)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = { tenantId: "bureau_kedbyte", userId: "user_admin" };
  try {
    const spec = await employeeListSpec(id, ctx.tenantId);
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
}
