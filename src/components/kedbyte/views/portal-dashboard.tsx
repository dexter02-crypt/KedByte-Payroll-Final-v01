"use client";

import * as React from "react";
import { useApp, gbp, fmtDate, type PortalView } from "@/store/app";
import {
  PearlButton,
  GhostButton,
  EmptyState,
  toast,
} from "@/components/kedbyte/primitives";
import { cn } from "@/lib/utils";

interface DashboardData {
  employee: {
    id: string;
    name: string;
    firstName: string;
    company: string;
    department: string;
    jobTitle: string;
    payrollId: string;
  };
  nextPayDate: string | null;
  latestNet: number | null;
  latestPayDate: string | null;
  ytd: {
    gross: number;
    taxable: number;
    taxPaid: number;
    niEe: number;
    net: number;
    pensionEe: number;
    studentLoan: number;
  };
  payslips: { id: string; taxYear: string; generatedAt: string; payRunEntryId: string | null }[];
  holidayBalance: number;
  holidayEntitlement: number;
  holidayUsed: number;
  pendingHolidays: number;
  notifications: any[];
  isManager: boolean;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function todayString(): string {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) + " Pay";
}

function SkeletonCard() {
  return (
    <div className="bg-surface border border-subtle p-6 flex flex-col gap-3 animate-pulse">
      <div className="h-3 w-24 bg-surface-high" />
      <div className="h-8 w-40 bg-surface-high" />
      <div className="h-3 w-20 bg-surface-high" />
    </div>
  );
}

function HolidayRing({ used, entitlement, pending }: { used: number; entitlement: number; pending: number }) {
  const remaining = Math.max(0, entitlement - used - pending);
  const size = 132;
  const stroke = 8;
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
            strokeLinecap="butt"
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
            strokeLinecap="butt"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="data-lg text-pearl">{remaining}</span>
        <span className="label-caps text-ttertiary mt-0.5">days left</span>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  sublabel,
  onClick,
  badge,
}: {
  icon: string;
  label: string;
  sublabel: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="relative bg-surface border border-subtle p-4 flex flex-col items-start gap-3 text-left hover:bg-surface-high hover:border-pearl-dim transition-colors group"
    >
      <span className="material-symbols-outlined text-[22px] text-pearl group-hover:text-white">{icon}</span>
      <div>
        <div className="text-[13px] text-tprimary font-medium">{label}</div>
        <div className="text-[11px] text-ttertiary font-mono mt-0.5">{sublabel}</div>
      </div>
      {badge && (
        <span className="absolute top-2 right-2 text-[10px] font-mono font-semibold text-warning border border-warning/40 px-1.5 py-0.5">
          {badge}
        </span>
      )}
    </button>
  );
}

