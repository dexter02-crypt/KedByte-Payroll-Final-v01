"use client";

import * as React from "react";
import { useApp, gbp, gbpShort, fmtDate } from "@/store/app";
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
import { maskNINO } from "@/engine/payroll";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  payrollId: string;
  name: string;
  firstName: string;
  lastName: string;
  department: string | null;
  jobTitle: string | null;
  salaryAnnual: number;
  taxCode: string;
  niCategory: string;
  employmentType: string;
  pensionStatus: string;
  studentLoanPlan: string | null;
  postgradLoan: boolean;
  status: string;
  startDate: string;
}

interface PayRunRow {
  id: string;
  taxYear: string;
  taxPeriod: number;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: string;
  totalsJson: string;
}

interface PensionScheme {
  id: string;
  provider: string;
  basis: string;
  relief: string;
  eeRate: number;
  erRate: number;
  status: string;
}

interface CompanyDetail {
  company: {
    id: string;
    name: string;
    payeRef: string;
    accountsOfficeRef: string;
    addressLine1: string | null;
    addressCity: string | null;
    addressPostcode: string | null;
    bankSortCode: string | null;
    bankAccount: string | null;
    bankAccountName: string | null;
    region: string;
    paySchedule: string;
    payDateDay: number | null;
    earlyPay: boolean;
    status: string;
  };
  employees: Employee[];
  payRuns: PayRunRow[];
  pensionSchemes: PensionScheme[];
}

type Tab = "overview" | "employees" | "payruns" | "pensions";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "dashboard" },
  { id: "employees", label: "Employees", icon: "group" },
  { id: "payruns", label: "Pay Runs", icon: "payments" },
  { id: "pensions", label: "Pension Schemes", icon: "account_balance" },
];

const SCHEDULE_LABELS: Record<string, string> = {
  monthly_last_working_day: "Monthly · Last Working Day",
  fixed_date: "Monthly · Fixed Date",
  weekly_friday: "Weekly · Friday",
  fortnightly_friday: "Fortnightly · Friday",
};

function formatSortCode(sc?: string | null): string {
  if (!sc) return "—";
  const d = sc.replace(/\D/g, "");
  if (d.length !== 6) return sc;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
}

