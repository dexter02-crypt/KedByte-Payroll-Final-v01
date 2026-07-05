"use client";

import * as React from "react";
import { useApp, fmtDate } from "@/store/app";
import {
  EmptyState,
  PearlButton,
  GhostButton,
  Modal,
  Field,
  TextInput,
  toast,
} from "@/components/kedbyte/primitives";
import { cn } from "@/lib/utils";

interface PendingHoliday {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
}

interface ApproveData {
  pending: PendingHoliday[];
  reportCount: number;
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  return as <= be && bs <= ae;
}

export function PortalApprovals() {
  const { user } = useApp();
  const [data, setData] = React.useState<ApproveData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [modal, setModal] = React.useState<{ holiday: PendingHoliday; action: "approve" | "reject" } | null>(null);
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(() => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/holidays/approve?userId=${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(() => toast("Failed to load approvals", "error"))
      .finally(() => setLoading(false));
  }, [user]);

  React.useEffect(() => {
    load();
  }, [load]);

  const submitDecision = async () => {
    if (!modal || !user) return;
    setSubmitting(true);
    const endpoint = modal.action === "approve" ? "/api/holidays/approve" : "/api/holidays/reject";
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holidayId: modal.holiday.id,
          note: note.trim(),
          approverId: user.id,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      toast(
        `Holiday ${d.status} · ${modal.holiday.employeeName} notified`,
        d.status === "approved" ? "success" : "info"
      );
      setModal(null);
      setNote("");
      load();
    } catch (e: any) {
      toast(e.message || "Failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-8 bg-surface-high animate-pulse" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-surface border border-subtle p-5 h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-surface border border-subtle">
        <EmptyState icon="error" title="Could not load approvals." action={load} actionLabel="Retry" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="page-title text-tprimary">Team Approvals</h1>
          <p className="text-[13px] text-tsecondary mt-1">
            Review holiday requests from your direct reports.
          </p>
        </div>
        <div className="text-right">
          <div className="data-lg text-pearl">{data.pending.length}</div>
          <div className="label-caps text-ttertiary">Pending</div>
        </div>
      </div>

      {/* Pending queue */}
      {data.pending.length === 0 ? (
        <div className="bg-surface border border-subtle">
          <EmptyState
            icon="check_circle"
            title="No pending approvals. You're all caught up."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {data.pending.map((h) => {
            // Overlap check: any other pending request from same department overlapping dates
            const overlap = data.pending.some(
              (o) =>
                o.id !== h.id &&
                o.employeeId !== h.employeeId &&
                rangesOverlap(h.startDate, h.endDate, o.startDate, o.endDate)
            );
            return (
              <div key={h.id} className="bg-surface border border-subtle p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-surface-high border border-subtle flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px] text-pearl">person</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] text-tprimary font-medium truncate">{h.employeeName}</div>
                      <div className="text-[11px] text-ttertiary font-mono truncate">{h.department || "—"}</div>
                    </div>
                  </div>
                  {overlap && (
                    <div
                      className="flex items-center gap-1.5 text-[11px] text-warning font-mono border border-warning/40 px-2 py-1 shrink-0"
                      title="Another team member has overlapping leave"
                    >
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      CLASH
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Cell label="Start" value={fmtDate(h.startDate)} />
                  <Cell label="End" value={fmtDate(h.endDate)} />
                  <Cell label="Days" value={`${h.days}`} highlight />
                </div>

                {h.reason && (
                  <div className="bg-surface-low border border-subtle p-3">
                    <span className="label-caps text-ttertiary block mb-1">Reason</span>
                    <span className="text-[13px] text-tsecondary">{h.reason}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <PearlButton
                    onClick={() => setModal({ holiday: h, action: "approve" })}
                    className="flex-1"
                  >
                    <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">check</span>
                    Approve
                  </PearlButton>
                  <GhostButton
                    onClick={() => setModal({ holiday: h, action: "reject" })}
                    className="flex-1 border-error/40 text-error hover:border-error hover:text-error"
                  >
                    <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">close</span>
                    Reject
                  </GhostButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Team summary footer */}
      <div className="bg-surface-low border border-subtle p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-ttertiary">groups</span>
          <span className="text-[12px] text-tsecondary">Direct reports</span>
        </div>
        <span className="text-[13px] font-mono text-tprimary">{data.reportCount}</span>
      </div>

      {/* Decision modal */}
      <Modal
        open={!!modal}
        onClose={() => {
          setModal(null);
          setNote("");
        }}
        title={modal?.action === "approve" ? "Approve Holiday" : "Reject Holiday"}
      >
        {modal && (
          <div className="flex flex-col gap-4">
            <div className="bg-surface-low border border-subtle p-3">
              <div className="text-[13px] text-tprimary font-medium">{modal.holiday.employeeName}</div>
              <div className="text-[12px] text-tsecondary font-mono mt-1">
                {fmtDate(modal.holiday.startDate)} → {fmtDate(modal.holiday.endDate)} · {modal.holiday.days} days
              </div>
              {modal.holiday.reason && (
                <div className="text-[12px] text-ttertiary mt-2">{modal.holiday.reason}</div>
              )}
            </div>
            <Field
              label="Note to employee"
              hint={modal.action === "approve" ? "Optional. Will be shown in the notification." : "Recommended. Helps the employee understand the decision."}
            >
              <TextInput
                value={note}
                onChange={setNote}
                placeholder={modal.action === "approve" ? "Enjoy your time off." : "Conflict with project deadline."}
              />
            </Field>
            <div className="flex gap-2 pt-1">
              <GhostButton
                onClick={() => {
                  setModal(null);
                  setNote("");
                }}
                className="flex-1"
              >
                Cancel
              </GhostButton>
              <button
                onClick={submitDecision}
                disabled={submitting}
                className={cn(
                  "flex-1 px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                  modal.action === "approve"
                    ? "bg-success text-void hover:opacity-90"
                    : "bg-error text-void hover:opacity-90"
                )}
              >
                {submitting ? "Submitting…" : modal.action === "approve" ? "Confirm Approval" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Cell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="border border-subtle p-3 flex flex-col gap-1">
      <span className="label-caps text-ttertiary">{label}</span>
      <span className={cn("text-[13px] font-mono", highlight ? "text-pearl" : "text-tprimary")}>{value}</span>
    </div>
  );
}