export function PortalDashboard({ onNavigate }: { onNavigate: (v: PortalView) => void }) {
  const { user } = useApp();
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [showPay, setShowPay] = React.useState(false);

  const load = React.useCallback(() => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/ess/dashboard?userId=${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(() => toast("Failed to load dashboard", "error"))
      .finally(() => setLoading(false));
  }, [user]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-10 bg-surface-high animate-pulse" />
        <SkeletonCard />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-surface border border-subtle p-4 h-20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-surface border border-subtle">
        <EmptyState
          icon="error"
          title="Could not load your dashboard. Please try again."
          action={load}
          actionLabel="Retry"
        />
      </div>
    );
  }

  const emp = data.employee;
  const ytd = data.ytd;
  const latestDate = data.latestPayDate ? new Date(data.latestPayDate) : null;
  const latestLabel = latestDate ? monthLabel(latestDate) : "Latest Pay";
  const payslipsThisYear = data.payslips.filter((p) => p.taxYear === "2026-27").length;
  const upcomingEvents: { label: string; sub: string; icon: string; onClick?: () => void }[] = [];
  if (data.nextPayDate) {
    upcomingEvents.push({
      label: "Next pay date",
      sub: fmtDate(data.nextPayDate),
      icon: "payments",
    });
  }
  if (data.holidayBalance > 0 && data.holidayEntitlement > 0) {
    upcomingEvents.push({
      label: "Holiday remaining",
      sub: `${data.holidayBalance} days · ${data.holidayUsed} used`,
      icon: "calendar_today",
      onClick: () => onNavigate("holidays"),
    });
  }
  if (data.pendingHolidays > 0) {
    upcomingEvents.push({
      label: "Pending holiday request",
      sub: `${data.pendingHolidays} day(s) awaiting approval`,
      icon: "schedule",
      onClick: () => onNavigate("holidays"),
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Greeting */}
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] sm:text-[26px] font-semibold text-tprimary tracking-tight">
          {greeting()}, {emp.firstName}
        </h1>
        <p className="text-[13px] text-ttertiary font-mono">{todayString()}</p>
      </div>

      {/* Manager approval badge */}
      {data.isManager && (
        <button
          onClick={() => onNavigate("approvals")}
          className="flex items-center justify-between bg-surface border border-warning/40 px-5 py-3 hover:bg-surface-high transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px] text-warning">groups</span>
            <div className="text-left">
              <div className="text-[13px] text-tprimary font-medium">Pending team approvals</div>
              <div className="text-[11px] text-ttertiary font-mono">Tap to review your team&apos;s holiday requests</div>
            </div>
          </div>
          <span className="material-symbols-outlined text-[18px] text-warning">arrow_forward</span>
        </button>
      )}

      {/* Hero pay card */}
      <div className="bg-surface border border-subtle p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="label-caps text-tsecondary">Latest pay</span>
            <span className="text-[14px] text-tprimary font-medium">{latestLabel}</span>
          </div>
          {latestDate && (
            <div className="flex flex-col items-end gap-1">
              <span className="label-caps text-tsecondary">Paid on</span>
              <span className="text-[13px] text-tsecondary font-mono">{fmtDate(latestDate)}</span>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowPay((s) => !s)}
          className="flex items-baseline gap-3 group w-full text-left"
          aria-label={showPay ? "Hide pay amount" : "Reveal pay amount"}
        >
          <span className="data-lg text-pearl" style={{ fontSize: 36 }}>
            {showPay ? gbp(data.latestNet) : "••••••"}
          </span>
          <span className="material-symbols-outlined text-[16px] text-ttertiary group-hover:text-tsecondary transition-colors">
            {showPay ? "visibility_off" : "visibility"}
          </span>
          <span className="text-[11px] text-ttertiary font-mono ml-auto">
            {showPay ? "Tap to hide" : "Tap to reveal"}
          </span>
        </button>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border border-subtle divide-x divide-subtle">
          <StatCell label="Gross" value={ytd.gross} />
          <StatCell label="Tax" value={-ytd.taxPaid} negative />
          <StatCell label="NI" value={-ytd.niEe} negative />
          <StatCell label="Pension" value={-ytd.pensionEe} negative />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <PearlButton onClick={() => onNavigate("payslips")} className="flex-1">
            <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">receipt_long</span>
            View Full Breakdown
          </PearlButton>
          <GhostButton onClick={() => toast("Download queued · PDF will appear shortly", "info")} className="flex-1">
            <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">download</span>
            Download PDF
          </GhostButton>
        </div>
      </div>

      {/* Quick Actions grid */}
      <div className="flex flex-col gap-3">
        <h2 className="section-title text-tsecondary">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction
            icon="calendar_today"
            label="Request Holiday"
            sublabel={`${data.holidayBalance} days left`}
            onClick={() => onNavigate("holidays")}
          />
          <QuickAction
            icon="receipt_long"
            label="View Payslips"
            sublabel={`${payslipsThisYear} this year`}
            onClick={() => onNavigate("payslips")}
          />
          <QuickAction
            icon="person"
            label="Update Details"
            sublabel="Profile completeness"
            onClick={() => onNavigate("details")}
          />
          <QuickAction
            icon="folder"
            label="Documents"
            sublabel="Payslips · P60 · P45"
            onClick={() => onNavigate("documents")}
          />
        </div>
      </div>

      {/* YTD strip */}
      <div className="bg-surface border border-subtle p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title text-tprimary">Year to Date</h2>
          <span className="text-[11px] text-ttertiary font-mono">Tax Year 2026-27</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <YtdCell label="Gross" value={gbp(ytd.gross)} />
          <YtdCell label="Tax" value={gbp(ytd.taxPaid)} />
          <YtdCell label="NI" value={gbp(ytd.niEe)} />
          <YtdCell label="Net" value={gbp(ytd.net)} highlight />
        </div>
      </div>

      {/* Holiday balance + Upcoming events */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface border border-subtle p-5 flex flex-col items-center gap-4">
          <div className="flex items-center justify-between w-full">
            <h2 className="section-title text-tprimary">Holiday Balance</h2>
            <span className="material-symbols-outlined text-[18px] text-ttertiary">calendar_today</span>
          </div>
          <HolidayRing used={data.holidayUsed} entitlement={data.holidayEntitlement} pending={data.pendingHolidays} />
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <Legend color="#E8E4E0" label={`${data.holidayUsed} used`} />
            <Legend color="#FBBF24" label={`${data.pendingHolidays} pending`} />
            <Legend color="rgba(245,245,245,0.15)" label={`${data.holidayEntitlement} total`} />
          </div>
          <GhostButton onClick={() => onNavigate("holidays")} className="w-full">
            Manage Holidays
          </GhostButton>
        </div>

        <div className="bg-surface border border-subtle p-5 flex flex-col">
          <h2 className="section-title text-tprimary mb-4">Upcoming</h2>
          {upcomingEvents.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[12px] text-ttertiary">Nothing scheduled.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3 flex-1">
              {upcomingEvents.map((e, i) => (
                <button
                  key={i}
                  onClick={e.onClick}
                  disabled={!e.onClick}
                  className={cn(
                    "flex items-center gap-3 py-2 text-left",
                    e.onClick && "hover:opacity-80 transition-opacity"
                  )}
                >
                  <span className="material-symbols-outlined text-[20px] text-pearl">{e.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-tprimary truncate">{e.label}</div>
                    <div className="text-[11px] text-ttertiary font-mono truncate">{e.sub}</div>
                  </div>
                  {e.onClick && <span className="material-symbols-outlined text-[16px] text-ttertiary">arrow_forward</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent notifications preview */}
      {data.notifications.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title text-tsecondary">Recent Notifications</h2>
            <button
              onClick={() => onNavigate("notifications")}
              className="text-[12px] text-tsecondary hover:text-pearl transition-colors flex items-center gap-1"
            >
              View all
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
          <div className="bg-surface border border-subtle divide-y divide-subtle">
            {data.notifications.slice(0, 3).map((n: any) => (
              <div key={n.id} className="flex items-start gap-3 px-4 py-3">
                <span className="material-symbols-outlined text-[18px] text-pearl shrink-0">
                  {notifIcon(n.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-tprimary truncate">{n.title}</div>
                  <div className="text-[11px] text-ttertiary font-mono">{fmtDate(n.createdAt)}</div>
                </div>
                {!n.readAt && <span className="w-1.5 h-1.5 bg-pearl mt-1.5" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function notifIcon(type: string): string {
  switch (type) {
    case "payslip_ready": return "description";
    case "holiday_decision": return "event";
    case "bank_change": return "account_balance";
    case "p60_ready": return "task_alt";
    case "pay_date": return "payments";
    default: return "info";
  }
}

function StatCell({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div className="flex flex-col gap-1 p-3">
      <span className="label-caps text-ttertiary">{label}</span>
      <span className={cn("data-sm font-mono", negative ? "text-error" : "text-tprimary")}>
        {gbp(Math.abs(value))}
        {negative && <span className="text-ttertiary"> (−)</span>}
      </span>
    </div>
  );
}

function YtdCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label-caps text-ttertiary">{label}</span>
      <span className={cn("data-sm font-mono", highlight ? "text-pearl" : "text-tprimary")}>{value}</span>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 inline-block" style={{ backgroundColor: color }} />
      <span className="text-ttertiary">{label}</span>
    </div>
  );
}
