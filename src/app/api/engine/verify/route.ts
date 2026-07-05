import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWorkedProof } from "@/engine/payroll";

export async function GET() {
  const proof = verifyWorkedProof();
  return NextResponse.json(proof);
}
