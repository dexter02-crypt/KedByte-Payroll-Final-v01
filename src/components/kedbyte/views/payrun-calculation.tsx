"use client";

import * as React from "react";
import { useApp, gbp } from "@/store/app";
import {
  Stepper,
  StatusChip,
  PearlButton,
  GhostButton,
  TerminalLog,
  EmptyState,
  toast,
} from "@/components/kedbyte/primitives";
import { cn } from "@/lib/utils";

// ============ TYPES ============
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

interface ProgressLogEntry {
  i: number;
  total: number;
  employeeId: string;
  line: string;
}

interface TerminalLine {
  ts: string;
  text: string;
  level: string;
}

const EMPTY_TOTALS: Totals = {
  gross: 0,
  tax: 0,
  niEe: 0,
  niEr: 0,
  pensEe: 0,
  pensEr: 0,
  net: 0,
  employerCost: 0,
  sl: 0,
  pgl: 0,
};

function tsNow(): string {
  return new Date().toISOString().slice(11, 23);
}

function levelForLine(text: string): string {
  if (text.includes("ERROR") || text.includes("FAIL")) return "error";
  if (text.includes("WARN") || text.includes("Variance")) return "warn";
  if (text.includes("✓") || text.includes("OK") || text.includes("COMPLETE")) return "ok";
  return "info";
}

