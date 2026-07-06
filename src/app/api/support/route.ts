import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/support — create a support ticket
export async function POST(req: NextRequest) {
  const { topic, email, message, userId } = await req.json();

  if (!topic || !message) {
    return NextResponse.json({ error: "Topic and message are required", fields: { topic: "Required", message: "Required" } }, { status: 422 });
  }

  // Generate ticket reference
  const ticketRef = "KB-" + Date.now().toString().slice(-6);

  // Create a notification for the user confirming the ticket
  if (userId) {
    await db.notification.create({
      data: {
        tenantId: "bureau_kedbyte",
        userId,
        type: "support_ticket",
        title: `Support ticket ${ticketRef} created`,
        body: `Topic: ${topic}. ${message.slice(0, 100)}${message.length > 100 ? "…" : ""}. Our team will respond within 4 business hours.`,
        actionUrl: null,
      },
    });
  }

  // Audit the ticket creation
  await db.auditLog.create({
    data: {
      tenantId: "bureau_kedbyte",
      actorId: userId || "unknown",
      action: "SUPPORT_TICKET_CREATED",
      entityType: "support",
      entityId: ticketRef,
      afterJson: JSON.stringify({ ticketRef, topic, email, messageLength: message.length }),
      prevHash: "0".repeat(64),
      currHash: "0".repeat(64),
      seq: Math.floor(Date.now() / 1000),
    },
  });

  return NextResponse.json({
    ok: true,
    ticketRef,
    message: `Support ticket ${ticketRef} created — our team will respond within 4 business hours.`,
  }, { status: 201 });
}

// GET /api/support — list support tickets (for admin view)
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const logs = await db.auditLog.findMany({
    where: {
      action: "SUPPORT_TICKET_CREATED",
      ...(userId ? { actorId: userId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const tickets = logs.map((l) => {
    const data = JSON.parse(l.afterJson || "{}");
    return {
      ticketRef: data.ticketRef,
      topic: data.topic,
      email: data.email,
      messageLength: data.messageLength,
      createdAt: l.createdAt,
      actorId: l.actorId,
    };
  });

  return NextResponse.json({ tickets });
}
