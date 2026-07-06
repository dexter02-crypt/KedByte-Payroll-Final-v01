<<<<<<< HEAD
import { NextResponse } from "next/server";
import { getQueueHealth } from "@/lib/jobs/runner";
export async function GET() { return NextResponse.json({ jobs: getQueueHealth() }); }
=======
import { NextRequest, NextResponse } from "next/server";
import { getQueueHealth } from "@/lib/jobs/runner";

// GET /api/settings/system/jobs — all 15 queue health
export async function GET() {
  const health = getQueueHealth();
  return NextResponse.json({ jobs: health });
}
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
