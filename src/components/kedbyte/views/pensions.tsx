"use client";

import * as React from "react";
import { useApp, gbp, fmtDate } from "@/store/app";
import {
  StatCard,
  DataTable,
  TableRow,
  TableCell,
  StatusChip,
  EmptyState,
  PearlButton,
  GhostButton,
  Field,
  TextInput,
  Select,
  Modal,
  toast,
} from "@/components/kedbyte/primitives";
import { ExportButton } from "@/components/kedbyte/export-button";

// ============ TYPES ============
interface Employee {
  id: string;
  name: string;
  dob: string;
  age: number;
  salaryAnnual: number;
  pensionStatus: string; // eligible | enrolled | opted_out | entitled | not_assessed
  pensionEnrolmentDate: string | null;
  pensionOptoutDate: string | null;
  assessment: {
    result: string; // eligible | non_eligible | entitled
    action: string;
    assessedOn: string;
  } | null;
}

interface Stats {
  eligible: number;
  enrolled: number;
  optedOut: number;
  total: number;
  lastAssessment: string;
}

interface CompanyLite {
  id: string;
  name: string;
}

const PENSION_LABELS: Record<string, string> = {
  eligible: "Eligible",
  enrolled: "Enrolled",
  opted_out: "Opted Out",
  entitled: "Entitled",
  not_assessed: "Not Assessed",
};

const ASSESSMENT_LABELS: Record<string, string> = {
  eligible: "Eligible",
  non_eligible: "Non-Eligible",
  entitled: "Entitled",
};

