import { NextRequest, NextResponse } from "next/server";
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
}
