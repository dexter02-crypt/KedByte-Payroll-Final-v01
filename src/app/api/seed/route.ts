import { NextRequest, NextResponse } from "next/server";
import { seedDatabase } from "@/lib/seed";

export async function POST(req: NextRequest) {
  try {
    const result = await seedDatabase();
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("Seed error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