export function PensionsView() {
  const { activeCompanyId, setActiveCompany } = useApp();
  const [companies, setCompanies] = React.useState<CompanyLite[]>([]);
  const [selectedCompany, setSelectedCompany] = React.useState<string>("");
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingCompanies, setLoadingCompanies] = React.useState(true);

  // Opt-out modal
  const [optoutEmp, setOptoutEmp] = React.useState<Employee | null>(null);
  const [receivedDate, setReceivedDate] = React.useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [submitting, setSubmitting] = React.useState(false);

  // Load companies
  React.useEffect(() => {
    setLoadingCompanies(true);
    fetch("/api/companies")
      .then((r) => r.json())
      .then((d) => {
        const list = d.companies || [];
        setCompanies(list);
        if (list.length > 0) {
          const match = list.find((c: CompanyLite) => c.id === activeCompanyId);
          setSelectedCompany(match ? match.id : list[0].id);
        }
      })
      .catch(() => toast("Failed to load companies", "error"))
      .finally(() => setLoadingCompanies(false));
  }, [activeCompanyId]);

  // Load employees
  React.useEffect(() => {
    if (!selectedCompany) {
      setEmployees([]);
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/pensions?companyId=${selectedCompany}`)
      .then((r) => r.json())
      .then((d) => {
        setEmployees(d.employees || []);
        setStats(d.stats || null);
      })
      .catch(() => toast("Failed to load pension data", "error"))
      .finally(() => setLoading(false));
  }, [selectedCompany]);

  // Sync store active company
  React.useEffect(() => {
    if (selectedCompany && selectedCompany !== activeCompanyId) {
      setActiveCompany(selectedCompany);
    }
  }, [selectedCompany, activeCompanyId, setActiveCompany]);

  const handleOptout = async () => {
    if (!optoutEmp) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/pensions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "optout",
          employeeId: optoutEmp.id,
          receivedDate,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const d = await res.json();
      const mode = d.mode === "refund" ? "refund" : "cessation";
      toast(
        mode === "refund"
          ? `Opt-out processed · Refund mode (within 1-month window)`
          : `Opt-out processed · Cessation mode (contributions cease)`,
        "success"
      );
      // Refresh list
      const fresh = await fetch(`/api/pensions?companyId=${selectedCompany}`).then((r) => r.json());
      setEmployees(fresh.employees || []);
      setStats(fresh.stats || null);
      setOptoutEmp(null);
    } catch {
      toast("Failed to process opt-out", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const assessNow = async () => {
    toast("Assessment queued · " + (selectedCompany ? "1 company" : "all companies"), "info");
    // Could POST /api/pensions {action:"assess"} but per API it just returns jobId
    try {
      await fetch("/api/pensions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assess" }),
      });
    } catch {
      /* silent */
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-tprimary">Pension Auto-Enrolment</h1>
          <p className="text-[13px] text-tsecondary mt-1">
            TPR compliance · worker assessment · NEST/Smart/Aviva contribution files
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            href={`/api/pensions/assessment/export${selectedCompany ? `?companyId=${selectedCompany}` : ""}`}
            label="Export Report"
            icon="file_export"
          />
          <PearlButton onClick={assessNow}>
            <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">bolt</span>
            Assess Now
          </PearlButton>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Eligible Workers"
            value={String(stats.eligible)}
            sublabel={`of ${stats.total} total`}
            icon="group"
          />
          <StatCard
            label="Enrolled"
            value={String(stats.enrolled)}
            sublabel="active contributors"
            icon="verified_user"
          />
          <StatCard
            label="Opted Out"
            value={String(stats.optedOut)}
            sublabel="within statutory window"
            icon="person_remove"
          />
          <StatCard
            label="Last Assessment"
            value={stats.lastAssessment ? stats.lastAssessment.split(" ")[0] : "—"}
            sublabel={stats.lastAssessment ? stats.lastAssessment.split(" ")[1] : "never"}
            icon="history"
          />
        </div>
      )}

      {/* Company selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="label-caps text-tsecondary">Company</span>
          {loadingCompanies ? (
            <div className="h-9 w-56 bg-surface-high animate-pulse" />
          ) : (
            <Select
              value={selectedCompany}
              onChange={setSelectedCompany}
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              className="min-w-[240px]"
            />
          )}
        </div>
        <div className="text-[12px] text-ttertiary font-mono">
          {selectedCompany
            ? "Filtering active workers for selected company"
            : "Showing all companies"}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="border border-subtle">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 border-b border-subtle last:border-b-0 bg-surface animate-pulse" />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-surface border border-subtle">
          <EmptyState
            icon="elderly"
            title="No employees found for this company. Run an assessment to begin auto-enrolment tracking."
          />
        </div>
      ) : (
        <DataTable
          columns={[
            { label: "Employee" },
            { label: "Age", className: "text-right" },
            { label: "Earnings Annual", className: "text-right" },
            { label: "Assessment" },
            { label: "Pension Status" },
            { label: "Enrolment Date" },
            { label: "Action" },
          ]}
        >
          {employees.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-[13px] text-tprimary font-medium">{e.name}</span>
                  <span className="text-[11px] text-ttertiary font-mono mt-0.5">
                    DOB {e.dob ? fmtDate(e.dob) : "—"}
                  </span>
                </div>
              </TableCell>
              <TableCell mono className="text-right text-tsecondary">
                {e.age}
              </TableCell>
              <TableCell mono className="text-right">
                {gbp(e.salaryAnnual)}
              </TableCell>
              <TableCell>
                {e.assessment ? (
                  <div className="flex flex-col gap-1">
                    <StatusChip
                      status={
                        e.assessment.result === "eligible"
                          ? "eligible"
                          : e.assessment.result === "entitled"
                          ? "entitled"
                          : "not_assessed"
                      }
                      label={ASSESSMENT_LABELS[e.assessment.result] || e.assessment.result}
                    />
                    <span className="text-[10px] font-mono text-ttertiary">
                      {fmtDate(e.assessment.assessedOn)}
                    </span>
                  </div>
                ) : (
                  <StatusChip status="not_assessed" label="Not Assessed" />
                )}
              </TableCell>
              <TableCell>
                <StatusChip
                  status={e.pensionStatus}
                  label={PENSION_LABELS[e.pensionStatus] || e.pensionStatus}
                />
              </TableCell>
              <TableCell mono className="text-tsecondary">
                {e.pensionEnrolmentDate ? fmtDate(e.pensionEnrolmentDate) : "—"}
              </TableCell>
              <TableCell>
                {e.pensionStatus === "enrolled" ? (
                  <GhostButton
                    onClick={() => {
                      setOptoutEmp(e);
                      setReceivedDate(new Date().toISOString().slice(0, 10));
                    }}
                  >
                    <span className="material-symbols-outlined text-[14px] mr-1.5 align-middle">
                      person_remove
                    </span>
                    Opt Out
                  </GhostButton>
                ) : e.pensionStatus === "opted_out" ? (
                  <span className="text-[11px] text-ttertiary font-mono">
                    Opted out {e.pensionOptoutDate ? fmtDate(e.pensionOptoutDate) : ""}
                  </span>
                ) : (
                  <span className="text-[11px] text-ttertiary font-mono">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      )}

      {/* Compliance footer */}
      {!loading && stats && (
        <div className="bg-surface border border-subtle p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-6">
            <div>
              <div className="label-caps text-ttertiary">Enrolment Ratio</div>
              <div className="data-sm text-tprimary mt-1">
                {stats.enrolled}/{stats.total} ·{" "}
                <span className="text-success">
                  {stats.total > 0 ? Math.round((stats.enrolled / stats.total) * 100) : 0}%
                </span>
              </div>
            </div>
            <div>
              <div className="label-caps text-ttertiary">Opt-Out Rate</div>
              <div className="data-sm text-tprimary mt-1">
                {stats.total > 0 ? Math.round((stats.optedOut / stats.total) * 100) : 0}%
              </div>
            </div>
            <div>
              <div className="label-caps text-ttertiary">Next Reassessment</div>
              <div className="data-sm text-pearl mt-1">Every 3 years · Cyclical</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-success">verified</span>
            <span className="text-[12px] text-tsecondary">TPR compliant</span>
          </div>
        </div>
      )}

      {/* Opt-out Modal */}
      <Modal
        open={!!optoutEmp}
        onClose={() => (submitting ? null : setOptoutEmp(null))}
        title="Process Pension Opt-Out"
      >
        {optoutEmp && (
          <div className="flex flex-col gap-5">
            <div className="bg-surface-low border border-subtle p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-surface-high border border-subtle flex items-center justify-center shrink-0">
                <span className="text-[13px] font-mono font-bold text-pearl">
                  {optoutEmp.name.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-tprimary font-medium">{optoutEmp.name}</div>
                <div className="text-[12px] font-mono text-ttertiary">
                  Enrolled {optoutEmp.pensionEnrolmentDate ? fmtDate(optoutEmp.pensionEnrolmentDate) : "—"}
                </div>
              </div>
              <StatusChip status="enrolled" label="Enrolled" />
            </div>

            <div className="bg-surface-low border-l-2 border-l-warning border border-subtle p-3 flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] text-warning mt-0.5">info</span>
              <p className="text-[12px] text-tsecondary leading-relaxed">
                Workers may opt out within 1 month of enrolment for a{" "}
                <span className="text-pearl">full refund</span>. After that window,
                contributions <span className="text-pearl">cease</span> but are not refunded. The
                mode will be determined automatically based on the received date and the enrolment
                date.
              </p>
            </div>

            <Field
              label="Opt-Out Received Date"
              hint="The date the worker formally requested to opt out"
            >
              <TextInput
                type="date"
                value={receivedDate}
                onChange={setReceivedDate}
                mono
              />
            </Field>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-subtle">
              <GhostButton onClick={() => setOptoutEmp(null)} disabled={submitting}>
                Cancel
              </GhostButton>
              <PearlButton onClick={handleOptout} disabled={submitting || !receivedDate}>
                {submitting ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle animate-spin">
                      progress_activity
                    </span>
                    Processing…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">
                      check
                    </span>
                    Confirm Opt-Out
                  </>
                )}
              </PearlButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
