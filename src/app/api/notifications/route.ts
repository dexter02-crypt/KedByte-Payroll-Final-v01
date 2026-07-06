import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const notifications = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ notifications });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { notificationId, action, userId } = body;

  if (action === "mark-read") {
    if (!notificationId) return NextResponse.json({ error: "notificationId required" }, { status: 400 });
    await db.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "mark-all-read") {
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    const result = await db.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true, updated: result.count });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
