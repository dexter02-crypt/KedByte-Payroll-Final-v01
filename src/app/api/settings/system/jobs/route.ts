import { NextRequest, NextResponse } from "next/server";
import { getQueueHealth } from "@/lib/jobs/runner";

// GET /api/settings/system/jobs — all 15 queue health
export async function GET() {
  const health = getQueueHealth();
  return NextResponse.json({ jobs: health });
}
