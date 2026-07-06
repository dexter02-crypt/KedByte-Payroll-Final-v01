import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  return NextResponse.json({ sessions: [
    { id: "sess_current", device: "Chrome · macOS", ip: "82.14.220.7", lastSeen: new Date().toISOString(), current: true },
    { id: "sess_mobile", device: "Safari · iOS", ip: "82.14.220.7", lastSeen: new Date(Date.now() - 86400000).toISOString(), current: false },
    { id: "sess_tablet", device: "Edge · Windows", ip: "10.0.0.42", lastSeen: new Date(Date.now() - 3 * 86400000).toISOString(), current: false },
  ]});
}
export async function DELETE(req: NextRequest) {
  return NextResponse.json({ ok: true, message: "Sessions revoked" });
}
