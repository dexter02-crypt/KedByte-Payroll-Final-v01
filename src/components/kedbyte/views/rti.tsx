"use client";

import * as React from "react";
import { useApp, gbp, fmtDateTime } from "@/store/app";
import {
  DataTable,
  TableRow,
  TableCell,
  StatusChip,
  EmptyState,
  PearlButton,
  GhostButton,
  Select,
  Modal,
  toast,
} from "@/components/kedbyte/primitives";
import { ExportButton } from "@/components/kedbyte/export-button";

// ============ TYPES ============
interface Submission {
  id: string;
  type: string; // FPS | EPS | NVR
  taxYear: string;
  taxPeriod: number | null;
  companyId: string;
  companyName: string;
  status: string; // pending | submitted | polling | accepted | rejected | error
  irmark: string;
  correlationId: string | null;
  submittedAt: string | null;
  resolvedAt: string | null;
  errorCode: string | null;
  errorText: string | null;
  totalPay: number;
  totalTax: number;
  employeeCount: number;
}

interface ErrorDictEntry {
  code: string;
  category: string | null;
  severity: string | null;
  hmrcMessage: string | null;
  cause: string | null;
  resolutionScreen: string | null;
  resolutionField: string | null;
  guidedSteps: string | null; // JSON string
}

// ============ STATUS HELPERS ============
function statusLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function severityChip(sev: string) {
  const s = (sev || "").toLowerCase();
  if (s === "error" || s === "critical") return { status: "rejected", label: "Error" };
  if (s === "warning" || s === "warn") return { status: "pending", label: "Warning" };
  if (s === "info") return { status: "active", label: "Info" };
  return { status: "active", label: sev || "Info" };
}

// ============ SYNTHETIC XML (API contract doesn't return xmlPayload) ============
function synthesizeXml(s: Submission): string {
  const yearEnd = s.taxYear // "2026-27" → "2027-04-05"
    ? `20${s.taxYear.split("-")[1]}-04-05`
    : "2027-04-05";
  const period = s.taxPeriod ? `TaxPeriod="${s.taxPeriod}"` : "";
  return `<IRenvelope xmlns="http://www.govtalk.gov.uk/taxation/PAYE/FP16/1">
  <IRheader>
    <Keys>
      <Key Type="SAO">EMPLOYER-PAYEREF</Key>
    </Keys>
    <PeriodEnd>${yearEnd}</PeriodEnd>
    <IRmark Type="generic">${s.irmark}</IRmark>
    <Sender>Kedbyte Payroll Bureau</Sender>
  </IRheader>
  <FPS ${period} LateReason="" FinalSubmissionForTaxYear="No">
    <Employer>
      <PAYE>${s.companyId}</PAYE>
      <AORef>${s.companyName}</AORef>
      <BankDetails>SortCode=**-**-** Account=********</BankDetails>
    </Employer>
    <Employee>
      <NINO>JT**1111A</NINO>
      <Name>
        <Forename>—</Forename>
        <Surname>—</Surname>
      </Name>
      <Address>—</Address>
      <AnnualValues>
        <TaxablePay>${s.totalPay.toFixed(2)}</TaxablePay>
        <TotalTax>${s.totalTax.toFixed(2)}</TotalTax>
      </AnnualValues>
    </Employee>
    <EmployeesCount>${s.employeeCount}</EmployeesCount>
    <Totals>
      <GrossPay>${s.totalPay.toFixed(2)}</GrossPay>
      <TotalTax>${s.totalTax.toFixed(2)}</TotalTax>
      <EmployeeCount>${s.employeeCount}</EmployeeCount>
    </Totals>
  </FPS>
</IRenvelope>`;
}