export function CompanyDetailView() {
  const { activeCompanyId, setBureauView, setActiveEmployee, setActivePayRun } = useApp();
  const [data, setData] = React.useState<CompanyDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<Tab>("overview");
  const [running, setRunning] = React.useState(false);

  const load = React.useCallback(() => {
    if (!activeCompanyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/companies/${activeCompanyId}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast("Failed to load company", "error"))
      .finally(() => setLoading(false));
  }, [activeCompanyId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const runPayroll = async () => {
    if (!activeCompanyId) return;
    setRunning(true);
    try {
      const res = await fetch("/api/payruns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: activeCompanyId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to start pay run");
      }
      const d = await res.json();
      setActivePayRun(d.id);
      toast(d.existing ? "Resumed existing pay run" : `Pay run ${d.ref} created`, "success");
      setBureauView("payrun_input");
    } catch (e: any) {
      toast(e.message || "Failed to start pay run", "error");
    } finally {
      setRunning(false);
    }
  };

  if (!activeCompanyId) {
    return (
      <div className="bg-surface border border-subtle">
        <EmptyState
          icon="business"
          title="No company selected. Choose one from the Companies list."
          action={() => setBureauView("companies")}
          actionLabel="Browse Companies"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-7 w-72 bg-surface-high animate-pulse" />
        <div className="h-px bg-border-subtle" style={{ backgroundColor: "rgba(245,245,245,0.06)" }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-surface border border-subtle p-5 h-28 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || !data.company) {
    return (
      <div className="bg-surface border border-subtle">
        <EmptyState
          icon="error"
          title="Company not found."
          action={() => setBureauView("companies")}
          actionLabel="Back to Companies"
        />
      </div>
    );
  }

  const { company, employees, payRuns, pensionSchemes } = data;

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] text-ttertiary font-mono">
        <button onClick={() => setBureauView("companies")} className="hover:text-pearl transition-colors">
          Companies
        </button>
        <span className="text-ttertiary">›</span>
        <span className="text-tsecondary">{company.name}</span>
      </div>

      {/* Company Header */}
      <div className="bg-surface border border-subtle p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-surface-high border border-subtle flex items-center justify-center shrink-0">
              <span className="text-[16px] font-mono font-bold text-pearl">
                {company.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="page-title text-tprimary">{company.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[12px] text-tsecondary font-mono">
                <span>PAYE: <span className="text-tprimary">{company.payeRef}</span></span>
                <span>AO: <span className="text-tprimary">{company.accountsOfficeRef}</span></span>
                <span>Region: <span className="text-tprimary">{company.region.replace(/_/g, " ")}</span></span>
              </div>
              {company.addressLine1 && (
                <div className="text-[12px] text-ttertiary mt-1 font-mono">
                  {company.addressLine1}
                  {company.addressCity ? `, ${company.addressCity}` : ""}
                  {company.addressPostcode ? ` · ${company.addressPostcode}` : ""}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status={company.status} />
            <PearlButton onClick={runPayroll} disabled={running}>
              {running ? (
                <>
                  <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle animate-spin">progress_activity</span>
                  Starting…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">play_arrow</span>
                  Run Payroll
                </>
              )}
            </PearlButton>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-subtle overflow-x-auto scroll-thin">
        {TABS.map((t) => {
          const active = tab === t.id;
          const count =
            t.id === "employees" ? employees.length :
            t.id === "payruns" ? payRuns.length :
            t.id === "pensions" ? pensionSchemes.length : null;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                active
                  ? "border-pearl text-pearl"
                  : "border-transparent text-tsecondary hover:text-tprimary"
              )}
            >
              <span
                className="material-symbols-outlined text-[16px]"
                style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
              >
                {t.icon}
              </span>
              {t.label}
              {count !== null && (
                <span className={cn("text-[10px] font-mono px-1.5 py-0.5", active ? "bg-pearl text-ink" : "bg-surface-high text-ttertiary")}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Employees"
              value={String(employees.filter((e) => e.status === "active").length)}
              sublabel={`${employees.length} total records`}
              icon="group"
              onClick={() => setTab("employees")}
            />
            <StatCard
              label="Pay Schedule"
              value={SCHEDULE_LABELS[company.paySchedule] || company.paySchedule}
              sublabel={company.payDateDay ? `Day ${company.payDateDay}` : company.earlyPay ? "Early pay enabled" : "Standard"}
              icon="event"
            />
            <StatCard
              label="Pension Provider"
              value={pensionSchemes[0]?.provider || "—"}
              sublabel={pensionSchemes[0] ? `${(pensionSchemes[0].eeRate * 100).toFixed(1)}% / ${(pensionSchemes[0].erRate * 100).toFixed(1)}%` : "No scheme configured"}
              icon="account_balance"
              onClick={() => setTab("pensions")}
            />
            <StatCard
              label="Annual Payroll"
              value={gbpShort(employees.reduce((s, e) => s + (e.salaryAnnual || 0), 0))}
              sublabel="gross across all employees"
              icon="trending_up"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bank Details */}
            <div className="bg-surface border border-subtle p-5">
              <h3 className="section-title text-tprimary mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-pearl">account_balance</span>
                Bank Details
              </h3>
              <div className="flex flex-col divide-y" style={{ borderColor: "rgba(245,245,245,0.06)" }}>
                <div className="flex justify-between py-2.5 border-b border-subtle">
                  <span className="text-[12px] text-tsecondary">Account Name</span>
                  <span className="text-[13px] text-tprimary font-mono">{company.bankAccountName || "—"}</span>
                </div>
                <div className="flex justify-between py-2.5 border-b border-subtle">
                  <span className="text-[12px] text-tsecondary">Sort Code</span>
                  <span className="text-[13px] text-tprimary font-mono">{formatSortCode(company.bankSortCode)}</span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-[12px] text-tsecondary">Account Number</span>
                  <span className="text-[13px] text-tprimary font-mono">{company.bankAccount || "—"}</span>
                </div>
              </div>
            </div>

            {/* Recent Pay Runs Summary */}
            <div className="bg-surface border border-subtle p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-title text-tprimary flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-pearl">history</span>
                  Recent Pay Runs
                </h3>
                <button
                  onClick={() => setTab("payruns")}
                  className="text-[12px] text-tsecondary hover:text-pearl transition-colors"
                >
                  View all
                </button>
              </div>
              {payRuns.length === 0 ? (
                <div className="text-[13px] text-ttertiary py-4 text-center">No pay runs yet</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {payRuns.slice(0, 4).map((pr) => {
                    let net = 0;
                    try {
                      net = JSON.parse(pr.totalsJson).net || 0;
                    } catch {}
                    return (
                      <div key={pr.id} className="flex items-center justify-between py-2 border-b border-subtle last:border-b-0">
                        <div>
                          <div className="text-[12px] text-tprimary font-mono">
                            Period {pr.taxPeriod} · {fmtDate(pr.payDate)}
                          </div>
                          <div className="text-[11px] text-ttertiary font-mono mt-0.5">{pr.taxYear}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[13px] text-tprimary font-mono">{gbp(net)}</span>
                          <StatusChip status={pr.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "employees" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-tsecondary">
              <span className="font-mono text-tprimary">{employees.length}</span> employees on file
            </p>
            <GhostButton onClick={() => setBureauView("employee_new")}>
              <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">person_add</span>
              Add Employee
            </GhostButton>
          </div>
          {employees.length === 0 ? (
            <div className="bg-surface border border-subtle">
              <EmptyState
                icon="person_off"
                title="No employees yet for this company."
                action={() => setBureauView("employee_new")}
                actionLabel="Add First Employee"
              />
            </div>
          ) : (
            <DataTable
              columns={[
                { label: "Employee" },
                { label: "Department" },
                { label: "Salary", className: "text-right" },
                { label: "Tax Code" },
                { label: "NI Number" },
                { label: "Status" },
              ]}
            >
              {employees.map((e) => (
                <TableRow
                  key={e.id}
                  onClick={() => {
                    setActiveEmployee(e.id);
                  }}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-[13px] text-tprimary font-medium">{e.name}</span>
                      <span className="text-[11px] text-ttertiary font-mono mt-0.5">{e.payrollId}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-tsecondary">{e.department || "—"}</TableCell>
                  <TableCell mono className="text-right">
                    {gbp(e.salaryAnnual)}
                  </TableCell>
                  <TableCell mono className="text-tsecondary">
                    {e.taxCode}
                  </TableCell>
                  <TableCell mono className="text-tsecondary">
                    {maskNINO((e as any).nino)}
                  </TableCell>
                  <TableCell>
                    <StatusChip status={e.status} />
                  </TableCell>
                </TableRow>
              ))}
            </DataTable>
          )}
        </div>
      )}

      {tab === "payruns" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-tsecondary">
              <span className="font-mono text-tprimary">{payRuns.length}</span> pay runs on file
            </p>
            <PearlButton onClick={runPayroll} disabled={running}>
              {running ? "Starting…" : (
                <>
                  <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">play_arrow</span>
                  New Pay Run
                </>
              )}
            </PearlButton>
          </div>
          {payRuns.length === 0 ? (
            <div className="bg-surface border border-subtle">
              <EmptyState
                icon="payments"
                title="No pay runs yet. Start the first pay period for this company."
                action={runPayroll}
                actionLabel="Run Payroll"
              />
            </div>
          ) : (
            <DataTable
              columns={[
                { label: "Period" },
                { label: "Period Range" },
                { label: "Pay Date" },
                { label: "Net", className: "text-right" },
                { label: "Status" },
              ]}
            >
              {payRuns.map((pr) => {
                let net = 0;
                try {
                  net = JSON.parse(pr.totalsJson).net || 0;
                } catch {}
                return (
                  <TableRow
                    key={pr.id}
                    onClick={() => {
                      setActivePayRun(pr.id);
                      setBureauView("payrun_input");
                    }}
                  >
                    <TableCell mono>
                      <div className="flex flex-col">
                        <span className="text-tprimary">P{pr.taxPeriod}</span>
                        <span className="text-[11px] text-ttertiary mt-0.5">{pr.taxYear}</span>
                      </div>
                    </TableCell>
                    <TableCell mono className="text-tsecondary text-[12px]">
                      {fmtDate(pr.periodStart)} → {fmtDate(pr.periodEnd)}
                    </TableCell>
                    <TableCell mono className="text-tprimary">
                      {fmtDate(pr.payDate)}
                    </TableCell>
                    <TableCell mono className="text-right">
                      {net ? gbp(net) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={pr.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </DataTable>
          )}
        </div>
      )}

      {tab === "pensions" && (
        <div className="flex flex-col gap-3">
          {pensionSchemes.length === 0 ? (
            <div className="bg-surface border border-subtle">
              <EmptyState
                icon="account_balance"
                title="No pension schemes configured for this company."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pensionSchemes.map((p) => (
                <div key={p.id} className="bg-surface border border-subtle p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-surface-high border border-subtle flex items-center justify-center">
                        <span className="material-symbols-outlined text-[18px] text-pearl">account_balance</span>
                      </div>
                      <div>
                        <div className="text-[14px] text-tprimary font-semibold">{p.provider}</div>
                        <div className="text-[11px] text-ttertiary font-mono mt-0.5">
                          {p.basis.replace(/_/g, " ")} · {p.relief.replace(/_/g, " ")}
                        </div>
                      </div>
                    </div>
                    <StatusChip status={p.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface-low border border-subtle p-3">
                      <div className="label-caps text-ttertiary">Employee Rate</div>
                      <div className="data-sm text-tprimary mt-1">{(p.eeRate * 100).toFixed(2)}%</div>
                    </div>
                    <div className="bg-surface-low border border-subtle p-3">
                      <div className="label-caps text-ttertiary">Employer Rate</div>
                      <div className="data-sm text-tprimary mt-1">{(p.erRate * 100).toFixed(2)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
