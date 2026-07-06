"use client";

import * as React from "react";
import { useApp, gbp, fmtDate } from "@/store/app";
import {
  Stepper,
  StatusChip,
  PearlButton,
  GhostButton,
  EmptyState,
  toast,
} from "@/components/kedbyte/primitives";
import { cn } from "@/lib/utils";
import { ExportButton } from "@/components/kedbyte/export-button";

// ============ TYPES ============
interface Entry {
  id: string;
  name: string;
  payrollId: string;
  net: number | null;
  status: string;
}

interface Totals {
  gross: number;
  tax: number;
  niEe: number;
  niEr: number;
  pensEe: number;
  pensEr: number;
  net: number;
  employerCost: number;
  sl: number;
  pgl: number;
}

interface PayRun {
  id: string;
  ref: string;
  taxYear: string;
  taxPeriod: number;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  bacsSubmissionDate: string;
  status: string;
  companyName?: string;
  totals: Totals;
  entries: Entry[];
}

type CardStatus = "idle" | "submitting" | "submitted" | "accepted" | "generated" | "distributed" | "failed";

interface CardState {
  fps: CardStatus;
  pension: CardStatus;
  bacs: CardStatus;
  payslips: CardStatus;
}

const INITIAL_CARDS: CardState = { fps: "idle", pension: "idle", bacs: "idle", payslips: "idle" };

