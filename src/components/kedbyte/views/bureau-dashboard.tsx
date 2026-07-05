"use client";

import * as React from "react";
import { useApp, gbp, gbpShort, fmtDate, fmtDateTime } from "@/store/app";
import {
  StatCard,
  StatusChip,
  DataTable,
  TableRow,
  TableCell,
  EmptyState,
  PearlButton,
  GhostButton,
  toast,
} from "@/components/kedbyte/primitives";

interface ActivityItem {
  id: string;
  time: string;
  action: string;
  company: string;
  user: string;
  status: string;
  net: number;
}

interface ComplianceData {
  taxYear: string;
  p60s: { done: number; total: number };
  p11ds: { done: number; total: number };
  finalFps: string;
  daysRemaining: number;
}

interface DashboardData {
  totalPayrollMonth: number;
  deltaPct: number;
  activeEmployees: number;
  nextPayDate: string | null;
  daysToPay: number | null;
  pendingRti: number;
  overdueRti: number;
  companyCount: number;
  compliance: ComplianceData;
  activity: ActivityItem[];
  companies: { id: string; name: string; payeRef: string; status: string }[];
}

function SkeletonCard() {
  return (
    <div className="bg-surface border border-subtle p-5 flex flex-col gap-3 animate-pulse">
      <div className="h-3 w-24 bg-surface-high" />
      <div className="h-7 w-32 bg-surface-high" />
      <div className="h-3 w-16 bg-surface-high" />
    </div>
  );
}

function ComplianceRow({ label, value, status }: { label: string; value: string; status?: "ok" | "warn" | "pending" }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-subtle last:border-b-0">
      <span className="text-[13px] text-tsecondary">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-mono text-tprimary">{value}</span>
        {status === "ok" && <span className="material-symbols-outlined text-[14px] text-success">check_circle</span>}
        {status === "warn" && <span className="material-symbols-outlined text-[14px] text-warning">error</span>}
        {status === "pending" && <span className="material-symbols-outlined text-[14px] text-ttertiary">schedule</span>}
      </div>
    </div>
  );
}

