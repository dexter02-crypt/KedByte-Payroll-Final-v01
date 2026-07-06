import { NextRequest, NextResponse } from "next/server";
<<<<<<< HEAD
export async function GET(req: NextRequest) {
  return NextResponse.json({ sessions: [
    { id: "sess_current", device: "Chrome · macOS", ip: "82.14.220.7", lastSeen: new Date().toISOString(), current: true },
    { id: "sess_mobile", device: "Safari · iOS", ip: "82.14.220.7", lastSeen: new Date(Date.now() - 86400000).toISOString(), current: false },
    { id: "sess_tablet", device: "Edge · Windows", ip: "10.0.0.42", lastSeen: new Date(Date.now() - 3 * 86400000).toISOString(), current: false },
  ]});
}
export async function DELETE(req: NextRequest) {
  return NextResponse.json({ ok: true, message: "Sessions revoked" });
=======
import { db } from "@/lib/db";

// GET /api/account/sessions — list my sessions
// DELETE /api/account/sessions/[id] — revoke a session (bumps token_version for others)

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // Demo: return mock sessions (production: read from refresh_tokens table)
  return NextResponse.json({
    sessions: [
      { id: "sess_current", device: "Chrome · macOS", ip: "82.14.220.7", lastSeen: new Date().toISOString(), current: true },
      { id: "sess_mobile", device: "Safari · iOS", ip: "82.14.220.7", lastSeen: new Date(Date.now() - 86400000).toISOString(), current: false },
      { id: "sess_tablet", device: "Edge · Windows", ip: "10.0.0.42", lastSeen: new Date(Date.now() - 3 * 86400000).toISOString(), current: false },
    ],
  });
}

export async function DELETE(req: NextRequest) {
  const { sessionId, userId, revokeAll } = await req.json();

  if (revokeAll) {
    // Revoke all other sessions: bump token_version (keeps current via fresh issue)
    await db.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    return NextResponse.json({ ok: true, message: "All other sessions revoked" });
  }

  // Demo: just acknowledge single revoke
  return NextResponse.json({ ok: true, message: `Session ${sessionId} revoked` });
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
}
