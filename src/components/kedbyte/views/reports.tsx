"use client";

import * as React from "react";
import { gbp, gbpShort } from "@/store/app";
import {
  DataTable,
  TableRow,
  TableCell,
  EmptyState,
  PearlButton,
  GhostButton,
  toast,
} from "@/components/kedbyte/primitives";
import { ExportButton } from "@/components/kedbyte/export-button";

// ============ TYPES ============
interface MonthRow {
  period: number;
  label: string;
  gross: number;
  tax: number;
  niEe: number;
  niEr: number;
  net: number;
  pensEe: number;
  pensEr: number;
  employerCost: number;
}

interface Totals {
  gross: number;
  tax: number;
  niEe: number;
  niEr: number;
  net: number;
  pensEe: number;
  pensEr: number;
  employerCost: number;
}

interface Department {
  name: string;
  gross: number;
  net: number;
  count: number;
}

interface P32Month {
  period: number;
  label: string;
  taxDue: number;
  niEeDue: number;
  niErDue: number;
  totalDue: number;
  employmentAllowance: number;
  netDue: number;
}

interface ReportData {
  type: string;
  monthly: MonthRow[];
  totals: Totals;
  departments: Department[];
  p32: { months: P32Month[]; totalDue: number };
}

// ============ TABS ============
const TABS = [
  "Payroll Summary",
  "PAYE & NI",
  "Pensions",
  "Statutory Payments",
  "Cost Analysis",
  "Custom",
];

// ============ KPI CARD ============
function KpiCard({
  label,
  value,
  delta,
  direction,
  icon,
}: {
  label: string;
  value: string;
  delta: string;
  direction: "up" | "down" | "neutral";
  icon: string;
}) {
  return (
    <div className="bg-surface border border-subtle p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="label-caps text-tsecondary">{label}</span>
        <span className="material-symbols-outlined text-[16px] text-ttertiary">{icon}</span>
      </div>
      <span className="data-lg text-tprimary">{value}</span>
      <div className="flex items-center gap-1">
        <span
          className={`text-[12px] font-mono ${
            direction === "up" ? "text-success" : direction === "down" ? "text-error" : "text-tsecondary"
          }`}
        >
          {direction === "up" ? "▲" : direction === "down" ? "▼" : "■"} {delta}
        </span>
        <span className="text-[11px] text-ttertiary">vs prior period</span>
      </div>
    </div>
  );
}

