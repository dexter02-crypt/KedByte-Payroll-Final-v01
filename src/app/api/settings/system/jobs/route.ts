import { NextResponse } from "next/server";
import { getQueueHealth } from "@/lib/jobs/runner";
export async function GET() { return NextResponse.json({ jobs: getQueueHealth() }); }
