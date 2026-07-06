import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const committedRuns = await db.payRun.findMany({ where: { status: "committed", taxYear: "2026-27" } });
  const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const monthlyData: Record<number, any> = {};
  for (const pr of committedRuns) {
    try {
      const t = JSON.parse(pr.totalsJson);
      if (!monthlyData[pr.taxPeriod]) monthlyData[pr.taxPeriod] = { gross: 0, tax: 0, niEe: 0, niEr: 0, net: 0, pensEe: 0, pensEr: 0 };
      monthlyData[pr.taxPeriod].gross += t.gross || 0;
      monthlyData[pr.taxPeriod].tax += t.tax || 0;
      monthlyData[pr.taxPeriod].niEe += t.niEe || 0;
      monthlyData[pr.taxPeriod].niEr += t.niEr || 0;
      monthlyData[pr.taxPeriod].net += t.net || 0;
      monthlyData[pr.taxPeriod].pensEe += t.pensEe || 0;
      monthlyData[pr.taxPeriod].pensEr += t.pensEr || 0;
    } catch {}
  }
  const BOM = "\uFEFF";
  const rows = Object.keys(monthlyData).sort((a, b) => Number(a) - Number(b)).map((k) => [months[Number(k) - 1] || `M${k}`, (monthlyData[Number(k)].gross).toFixed(2), (monthlyData[Number(k)].tax).toFixed(2), (monthlyData[Number(k)].niEe + monthlyData[Number(k)].niEr).toFixed(2), (monthlyData[Number(k)].pensEe + monthlyData[Number(k)].pensEr).toFixed(2), (monthlyData[Number(k)].net).toFixed(2)]);
  const csv = BOM + ["Month,Gross,Tax,NI,Pension,Net", ...rows.map((r) => r.join(","))].join("\r\n") + "\r\n";
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
