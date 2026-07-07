import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/support — create a support ticket
// Tickets are stored in audit_log (source of truth for the tickets list).
// No notification is created for the ticket creator — they see confirmation
// in the modal and can track it in the Support Tickets tab.
export async function POST(req: NextRequest) {
  const { topic, email, message, userId } = await req.json();

  if (!topic || !message) {
    return NextResponse.json({ error: "Topic and message are required", fields: { topic: "Required", message: "Required" } }, { status: 422 });
  }

  // Generate ticket reference
  const ticketRef = "KB-" + Date.now().toString().slice(-6);

  // Store the ticket as an audit log entry
  await db.auditLog.create({
    data: {
      tenantId: "bureau_kedbyte",
      actorId: userId || "unknown",
      action: "SUPPORT_TICKET_CREATED",
      entityType: "support",
      entityId: ticketRef,
      afterJson: JSON.stringify({ ticketRef, topic, email, message, messageLength: message.length, status: "open" }),
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

// GET /api/support — list support tickets
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
      message: data.message || "",
      messageLength: data.messageLength,
      status: data.status || "open",
      createdAt: l.createdAt,
      actorId: l.actorId,
    };
  });

  return NextResponse.json({ tickets });
}