// ============ TIMELINE NODE ============
function TimelineNode({
  label,
  at,
  done,
  active,
  error,
}: {
  label: string;
  at: string | null;
  done: boolean;
  active: boolean;
  error?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-3 h-3 mt-1 border shrink-0 ${
          done
            ? error
              ? "bg-error border-error"
              : "bg-success border-success"
            : active
            ? "border-warning"
            : "border-subtle"
        }`}
      />
      <div className="flex flex-col">
        <span
          className={`text-[13px] ${
            done
              ? error
                ? "text-error"
                : "text-tprimary"
              : active
              ? "text-warning"
              : "text-ttertiary"
          }`}
        >
          {label}
        </span>
        {at && <span className="text-[11px] font-mono text-ttertiary mt-0.5">{at}</span>}
      </div>
    </div>
  );
}

// ============ ERROR CARD ============
function ErrorCard({ e }: { e: ErrorDictEntry }) {
  let steps: string[] = [];
  try {
    steps = e.guidedSteps ? JSON.parse(e.guidedSteps) : [];
  } catch {
    steps = [];
  }
  const sev = severityChip(e.severity || "");
  return (
    <div className="bg-surface border border-subtle p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[14px] text-error font-bold">{e.code}</span>
          <StatusChip status={sev.status} label={sev.label} />
          {e.category && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-ttertiary border border-subtle px-1.5 py-0.5">
              {e.category}
            </span>
          )}
        </div>
        <span className="material-symbols-outlined text-[18px] text-error">error</span>
      </div>

      <div>
        <div className="label-caps text-ttertiary mb-1">HMRC Message</div>
        <p className="text-[13px] text-tprimary">{e.hmrcMessage || "—"}</p>
      </div>

      <div>
        <div className="label-caps text-ttertiary mb-1">Plain-English Cause</div>
        <p className="text-[13px] text-tsecondary">{e.cause || "—"}</p>
      </div>

      {steps.length > 0 && (
        <div>
          <div className="label-caps text-ttertiary mb-2">Guided Resolution Steps</div>
          <ol className="flex flex-col gap-1.5">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] text-tsecondary">
                <span className="font-mono text-pearl shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(e.resolutionScreen || e.resolutionField) && (
        <div className="flex items-center gap-3 pt-2 border-t border-subtle">
          {e.resolutionScreen && (
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-ttertiary">monitor</span>
              <span className="text-[11px] font-mono text-ttertiary uppercase">Screen</span>
              <span className="text-[11px] font-mono text-pearl">{e.resolutionScreen}</span>
            </div>
          )}
          {e.resolutionField && (
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-ttertiary">text_fields</span>
              <span className="text-[11px] font-mono text-ttertiary uppercase">Field</span>
              <span className="text-[11px] font-mono text-pearl">{e.resolutionField}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============ MAIN COMPONENT ============
export function RtiView() {
  const { setBureauView } = useApp();
  const [submissions, setSubmissions] = React.useState<Submission[]>([]);
  const [errors, setErrors] = React.useState<ErrorDictEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Submission | null>(null);

  // Filters
  const [taxYearFilter, setTaxYearFilter] = React.useState("all");
  const [periodFilter, setPeriodFilter] = React.useState("all");
  const [companyFilter, setCompanyFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");

  React.useEffect(() => {
    setLoading(true);
    fetch("/api/rti")
      .then((r) => r.json())
      .then((d) => {
        setSubmissions(d.submissions || []);
        setErrors(d.errorDictionary || []);
      })
      .catch(() => toast("Failed to load RTI submissions", "error"))
      .finally(() => setLoading(false));
  }, []);

  // Derive filter option lists
  const taxYears = React.useMemo(() => {
    const set = new Set<string>();
    submissions.forEach((s) => s.taxYear && set.add(s.taxYear));
    return Array.from(set).sort();
  }, [submissions]);

  const periods = React.useMemo(() => {
    const set = new Set<string>();
    submissions.forEach((s) => s.taxPeriod != null && set.add(String(s.taxPeriod)));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [submissions]);

  const companies = React.useMemo(() => {
    const map = new Map<string, string>();
    submissions.forEach((s) => map.set(s.companyId, s.companyName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [submissions]);

  const filtered = submissions.filter((s) => {
    const matchYear = taxYearFilter === "all" || s.taxYear === taxYearFilter;
    const matchPeriod = periodFilter === "all" || String(s.taxPeriod) === periodFilter;
    const matchCompany = companyFilter === "all" || s.companyId === companyFilter;
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    const matchType = typeFilter === "all" || s.type === typeFilter;
    return matchYear && matchPeriod && matchCompany && matchStatus && matchType;
  });

  const clearFilters = () => {
    setTaxYearFilter("all");
    setPeriodFilter("all");
    setCompanyFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
  };

  const hasFilters =
    taxYearFilter !== "all" ||
    periodFilter !== "all" ||
    companyFilter !== "all" ||
    statusFilter !== "all" ||
    typeFilter !== "all";

  // Stats summary
  const stats = React.useMemo(() => {
    const accepted = submissions.filter((s) => s.status === "accepted").length;
    const pending = submissions.filter(
      (s) => s.status === "pending" || s.status === "submitted" || s.status === "polling"
    ).length;
    const rejected = submissions.filter((s) => s.status === "rejected" || s.status === "error").length;
    return { accepted, pending, rejected, total: submissions.length };
  }, [submissions]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-tprimary">RTI Submissions</h1>
          <p className="text-[13px] text-tsecondary mt-1">
            Real Time Information · HMRC FPS/EPS pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GhostButton onClick={() => setBureauView("rti_errors")}>
            <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">rule</span>
            Error Dictionary
          </GhostButton>
          <PearlButton
            onClick={() => toast("FPS submission wizard queued", "info")}
          >
            <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">send</span>
            Submit FPS
          </PearlButton>
        </div>
      </div>

      {/* Status summary strip */}
      {!loading && submissions.length > 0 && (
        <div className="bg-surface border border-subtle p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="label-caps text-ttertiary">Total Submissions</div>
            <div className="data-sm text-tprimary mt-1">{stats.total}</div>
          </div>
          <div>
            <div className="label-caps text-ttertiary">Accepted</div>
            <div className="data-sm text-success mt-1">{stats.accepted}</div>
          </div>
          <div>
            <div className="label-caps text-ttertiary">Pending / Polling</div>
            <div className="data-sm text-warning mt-1">{stats.pending}</div>
          </div>
          <div>
            <div className="label-caps text-ttertiary">Rejected / Error</div>
            <div className="data-sm text-error mt-1">{stats.rejected}</div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      {!loading && submissions.length > 0 && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 flex-1">
            <Select
              value={taxYearFilter}
              onChange={setTaxYearFilter}
              options={[
                { value: "all", label: "All Tax Years" },
                ...taxYears.map((y) => ({ value: y, label: y })),
              ]}
            />
            <Select
              value={periodFilter}
              onChange={setPeriodFilter}
              options={[
                { value: "all", label: "All Periods" },
                ...periods.map((p) => ({ value: p, label: `Period M${p.padStart(2, "0")}` })),
              ]}
            />
            <Select
              value={companyFilter}
              onChange={setCompanyFilter}
              options={[
                { value: "all", label: "All Companies" },
                ...companies.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All Statuses" },
                { value: "accepted", label: "Accepted" },
                { value: "submitted", label: "Submitted" },
                { value: "polling", label: "Polling" },
                { value: "pending", label: "Pending" },
                { value: "rejected", label: "Rejected" },
                { value: "error", label: "Error" },
              ]}
            />
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: "all", label: "All Types" },
                { value: "FPS", label: "FPS" },
                { value: "EPS", label: "EPS" },
                { value: "NVR", label: "NVR" },
              ]}
            />
          </div>
          {hasFilters && (
            <GhostButton onClick={clearFilters} className="shrink-0">
              Clear
            </GhostButton>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="border border-subtle">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 border-b border-subtle last:border-b-0 bg-surface animate-pulse" />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <div className="bg-surface border border-subtle">
          <EmptyState
            icon="cloud_upload"
            title="No RTI submissions yet. Run and finalise a pay run to generate an FPS."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-subtle">
          <EmptyState icon="filter_alt_off" title="No submissions match your filters." />
        </div>
      ) : (
        <DataTable
          columns={[
            { label: "Period" },
            { label: "Company" },
            { label: "Type" },
            { label: "Status" },
            { label: "Total Pay", className: "text-right" },
            { label: "Total Tax", className: "text-right" },
            { label: "Employees", className: "text-right" },
            { label: "Submitted At" },
            { label: "IRmark" },
          ]}
        >
          {filtered.map((s) => (
            <TableRow key={s.id} onClick={() => setSelected(s)}>
              <TableCell mono>
                <span className="text-pearl">
                  {s.taxYear ? s.taxYear.split("-")[0] : "—"} M
                  {s.taxPeriod ? String(s.taxPeriod).padStart(2, "0") : "—"}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-[13px] text-tprimary">{s.companyName}</span>
              </TableCell>
              <TableCell>
                <span className="font-mono text-[12px] text-tsecondary border border-subtle px-1.5 py-0.5">
                  {s.type}
                </span>
              </TableCell>
              <TableCell>
                <StatusChip status={s.status} label={statusLabel(s.status)} />
              </TableCell>
              <TableCell mono className="text-right">
                {gbp(s.totalPay)}
              </TableCell>
              <TableCell mono className="text-right">
                {gbp(s.totalTax)}
              </TableCell>
              <TableCell mono className="text-right">
                {s.employeeCount}
              </TableCell>
              <TableCell mono className="text-tsecondary">
                {s.submittedAt ? fmtDateTime(s.submittedAt) : "—"}
              </TableCell>
              <TableCell mono>
                <span className="text-ttertiary text-[11px]">
                  {s.irmark ? `${s.irmark.slice(0, 12)}…` : "—"}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      )}

      {/* Error Resolution section */}
      {!loading && errors.length > 0 && (
        <section className="flex flex-col gap-4 pt-4 border-t border-subtle">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title text-tprimary flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-error">rule</span>
                Error Resolution
              </h2>
              <p className="text-[12px] text-tsecondary mt-1">
                Plain-English guide for HMRC rejection codes · {errors.length} entries
              </p>
            </div>
            <GhostButton onClick={() => setBureauView("rti_errors")}>
              View full dictionary
              <span className="material-symbols-outlined text-[14px] ml-1.5 align-middle">arrow_forward</span>
            </GhostButton>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {errors.map((e) => (
              <ErrorCard key={e.code} e={e} />
            ))}
          </div>
        </section>
      )}

      {/* Detail Modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Submission · ${selected.type} · ${selected.companyName}` : ""}
        wide
      >
        {selected && (
          <div className="flex flex-col gap-6">
            {/* Top grid: status + key identifiers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="label-caps text-ttertiary mb-1">Status</div>
                <StatusChip status={selected.status} label={statusLabel(selected.status)} />
              </div>
              <div>
                <div className="label-caps text-ttertiary mb-1">Period</div>
                <span className="data-sm text-pearl">
                  {selected.taxYear} · M
                  {selected.taxPeriod ? String(selected.taxPeriod).padStart(2, "0") : "—"}
                </span>
              </div>
              <div>
                <div className="label-caps text-ttertiary mb-1">Type</div>
                <span className="font-mono text-[13px] text-tprimary">{selected.type}</span>
              </div>
              <div>
                <div className="label-caps text-ttertiary mb-1">Employees</div>
                <span className="data-sm text-tprimary">{selected.employeeCount}</span>
              </div>
            </div>

            {/* IRmark + correlation ID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-low border border-subtle p-4 flex flex-col gap-2">
                <div className="label-caps text-ttertiary">IRmark (SHA-1 · Base64)</div>
                <code className="font-mono text-[12px] text-pearl break-all">
                  {selected.irmark || "—"}
                </code>
              </div>
              <div className="bg-surface-low border border-subtle p-4 flex flex-col gap-2">
                <div className="label-caps text-ttertiary">Correlation ID</div>
                <code className="font-mono text-[12px] text-pearl break-all">
                  {selected.correlationId || "—"}
                </code>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h3 className="section-title text-tprimary mb-3">Submission Timeline</h3>
              <div className="bg-surface-low border border-subtle p-4 flex flex-col gap-3">
                <TimelineNode
                  label="Generated IRmark"
                  at={selected.submittedAt ? fmtDateTime(selected.submittedAt) : null}
                  done={!!selected.submittedAt}
                  active={!selected.submittedAt}
                />
                <TimelineNode
                  label="Submitted to HMRC"
                  at={selected.submittedAt ? fmtDateTime(selected.submittedAt) : null}
                  done={!!selected.submittedAt}
                  active={!selected.submittedAt && selected.status !== "pending"}
                />
                <TimelineNode
                  label="Polling for response"
                  at={
                    selected.status === "polling" || selected.status === "submitted"
                      ? "Awaiting HMRC ack"
                      : null
                  }
                  done={selected.status === "accepted" || selected.status === "rejected" || selected.status === "error"}
                  active={selected.status === "polling" || selected.status === "submitted"}
                />
                <TimelineNode
                  label={
                    selected.status === "accepted"
                      ? "Accepted ✓"
                      : selected.status === "rejected" || selected.status === "error"
                      ? "Rejected ✕"
                      : "Resolved"
                  }
                  at={selected.resolvedAt ? fmtDateTime(selected.resolvedAt) : null}
                  done={!!selected.resolvedAt || selected.status === "accepted"}
                  active={false}
                  error={selected.status === "rejected" || selected.status === "error"}
                />
              </div>
            </div>

            {/* Error info if rejected */}
            {(selected.status === "rejected" || selected.status === "error") && (
              <div className="bg-surface-low border-l-2 border-l-error border border-subtle p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-error">error</span>
                  <span className="label-caps text-error">Rejection Detail</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="label-caps text-ttertiary">Code</span>
                  <span className="font-mono text-[13px] text-error font-bold">
                    {selected.errorCode || "—"}
                  </span>
                </div>
                <p className="text-[13px] text-tprimary">{selected.errorText || "No error text returned."}</p>
                {selected.errorCode && (
                  <p className="text-[12px] text-tsecondary mt-1">
                    See the Error Resolution dictionary below for plain-English cause and guided steps.
                  </p>
                )}
              </div>
            )}

            {/* Totals */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-surface-low border border-subtle p-3">
                <div className="label-caps text-ttertiary mb-1">Total Pay</div>
                <div className="data-sm text-tprimary">{gbp(selected.totalPay)}</div>
              </div>
              <div className="bg-surface-low border border-subtle p-3">
                <div className="label-caps text-ttertiary mb-1">Total Tax</div>
                <div className="data-sm text-tprimary">{gbp(selected.totalTax)}</div>
              </div>
              <div className="bg-surface-low border border-subtle p-3">
                <div className="label-caps text-ttertiary mb-1">Headcount</div>
                <div className="data-sm text-tprimary">{selected.employeeCount}</div>
              </div>
            </div>

            {/* XML payload */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="section-title text-tprimary">XML Payload</h3>
                <div className="flex items-center gap-2">
                  <GhostButton
                    onClick={() => {
                      navigator.clipboard?.writeText(synthesizeXml(selected));
                      toast("XML payload copied to clipboard", "success");
                    }}
                  >
                    <span className="material-symbols-outlined text-[14px] mr-1.5 align-middle">
                      content_copy
                    </span>
                    Copy
                  </GhostButton>
                  <ExportButton
                    href={`/api/rti/${selected.id}/xml`}
                    label="Download XML"
                    icon="code"
                    filename={`fps-${selected.companyName?.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${selected.taxYear}-M${String(selected.taxPeriod).padStart(2, "0")}.xml`}
                  />
                  {selected.status === "accepted" && (
                    <ExportButton
                      href={`/api/rti/${selected.id}/response`}
                      label="Response XML"
                      icon="receipt"
                      filename={`fps-response-${selected.correlationId || selected.id}.xml`}
                    />
                  )}
                </div>
              </div>
              <pre className="bg-surface-low border border-subtle p-4 overflow-x-auto scroll-thin font-mono text-[11px] leading-relaxed text-tsecondary max-h-72">
                {synthesizeXml(selected)}
              </pre>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-subtle">
              <GhostButton onClick={() => setSelected(null)}>Close</GhostButton>
              {(selected.status === "rejected" || selected.status === "error") && (
                <PearlButton
                  onClick={() => {
                    toast("Resubmission queued", "info");
                    setSelected(null);
                  }}
                >
                  <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">refresh</span>
                  Resubmit
                </PearlButton>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
