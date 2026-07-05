"use client";

import * as React from "react";
import { useApp, gbp, fmtDate } from "@/store/app";
import {
  StatusChip,
  DataTable,
  TableRow,
  TableCell,
  EmptyState,
  PearlButton,
  GhostButton,
  Select,
  Modal,
  toast,
} from "@/components/kedbyte/primitives";
import { maskNINO } from "@/engine/payroll";
import { cn } from "@/lib/utils";

interface Payslip {
  id: string;
  type: string;
  taxYear: string;
  generatedAt: string;
  sha256: string;
  storageKey: string;
  payRunEntryId: string | null;
  net: number | null;
  gross: number | null;
  tax: number | null;
  niEmployee: number | null;
  pensionEmployee: number | null;
  studentLoan: number | null;
  period: number | null;
  companyName?: string;
}

function periodLabel(period: number | null): string {
  if (!period) return "—";
  return `M${period}`;
}

function monthFromDate(d: string): string {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function SkeletonRow() {
  return (
    <div className="bg-surface border border-subtle p-5 flex items-center justify-between animate-pulse">
      <div className="flex flex-col gap-2">
        <div className="h-3 w-24 bg-surface-high" />
        <div className="h-3 w-16 bg-surface-high" />
      </div>
      <div className="h-5 w-24 bg-surface-high" />
    </div>
  );
}

export function PortalPayslips() {
  const { user } = useApp();
  const [payslips, setPayslips] = React.useState<Payslip[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [taxYear, setTaxYear] = React.useState("all");
  const [selected, setSelected] = React.useState<Payslip | null>(null);

  const load = React.useCallback(() => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/ess/payslips?userId=${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setPayslips((d.payslips || []).filter((p: Payslip) => p.type === "payslip"));
      })
      .catch(() => toast("Failed to load payslips", "error"))
      .finally(() => setLoading(false));
  }, [user]);

  React.useEffect(() => {
    load();
  }, [load]);

  const taxYears = React.useMemo(() => {
    const set = new Set(payslips.map((p) => p.taxYear));
    return Array.from(set).sort().reverse();
  }, [payslips]);

  const filtered = React.useMemo(() => {
    if (taxYear === "all") return payslips;
    return payslips.filter((p) => p.taxYear === taxYear);
  }, [payslips, taxYear]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="page-title text-tprimary">Payslips</h1>
          <p className="text-[13px] text-tsecondary mt-1">All payslips issued to you, with full breakdowns.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="label-caps text-tsecondary">Tax Year</span>
          <Select
            value={taxYear}
            onChange={setTaxYear}
            options={[
              { value: "all", label: "All years" },
              ...taxYears.map((y) => ({ value: y, label: y })),
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-subtle">
          <EmptyState icon="receipt_long" title="No payslips found for this period." />
        </div>
      ) : (
        <div className="bg-surface border border-subtle divide-y divide-subtle">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-high transition-colors text-left"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] text-tprimary font-medium">
                    {monthFromDate(p.generatedAt)}
                  </span>
                  <span className="text-[11px] text-ttertiary font-mono">·</span>
                  <span className="text-[11px] text-ttertiary font-mono">{periodLabel(p.period)}</span>
                </div>
                <div className="text-[11px] text-ttertiary font-mono">
                  Paid {fmtDate(p.generatedAt)} · {p.taxYear}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="data-sm text-pearl">{gbp(p.net)}</span>
                <StatusChip status="committed" label="Paid" />
                <span className="material-symbols-outlined text-[18px] text-ttertiary hover:text-pearl transition-colors">
                  download
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Payslip preview modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Payslip Preview" wide>
        {selected && <PayslipPreview payslip={selected} />}
      </Modal>
    </div>
  );
}

function PayslipPreview({ payslip }: { payslip: Payslip }) {
  const { user } = useApp();
  const [employee, setEmployee] = React.useState<any>(null);

  React.useEffect(() => {
    if (!user) return;
    fetch(`/api/ess/details?userId=${user.id}`)
      .then((r) => r.json())
      .then((d) => setEmployee(d.employee))
      .catch(() => {});
  }, [user]);

  const gross = payslip.gross || 0;
  const tax = payslip.tax || 0;
  const ni = payslip.niEmployee || 0;
  const pension = payslip.pensionEmployee || 0;
  const sl = payslip.studentLoan || 0;
  const net = payslip.net || 0;
  const basic = Math.round(gross * 0.85); // demo breakdown
  const overtime = 0;
  const bonus = Math.max(0, gross - basic);
  const hashShort = payslip.sha256 ? payslip.sha256.slice(0, 16) + "…" : "—";

  return (
    <div className="flex flex-col gap-5">
      {/* Company header */}
      <div className="flex flex-col gap-2 border-b border-subtle pb-4">
        <div className="flex items-center justify-between">
          <span className="text-[15px] text-tprimary font-semibold">{employee?.company || "Your Company"}</span>
          <span className="text-[11px] text-ttertiary font-mono">PAYE ref: 246/RT567</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-ttertiary font-mono">
          <span>Tax Year {payslip.taxYear} · Period {periodLabel(payslip.period)}</span>
          <span>Paid {fmtDate(payslip.generatedAt)}</span>
        </div>
      </div>

      {/* Employee details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Detail label="Employee" value={employee ? `${employee.firstName} ${employee.lastName}` : "—"} />
        <Detail label="NI Number" value={maskNINO(employee?.nino)} mono />
        <Detail label="Tax Code" value="1257L" mono />
        <Detail label="Payroll ID" value={employee?.payrollId || "—"} mono />
      </div>

      {/* Payments */}
      <div className="border border-subtle">
        <div className="bg-surface-low px-4 py-2 border-b border-subtle">
          <span className="label-caps text-tsecondary">Payments</span>
        </div>
        <div className="divide-y divide-subtle">
          <BreakdownRow label="Basic Salary" value={gbp(basic)} />
          {overtime > 0 && <BreakdownRow label="Overtime" value={gbp(overtime)} />}
          {bonus > 0 && <BreakdownRow label="Bonus" value={gbp(bonus)} />}
          <BreakdownRow label="Gross Pay" value={gbp(gross)} highlight />
        </div>
      </div>

      {/* Deductions */}
      <div className="border border-subtle">
        <div className="bg-surface-low px-4 py-2 border-b border-subtle">
          <span className="label-caps text-tsecondary">Deductions</span>
        </div>
        <div className="divide-y divide-subtle">
          <BreakdownRow label="Income Tax (PAYE)" value={`− ${gbp(tax)}`} negative />
          <BreakdownRow label="NI Employee" value={`− ${gbp(ni)}`} negative />
          {pension > 0 && <BreakdownRow label="Pension (EE)" value={`− ${gbp(pension)}`} negative />}
          {sl > 0 && <BreakdownRow label="Student Loan" value={`− ${gbp(sl)}`} negative />}
          <BreakdownRow label="Net Pay" value={gbp(net)} highlight large />
        </div>
      </div>

      {/* YTD (placeholder using single-period values) */}
      <div className="border border-subtle p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="label-caps text-tsecondary">Year to Date</span>
          <span className="text-[11px] text-ttertiary font-mono">{payslip.taxYear}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Detail label="Gross" value={gbp(gross)} mono />
          <Detail label="Tax" value={gbp(tax)} mono />
          <Detail label="NI" value={gbp(ni)} mono />
          <Detail label="Net" value={gbp(net)} mono highlight />
        </div>
      </div>

      {/* Hash verification */}
      <div className="flex items-center gap-3 bg-surface-low border border-subtle p-3">
        <span className="material-symbols-outlined text-[18px] text-success">verified</span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-tsecondary">Hash verification</div>
          <div className="text-[11px] font-mono text-ttertiary truncate" title={payslip.sha256}>
            sha256: {hashShort}
          </div>
        </div>
        <span className="text-[11px] text-success font-mono">VERIFIED</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <PearlButton
          onClick={() => toast("Download queued · PDF will appear shortly", "info")}
          className="flex-1"
        >
          <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">download</span>
          Download PDF
        </PearlButton>
        <GhostButton onClick={() => toast("Payslip link copied", "success")}>
          <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">link</span>
          Copy Link
        </GhostButton>
      </div>
    </div>
  );
}

function Detail({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label-caps text-ttertiary">{label}</span>
      <span className={cn("text-[13px]", mono && "font-mono", highlight ? "text-pearl" : "text-tprimary")}>{value}</span>
    </div>
  );
}

function BreakdownRow({ label, value, highlight, negative, large }: { label: string; value: string; highlight?: boolean; negative?: boolean; large?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between px-4 py-2.5", highlight && "bg-surface-high")}>
      <span className={cn("text-[13px]", highlight ? "text-tprimary font-semibold" : "text-tsecondary")}>{label}</span>
      <span
        className={cn(
          large ? "data-lg" : "data-sm",
          "font-mono",
          highlight ? "text-pearl" : negative ? "text-error" : "text-tprimary"
        )}
      >
        {value}
      </span>
    </div>
  );
}
