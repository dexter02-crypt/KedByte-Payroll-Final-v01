import { NextResponse } from "next/server";
<<<<<<< HEAD
export function GET() { return NextResponse.json({ error: "Not found", type: "not_found", status: 404 }, { status: 404 }); }
export function POST() { return NextResponse.json({ error: "Not found", type: "not_found", status: 404 }, { status: 404 }); }
export function PUT() { return NextResponse.json({ error: "Not found", type: "not_found", status: 404 }, { status: 404 }); }
export function DELETE() { return NextResponse.json({ error: "Not found", type: "not_found", status: 404 }, { status: 404 }); }
=======

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
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
