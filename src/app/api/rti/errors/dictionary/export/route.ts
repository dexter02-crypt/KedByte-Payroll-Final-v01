import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const dict = await db.rtiErrorDictionary.findMany({ orderBy: { code: "asc" } });
  const BOM = "\uFEFF";
  const rows = dict.map((d) => [d.code, d.category || "", d.severity || "", d.hmrcMessage || "", d.cause || "", d.resolutionScreen || "", d.resolutionField || ""]);
  const csv = BOM + ["code,category,severity,hmrc_message,cause,resolution_screen,resolution_field", ...rows.map((r) => r.map((v) => /[",\n]/.test(String(v)) ? `"${v}"` : v).join(",")).join("\r\n")].join("\r\n") + "\r\n";
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="rti-error-dictionary-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