// ============ STACKED BAR CHART ============
function StackedBarChart({ monthly, totals }: { monthly: MonthRow[]; totals: Totals }) {
  // For each month, stacked segments: Net (bottom), Tax, NI (EE+ER), Pension (EE+ER)
  // Bar height proportional to gross
  const maxGross = Math.max(...monthly.map((m) => m.gross), 1);

  // Y-axis gridlines: 4 ticks
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => maxGross * f);

  return (
    <div className="bg-surface border border-subtle p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="section-title text-tprimary">Pay Component Breakdown</h3>
          <p className="text-[11px] text-ttertiary mt-0.5">Monthly stacked · 2026/27 tax year</p>
        </div>
        <div className="flex items-center gap-3">
          {[
            { label: "Net", color: "bg-success" },
            { label: "Tax", color: "bg-error" },
            { label: "NI", color: "bg-warning" },
            { label: "Pension", color: "bg-ttertiary" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 ${l.color}`} />
              <span className="text-[11px] font-mono text-tsecondary">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="flex items-stretch gap-2 h-64">
        {/* Y-axis */}
        <div className="flex flex-col justify-between text-right pr-1 w-14 shrink-0">
          {gridValues
            .slice()
            .reverse()
            .map((v, i) => (
              <span key={i} className="text-[10px] font-mono text-ttertiary leading-none">
                {gbpShort(v)}
              </span>
            ))}
        </div>

        {/* Bars container with gridlines */}
        <div className="relative flex-1 flex items-end gap-1.5 border-l border-b border-subtle">
          {/* Gridlines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="border-t border-subtle w-full" style={{ opacity: 0.5 }} />
            ))}
          </div>

          {/* Bars */}
          {monthly.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[12px] text-ttertiary font-mono">No committed pay runs</span>
            </div>
          ) : (
            monthly.map((m) => {
              const heightPct = (m.gross / maxGross) * 100;
              const netPct = m.gross > 0 ? (m.net / m.gross) * 100 : 0;
              const taxPct = m.gross > 0 ? (m.tax / m.gross) * 100 : 0;
              const niPct = m.gross > 0 ? ((m.niEe + m.niEr) / m.gross) * 100 : 0;
              const pensPct = m.gross > 0 ? ((m.pensEe + m.pensEr) / m.gross) * 100 : 0;
              return (
                <div
                  key={m.period}
                  className="group relative flex-1 flex flex-col justify-end h-full"
                  title={`${m.label} · Gross ${gbp(m.gross)} · Net ${gbp(m.net)} · Tax ${gbp(
                    m.tax
                  )} · NI ${gbp(m.niEe + m.niEr)} · Pens ${gbp(m.pensEe + m.pensEr)}`}
                >
                  <div
                    className="w-full flex flex-col-reverse transition-all duration-300 hover:brightness-125"
                    style={{ height: `${heightPct}%` }}
                  >
                    {/* Net (bottom) */}
                    <div className="bg-success" style={{ height: `${netPct}%` }} />
                    {/* Tax */}
                    <div className="bg-error" style={{ height: `${taxPct}%` }} />
                    {/* NI */}
                    <div className="bg-warning" style={{ height: `${niPct}%` }} />
                    {/* Pension (top) */}
                    <div className="bg-ttertiary" style={{ height: `${pensPct}%` }} />
                  </div>
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col gap-0.5 bg-surface-low border border-subtle px-2.5 py-2 z-10 min-w-[160px]">
                    <span className="text-[11px] font-mono text-pearl">{m.label} 2026</span>
                    <div className="flex justify-between gap-3">
                      <span className="text-[10px] text-ttertiary">Gross</span>
                      <span className="text-[10px] font-mono text-tprimary">{gbp(m.gross)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[10px] text-ttertiary">Net</span>
                      <span className="text-[10px] font-mono text-success">{gbp(m.net)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[10px] text-ttertiary">Tax</span>
                      <span className="text-[10px] font-mono text-error">{gbp(m.tax)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[10px] text-ttertiary">NI</span>
                      <span className="text-[10px] font-mono text-warning">{gbp(m.niEe + m.niEr)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex items-center gap-1.5 pl-16">
        {monthly.map((m) => (
          <div key={m.period} className="flex-1 text-center">
            <span className="text-[10px] font-mono text-ttertiary">{m.label}</span>
          </div>
        ))}
      </div>

      {/* Footer total */}
      <div className="flex items-center justify-between pt-3 border-t border-subtle">
        <span className="label-caps text-ttertiary">Annual Total Gross</span>
        <span className="data-sm text-pearl">{gbp(totals.gross)}</span>
      </div>
    </div>
  );
}

// ============ DONUT CHART (SVG) ============
function DonutChart({ totals }: { totals: Totals }) {
  const size = 220;
  const stroke = 28;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { label: "Gross", value: totals.gross, color: "#E8E4E0" },
    { label: "Tax", value: totals.tax, color: "#F87171" },
    { label: "NI (EE+ER)", value: totals.niEe + totals.niEr, color: "#FBBF24" },
    { label: "Net", value: totals.net, color: "#4ADE80" },
    { label: "Pension", value: totals.pensEe + totals.pensEr, color: "#A1A1AA" },
  ];

  const total = segments.reduce((s, x) => s + x.value, 0) || 1;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const pct = seg.value / total;
    const dash = pct * circumference;
    const arc = {
      ...seg,
      dash,
      gap: circumference - dash,
      offset: -offset,
    };
    offset += dash;
    return arc;
  });

  return (
    <div className="bg-surface border border-subtle p-5 flex flex-col gap-4">
      <div>
        <h3 className="section-title text-tprimary">Pay Components</h3>
        <p className="text-[11px] text-ttertiary mt-0.5">Annual distribution · 2026/27</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* SVG donut */}
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            {/* Background ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(245,245,245,0.04)"
              strokeWidth={stroke}
            />
            {/* Segments */}
            {arcs.map((arc, i) => (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={stroke}
                strokeDasharray={`${arc.dash} ${arc.gap}`}
                strokeDashoffset={arc.offset}
                style={{ transition: "stroke-dasharray 0.4s ease" }}
              />
            ))}
          </svg>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="label-caps text-ttertiary">Total Gross</span>
            <span className="data-sm text-pearl mt-0.5">{gbpShort(totals.gross)}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 flex flex-col gap-2 w-full">
          {segments.map((seg) => {
            const pct = total > 0 ? (seg.value / total) * 100 : 0;
            return (
              <div
                key={seg.label}
                className="flex items-center justify-between gap-3 py-1.5 border-b border-subtle last:border-b-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-[12px] text-tsecondary truncate">{seg.label}</span>
                </div>
                <div className="flex items-baseline gap-2 shrink-0">
                  <span className="text-[12px] font-mono text-tprimary">{gbp(seg.value)}</span>
                  <span className="text-[10px] font-mono text-ttertiary w-9 text-right">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ MAIN ============
export function ReportsView() {
  const [data, setData] = React.useState<ReportData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState(0);

  React.useEffect(() => {
    setLoading(true);
    fetch("/api/reports?type=gross-to-net")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast("Failed to load report data", "error"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-tprimary">Reports &amp; Analytics</h1>
          <p className="text-[13px] text-tsecondary mt-1">
            Gross-to-net · PAYE/NI · P32 · departmental cost analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            href="/api/reports/gross-to-net/export"
            label="Export CSV"
            icon="table_chart"
            filename="gross-to-net-report.csv"
          />
          <ExportButton
            href="/api/reports/gpg/export?snapshot=2026-04-05"
            label="GPG CSV"
            icon="balance"
            filename="gpg-2026-04-05.csv"
          />
          <PearlButton onClick={() => toast("Report saved to dashboard", "success")}>
            <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">bookmark_add</span>
            Save Report
          </PearlButton>
        </div>
      </div>

      {/* Tab bar (visual only) */}
      <div className="flex items-center gap-0 border-b border-subtle overflow-x-auto scroll-thin">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2.5 text-[12px] font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              activeTab === i
                ? "border-pearl text-pearl"
                : "border-transparent text-tsecondary hover:text-tprimary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <>
          <div className="h-28 bg-surface animate-pulse border border-subtle" />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 h-80 bg-surface animate-pulse border border-subtle" />
            <div className="lg:col-span-2 h-80 bg-surface animate-pulse border border-subtle" />
          </div>
        </>
      ) : !data || data.monthly.length === 0 ? (
        <div className="bg-surface border border-subtle">
          <EmptyState
            icon="bar_chart"
            title="No committed pay runs yet. Finalise a pay run to populate reports."
          />
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="border border-subtle p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="label-caps text-ttertiary">Key Performance Indicators · 2026/27</span>
              <span className="text-[11px] font-mono text-ttertiary">Annualised</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard
                label="Total Gross Pay"
                value={gbp(data.totals.gross)}
                delta="+4.2%"
                direction="up"
                icon="payments"
              />
              <KpiCard
                label="Total Tax (PAYE)"
                value={gbp(data.totals.tax)}
                delta="+3.1%"
                direction="up"
                icon="receipt_long"
              />
              <KpiCard
                label="Total NI (EE+ER)"
                value={gbp(data.totals.niEe + data.totals.niEr)}
                delta="-1.0pp"
                direction="down"
                icon="percent"
              />
              <KpiCard
                label="Total Net Pay"
                value={gbp(data.totals.net)}
                delta="+5.6%"
                direction="up"
                icon="account_balance_wallet"
              />
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <StackedBarChart monthly={data.monthly} totals={data.totals} />
            </div>
            <div className="lg:col-span-2">
              <DonutChart totals={data.totals} />
            </div>
          </div>

          {/* Department breakdown */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="section-title text-tprimary">Department Breakdown</h2>
              <span className="text-[11px] font-mono text-ttertiary">
                {data.departments.length} departments · {data.departments.reduce((s, d) => s + d.count, 0)}{" "}
                employees
              </span>
            </div>
            {data.departments.length === 0 ? (
              <div className="bg-surface border border-subtle">
                <EmptyState icon="apartment" title="No departmental data available." />
              </div>
            ) : (
              <DataTable
                columns={[
                  { label: "Department" },
                  { label: "Employees", className: "text-right" },
                  { label: "Gross", className: "text-right" },
                  { label: "Net", className: "text-right" },
                  { label: "Avg Gross", className: "text-right" },
                ]}
              >
                {data.departments.map((d) => (
                  <TableRow key={d.name}>
                    <TableCell>
                      <span className="text-[13px] text-tprimary font-medium">{d.name}</span>
                    </TableCell>
                    <TableCell mono className="text-right text-tsecondary">
                      {d.count}
                    </TableCell>
                    <TableCell mono className="text-right">
                      {gbp(d.gross)}
                    </TableCell>
                    <TableCell mono className="text-right text-pearl">
                      {gbp(d.net)}
                    </TableCell>
                    <TableCell mono className="text-right text-tsecondary">
                      {d.count > 0 ? gbp(d.gross / d.count) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </DataTable>
            )}
          </section>

          {/* P32 Employer Summary */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="section-title text-tprimary">P32 Employer Summary</h2>
                <p className="text-[11px] text-ttertiary mt-0.5">
                  Monthly PAYE &amp; NI due to HMRC · for direct debit / cheque reconciliation
                </p>
              </div>
              <GhostButton onClick={() => toast("P32 CSV queued", "info")}>
                <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">download</span>
                Export P32
              </GhostButton>
            </div>
            <DataTable
              columns={[
                { label: "Tax Month" },
                { label: "Tax Due", className: "text-right" },
                { label: "NI EE Due", className: "text-right" },
                { label: "NI ER Due", className: "text-right" },
                { label: "Emp. Allow.", className: "text-right" },
                { label: "Net Due", className: "text-right" },
              ]}
            >
              {data.p32.months.map((m) => (
                <TableRow key={m.period}>
                  <TableCell>
                    <span className="text-[13px] text-tprimary">
                      M{String(m.period).padStart(2, "0")} · {m.label}
                    </span>
                  </TableCell>
                  <TableCell mono className="text-right">
                    {gbp(m.taxDue)}
                  </TableCell>
                  <TableCell mono className="text-right text-tsecondary">
                    {gbp(m.niEeDue)}
                  </TableCell>
                  <TableCell mono className="text-right text-tsecondary">
                    {gbp(m.niErDue)}
                  </TableCell>
                  <TableCell mono className="text-right text-success">
                    {m.employmentAllowance > 0 ? `−${gbp(m.employmentAllowance)}` : "—"}
                  </TableCell>
                  <TableCell mono className="text-right text-pearl">
                    {gbp(m.netDue)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow>
                <TableCell>
                  <span className="text-[13px] text-tprimary font-semibold uppercase tracking-wide">
                    Total · 2026/27
                  </span>
                </TableCell>
                <TableCell mono className="text-right text-pearl font-semibold">
                  {gbp(data.p32.months.reduce((s, m) => s + m.taxDue, 0))}
                </TableCell>
                <TableCell mono className="text-right text-tsecondary font-semibold">
                  {gbp(data.p32.months.reduce((s, m) => s + m.niEeDue, 0))}
                </TableCell>
                <TableCell mono className="text-right text-tsecondary font-semibold">
                  {gbp(data.p32.months.reduce((s, m) => s + m.niErDue, 0))}
                </TableCell>
                <TableCell mono className="text-right text-success font-semibold">
                  {(() => {
                    const v = data.p32.months.reduce((s, m) => s + m.employmentAllowance, 0);
                    return v > 0 ? `−${gbp(v)}` : "—";
                  })()}
                </TableCell>
                <TableCell mono className="text-right text-pearl font-bold">
                  {gbp(data.p32.totalDue)}
                </TableCell>
              </TableRow>
            </DataTable>
          </section>

          {/* Employer cost summary */}
          <section className="bg-surface border border-subtle p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[24px] text-pearl">savings</span>
              <div>
                <div className="label-caps text-ttertiary">Total Employer Cost · 2026/27</div>
                <div className="data-lg text-pearl mt-1">{gbp(data.totals.employerCost)}</div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <div className="label-caps text-ttertiary">Gross to Employer Cost Ratio</div>
                <div className="data-sm text-tprimary mt-1">
                  {data.totals.gross > 0
                    ? ((data.totals.employerCost / data.totals.gross) * 100).toFixed(1) + "%"
                    : "—"}
                </div>
              </div>
              <div>
                <div className="label-caps text-ttertiary">Pension ER Contributions</div>
                <div className="data-sm text-tprimary mt-1">{gbp(data.totals.pensEr)}</div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
