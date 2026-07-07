"use client";

import * as React from "react";
import { useApp, gbp, fmtDate } from "@/store/app";
import {
  Stepper,
  StatusChip,
  PearlButton,
  GhostButton,
  DataTable,
  TableRow,
  TableCell,
  EmptyState,
  Modal,
  toast,
} from "@/components/kedbyte/primitives";
import { cn } from "@/lib/utils";
import { ExportButton } from "@/components/kedbyte/export-button";

// ============ TYPES ============
interface Entry {
  id: string;
  employeeId: string;
  name: string;
  payrollId: string;
  department: string;
  salaryAnnual: number;
  taxCode: string;
  niCategory: string;
  studentLoanPlan: string | null;
  postgradLoan: boolean;
  overtimeHours: number;
  overtimeMultiplier: number;
  bonus: number;
  commission: number;
  statutoryPay: number;
  gross: number | null;
  taxableGross: number | null;
  niableGross: number | null;
  tax: number | null;
  niEmployee: number | null;
  niEmployer: number | null;
  pensionEmployee: number | null;
  pensionEmployer: number | null;
  studentLoan: number | null;
  postgradLoanDeduction: number | null;
  net: number | null;
  variancePct: number | null;
  varianceFlag: string;
  status: string;
  rejectReason: string | null;
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
  totals: {
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
  };
  entries: Entry[];
}

