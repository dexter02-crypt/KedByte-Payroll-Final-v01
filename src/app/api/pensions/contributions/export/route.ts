import { NextRequest, NextResponse } from "next/server";
import { runExport, papdisSpec, nestCsvSpec } from "@/server/exports";

// GET /api/pensions/contributions/export?payRunId=&format=papdis|nest-csv
// E1 PAPDIS / E2 NEST CSV — MODE A (rows = enrolled employees in the run)
export async function GET(req: NextRequest) {
  const payRunId = req.nextUrl.searchParams.get("payRunId");
  const format = (req.nextUrl.searchParams.get("format") || "papdis") as "papdis" | "nest-csv";
  if (!payRunId) return NextResponse.json({ error: "payRunId required" }, { status: 400 });

  const ctx = { tenantId: "bureau_kedbyte", userId: "user_admin" };
  try {
    const spec = format === "papdis" ? await papdisSpec(payRunId, ctx.tenantId) : await nestCsvSpec(payRunId, ctx.tenantId);
    const r = await runExport(spec, ctx);
    if (r.mode === "direct") {
      return new NextResponse(r.body, {
        headers: {
          "Content-Type": r.contentType,
          "Content-Disposition": `attachment; filename="${r.filename}"`,
        },
      });
    }
    return NextResponse.json({ jobId: r.jobId }, { status: 202 });
  } catch (e: any) {
    if (e.message?.startsWith("409:")) {
      return NextResponse.json({ error: e.message.slice(4) }, { status: 409 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
