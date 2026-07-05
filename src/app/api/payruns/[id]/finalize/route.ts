import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Finalize pay run — roll YTD forward, commit, create RTI submission + documents
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payRun = await db.payRun.findUnique({
    where: { id },
    include: { company: true },
  });
  if (!payRun) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (payRun.status === "committed") {
    return NextResponse.json({ status: "committed", already: true });
  }

  const entries = await db.payRunEntry.findMany({
    where: { payRunId: id, status: "approved" },
    include: { employee: true },
  });

  // Roll YTD forward
  for (const e of entries) {
    const existing = await db.ytdFigure.findUnique({
      where: { employeeId_taxYear: { employeeId: e.employeeId, taxYear: payRun.taxYear } },
    });
    if (existing) {
      await db.ytdFigure.update({
        where: { id: existing.id },
        data: {
          taxable: { increment: e.taxableGross || 0 },
          taxPaid: { increment: e.tax || 0 },
          niable: { increment: e.niableGross || 0 },
          niEe: { increment: e.niEmployee || 0 },
          niEr: { increment: e.niEmployer || 0 },
          pensionEe: { increment: e.pensionEmployee || 0 },
          pensionEr: { increment: e.pensionEmployer || 0 },
          studentLoan: { increment: e.studentLoan || 0 },
          postgradLoan: { increment: e.postgradLoan || 0 },
          gross: { increment: e.gross || 0 },
          net: { increment: e.net || 0 },
          lastPeriod: payRun.taxPeriod,
        },
      });
    } else {
      await db.ytdFigure.create({
        data: {
          employeeId: e.employeeId,
          taxYear: payRun.taxYear,
          taxable: e.taxableGross || 0,
          taxPaid: e.tax || 0,
          niable: e.niableGross || 0,
          niEe: e.niEmployee || 0,
          niEr: e.niEmployer || 0,
          pensionEe: e.pensionEmployee || 0,
          pensionEr: e.pensionEmployer || 0,
          studentLoan: e.studentLoan || 0,
          postgradLoan: e.postgradLoan || 0,
          gross: e.gross || 0,
          net: e.net || 0,
          lastPeriod: payRun.taxPeriod,
        },
      });
    }

    // Create payslip document
    await db.document.create({
      data: {
        tenantId: payRun.tenantId,
        companyId: payRun.companyId,
        employeeId: e.employeeId,
        type: "payslip",
        taxYear: payRun.taxYear,
        payRunEntryId: e.id,
        storageKey: `docs/payslips/${e.employeeId}_${payRun.taxYear}_p${payRun.taxPeriod}.pdf`,
        sha256: Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join(""),
        status: "generated",
      },
    });

    // Create notification
    await db.notification.create({
      data: {
        tenantId: payRun.tenantId,
        userId: (await db.user.findFirst({ where: { employeeId: e.employeeId } }))?.id || "user_eleanor",
        type: "payslip_ready",
        title: "Payslip ready",
        body: `Your ${payRun.company.name} payslip for period ${payRun.taxPeriod} is available.`,
        actionUrl: "payslips",
      },
    });
  }

  // Create RTI FPS submission
  const irmark = Array.from({ length: 24 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[Math.floor(Math.random() * 64)]).join("");
  const rti = await db.rtiSubmission.create({
    data: {
      tenantId: payRun.tenantId,
      companyId: payRun.companyId,
      payRunId: payRun.id,
      type: "FPS",
      taxYear: payRun.taxYear,
      taxPeriod: payRun.taxPeriod,
      xmlPayload: `<GovTalkMessage xmlns="http://www.govtalk.gov.uk/CM/envelope"><Body><IRenvelope><FullPaymentSubmission>...${entries.length} employees...</FullPaymentSubmission></IRenvelope></Body></GovTalkMessage>`,
      irmark,
      status: "pending",
    },
  });

  // Simulate HMRC acceptance after a short delay (demo)
  await db.rtiSubmission.update({
    where: { id: rti.id },
    data: {
      status: "accepted",
      correlationId: "COR-" + Math.random().toString(36).slice(2, 12).toUpperCase(),
      submittedAt: new Date(),
      resolvedAt: new Date(),
    },
  });

  await db.payRun.update({
    where: { id },
    data: { status: "committed", committedAt: new Date() },
  });

  return NextResponse.json({
    status: "committed",
    jobs: { fps: rti.id, payslips: entries.length, pension: "queued", bacs: "generated" },
  });
}