export function PayRunReview() {
  const { activePayRunId, setBureauView } = useApp();
  const [payRun, setPayRun] = React.useState<PayRun | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Entry | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<Entry | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // ============ Fetch ============
  const load = React.useCallback(async () => {
    if (!activePayRunId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/payruns/${activePayRunId}`);
      const d = await res.json();
      setPayRun(d);
    } catch {
      toast("Failed to load pay run", "error");
    } finally {
      setLoading(false);
    }
  }, [activePayRunId]);

  React.useEffect(() => {
    load();
  }, [load]);

  // ============ Approve / Reject ============
  async function approveEntry(id: string) {
    if (!payRun) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/payruns/${payRun.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", entryIds: [id] }),
      });
      const data = await res.json();
      if (data.ok) {
        setPayRun((prev) =>
          prev
            ? {
                ...prev,
                entries: prev.entries.map((e) => (e.id === id ? { ...e, status: "approved", rejectReason: null } : e)),
              }
            : prev
        );
        setSelected((s) => (s && s.id === id ? { ...s, status: "approved" } : s));
        toast("Entry approved", "success");
      }
    } catch {
      toast("Approve failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function rejectEntry(id: string, reason: string) {
    if (!payRun) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/payruns/${payRun.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", entryIds: [id], reason }),
      });
      const data = await res.json();
      if (data.ok) {
        setPayRun((prev) =>
          prev
            ? {
                ...prev,
                entries: prev.entries.map((e) =>
                  e.id === id ? { ...e, status: "rejected", rejectReason: reason } : e
                ),
              }
            : prev
        );
        setSelected((s) => (s && s.id === id ? { ...s, status: "rejected", rejectReason: reason } : s));
        toast("Entry rejected", "info");
      }
    } catch {
      toast("Reject failed", "error");
    } finally {
      setBusy(false);
      setRejectTarget(null);
      setRejectReason("");
    }
  }

  async function approveAll() {
    if (!payRun) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/payruns/${payRun.id}/entries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve-all" }),
      });
      const data = await res.json();
      if (data.ok) {
        setPayRun((prev) =>
          prev
            ? {
                ...prev,
                entries: prev.entries.map((e) =>
                  e.status === "calculated" || e.status === "approved" ? { ...e, status: "approved" } : e
                ),
              }
            : prev
        );
        toast("All calculated entries approved", "success");
      }
    } catch {
      toast("Approve-all failed", "error");
    } finally {
      setBusy(false);
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
          current={2}
        />
        <div className="mt-6">
          <EmptyState
            icon="fact_check"
            title="No active pay run to review. Start from Step 1."
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
        <span className="material-symbols-outlined text-[28px] text-ttertiary animate-spin-slow mr-3">progress_activity</span>
        <span className="text-[13px] text-tsecondary font-mono">Loading review…</span>
      </div>
    );
  }

  // ============ Derived ============
  const approvedCount = payRun.entries.filter((e) => e.status === "approved").length;
  const rejectedCount = payRun.entries.filter((e) => e.status === "rejected").length;
  const pendingCount = payRun.entries.filter((e) => e.status !== "approved" && e.status !== "rejected").length;
  const allDecided = pendingCount === 0 && payRun.entries.length > 0;
  const varianceWarn = payRun.entries.filter((e) => e.varianceFlag === "warn").length;
  const varianceErr = payRun.entries.filter((e) => e.varianceFlag === "error").length;
  const totals = payRun.totals;

  // ============ RENDER ============
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="page-title text-tprimary">Audit &amp; Finalise</h1>
              <StatusChip status={payRun.status} />
            </div>
            <p className="text-[13px] text-tsecondary">
              {payRun.ref} · {payRun.companyName || "Company"} · Step 3 of 4 · Approve payslips before submission
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatPill label="APPROVED" value={approvedCount} tone="success" />
            <StatPill label="REJECTED" value={rejectedCount} tone="error" />
            <StatPill label="PENDING" value={pendingCount} tone="warning" />
          </div>
        </div>
        <Stepper
          steps={[
            { label: "Input", icon: "edit" },
            { label: "Calculation", icon: "calculate" },
            { label: "Review", icon: "fact_check" },
            { label: "Submission", icon: "send" },
          ]}
          current={2}
        />
      </div>

      {/* Variance banner */}
      {(varianceWarn > 0 || varianceErr > 0) && (
        <div className="bg-surface border-l-2 border border-subtle px-4 py-3 mb-4 flex items-center justify-between gap-3" style={{ borderLeftColor: varianceErr > 0 ? "#F87171" : "#FBBF24" }}>
          <div className="flex items-center gap-3">
            <span className={cn("material-symbols-outlined text-[20px]", varianceErr > 0 ? "text-error" : "text-warning")}>
              {varianceErr > 0 ? "error" : "warning"}
            </span>
            <span className="text-[13px] text-tprimary">
              {varianceErr > 0 && <span className="text-error font-medium">{varianceErr} error{varianceErr !== 1 ? "s" : ""} </span>}
              {varianceErr > 0 && varianceWarn > 0 && <span className="text-ttertiary">· </span>}
              {varianceWarn > 0 && <span className="text-warning font-medium">{varianceWarn} warning{varianceWarn !== 1 ? "s" : ""}</span>}
              <span className="text-tsecondary"> · variance vs prior period — review before approving</span>
            </span>
          </div>
          <button
            onClick={() => {
              const e = payRun.entries.find((x) => x.varianceFlag === "error" || x.varianceFlag === "warn");
              if (e) setSelected(e);
            }}
            className="text-[12px] font-mono text-pearl hover:underline uppercase tracking-wider"
          >
            Jump to first →
          </button>
        </div>
      )}

      {/* Review toolbar + table */}
      <div className="bg-surface border border-subtle">
        <div className="flex items-center justify-between px-4 py-3 border-b border-subtle">
          <div className="flex items-center gap-3">
            <span className="label-caps text-tsecondary">Payslip Audit</span>
            <span className="text-[11px] font-mono text-ttertiary">
              {payRun.entries.length} records · Period M{payRun.taxPeriod} · {payRun.taxYear.replace("-", "/")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <GhostButton onClick={load} disabled={busy}>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Refresh
              </span>
            </GhostButton>
            <PearlButton onClick={approveAll} disabled={busy || pendingCount === 0}>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">done_all</span>
                Approve All Calculated
              </span>
            </PearlButton>
          </div>
        </div>

        {payRun.entries.length === 0 ? (
          <EmptyState icon="person_off" title="No entries to review." />
        ) : (
          <DataTable
            columns={[
              { label: "Employee" },
              { label: "Gross", className: "text-right" },
              { label: "Tax", className: "text-right" },
              { label: "NI EE", className: "text-right" },
              { label: "Pension", className: "text-right" },
              { label: "Net Pay", className: "text-right" },
              { label: "Variance", className: "text-right" },
              { label: "Status" },
              { label: "" },
            ]}
          >
            {payRun.entries.map((e) => (
              <TableRow key={e.id} selected={selected?.id === e.id} onClick={() => setSelected(e)}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-[13px] text-tprimary font-medium">{e.name}</span>
                    <span className="text-[11px] text-ttertiary font-mono">
                      {e.payrollId} · {e.taxCode} · NI {e.niCategory}
                    </span>
                  </div>
                </TableCell>
                <TableCell mono className="text-right">{gbp(e.gross)}</TableCell>
                <TableCell mono className="text-right text-tsecondary">{gbp(e.tax)}</TableCell>
                <TableCell mono className="text-right text-tsecondary">{gbp(e.niEmployee)}</TableCell>
                <TableCell mono className="text-right text-tsecondary">{gbp(e.pensionEmployee)}</TableCell>
                <TableCell mono className="text-right text-pearl">{gbp(e.net)}</TableCell>
                <TableCell mono className="text-right">
                  <VarianceCell pct={e.variancePct} flag={e.varianceFlag} />
                </TableCell>
                <TableCell>
                  <StatusChip status={e.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
                    <IconBtn
                      icon="check"
                      tone="success"
                      disabled={busy || e.status === "approved"}
                      onClick={() => approveEntry(e.id)}
                      title="Approve"
                    />
                    <IconBtn
                      icon="close"
                      tone="error"
                      disabled={busy || e.status === "rejected"}
                      onClick={() => {
                        setRejectTarget(e);
                        setRejectReason("");
                      }}
                      title="Reject"
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        )}

        {/* Totals row + footer */}
        <div className="border-t border-subtle">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border-subtle" style={{ background: "rgba(245,245,245,0.06)" }}>
            <TotalCell label="Total Gross" value={gbp(totals?.gross || 0)} />
            <TotalCell label="Total Tax" value={gbp(totals?.tax || 0)} />
            <TotalCell label="Total NI (EE+ER)" value={gbp((totals?.niEe || 0) + (totals?.niEr || 0))} />
            <TotalCell label="Total Pension" value={gbp((totals?.pensEe || 0) + (totals?.pensEr || 0))} />
            <TotalCell label="Total Net Pay" value={gbp(totals?.net || 0)} highlight />
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-4 border-t border-subtle">
          <div className="text-[12px] text-tsecondary">
            {allDecided ? (
              <span className="flex items-center gap-1.5 text-success">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                All entries reviewed — ready to submit
              </span>
            ) : (
              <span>
                <span className="font-mono text-pearl">{pendingCount}</span> pending — review all entries to continue
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activePayRunId && (
              <ExportButton
                href={`/api/payruns/${activePayRunId}/entries/export`}
                label="Export entries CSV"
                icon="table_chart"
                filename={`payrun-entries-${new Date().toISOString().slice(0, 10)}.csv`}
              />
            )}
            <GhostButton onClick={() => setBureauView("payrun_calculation")}>
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                Back
              </span>
            </GhostButton>
            <PearlButton
              disabled={!allDecided || busy}
              onClick={() => {
                setBureauView("payrun_submission");
                toast("Proceeding to final submission", "info");
              }}
            >
              <span className="flex items-center gap-2">
                Continue to Submission
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </span>
            </PearlButton>
          </div>
        </div>
      </div>

      {/* Payslip preview Modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Payslip Preview · ${selected?.name || ""}`}
        wide
      >
        {selected && <PayslipPreview entry={selected} payRun={payRun} onApprove={() => approveEntry(selected.id)} onReject={() => { setRejectTarget(selected); setRejectReason(""); }} busy={busy} />}
      </Modal>

      {/* Reject reason Modal */}
      <Modal
        open={!!rejectTarget}
        onClose={() => {
          setRejectTarget(null);
          setRejectReason("");
        }}
        title={`Reject entry · ${rejectTarget?.name || ""}`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-tsecondary">
            Mark <span className="text-tprimary font-medium">{rejectTarget?.name}</span> as rejected. A reason is required for audit log.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="label-caps text-tsecondary">Reason</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. awaiting confirmation of overtime hours from line manager"
              className="bg-surface-low border border-subtle px-3 py-2 text-[13px] text-tprimary placeholder:text-ttertiary outline-none focus:border-pearl-dim transition-colors resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-subtle">
            <GhostButton onClick={() => { setRejectTarget(null); setRejectReason(""); }}>Cancel</GhostButton>
            <PearlButton
              disabled={!rejectReason.trim() || busy}
              onClick={() => rejectTarget && rejectEntry(rejectTarget.id, rejectReason.trim())}
            >
              Confirm Reject
            </PearlButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============ SUB-COMPONENTS ============

function VarianceCell({ pct, flag }: { pct: number | null; flag: string }) {
  if (pct === null || pct === undefined) return <span className="text-ttertiary">—</span>;
  const sign = pct > 0 ? "+" : "";
  const cls = flag === "error" ? "text-error" : flag === "warn" ? "text-warning" : "text-tsecondary";
  return <span className={cls}>{sign}{pct.toFixed(2)}%</span>;
}

function StatPill({ label, value, tone }: { label: string; value: number; tone: "success" | "error" | "warning" }) {
  const cls = tone === "success" ? "text-success" : tone === "error" ? "text-error" : "text-warning";
  return (
    <div className="bg-surface-low border border-subtle px-3 py-1.5 flex items-center gap-2">
      <span className="text-[9px] font-mono uppercase tracking-wider text-ttertiary">{label}</span>
      <span className={cn("text-[13px] font-mono font-semibold", cls)}>{value}</span>
    </div>
  );
}

function TotalCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-surface px-4 py-3 flex flex-col gap-1">
      <span className="label-caps text-ttertiary">{label}</span>
      <span className={cn("data-sm", highlight ? "text-pearl" : "text-tprimary")}>{value}</span>
    </div>
  );
}

function IconBtn({
  icon,
  tone,
  disabled,
  onClick,
  title,
}: {
  icon: string;
  tone: "success" | "error";
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) {
  const cls = tone === "success" ? "text-success hover:border-success" : "text-error hover:border-error";
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-7 h-7 border border-subtle flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
        cls
      )}
    >
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
    </button>
  );
}