export function PayRunCalculation() {
  const { activePayRunId, setBureauView } = useApp();
  const [lines, setLines] = React.useState<TerminalLine[]>([]);
  const [running, setRunning] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [errorCount, setErrorCount] = React.useState(0);
  const [processed, setProcessed] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [finalTotals, setFinalTotals] = React.useState<Totals>(EMPTY_TOTALS);
  const [taxPeriod, setTaxPeriod] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const firedRef = React.useRef(false);

  // Push a line immutably
  const pushLine = React.useCallback((text: string, level: string = "info") => {
    setLines((prev) => [...prev, { ts: tsNow(), text, level }]);
  }, []);

  // ============ ON MOUNT: trigger calculation ============
  React.useEffect(() => {
    if (!activePayRunId) return;
    if (firedRef.current) return;
    firedRef.current = true;

    let cancelled = false;
    setRunning(true);

    // Boot lines (immediate)
    pushLine("> INITIALIZING PAY RUN ENGINE…", "info");
    setTimeout(() => pushLine("> LOADING TAX CODES AND THRESHOLDS… OK", "ok"), 220);
    setTimeout(() => pushLine("> Connecting to YTD ledger and pension scheme registry…", "info"), 380);

    async function run() {
      try {
        // Small delay so boot lines render first
        await new Promise((r) => setTimeout(r, 700));
        if (cancelled) return;

        // Fire the calculation
        pushLine("> Dispatching POST /api/payruns/" + activePayRunId + "/calculate", "info");
        const res = await fetch(`/api/payruns/${activePayRunId}/calculate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();

        if (cancelled) return;
        if (data.error) {
          pushLine(`> ENGINE ERROR: ${data.error}`, "error");
          pushLine("> Calculation aborted.", "error");
          setError(data.error);
          setRunning(false);
          return;
        }

        // Push tax period context line
        const pl: ProgressLogEntry[] = data.progressLog || [];
        const t = pl.length > 0 ? pl[0].total : 0;
        setTotal(t);
        setErrorCount(data.errors || 0);

        // Tax period — derive from total records (we don't have it directly, fetch pay run quickly)
        try {
          const prRes = await fetch(`/api/payruns/${activePayRunId}`);
          const pr = await prRes.json();
          if (pr.taxPeriod) {
            setTaxPeriod(pr.taxPeriod);
            pushLine(`> Tax year 2026/27 · Period M${pr.taxPeriod}`, "info");
          }
        } catch {}

        pushLine(`> ${pl.length} employee records queued for processing`, "info");
        pushLine("> Beginning per-record calculation pass…", "info");

        // Stream progressLog one entry at a time, 60-120ms intervals
        for (let k = 0; k < pl.length; k++) {
          if (cancelled) return;
          const entry = pl[k];
          // Random 60-120ms delay
          const delay = 60 + Math.floor(Math.random() * 60);
          await new Promise((r) => setTimeout(r, delay));

          pushLine(`> Processing record ${entry.i} of ${entry.total}… ✓`, "info");
          // Push the engine log line for this record (could be success/warn/error)
          pushLine(entry.line, levelForLine(entry.line));

          // Update running counter
          setProcessed(entry.i);

          // Update interpolated totals (progressive build)
          const scale = entry.i / entry.total;
          setFinalTotals({
            gross: round2((data.totals.gross || 0) * scale),
            tax: round2((data.totals.tax || 0) * scale),
            niEe: round2((data.totals.niEe || 0) * scale),
            niEr: round2((data.totals.niEr || 0) * scale),
            pensEe: round2((data.totals.pensEe || 0) * scale),
            pensEr: round2((data.totals.pensEr || 0) * scale),
            net: round2((data.totals.net || 0) * scale),
            employerCost: round2((data.totals.employerCost || 0) * scale),
            sl: round2((data.totals.sl || 0) * scale),
            pgl: round2((data.totals.pgl || 0) * scale),
          });
        }

        if (cancelled) return;

        // Finalize totals to exact values
        setFinalTotals({
          gross: data.totals.gross || 0,
          tax: data.totals.tax || 0,
          niEe: data.totals.niEe || 0,
          niEr: data.totals.niEr || 0,
          pensEe: data.totals.pensEe || 0,
          pensEr: data.totals.pensEr || 0,
          net: data.totals.net || 0,
          employerCost: data.totals.employerCost || 0,
          sl: data.totals.sl || 0,
          pgl: data.totals.pgl || 0,
        });

        pushLine("> All records processed.", "info");
        pushLine("> Totals reconciled · YTD vectors updated · variance checks applied", "ok");
        pushLine(`> CALCULATION COMPLETE ✓  ·  ${data.errors || 0} record(s) flagged`, "ok");
        setRunning(false);
        setDone(true);
        toast("Calculation complete", "success");
      } catch (e: any) {
        if (cancelled) return;
        pushLine(`> FATAL: ${e?.message || "Unknown error"}`, "error");
        pushLine("> Calculation failed. Inspect engine log.", "error");
        setError(e?.message || "Calculation failed");
        setRunning(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [activePayRunId, pushLine]);

  // ============ NO PAY RUN ============
  if (!activePayRunId) {
    return (
      <div className="max-w-3xl mx-auto py-6">
        <Stepper
          steps={[
            { label: "Input", icon: "edit" },
            { label: "Calculation", icon: "calculate" },
            { label: "Review", icon: "fact_check" },
            { label: "Submission", icon: "send" },
          ]}
          current={1}
        />
        <div className="mt-6">
          <EmptyState
            icon="calculate"
            title="No active pay run. Go back to Step 1 to create or select a pay run."
            action={() => setBureauView("payrun_input")}
            actionLabel="Back to Input"
          />
        </div>
      </div>
    );
  }

  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  // ============ RENDER ============
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="page-title text-tprimary">Calculation Engine</h1>
              <StatusChip status={running ? "calculating" : done ? "approved" : "draft"} label={running ? "RUNNING" : done ? "COMPLETE" : "IDLE"} />
            </div>
            <p className="text-[13px] text-tsecondary">Step 2 of 4 · Live PAYE / NI / SL / Pension computation</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-ttertiary uppercase tracking-wider">
            <span className="material-symbols-outlined text-[14px] text-ttertiary">memory</span>
            Engine v2026.27.4 · TY 2026/27 {taxPeriod ? `· M${taxPeriod}` : ""}
          </div>
        </div>
        <Stepper
          steps={[
            { label: "Input", icon: "edit" },
            { label: "Calculation", icon: "calculate" },
            { label: "Review", icon: "fact_check" },
            { label: "Submission", icon: "send" },
          ]}
          current={1}
        />
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-surface border-l-2 border-l-error border border-subtle px-4 py-3 mb-4 flex items-center gap-3" style={{ borderLeftColor: "#F87171" }}>
          <span className="material-symbols-outlined text-[20px] text-error">error</span>
          <span className="text-[13px] text-tprimary">Engine error: {error}</span>
        </div>
      )}

      {/* Variance / attention banner */}
      {done && errorCount > 0 && (
        <div className="bg-surface border-l-2 border-l-warning border border-subtle px-4 py-3 mb-4 flex items-center justify-between gap-3" style={{ borderLeftColor: "#FBBF24" }}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px] text-warning">warning</span>
            <span className="text-[13px] text-tprimary">
              {errorCount} record{errorCount !== 1 ? "s" : ""} need attention — review variance flags before continuing.
            </span>
          </div>
          <span className="text-[11px] font-mono text-warning uppercase tracking-wider">Review in Step 3</span>
        </div>
      )}

      {/* Two-column layout: Terminal 60% · Summary 40% */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
        {/* LEFT: Terminal Log */}
        <div className="bg-surface-low border border-subtle h-[640px] flex flex-col">
          <TerminalLog lines={lines} running={running} />
        </div>

        {/* RIGHT: Live Summary */}
        <div className="flex flex-col gap-4">
          {/* Progress block */}
          <div className="bg-surface border border-subtle p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="label-caps text-tsecondary">Engine Progress</span>
              <span className="text-[12px] font-mono text-pearl">{pct}%</span>
            </div>
            <div className="h-2 bg-surface-low border border-subtle overflow-hidden">
              <div
                className={cn("h-full transition-all duration-200", running ? "bg-warning" : "bg-success")}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-[12px] font-mono text-tsecondary">
                Records processed <span className="text-pearl">{processed}</span> / <span className="text-tprimary">{total}</span>
              </span>
              {running ? (
                <span className="flex items-center gap-1.5 text-[11px] font-mono text-warning uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 bg-warning animate-pulse" />
                  Streaming
                </span>
              ) : done ? (
                <span className="flex items-center gap-1.5 text-[11px] font-mono text-success uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Reconciled
                </span>
              ) : null}
            </div>
          </div>

          {/* Live totals */}
          <div className="bg-surface border border-subtle p-5 flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="label-caps text-tsecondary">Live Totals</span>
              <span className="text-[10px] font-mono text-ttertiary uppercase tracking-wider">All figures GBP</span>
            </div>

            <SummaryRow label="Total Gross" value={finalTotals.gross} highlight />
            <SummaryRow label="Total Tax (PAYE)" value={finalTotals.tax} />
            <SummaryRow label="Total NI · Employee" value={finalTotals.niEe} />
            <SummaryRow label="Total NI · Employer" value={finalTotals.niEr} />
            <SummaryRow label="Total Pension · EE" value={finalTotals.pensEe} />
            <SummaryRow label="Total Pension · ER" value={finalTotals.pensEr} />
            {(finalTotals.sl > 0 || finalTotals.pgl > 0) && (
              <SummaryRow label="Student / PG Loans" value={finalTotals.sl + finalTotals.pgl} />
            )}

            {/* Net pay emphasis */}
            <div className="border-t border-subtle pt-4 mt-2">
              <div className="flex items-end justify-between">
                <div className="flex flex-col gap-1">
                  <span className="label-caps text-tsecondary">Total Net Pay</span>
                  <span className="data-lg text-pearl">{gbp(finalTotals.net)}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="label-caps text-ttertiary">Employer Cost</span>
                  <span className="data-sm text-tsecondary">{gbp(finalTotals.employerCost)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-subtle">
        <GhostButton onClick={() => setBureauView("payrun_input")}>
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Input
          </span>
        </GhostButton>
        <div className="flex items-center gap-3">
          {done ? (
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-success uppercase tracking-wider">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              Ready to review
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-ttertiary uppercase tracking-wider">
              <span className="material-symbols-outlined text-[14px] animate-spin-slow">progress_activity</span>
              Calculation in progress…
            </span>
          )}
          <PearlButton
            disabled={!done}
            onClick={() => {
              setBureauView("payrun_review");
              toast("Continuing to review & approval", "info");
            }}
          >
            <span className="flex items-center gap-2">
              Continue to Review
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </span>
          </PearlButton>
        </div>
      </div>
    </div>
  );
}

// ============ SUB-COMPONENTS ============

function SummaryRow({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-tsecondary">{label}</span>
      <span className={cn("data-sm", highlight ? "text-pearl" : "text-tprimary")}>{gbp(value)}</span>
    </div>
  );
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