export function BureauDashboard() {
  const { setBureauView, setActiveCompany } = useApp();
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast("Failed to load dashboard", "error"))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const runPayroll = () => {
    // If a single company exists, default to it; otherwise land on companies view
    if (data?.companies?.length === 1) {
      setActiveCompany(data.companies[0].id);
    }
    if (!data || data.companies.length === 0) {
      setBureauView("companies");
      toast("Select a company to run payroll", "info");
      return;
    }
    setBureauView("payrun_input");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-tprimary">Bureau Dashboard</h1>
          <p className="text-[13px] text-tsecondary mt-1">System overview and immediate actions</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PearlButton onClick={runPayroll}>
            <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">play_arrow</span>
            Run Payroll
          </PearlButton>
          <GhostButton onClick={() => setBureauView("employee_new")}>
            <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">person_add</span>
            Add Employee
          </GhostButton>
          <GhostButton onClick={() => setBureauView("reports")}>
            <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">analytics</span>
            Generate Report
          </GhostButton>
        </div>
      </div>

      {/* Empty state */}
      {!loading && data && data.companyCount === 0 && (
        <div className="bg-surface border border-subtle">
          <EmptyState
            icon="business"
            title="No companies yet. Add your first client to start running payroll."
            action={() => setBureauView("companies")}
            actionLabel="Add Company"
          />
        </div>
      )}

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        data && data.companyCount > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Payroll This Month"
              value={gbp(data.totalPayrollMonth)}
              delta={`${data.deltaPct > 0 ? "+" : ""}${data.deltaPct.toFixed(1)}%`}
              deltaDirection={data.deltaPct >= 0 ? "up" : "down"}
              sublabel="vs prior month"
              icon="payments"
            />
            <StatCard
              label="Active Employees"
              value={String(data.activeEmployees)}
              sublabel={`across ${data.companyCount} ${data.companyCount === 1 ? "company" : "companies"}`}
              icon="group"
              onClick={() => setBureauView("employees")}
            />
            <StatCard
              label="Next Pay Date"
              value={data.nextPayDate ? fmtDate(data.nextPayDate) : "—"}
              delta={data.daysToPay !== null ? `${data.daysToPay}d` : undefined}
              deltaDirection="neutral"
              sublabel={data.daysToPay !== null ? "to BACS cut-off" : "no scheduled runs"}
              icon="event"
            />
            <StatCard
              label="Pending RTI"
              value={String(data.pendingRti)}
              delta={data.overdueRti > 0 ? `${data.overdueRti} OVERDUE` : "On schedule"}
              deltaDirection={data.overdueRti > 0 ? "down" : "neutral"}
              sublabel="submissions awaiting HMRC"
              icon="send"
              onClick={() => setBureauView("rti")}
            />
          </div>
        )
      )}

      {/* Compliance + Activity */}
      {!loading && data && data.companyCount > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Compliance */}
          <div className="bg-surface border border-subtle p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="section-title text-tprimary">Compliance Overview</h2>
                <p className="text-[11px] text-ttertiary font-mono mt-0.5">Tax Year {data.compliance.taxYear}</p>
              </div>
              <span className="material-symbols-outlined text-[18px] text-ttertiary">verified</span>
            </div>
            <ComplianceRow
              label="P60s Generated"
              value={`${data.compliance.p60s.done}/${data.compliance.p60s.total}`}
              status={data.compliance.p60s.done >= data.compliance.p60s.total && data.compliance.p60s.total > 0 ? "ok" : "warn"}
            />
            <ComplianceRow
              label="P11Ds Submitted"
              value={`${data.compliance.p11ds.done}/${data.compliance.p11ds.total}`}
              status={data.compliance.p11ds.done >= data.compliance.p11ds.total && data.compliance.p11ds.total > 0 ? "ok" : "pending"}
            />
            <ComplianceRow
              label="Final FPS Status"
              value={data.compliance.finalFps.toUpperCase()}
              status={data.compliance.finalFps === "accepted" || data.compliance.finalFps === "approved" ? "ok" : "pending"}
            />
            <ComplianceRow
              label="Year-End Countdown"
              value={`${data.compliance.daysRemaining} days`}
              status={data.compliance.daysRemaining < 30 ? "warn" : "ok"}
            />
            <button
              onClick={() => setBureauView("rti")}
              className="mt-4 w-full text-[12px] text-tsecondary hover:text-pearl border border-subtle hover:border-pearl-dim px-3 py-2 transition-colors flex items-center justify-center gap-1.5"
            >
              View RTI &amp; Year-End
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>

          {/* Recent activity */}
          <div className="lg:col-span-2 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title text-tprimary">Recent Activity</h2>
              <span className="text-[11px] text-ttertiary font-mono">{data.activity.length} events</span>
            </div>
            {data.activity.length === 0 ? (
              <div className="bg-surface border border-subtle">
                <EmptyState icon="history" title="No activity yet — committed pay runs will appear here." />
              </div>
            ) : (
              <DataTable
                columns={[
                  { label: "Time" },
                  { label: "Action" },
                  { label: "Company" },
                  { label: "Net", className: "text-right" },
                  { label: "Status" },
                ]}
              >
                {data.activity.slice(0, 8).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell mono className="text-tsecondary text-[12px] whitespace-nowrap">
                      {fmtDateTime(a.time)}
                    </TableCell>
                    <TableCell>{a.action}</TableCell>
                    <TableCell className="text-tsecondary">{a.company}</TableCell>
                    <TableCell mono className="text-right">
                      {a.net ? gbp(a.net) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={a.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </DataTable>
            )}
          </div>
        </div>
      )}

      {/* Quick company access (last) */}
      {!loading && data && data.companyCount > 0 && (
        <div className="bg-surface border border-subtle p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title text-tprimary">Your Companies</h2>
            <button
              onClick={() => setBureauView("companies")}
              className="text-[12px] text-tsecondary hover:text-pearl transition-colors flex items-center gap-1"
            >
              View all
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.companies.slice(0, 6).map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCompany(c.id);
                  setBureauView("company_detail");
                }}
                className="flex items-center justify-between px-4 py-3 border border-subtle hover:bg-surface-high hover:border-pearl-dim transition-colors text-left"
              >
                <div className="min-w-0">
                  <div className="text-[13px] text-tprimary font-medium truncate">{c.name}</div>
                  <div className="text-[11px] text-ttertiary font-mono mt-0.5">{c.payeRef}</div>
                </div>
                <StatusChip status={c.status} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