function PayslipPreview({
  entry,
  payRun,
  onApprove,
  onReject,
  busy,
}: {
  entry: Entry;
  payRun: PayRun;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const basic = entry.salaryAnnual / 12;
  const hourly = entry.salaryAnnual / 52 / 37.5;
  const ot = (entry.overtimeHours || 0) * hourly * (entry.overtimeMultiplier || 1.5);
  const isApproved = entry.status === "approved";
  const isRejected = entry.status === "rejected";

  return (
    <div className="flex flex-col gap-6">
      {/* Company header */}
      <div className="border border-subtle p-5 bg-surface-low">
        <div className="flex items-start justify-between">
          <div>
            <div className="label-caps text-ttertiary mb-1">Payslip</div>
            <h3 className="text-[18px] font-semibold text-tprimary">{payRun.companyName || "Company"}</h3>
            <p className="text-[11px] text-ttertiary font-mono mt-1">
              Ref {payRun.ref} · Period M{payRun.taxPeriod} · {payRun.taxYear.replace("-", "/")}
            </p>
            <p className="text-[11px] text-ttertiary font-mono">
              {fmtDate(payRun.periodStart)} → {fmtDate(payRun.periodEnd)} · Pay date {fmtDate(payRun.payDate)}
            </p>
          </div>
          <StatusChip status={entry.status} />
        </div>
      </div>

      {/* Employee details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Detail label="Employee" value={entry.name} />
        <Detail label="Payroll ID" value={entry.payrollId} mono />
        <Detail label="Tax Code" value={entry.taxCode} mono />
        <Detail label="NI Category" value={entry.niCategory} mono />
        <Detail label="Department" value={entry.department || "—"} />
        <Detail label="Student Loan" value={entry.studentLoanPlan ? `Plan ${entry.studentLoanPlan}` : "None"} mono />
        <Detail label="Postgrad Loan" value={entry.postgradLoan ? "Yes" : "No"} mono />
        <Detail label="Salary (annual)" value={gbp(entry.salaryAnnual)} mono />
      </div>

      {/* Payments & Deductions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payments */}
        <div className="border border-subtle">
          <div className="px-4 py-2 border-b border-subtle bg-surface">
            <span className="label-caps text-tsecondary">Payments</span>
          </div>
          <div className="p-4 flex flex-col gap-2">
            <PayLine label="Basic Salary" value={gbp(basic)} />
            {entry.overtimeHours > 0 && (
              <PayLine label={`Overtime (${entry.overtimeHours}h × 1.5)`} value={gbp(ot)} />
            )}
            {entry.bonus > 0 && <PayLine label="Bonus" value={gbp(entry.bonus)} />}
            {entry.commission > 0 && <PayLine label="Commission" value={gbp(entry.commission)} />}
            {(entry.statutoryPay || 0) > 0 && <PayLine label="Statutory Pay" value={gbp(entry.statutoryPay)} />}
            <div className="border-t border-subtle pt-2 mt-1 flex items-center justify-between">
              <span className="text-[13px] text-tprimary font-medium">Gross Pay</span>
              <span className="data-sm text-pearl">{gbp(entry.gross)}</span>
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div className="border border-subtle">
          <div className="px-4 py-2 border-b border-subtle bg-surface">
            <span className="label-caps text-tsecondary">Deductions</span>
          </div>
          <div className="p-4 flex flex-col gap-2">
            <PayLine label="Income Tax (PAYE)" value={`-${gbp(entry.tax)}`} tone="neg" />
            <PayLine label="National Insurance (EE)" value={`-${gbp(entry.niEmployee)}`} tone="neg" />
            {(entry.pensionEmployee || 0) > 0 && (
              <PayLine label="Pension (EE)" value={`-${gbp(entry.pensionEmployee)}`} tone="neg" />
            )}
            {(entry.studentLoan || 0) > 0 && (
              <PayLine label={`Student Loan ${entry.studentLoanPlan ? `(${entry.studentLoanPlan})` : ""}`} value={`-${gbp(entry.studentLoan)}`} tone="neg" />
            )}
            {(entry.postgradLoanDeduction || 0) > 0 && (
              <PayLine label="Postgraduate Loan" value={`-${gbp(entry.postgradLoanDeduction)}`} tone="neg" />
            )}
            <div className="border-t border-subtle pt-2 mt-1 flex items-center justify-between">
              <span className="text-[13px] text-tprimary font-medium">Total Deductions</span>
              <span className="data-sm text-error">
                -
                {gbp(
                  (entry.tax || 0) +
                    (entry.niEmployee || 0) +
                    (entry.pensionEmployee || 0) +
                    (entry.studentLoan || 0) +
                    (entry.postgradLoanDeduction || 0)
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Net pay */}
      <div className="border border-subtle bg-surface-low p-5 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="label-caps text-tsecondary">Net Pay</span>
          <span className="text-[11px] text-ttertiary font-mono">Take-home for {fmtDate(payRun.payDate)}</span>
        </div>
        <span className="data-lg text-pearl">{gbp(entry.net)}</span>
      </div>

      {/* Variance note */}
      {entry.varianceFlag !== "none" && entry.variancePct !== null && (
        <div className="border-l-2 border border-subtle px-4 py-3 flex items-center gap-3" style={{ borderLeftColor: entry.varianceFlag === "error" ? "#F87171" : "#FBBF24" }}>
          <span className={cn("material-symbols-outlined text-[18px]", entry.varianceFlag === "error" ? "text-error" : "text-warning")}>
            {entry.varianceFlag === "error" ? "error" : "warning"}
          </span>
          <span className="text-[12px] text-tprimary">
            Net pay variance {entry.variancePct > 0 ? "+" : ""}{entry.variancePct.toFixed(2)}% vs prior period — flagged as {entry.varianceFlag.toUpperCase()}
          </span>
        </div>
      )}

      {/* Reject reason shown if rejected */}
      {isRejected && entry.rejectReason && (
        <div className="border border-subtle border-l-error px-4 py-3" style={{ borderLeftColor: "#F87171" }}>
          <span className="label-caps text-error">Rejection Reason</span>
          <p className="text-[13px] text-tprimary mt-1">{entry.rejectReason}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-subtle">
        <span className="text-[11px] font-mono text-ttertiary uppercase tracking-wider">
          {isApproved ? "Approved — ready for submission" : isRejected ? "Rejected — excluded from submission" : "Decision pending"}
        </span>
        <div className="flex items-center gap-2">
          <GhostButton disabled={busy || isRejected} onClick={onReject}>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">close</span>
              Reject
            </span>
          </GhostButton>
          <PearlButton disabled={busy || isApproved} onClick={onApprove}>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">check</span>
              Approve
            </span>
          </PearlButton>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label-caps text-ttertiary">{label}</span>
      <span className={cn("text-[13px] text-tprimary", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function PayLine({ label, value, tone }: { label: string; value: string; tone?: "neg" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-tsecondary">{label}</span>
      <span className={cn("data-sm", tone === "neg" ? "text-tsecondary" : "text-tprimary")}>{value}</span>
    </div>
  );
}
