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
  Select,
  Field,
  toast,
} from "@/components/kedbyte/primitives";
import { cn } from "@/lib/utils";

// ============ TYPES ============
interface Entry {
  id: string;
  employeeId: string;
  name: string;
  payrollId: string;
  baseSalaryMonthly: number;
  salaryAnnual: number;
  taxCode: string;
  niCategory: string;
  department: string;
  overtimeHours: number;
  bonus: number;
  commission: number;
  gross: number | null;
  status: string;
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
  entries: Entry[];
}

interface Company {
  id: string;
  name: string;
  payeRef: string;
  employeeCount: number;
  status: string;
}

const PERIOD_LABEL = (m: number) => `M${m}`;

// Approx hourly rate for instant local gross preview (server echo overwrites)
function approxHourly(salaryAnnual: number): number {
  return salaryAnnual / 52 / 37.5;
}

function provisionalGross(e: Entry): number {
  const basic = e.baseSalaryMonthly || e.salaryAnnual / 12;
  const ot = (e.overtimeHours || 0) * approxHourly(e.salaryAnnual) * 1.5;
  return Math.round((basic + ot + (e.bonus || 0) + (e.commission || 0)) * 100) / 100;
}

export function PayRunInput() {
  const { activePayRunId, activeCompanyId, setActivePayRun, setBureauView, setBureauView: nav } = useApp();
  const [payRun, setPayRun] = React.useState<PayRun | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [pickedCompany, setPickedCompany] = React.useState<string>("");
  const [creating, setCreating] = React.useState(false);
  const [dirty, setDirty] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  // -------- Initial load: companies list (in case we need picker) --------
  React.useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((d) => {
        const list: Company[] = d.companies || [];
        setCompanies(list);
        if (!pickedCompany && list.length > 0) {
          // default to activeCompanyId if set, else first company
          const initial = list.find((c) => c.id === activeCompanyId) || list[0];
          setPickedCompany(initial.id);
        }
      })
      .catch(() => {});
  }, [activeCompanyId, pickedCompany]);

  // -------- Fetch pay run if activePayRunId is set --------
  React.useEffect(() => {
    if (!activePayRunId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/payruns/${activePayRunId}`)
      .then((r) => r.json())
      .then((d: PayRun) => {
        setPayRun(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activePayRunId]);

  // -------- Autosave: debounce 800ms after any dirty edit --------
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (dirty.size === 0 || !payRun) return;
    setSaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const edited = payRun.entries.filter((e) => dirty.has(e.id));
      if (edited.length === 0) {
        setSaving(false);
        return;
      }
      try {
        const res = await fetch(`/api/payruns/${payRun.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entries: edited.map((e) => ({
              id: e.id,
              overtimeHours: e.overtimeHours,
              bonus: e.bonus,
              commission: e.commission,
              statutoryPay: 0,
              adjustments: [],
            })),
          }),
        });
        const data = await res.json();
        if (data.ok && data.echo) {
          const echoMap = new Map<string, number>(data.echo.map((x: { id: string; gross: number }) => [x.id, x.gross]));
          setPayRun((prev) =>
            prev
              ? {
                  ...prev,
                  entries: prev.entries.map((e) =>
                    echoMap.has(e.id) ? { ...e, gross: echoMap.get(e.id)! } : e
                  ),
                }
              : prev
          );
          setSavedAt(Date.now());
          toast("Autosaved · gross updated", "success");
        }
      } catch {
        toast("Autosave failed", "error");
      } finally {
        setDirty(new Set());
        setSaving(false);
      }
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [dirty, payRun]);

  // -------- Create pay run --------
  async function handleCreate() {
    if (!pickedCompany) {
      toast("Select a company first", "error");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/payruns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: pickedCompany }),
      });
      const data = await res.json();
      if (data.error) {
        toast(data.error, "error");
        setCreating(false);
        return;
      }
      setActivePayRun(data.id);
      toast(`Pay run ${data.ref} created`, "success");
    } catch {
      toast("Failed to create pay run", "error");
      setCreating(false);
    }
  }

  // -------- Edit handlers --------
  function updateEntry(id: string, patch: Partial<Entry>) {
    if (!payRun) return;
    setPayRun({
      ...payRun,
      entries: payRun.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
    setDirty((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  // ============ RENDER: NO PAY RUN — COMPANY PICKER ============
  if (!activePayRunId && !loading) {
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
            current={0}
          />
        </div>
        <div className="bg-surface border border-subtle p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-[28px] text-pearl">add_circle</span>
            <div>
              <h2 className="page-title text-tprimary">Start a Pay Run</h2>
              <p className="text-[13px] text-tsecondary mt-1">
                Select a company to create a new pay run for the next tax period.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Field label="Company">
              <Select
                value={pickedCompany}
                onChange={setPickedCompany}
                options={companies.map((c) => ({
                  value: c.id,
                  label: `${c.name} · ${c.employeeCount} employees`,
                }))}
                className="w-full"
              />
            </Field>
            <Field label="Tax Year" hint="2026/27 · automatically derived">
              <div className="bg-surface-low border border-subtle px-3 py-2 text-[13px] text-tsecondary font-mono">
                2026/27
              </div>
            </Field>
          </div>

          {companies.length === 0 ? (
            <p className="text-[13px] text-ttertiary text-center py-4">No companies available.</p>
          ) : (
            <div className="flex items-center justify-between border-t border-subtle pt-6">
              <span className="text-[12px] text-ttertiary font-mono">
                {companies.find((c) => c.id === pickedCompany)?.payeRef || "—"}
              </span>
              <PearlButton onClick={handleCreate} disabled={creating || !pickedCompany}>
                {creating ? (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    Creating…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                    Create Pay Run
                  </span>
                )}
              </PearlButton>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============ RENDER: LOADING ============
  if (loading || !payRun) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined text-[28px] text-ttertiary animate-spin mr-3">progress_activity</span>
        <span className="text-[13px] text-tsecondary font-mono">Loading pay run…</span>
      </div>
    );
  }

  const totalGross = payRun.entries.reduce((s, e) => s + provisionalGross(e), 0);

  // ============ RENDER: MAIN ============
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="page-title text-tprimary">Pay Run: {payRun.ref}</h1>
              <StatusChip status={payRun.status} />
            </div>
            <p className="text-[13px] text-tsecondary">
              {payRun.companyName || "Company"} · Step 1 of 4 · Employee Input
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Chip icon="calendar_month" label="PAY PERIOD" value={`${fmtDate(payRun.periodStart)} → ${fmtDate(payRun.periodEnd)}`} />
            <Chip icon="payments" label="PAY DATE" value={fmtDate(payRun.payDate)} />
            <Chip icon="account_balance" label="BACS DUE" value={fmtDate(payRun.bacsSubmissionDate)} />
          </div>
        </div>
        <Stepper
          steps={[
            { label: "Input", icon: "edit" },
            { label: "Calculation", icon: "calculate" },
            { label: "Review", icon: "fact_check" },
            { label: "Submission", icon: "send" },
          ]}
          current={0}
        />
      </div>

      {/* Editable entries grid */}
      <div className="bg-surface border border-subtle">
        <div className="flex items-center justify-between px-4 py-3 border-b border-subtle">
          <div className="flex items-center gap-3">
            <span className="label-caps text-tsecondary">Employee Inputs</span>
            <span className="text-[11px] font-mono text-ttertiary">
              {payRun.entries.length} records · Period {PERIOD_LABEL(payRun.taxPeriod)} · TY {payRun.taxYear.replace("-", "/")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {saving ? (
              <span className="flex items-center gap-1.5 text-[11px] font-mono text-warning uppercase tracking-wider">
                <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                Saving…
              </span>
            ) : savedAt ? (
              <span className="flex items-center gap-1.5 text-[11px] font-mono text-success uppercase tracking-wider">
                <span className="material-symbols-outlined text-[14px]">check</span>
                Autosaved
              </span>
            ) : null}
            <span className="text-[11px] font-mono text-ttertiary uppercase tracking-wider">Debounce 800ms</span>
          </div>
        </div>

        {payRun.entries.length === 0 ? (
          <EmptyState
            icon="person_off"
            title="No active employees found for this company. Add employees before running payroll."
          />
        ) : (
          <DataTable
            columns={[
              { label: "Employee" },
              { label: "Base Salary", className: "text-right" },
              { label: "OT Hours" },
              { label: "Bonus" },
              { label: "Commission" },
              { label: "Gross Pay", className: "text-right" },
              { label: "Status" },
            ]}
          >
            {payRun.entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-[13px] text-tprimary font-medium">{e.name}</span>
                    <span className="text-[11px] text-ttertiary font-mono">
                      {e.payrollId} · {e.taxCode} · NI {e.niCategory}
                    </span>
                  </div>
                </TableCell>
                <TableCell mono className="text-right">
                  <span className="text-tsecondary">{gbp(e.baseSalaryMonthly)}</span>
                  <span className="block text-[10px] text-ttertiary">{gbp(e.salaryAnnual)} /yr</span>
                </TableCell>
                <TableCell>
                  <NumInput
                    value={e.overtimeHours}
                    onChange={(v) => updateEntry(e.id, { overtimeHours: v })}
                    step={0.5}
                    placeholder="0"
                  />
                </TableCell>
                <TableCell>
                  <NumInput
                    value={e.bonus}
                    onChange={(v) => updateEntry(e.id, { bonus: v })}
                    step={0.01}
                    prefix="£"
                    placeholder="0.00"
                  />
                </TableCell>
                <TableCell>
                  <NumInput
                    value={e.commission}
                    onChange={(v) => updateEntry(e.id, { commission: v })}
                    step={0.01}
                    prefix="£"
                    placeholder="0.00"
                  />
                </TableCell>
                <TableCell mono className="text-right">
                  <span className="text-pearl">{gbp(provisionalGross(e))}</span>
                </TableCell>
                <TableCell>
                  <StatusChip status={e.status} />
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        )}

        {/* Footer summary + nav */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 border-t border-subtle">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="label-caps text-ttertiary">Total Provisional Gross</span>
              <span className="data-sm text-pearl">{gbp(totalGross)}</span>
            </div>
            <div className="flex flex-col">
              <span className="label-caps text-ttertiary">Employees</span>
              <span className="data-sm text-tprimary">{payRun.entries.length}</span>
            </div>
            <div className="flex flex-col">
              <span className="label-caps text-ttertiary">Period</span>
              <span className="data-sm text-tprimary">{PERIOD_LABEL(payRun.taxPeriod)} · {payRun.taxYear.replace("-", "/")}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GhostButton disabled>Back</GhostButton>
            <PearlButton
              onClick={() => {
                nav("payrun_calculation");
                toast("Continuing to calculation engine…", "info");
              }}
            >
              <span className="flex items-center gap-2">
                Continue to Calculation
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </span>
            </PearlButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ SUB-COMPONENTS ============

function Chip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-surface-low border border-subtle px-3 py-1.5 flex items-center gap-2">
      <span className="material-symbols-outlined text-[14px] text-ttertiary">{icon}</span>
      <div className="flex flex-col">
        <span className="text-[9px] font-mono uppercase tracking-wider text-ttertiary">{label}</span>
        <span className="text-[12px] font-mono text-tprimary whitespace-nowrap">{value}</span>
      </div>
    </div>
  );
}

function NumInput({
  value,
  onChange,
  step = 1,
  prefix,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  prefix?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center bg-surface-low border border-subtle focus-within:border-pearl-dim transition-colors">
      {prefix && <span className="pl-2 text-[12px] text-ttertiary font-mono">{prefix}</span>}
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) && value !== 0 ? value : ""}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? 0 : parseFloat(v));
        }}
        className={cn(
          "bg-transparent border-none outline-none w-full min-w-[80px] px-2 py-1.5 text-[13px] text-tprimary font-mono placeholder:text-ttertiary",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        )}
      />
    </div>
  );
}
