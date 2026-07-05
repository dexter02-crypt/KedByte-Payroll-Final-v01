import { NextResponse } from "next/server";

// Catch-all for unknown API routes → JSON 404 (not HTML)
export function GET() {
  return NextResponse.json({ error: "Not found", type: "not_found", status: 404 }, { status: 404 });
}
export function POST() {
  return NextResponse.json({ error: "Not found", type: "not_found", status: 404 }, { status: 404 });
}
export function PUT() {
  return NextResponse.json({ error: "Not found", type: "not_found", status: 404 }, { status: 404 });
}
export function DELETE() {
  return NextResponse.json({ error: "Not found", type: "not_found", status: 404 }, { status: 404 });
}
