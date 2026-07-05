"use client";

import * as React from "react";
import { useApp, fmtDate } from "@/store/app";
import {
  StatusChip,
  DataTable,
  TableRow,
  TableCell,
  EmptyState,
  PearlButton,
  Field,
  TextInput,
  toast,
} from "@/components/kedbyte/primitives";
import { cn } from "@/lib/utils";

interface Holiday {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  decidedAt: string | null;
  decisionNote: string | null;
}

interface HolidayData {
  holidays: Holiday[];
  balance: number;
  entitlement: number;
  used: number;
  pending: number;
}

function countWorkingDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  if (s > e) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function toISOInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function HolidayRing({ used, entitlement, pending }: { used: number; entitlement: number; pending: number }) {
  const remaining = Math.max(0, entitlement - used - pending);
  const size = 168;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const usedPct = entitlement > 0 ? Math.min(1, used / entitlement) : 0;
  const pendingPct = entitlement > 0 ? Math.min(1 - usedPct, pending / entitlement) : 0;
  const usedOffset = c * (1 - usedPct);
  const pendingOffset = c * (1 - usedPct - pendingPct);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(245,245,245,0.06)" strokeWidth={stroke} fill="none" />
        {pendingPct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="#FBBF24"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={pendingOffset}
          />
        )}
        {usedPct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="#E8E4E0"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={usedOffset}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[40px] font-mono font-bold text-pearl leading-none">{remaining}</span>
        <span className="label-caps text-ttertiary mt-1">days remaining</span>
      </div>
    </div>
  );
}

export function PortalHolidays() {
  const { user } = useApp();
  const [data, setData] = React.useState<HolidayData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(() => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/ess/holidays?userId=${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(() => toast("Failed to load holidays", "error"))
      .finally(() => setLoading(false));
  }, [user]);

  React.useEffect(() => {
    load();
  }, [load]);

  const days = countWorkingDays(startDate, endDate);
  const canSubmit = startDate && endDate && days > 0 && reason.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/ess/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, startDate, endDate, reason: reason.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to submit");
      toast("Request submitted · pending manager approval", "success");
      setStartDate("");
      setEndDate("");
      setReason("");
      load();
    } catch (e: any) {
      toast(e.message || "Failed to submit", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-8 bg-surface-high animate-pulse" />
        <div className="bg-surface border border-subtle p-6 h-64 animate-pulse" />
        <div className="h-64 bg-surface border border-subtle animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-surface border border-subtle">
        <EmptyState icon="error" title="Could not load your holidays." action={load} actionLabel="Retry" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="page-title text-tprimary">Holidays</h1>
        <p className="text-[13px] text-tsecondary mt-1">Request time off and track your leave balance.</p>
      </div>

      {/* Balance ring + legend */}
      <div className="bg-surface border border-subtle p-6 flex flex-col sm:flex-row items-center gap-6">
        <HolidayRing used={data.used} entitlement={data.entitlement} pending={data.pending} />
        <div className="flex-1 grid grid-cols-2 gap-4 w-full">
          <BalanceStat label="Entitlement" value={data.entitlement} color="text-tprimary" />
          <BalanceStat label="Used" value={data.used} color="text-pearl" />
          <BalanceStat label="Pending" value={data.pending} color="text-warning" />
          <BalanceStat label="Remaining" value={Math.max(0, data.entitlement - data.used - data.pending)} color="text-success" />
        </div>
      </div>

      {/* Request form */}
      <div className="bg-surface border border-subtle p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="section-title text-tprimary">Request Holiday</h2>
          {days > 0 && (
            <span className="text-[12px] font-mono text-pearl">
              {days} working {days === 1 ? "day" : "days"}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Start Date">
            <TextInput type="date" value={startDate} onChange={setStartDate} />
          </Field>
          <Field label="End Date">
            <TextInput type="date" value={endDate} onChange={setEndDate} />
          </Field>
        </div>
        <Field label="Reason" hint="A short note for your manager (e.g. Annual leave, Family, Medical).">
          <TextInput value={reason} onChange={setReason} placeholder="e.g. Annual leave — summer break" />
        </Field>
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-ttertiary font-mono">
            Working days calculated Mon–Fri (bank holidays excluded by manager).
          </p>
          <PearlButton onClick={submit} disabled={!canSubmit}>
            {submitting ? "Submitting…" : "Request Holiday"}
          </PearlButton>
        </div>
      </div>

      {/* History table */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title text-tsecondary">History</h2>
          <span className="text-[11px] text-ttertiary font-mono">{data.holidays.length} requests</span>
        </div>
        {data.holidays.length === 0 ? (
          <div className="bg-surface border border-subtle">
            <EmptyState icon="calendar_today" title="No holiday requests yet." />
          </div>
        ) : (
          <DataTable
            columns={[
              { label: "Start" },
              { label: "End" },
              { label: "Days", className: "text-right" },
              { label: "Reason" },
              { label: "Status" },
              { label: "Note" },
            ]}
          >
            {data.holidays.map((h) => (
              <TableRow key={h.id}>
                <TableCell mono className="text-tsecondary">{fmtDate(h.startDate)}</TableCell>
                <TableCell mono className="text-tsecondary">{fmtDate(h.endDate)}</TableCell>
                <TableCell mono className="text-right text-tprimary">{h.days}</TableCell>
                <TableCell className="text-tsecondary">{h.reason || "—"}</TableCell>
                <TableCell><StatusChip status={h.status} /></TableCell>
                <TableCell className="text-ttertiary text-[12px]">
                  {h.decisionNote || (h.status === "pending" ? "Awaiting manager" : "—")}
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  );
}

function BalanceStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="border border-subtle p-4 flex flex-col gap-1">
      <span className="label-caps text-ttertiary">{label}</span>
      <span className={cn("data-lg", color)}>{value}</span>
    </div>
  );
}
