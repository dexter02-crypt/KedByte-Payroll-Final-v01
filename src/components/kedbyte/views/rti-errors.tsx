"use client";

import * as React from "react";
import { useApp } from "@/store/app";
import { EmptyState, GhostButton, PearlButton, toast } from "@/components/kedbyte/primitives";
import { ExportButton } from "@/components/kedbyte/export-button";

// ============================================================
// RTI ERROR DICTIONARY VIEW — full HMRC error code reference
// ============================================================

export function RtiErrorsView() {
  const { setBureauView } = useApp();
  const [errors, setErrors] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/rti")
      .then((r) => r.json())
      .then((d) => setErrors(d.errorDictionary || []))
      .catch(() => toast("Failed to load error dictionary", "error"))
      .finally(() => setLoading(false));
  }, []);

  const categoryColor = (cat: string) => {
    if (cat === "auth") return "text-error";
    if (cat === "reference") return "text-warning";
    if (cat === "registration") return "text-warning";
    if (cat === "schema") return "text-error";
    return "text-tsecondary";
  };

  const parseSteps = (steps: string | null) => {
    if (!steps) return [];
    try { return JSON.parse(steps); } catch { return []; }
  };

  if (loading) return <div className="text-[13px] text-ttertiary font-mono">Loading…</div>;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-tprimary">RTI Error Dictionary</h1>
          <p className="text-[13px] text-tsecondary mt-1">
            Plain-English guide for HMRC rejection codes · {errors.length} entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton href="/api/rti/errors/dictionary/export" label="Export CSV" icon="csv" filename="rti-error-dictionary.csv" />
          <GhostButton onClick={() => setBureauView("rti")}>
            <span className="material-symbols-outlined text-[14px] mr-1.5 align-middle">arrow_back</span>
            Back to RTI
          </GhostButton>
        </div>
      </div>

      {/* Error cards */}
      {errors.length === 0 ? (
        <EmptyState icon="rule" title="No error dictionary entries found." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {errors.map((e) => {
            const steps = parseSteps(e.guidedSteps);
            return (
              <div key={e.code} className="bg-surface border border-subtle p-5 flex flex-col gap-3">
                {/* Code + category */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[18px] font-mono font-bold text-error">{e.code}</span>
                    <span className={`text-[10px] font-mono uppercase tracking-wider ${categoryColor(e.category)}`}>
                      {e.category || "unknown"}
                    </span>
                  </div>
                  {e.severity && (
                    <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border ${
                      e.severity === "error" ? "border-error text-error" :
                      e.severity === "warning" ? "border-warning text-warning" :
                      "border-subtle text-tsecondary"
                    }`}>
                      {e.severity}
                    </span>
                  )}
                </div>

                {/* HMRC message */}
                <div>
                  <span className="label-caps text-ttertiary">HMRC Message</span>
                  <p className="text-[13px] text-tprimary mt-1">{e.hmrcMessage || "—"}</p>
                </div>

                {/* Plain-English cause */}
                <div>
                  <span className="label-caps text-ttertiary">Plain-English Cause</span>
                  <p className="text-[13px] text-tsecondary mt-1">{e.cause || "—"}</p>
                </div>

                {/* Guided steps */}
                {steps.length > 0 && (
                  <div>
                    <span className="label-caps text-ttertiary">Guided Resolution Steps</span>
                    <ol className="mt-1 flex flex-col gap-1">
                      {steps.map((step: string, i: number) => (
                        <li key={i} className="text-[12px] text-tsecondary flex gap-2">
                          <span className="font-mono text-pearl shrink-0">{i + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Screen + field reference */}
                <div className="flex items-center gap-4 pt-2 border-t border-subtle">
                  {e.resolutionScreen && (
                    <span className="text-[10px] font-mono text-ttertiary uppercase tracking-wider">
                      Screen {e.resolutionScreen}
                    </span>
                  )}
                  {e.resolutionField && (
                    <span className="text-[10px] font-mono text-ttertiary uppercase tracking-wider">
                      Field: {e.resolutionField}
                    </span>
                  )}
                  {e.autoRetry && (
                    <span className="text-[10px] font-mono text-success uppercase tracking-wider">
                      ● Auto-retry
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-subtle">
        <span className="text-[11px] text-ttertiary font-mono">{errors.length} error codes in dictionary</span>
        <GhostButton onClick={() => setBureauView("rti")}>
          <span className="material-symbols-outlined text-[14px] mr-1.5 align-middle">arrow_back</span>
          Back to RTI Submissions
        </GhostButton>
      </div>
    </div>
  );
}
