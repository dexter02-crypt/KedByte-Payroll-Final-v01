import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const config = [
    { key: "personalAllowance", value: "£12,570", variance: "Frozen → 2031", authority: "HMRC" },
    { key: "niPtMonthly", value: "£1,048", variance: "—", authority: "HMRC" },
    { key: "niStMonthly", value: "£417", variance: "—", authority: "HMRC" },
    { key: "niUelMonthly", value: "£4,189", variance: "—", authority: "HMRC" },
    { key: "niEeMainRate", value: "8%", variance: "−1pp vs 2025/26", authority: "HMRC" },
    { key: "niErRate", value: "15%", variance: "+1.7pp vs 2024/25", authority: "HMRC" },
    { key: "employmentAllowance", value: "£10,500", variance: "+£550 vs 2025/26", authority: "HMRC" },
    { key: "aeTriggerAnnual", value: "£10,000", variance: "—", authority: "TPR" },
    { key: "aeQeBand", value: "£520 – £4,189.17/mo", variance: "—", authority: "TPR" },
    { key: "slPlan2Threshold", value: "£29,385", variance: "Frozen → 2030", authority: "HMRC" },
    { key: "slPlan5Threshold", value: "£25,000", variance: "NEW (first live year)", authority: "HMRC" },
    { key: "nlw21", value: "£12.71/hr", variance: "+5.9% vs 2025/26", authority: "Low Pay Commission" },
    { key: "sspWeeklyMax", value: "£123.25", variance: "Day-one payable (new)", authority: "HMRC" },
    { key: "smpWeeklyFlat", value: "£194.32", variance: "—", authority: "HMRC" },
  ];
  return NextResponse.json({ taxYear: "2026-27", config });
}
