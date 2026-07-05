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
  const { notificationId, action } = await req.json();
  if (action === "mark-read") {
    await db.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  } else if (action === "mark-all-read") {
    const { userId } = await req.json();
    await db.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}
