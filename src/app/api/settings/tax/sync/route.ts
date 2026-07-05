import { NextRequest, NextResponse } from "next/server";

// POST /api/settings/tax/sync — starts HMRC sync job, returns reviewable diff
export async function POST(req: NextRequest) {
  const { year } = await req.json();
  // In production: enqueue tax:sync job. For demo: return a diff to review.
  const diff = [
    { key: "nlw_21", label: "National Living Wage (21+)", current: 12.0, incoming: 12.71, source: "gov.uk rates page", accept: false },
    { key: "ssp_week", label: "SSP Weekly (max)", current: 118.22, incoming: 123.25, source: "gov.uk rates page", accept: false },
    { key: "ni_er_rate", label: "NI Employer Rate", current: 13.8, incoming: 15, source: "gov.uk rates page", accept: false },
  ];
  return NextResponse.json({ jobId: "tax-sync-" + Date.now(), diff, status: "review" });
}
