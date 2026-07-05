import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const entries = await db.payRunEntry.findMany({
    where: { payRunId: id },
    include: { employee: true },
  });

  if (body.action === "approve-all") {
    for (const e of entries) {
      if (e.status === "calculated") {
        await db.payRunEntry.update({ where: { id: e.id }, data: { status: "approved" } });
      }
    }
    const allApproved = entries.every((e) => e.status === "approved" || e.status === "rejected");
    if (allApproved) {
      await db.payRun.update({ where: { id }, data: { status: "review" } });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  if (body.action === "approve") {
    for (const entryId of body.entryIds || []) {
      await db.payRunEntry.update({ where: { id: entryId }, data: { status: "approved" } });
    }
  } else if (body.action === "reject") {
    for (const entryId of body.entryIds || []) {
      await db.payRunEntry.update({ where: { id: entryId }, data: { status: "rejected", rejectReason: body.reason } });
    }
  }

  return NextResponse.json({ ok: true });
}