export function PayRunSubmission() {
  const { activePayRunId, setBureauView, setActivePayRun } = useApp();
  const [payRun, setPayRun] = React.useState<PayRun | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [cards, setCards] = React.useState<CardState>(INITIAL_CARDS);
  const [finalising, setFinalising] = React.useState(false);
  const [finalised, setFinalised] = React.useState(false);
  const [jobsResult, setJobsResult] = React.useState<any>(null);

  // ============ Fetch ============
  React.useEffect(() => {
    if (!activePayRunId) {
      setLoading(false);
      return;
    }
    fetch(`/api/payruns/${activePayRunId}`)
      .then((r) => r.json())
      .then((d) => {
        setPayRun(d);
        if (d.status === "committed") {
          setFinalised(true);
          setCards({ fps: "accepted", pension: "accepted", bacs: "generated", payslips: "distributed" });
        }
      })
      .catch(() => toast("Failed to load pay run", "error"))
      .finally(() => setLoading(false));
  }, [activePayRunId]);

  // ============ Card actions (local simulation) ============
  async function submitFps() {
    setCards((c) => ({ ...c, fps: "submitting" }));
    await wait(700);
    setCards((c) => ({ ...c, fps: "submitted" }));
    toast("FPS submitted to HMRC gateway", "info");
    await wait(900);
    setCards((c) => ({ ...c, fps: "accepted" }));
    toast("FPS accepted by HMRC ✓", "success");
  }

  async function submitPension() {
    setCards((c) => ({ ...c, pension: "submitting" }));
    await wait(700);
    setCards((c) => ({ ...c, pension: "submitted" }));
    toast("Pension file queued for NEST", "info");
    await wait(900);
    setCards((c) => ({ ...c, pension: "accepted" }));
    toast("NEST acknowledged contribution file ✓", "success");
  }

  function downloadBacs() {
    if (!payRun) return;
    setCards((c) => ({ ...c, bacs: "submitting" }));
    try {
      const content = generateBacsFile(payRun);
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${payRun.ref}_BACS_${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setCards((c) => ({ ...c, bacs: "generated" }));
      toast("BACS Standard-18 file generated ✓", "success");
    } catch {
      setCards((c) => ({ ...c, bacs: "failed" }));
      toast("BACS file generation failed", "error");
    }
  }

  async function distributePayslips() {
    setCards((c) => ({ ...c, payslips: "submitting" }));
    await wait(800);
    setCards((c) => ({ ...c, payslips: "distributed" }));
    toast("Payslips distributed to ESS portal ✓", "success");
  }

  // ============ Finalise ============
  async function finalise() {
    if (!payRun) return;
    setFinalising(true);
    try {
      const res = await fetch(`/api/payruns/${payRun.id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.error) {
        toast(data.error, "error");
        setFinalising(false);
        return;
      }
      setJobsResult(data.jobs);
      // Apply job statuses from finalize response
      setCards({
        fps: data.jobs?.fps ? "accepted" : "idle",
        pension: data.jobs?.pension === "queued" ? "accepted" : (data.jobs?.pension || "idle"),
        bacs: data.jobs?.bacs === "generated" ? "generated" : (data.jobs?.bacs || "idle"),
        payslips: data.jobs?.payslips ? "distributed" : "idle",
      });
      setFinalised(true);
      toast("Pay run finalised & committed ✓", "success");
    } catch {
      toast("Finalise failed", "error");
    } finally {
      setFinalising(false);
    }
  }

  // ============ Loading & empty ============
  if (!activePayRunId && !loading) {
    return (
      <div className="max-w-3xl mx-auto py-6">
        <Stepper
          steps={[
            { label: "Input", icon: "edit" },
            { label: "Calculation", icon: "calculate" },
            { label: "Review", icon: "fact_check" },
            { label: "Submission", icon: "send" },
          ]}
          current={3}
        />
        <div className="mt-6">
          <EmptyState
            icon="send"
            title="No active pay run to submit. Start from Step 1."
            action={() => setBureauView("payrun_input")}
            actionLabel="Back to Input"
          />
        </div>
      </div>
    );
  }

  if (loading || !payRun) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined text-[28px] text-ttertiary animate-spin mr-3">progress_activity</span>
        <span className="text-[13px] text-tsecondary font-mono">Loading submission…</span>
      </div>
    );
  }

  const approvedCount = payRun.entries.filter((e) => e.status === "approved").length;
  const totals = payRun.totals;

  // ============ RENDER: FINALISED SUCCESS ============
  if (finalised) {
    return (
      <div className="max-w-3xl mx-auto py-6">
        <div className="mb-6">
          <Stepper
            steps={[
              { label: "Input", icon: "edit" },
              { label: "Calculation", icon: "calculate" },
              { label: "Review", icon: "fact_check" },
              { label: "Submission", icon: "send" },
            ]}
            current={3}
          />
        </div>

        <div className="bg-surface border border-subtle p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 border-2 border-success flex items-center justify-center" style={{ borderColor: "#4ADE80" }}>
            <span className="material-symbols-outlined text-[40px] text-success">check</span>
          </div>
          <h2 className="page-title text-tprimary mb-2">Pay run complete ✓</h2>
          <p className="text-[13px] text-tsecondary mb-6">
            {payRun.ref} · {payRun.companyName} · committed at {fmtDate(new Date())}
          </p>

          {/* Job summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border-subtle mb-6" style={{ background: "rgba(245,245,245,0.06)" }}>
            <JobResult label="RTI FPS" status={cards.fps === "accepted" ? "accepted" : "—"} />
            <JobResult label="Pension" status={cards.pension === "accepted" ? "submitted" : cards.pension} />
            <JobResult label="BACS File" status={cards.bacs === "generated" ? "generated" : cards.bacs} />
            <JobResult label="Payslips" status={typeof jobsResult?.payslips === "number" ? `${jobsResult.payslips} sent` : cards.payslips === "distributed" ? "distributed" : cards.payslips} />
          </div>

          {/* Final totals */}
          <div className="grid grid-cols-3 gap-px bg-border-subtle mb-6" style={{ background: "rgba(245,245,245,0.06)" }}>
            <JobResult label="Total Net Paid" value={gbp(totals?.net || 0)} big />
            <JobResult label="Employees" value={String(approvedCount)} big />
            <JobResult label="Employer Cost" value={gbp(totals?.employerCost || 0)} big />
          </div>

          <div className="flex items-center justify-center gap-2">
            <GhostButton onClick={() => setBureauView("reports")}>
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">analytics</span>
                View Reports
              </span>
            </GhostButton>
            <PearlButton
              onClick={() => {
                setActivePayRun(null);
                setBureauView("dashboard");
              }}
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">dashboard</span>
                Return to Dashboard
              </span>
            </PearlButton>
          </div>
        </div>
      </div>
    );
  }

  // ============ RENDER: MAIN ============
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="page-title text-tprimary">Finalise &amp; Submit</h1>
              <StatusChip status={payRun.status} />
            </div>
            <p className="text-[13px] text-tsecondary">
              {payRun.ref} · {payRun.companyName} · Step 4 of 4 · Submit RTI, pension, BACS &amp; payslips
            </p>
          </div>
        </div>
        <Stepper
          steps={[
            { label: "Input", icon: "edit" },
            { label: "Calculation", icon: "calculate" },
            { label: "Review", icon: "fact_check" },
            { label: "Submission", icon: "send" },
          ]}
          current={3}
        />
      </div>

      {/* Top row: Timeline + Summary chips */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4 mb-6">
        {/* Timeline */}
        <div className="bg-surface border border-subtle p-5">
          <span className="label-caps text-tsecondary mb-4 block">Workflow Timeline</span>
          <ol className="flex flex-col gap-0">
            <TimelineNode icon="upload" label="Data Ingest" sub="Employee inputs captured" state="done" />
            <TimelineNode icon="calculate" label="Calculation" sub="Engine run · totals reconciled" state="done" />
            <TimelineNode icon="fact_check" label="Approval" sub={`${approvedCount} of ${payRun.entries.length} entries approved`} state="done" />
            <TimelineNode icon="send" label="Submission" sub="RTI · Pension · BACS · Payslips" state="active" last />
          </ol>
        </div>

        {/* Summary chips */}
        <div className="bg-surface border border-subtle p-5 grid grid-cols-3 gap-4">
          <SummaryChip
            label="Total Net Pay"
            value={gbp(totals?.net || 0)}
            big
            sub={`Pay date ${fmtDate(payRun.payDate)}`}
          />
          <SummaryChip
            label="Employees"
            value={String(approvedCount)}
            sub={`${payRun.entries.length} total records`}
          />
          <SummaryChip
            label="Period"
            value={`M${payRun.taxPeriod}`}
            sub={`TY ${payRun.taxYear.replace("-", "/")}`}
          />
          <SummaryChip
            label="Total Gross"
            value={gbp(totals?.gross || 0)}
          />
          <SummaryChip
            label="Total Tax + NI"
            value={gbp((totals?.tax || 0) + (totals?.niEe || 0) + (totals?.niEr || 0))}
          />
          <SummaryChip
            label="Employer Cost"
            value={gbp(totals?.employerCost || 0)}
          />
        </div>
      </div>

      {/* Action cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <ActionCard
          icon="cloud_upload"
          title="RTI FPS"
          subtitle="Full Payment Submission to HMRC"
          desc="Sends per-employee pay + tax details for period M{period}. Required on or before pay date."
          status={cards.fps}
          statusLabel={statusLabel(cards.fps)}
          actionLabel={actionLabel(cards.fps, "Submit FPS to HMRC")}
          onAction={submitFps}
          disabled={cards.fps !== "idle" && cards.fps !== "failed"}
        />
        <ActionCard
          icon="account_balance"
          title="Pension Contributions"
          subtitle="NEST contribution file"
          desc="EE & ER contributions for this period, packaged for the pension provider."
          status={cards.pension}
          statusLabel={statusLabel(cards.pension)}
          actionLabel={actionLabel(cards.pension, "Send to NEST")}
          onAction={submitPension}
          disabled={cards.pension !== "idle" && cards.pension !== "failed"}
        />
        <ActionCard
          icon="receipt_long"
          title="BACS File"
          subtitle="Standard-18 payment instruction"
          desc="Generates the BACS payment file for net pay disbursement to employee bank accounts. Pence amounts, contra balances to total net."
          status={cards.bacs}
          statusLabel={statusLabel(cards.bacs)}
          actionLabel={payRun?.status === "committed" ? "Download BACS" : "Commit run first"}
          onAction={payRun?.status === "committed" ? downloadBacs : undefined}
          disabled={payRun?.status !== "committed"}
          extra={payRun?.status === "committed" && (
            <ExportButton
              href={`/api/payruns/${payRun.id}/bacs`}
              label="Download BACS (std18)"
              icon="receipt_long"
              filename={`${payRun.ref}_bacs.std18.txt`}
            />
          )}
        />
        <ActionCard
          icon="mail"
          title="Payslip Distribution"
          subtitle="ESS portal delivery"
          desc="Publishes payslips to the My Pay portal — employees notified instantly."
          status={cards.payslips}
          statusLabel={statusLabel(cards.payslips)}
          actionLabel={actionLabel(cards.payslips, "Distribute Payslips")}
          onAction={distributePayslips}
          disabled={cards.payslips !== "idle" && cards.payslips !== "failed"}
        />
      </div>

      {/* Finalise bar */}
      <div className="bg-surface border border-subtle p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[24px] text-warning">lock</span>
          <div className="flex flex-col">
            <span className="text-[14px] text-tprimary font-medium">Finalise Pay Run</span>
            <span className="text-[12px] text-tsecondary">
              Commits the pay run · rolls YTD forward · creates RTI submission &amp; payslip documents · cannot be undone.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GhostButton onClick={() => setBureauView("payrun_review")}>
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to Review
            </span>
          </GhostButton>
          <PearlButton onClick={finalise} disabled={finalising}>
            {finalising ? (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                Finalising…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                Finalise Pay Run
              </span>
            )}
          </PearlButton>
        </div>
      </div>
    </div>
  );
}

// ============ SUB-COMPONENTS ============

function TimelineNode({ icon, label, sub, state, last }: { icon: string; label: string; sub: string; state: "done" | "active"; last?: boolean }) {
  return (
    <li className="flex gap-3 pb-4 relative">
      {!last && (
        <div className="absolute left-[15px] top-8 bottom-0 w-px" style={{ backgroundColor: state === "done" ? "rgba(74,222,128,0.4)" : "rgba(245,245,245,0.06)" }} />
      )}
      <div
        className={cn(
          "w-8 h-8 border flex items-center justify-center shrink-0 z-10 bg-surface",
          state === "done" && "border-success text-success",
          state === "active" && "border-warning text-warning"
        )}
        style={{ borderColor: state === "done" ? "rgba(74,222,128,0.4)" : state === "active" ? "rgba(251,191,36,0.4)" : "rgba(245,245,245,0.06)" }}
      >
        {state === "done" ? (
          <span className="material-symbols-outlined text-[16px]">check</span>
        ) : (
          <span className="material-symbols-outlined text-[16px] animate-pulse">{icon}</span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 pt-1">
        <span className={cn("text-[13px] font-medium", state === "active" ? "text-pearl" : "text-tprimary")}>{label}</span>
        <span className="text-[11px] text-ttertiary font-mono">{sub}</span>
      </div>
    </li>
  );
}

function SummaryChip({ label, value, sub, big }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label-caps text-ttertiary">{label}</span>
      <span className={cn(big ? "data-lg text-pearl" : "data-sm text-tprimary")}>{value}</span>
      {sub && <span className="text-[11px] text-ttertiary font-mono">{sub}</span>}
    </div>
  );
}

function ActionCard({
  icon,
  title,
  subtitle,
  desc,
  status,
  statusLabel,
  actionLabel,
  onAction,
  disabled,
  extra,
}: {
  icon: string;
  title: string;
  subtitle: string;
  desc: string;
  status: CardStatus;
  statusLabel: string;
  actionLabel: string;
  onAction?: () => void;
  disabled: boolean;
  extra?: React.ReactNode;
}) {
  const isRunning = status === "submitting";
  return (
    <div className="bg-surface border border-subtle p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 border border-subtle bg-surface-low flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px] text-pearl">{icon}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[14px] font-semibold text-tprimary">{title}</span>
            <span className="text-[11px] text-ttertiary font-mono">{subtitle}</span>
          </div>
        </div>
        <StatusIndicator status={status} label={statusLabel} />
      </div>
      <p className="text-[12px] text-tsecondary leading-relaxed">{desc}</p>
      {extra && <div className="flex items-center gap-2">{extra}</div>}
      <div className="flex items-center justify-between pt-2 border-t border-subtle">
        <span className="text-[11px] font-mono text-ttertiary uppercase tracking-wider">
          {isRunning ? "Transmitting…" : status === "idle" ? "Not started" : "Complete"}
        </span>
        {onAction && (
          <button
            onClick={onAction}
            disabled={disabled || isRunning}
            className={cn(
              "px-3 py-1.5 border border-subtle text-[12px] font-medium transition-colors flex items-center gap-1.5",
              "hover:border-pearl-dim hover:text-pearl",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-subtle disabled:hover:text-tsecondary"
            )}
          >
            {isRunning && <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>}
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusIndicator({ status, label }: { status: CardStatus; label: string }) {
  const cls =
    status === "accepted" || status === "generated" || status === "distributed"
      ? "text-success"
      : status === "submitting" || status === "submitted"
      ? "text-warning"
      : status === "failed"
      ? "text-error"
      : "text-ttertiary";
  const icon =
    status === "accepted" || status === "generated" || status === "distributed"
      ? "check_circle"
      : status === "submitting"
      ? "pending"
      : status === "submitted"
      ? "schedule"
      : status === "failed"
      ? "error"
      : "radio_button_unchecked";
  return (
    <span className={cn("flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider", cls)}>
      <span className={cn("material-symbols-outlined text-[14px]", status === "submitting" && "animate-spin")}>{icon}</span>
      {label}
    </span>
  );
}

function JobResult({ label, status, value, big }: { label: string; status?: string; value?: string; big?: boolean }) {
  return (
    <div className="bg-surface px-4 py-4 flex flex-col gap-1 items-center justify-center text-center">
      <span className="label-caps text-ttertiary">{label}</span>
      {value ? (
        <span className={cn("font-mono text-tprimary", big ? "text-[18px] font-bold" : "text-[14px]")}>{value}</span>
      ) : (
        <span className={cn("text-[13px] font-mono uppercase tracking-wider", status === "accepted" || status === "generated" || status === "distributed" ? "text-success" : "text-ttertiary")}>
          {status}
        </span>
      )}
    </div>
  );
}

// ============ HELPERS ============

function statusLabel(s: CardStatus): string {
  switch (s) {
    case "idle": return "Idle";
    case "submitting": return "Transmitting";
    case "submitted": return "Submitted";
    case "accepted": return "Accepted";
    case "generated": return "Generated";
    case "distributed": return "Distributed";
    case "failed": return "Failed";
  }
}

function actionLabel(s: CardStatus, base: string): string {
  if (s === "submitting") return "Working…";
  if (s === "accepted" || s === "generated" || s === "distributed") return "Done";
  if (s === "submitted") return "Submitted";
  if (s === "failed") return "Retry";
  return base;
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function generateBacsFile(payRun: PayRun): string {
  const sun = "BACS1234";
  const date = payRun.bacsSubmissionDate ? new Date(payRun.bacsSubmissionDate) : new Date();
  const processingDate = date.toISOString().slice(2, 10).replace(/-/g, "");
  const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);

  const lines: string[] = [];
  // Standard 18 header (108 chars each)
  lines.push(`HDR1A01${pad(sun, 6)}${processingDate}0001${pad("0001", 4)}${pad("", 80)}`);
  lines.push(`VOL1${pad(sun, 6)}${pad("", 96)}`);
  lines.push(`HDR2A${processingDate}${pad("0000", 4)}${pad("", 90)}`);
  lines.push(`UHL1${processingDate}NNNN${pad("0", 16)}${pad("", 80)}`);

  let seq = 1;
  let totalPence = 0;
  for (const e of payRun.entries) {
    if (e.status !== "approved") continue;
    const net = e.net || 0;
    const pence = Math.round(net * 100);
    totalPence += pence;
    const netStr = String(pence).padStart(11, "0");
    const sortCode = "123456";
    const account = "12345678";
    const name = pad(e.name.toUpperCase().replace(/[^A-Z0-9 .&/-]/g, " "), 18);
    const ref = pad((e.payrollId + payRun.ref).slice(0, 18), 18);
    const seqStr = String(seq).padStart(6, "0");
    lines.push(`   ${sortCode}${account}${netStr}17${name}${ref}${seqStr}                `);
    seq++;
  }

  // Totals
  const totalStr = String(totalPence).padStart(13, "0");
  const countStr = String(seq - 1).padStart(6, "0");
  lines.push(`EOF1A01${pad(sun, 6)}${processingDate}${countStr}${totalStr}${pad("", 70)}`);
  lines.push(`UTL1${processingDate}NNNN${totalStr}${pad("", 80)}`);
  lines.push(`EOF2A${countStr}${totalStr}${pad("", 86)}`);

  return lines.join("\n");
}
