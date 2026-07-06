"use client";

import * as React from "react";
import { useApp, gbp, fmtDate } from "@/store/app";
import {
  DataTable,
  TableRow,
  TableCell,
  StatusChip,
  EmptyState,
  PearlButton,
  GhostButton,
  Select,
  Field,
  Modal,
  toast,
} from "@/components/kedbyte/primitives";
import { ExportButton } from "@/components/kedbyte/export-button";
import { maskNINO } from "@/engine/payroll";

interface Employee {
  id: string;
  payrollId: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string | null;
  nino: string | null;
  department: string | null;
  jobTitle: string | null;
  salaryAnnual: number;
  taxCode: string;
  taxBasis: string;
  niCategory: string;
  employmentType: string;
  pensionStatus: string;
  studentLoanPlan: string | null;
  postgradLoan: boolean;
  status: string;
  startDate: string;
}

interface CompanyLite {
  id: string;
  name: string;
}

const PENSION_LABELS: Record<string, string> = {
  eligible: "Eligible",
  enrolled: "Enrolled",
  opted_out: "Opted Out",
  not_assessed: "Not Assessed",
  entitled: "Entitled",
};

export function EmployeesView() {
  const { activeCompanyId, setActiveCompany, setActiveEmployee, setBureauView } = useApp();
  const [companies, setCompanies] = React.useState<CompanyLite[]>([]);
  const [selectedCompany, setSelectedCompany] = React.useState<string>("");
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingCompanies, setLoadingCompanies] = React.useState(true);

  // Filters
  const [search, setSearch] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [taxCodeFilter, setTaxCodeFilter] = React.useState("all");
  const [pensionFilter, setPensionFilter] = React.useState("all");
  const [importOpen, setImportOpen] = React.useState(false);

  // Load companies list (for the selector)
  React.useEffect(() => {
    setLoadingCompanies(true);
    fetch("/api/companies")
      .then((r) => r.json())
      .then((d) => {
        const list = d.companies || [];
        setCompanies(list);
        // Default selection: activeCompanyId if present in list, else first
        if (list.length > 0) {
          const match = list.find((c: CompanyLite) => c.id === activeCompanyId);
          setSelectedCompany(match ? match.id : list[0].id);
        }
      })
      .catch(() => toast("Failed to load companies", "error"))
      .finally(() => setLoadingCompanies(false));
  }, [activeCompanyId]);

  // Load employees for selected company
  React.useEffect(() => {
    if (!selectedCompany) {
      setEmployees([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/companies/${selectedCompany}/employees`)
      .then((r) => r.json())
      .then((d) => setEmployees(d.employees || []))
      .catch(() => toast("Failed to load employees", "error"))
      .finally(() => setLoading(false));
  }, [selectedCompany]);

  // Sync store activeCompany when user changes the selector
  React.useEffect(() => {
    if (selectedCompany && selectedCompany !== activeCompanyId) {
      setActiveCompany(selectedCompany);
    }
  }, [selectedCompany, activeCompanyId, setActiveCompany]);

  const departments = React.useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => { if (e.department) set.add(e.department); });
    return Array.from(set).sort();
  }, [employees]);

  const taxCodes = React.useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => { if (e.taxCode) set.add(e.taxCode); });
    return Array.from(set).sort();
  }, [employees]);

  const filtered = employees.filter((e) => {
    const matchesSearch =
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.payrollId.toLowerCase().includes(search.toLowerCase()) ||
      (e.email || "").toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === "all" || e.department === deptFilter;
    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    const matchesTax = taxCodeFilter === "all" || e.taxCode === taxCodeFilter;
    const matchesPension = pensionFilter === "all" || e.pensionStatus === pensionFilter;
    return matchesSearch && matchesDept && matchesStatus && matchesTax && matchesPension;
  });

  const openEmployee = (e: Employee) => {
    setActiveEmployee(e.id);
    // Stay in employees list context — could navigate to a detail screen later
    toast(`${e.name} · ${e.payrollId}`, "info");
  };

  const hasCompanies = companies.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-tprimary">Employees</h1>
          <p className="text-[13px] text-tsecondary mt-1">
            Manage employee records across all client payrolls
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedCompany && (
            <>
              <ExportButton
                href={`/api/companies/${selectedCompany}/employees/export`}
                label="Export List"
                icon="file_export"
              />
              <GhostButton onClick={() => setImportOpen(true)}>
                <span className="material-symbols-outlined text-[14px] mr-1.5 align-middle">upload</span>
                Bulk Import
              </GhostButton>
              <PearlButton onClick={() => setBureauView("employee_new")}>
                <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">person_add</span>
                Add Employee
              </PearlButton>
            </>
          )}
        </div>
      </div>

      {/* Company selector + actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
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
        <div className="flex items-center bg-surface-low border border-subtle px-3 py-2 flex-1 max-w-md">
          <span className="material-symbols-outlined text-[16px] text-ttertiary mr-2">search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, EMP ID, or email…"
            className="bg-transparent border-none outline-none text-[13px] text-tprimary placeholder:text-ttertiary w-full font-mono"
          />
        </div>
      </div>

      {/* Empty state when no companies */}
      {!loadingCompanies && !hasCompanies && (
        <div className="bg-surface border border-subtle">
          <EmptyState
            icon="business"
            title="No companies available. Add a company first to manage employees."
            action={() => setBureauView("companies")}
            actionLabel="Add Company"
          />
        </div>
      )}

      {/* Filters */}
      {hasCompanies && selectedCompany && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Select
            value={deptFilter}
            onChange={setDeptFilter}
            options={[
              { value: "all", label: "All Departments" },
              ...departments.map((d) => ({ value: d, label: d })),
            ]}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "active", label: "Active" },
              { value: "draft", label: "Draft" },
              { value: "leaver", label: "Leaver" },
            ]}
          />
          <Select
            value={taxCodeFilter}
            onChange={setTaxCodeFilter}
            options={[
              { value: "all", label: "All Tax Codes" },
              ...taxCodes.map((t) => ({ value: t, label: t })),
            ]}
          />
          <Select
            value={pensionFilter}
            onChange={setPensionFilter}
            options={[
              { value: "all", label: "All Pension Status" },
              { value: "enrolled", label: "Enrolled" },
              { value: "eligible", label: "Eligible" },
              { value: "opted_out", label: "Opted Out" },
              { value: "entitled", label: "Entitled" },
              { value: "not_assessed", label: "Not Assessed" },
            ]}
          />
        </div>
      )}

      {/* Table */}
      {hasCompanies && selectedCompany && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-tsecondary">
              Showing <span className="font-mono text-tprimary">{filtered.length}</span> of{" "}
              <span className="font-mono text-tprimary">{employees.length}</span> employees
            </p>
            {(deptFilter !== "all" || statusFilter !== "all" || taxCodeFilter !== "all" || pensionFilter !== "all" || search) && (
              <GhostButton
                onClick={() => {
                  setSearch("");
                  setDeptFilter("all");
                  setStatusFilter("all");
                  setTaxCodeFilter("all");
                  setPensionFilter("all");
                }}
              >
                Clear filters
              </GhostButton>
            )}
          </div>

          {loading ? (
            <div className="border border-subtle">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-14 border-b border-subtle last:border-b-0 bg-surface animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-surface border border-subtle">
              {employees.length === 0 ? (
                <EmptyState
                  icon="person_off"
                  title="No employees yet for this company."
                  action={() => setBureauView("employee_new")}
                  actionLabel="Add First Employee"
                />
              ) : (
                <EmptyState icon="search_off" title="No employees match your filters." />
              )}
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
                { label: "Pension" },
              ]}
            >
              {filtered.map((e) => (
                <TableRow key={e.id} onClick={() => openEmployee(e)}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-[13px] text-tprimary font-medium">{e.name}</span>
                      <span className="text-[11px] text-ttertiary font-mono mt-0.5">
                        {e.payrollId} · {e.jobTitle || "—"}
                      </span>
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
                    {maskNINO(e.nino)}
                  </TableCell>
                  <TableCell>
                    <StatusChip status={e.status} />
                  </TableCell>
                  <TableCell>
                    <StatusChip status={e.pensionStatus} label={PENSION_LABELS[e.pensionStatus] || e.pensionStatus} />
                  </TableCell>
                </TableRow>
              ))}
            </DataTable>
          )}

          {/* Footer summary */}
          {!loading && filtered.length > 0 && (
            <div className="bg-surface border border-subtle p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-6">
                <div>
                  <div className="label-caps text-ttertiary">Total Annual Salary</div>
                  <div className="data-sm text-tprimary mt-1">
                    {gbp(filtered.reduce((s, e) => s + (e.salaryAnnual || 0), 0))}
                  </div>
                </div>
                <div>
                  <div className="label-caps text-ttertiary">Avg Salary</div>
                  <div className="data-sm text-tprimary mt-1">
                    {gbp(filtered.reduce((s, e) => s + (e.salaryAnnual || 0), 0) / filtered.length)}
                  </div>
                </div>
                <div>
                  <div className="label-caps text-ttertiary">Pension Enrolled</div>
                  <div className="data-sm text-tprimary mt-1">
                    {filtered.filter((e) => e.pensionStatus === "enrolled").length}/{filtered.length}
                  </div>
                </div>
              </div>
              <GhostButton onClick={() => setBureauView("employee_new")}>
                <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">person_add</span>
                Add Another
              </GhostButton>
            </div>
          )}
        </>
      )}

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} companyId={selectedCompany} onDone={() => { setImportOpen(false); loadEmployees(); }} />
    </div>
  );
}

// ============ IMPORT MODAL (I1 — Bulk CSV import) ============
function ImportModal({ open, onClose, companyId, onDone }: { open: boolean; onClose: () => void; companyId: string; onDone: () => void }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);

  const upload = async () => {
    if (!file) { toast("Select a CSV file first", "error"); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("companyId", companyId);
    try {
      const res = await fetch("/api/employees/import", { method: "POST", body: fd });
      const d = await res.json();
      setResult(d);
      if (d.inserted > 0) toast(`${d.inserted} employees imported`, "success");
      if (d.failed > 0) toast(`${d.failed} rows failed — download error report`, "error");
    } catch (e: any) {
      toast(e.message || "Import failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const downloadErrors = () => {
    if (result?.errorFileId) {
      window.open(`/api/exports/${result.errorFileId}/download`, "_blank");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Bulk Import Employees" wide>
      <div className="flex flex-col gap-4">
        <div className="border border-subtle bg-surface-low px-4 py-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-[16px] text-warning">info</span>
          <p className="text-[12px] text-tsecondary">CSV format, max 5 MB. Headers are case/space tolerant. NINO/tax code/sort code validated per row; duplicates detected by NINO.</p>
        </div>

        {/* Template download */}
        <div className="flex items-center justify-between px-4 py-3 border border-subtle">
          <div>
            <div className="text-[13px] text-tprimary font-medium">Download template</div>
            <div className="text-[11px] text-ttertiary">22-column CSV with sample row — kills 80% of import failures</div>
          </div>
          <ExportButton href="/api/employees/import/template" label="Template" icon="description" filename="kedbyte-employee-import-template.csv" />
        </div>

        {/* File picker */}
        <Field label="CSV File">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }}
            className="text-[12px] text-tsecondary file:mr-3 file:px-3 file:py-1.5 file:border file:border-subtle file:bg-surface file:text-tprimary file:text-[12px] file:cursor-pointer hover:file:border-pearl-dim"
          />
        </Field>

        {/* Result */}
        {result && (
          <div className="border border-subtle bg-surface-low p-4">
            <div className="label-caps text-tsecondary mb-3">Import Result</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[11px] text-ttertiary">Total rows</div>
                <div className="data-sm text-tprimary">{result.total}</div>
              </div>
              <div>
                <div className="text-[11px] text-ttertiary">Inserted</div>
                <div className="data-sm text-success">{result.inserted}</div>
              </div>
              <div>
                <div className="text-[11px] text-ttertiary">Failed</div>
                <div className="data-sm text-error">{result.failed}</div>
              </div>
            </div>
            {result.failed > 0 && (
              <div className="mt-4 pt-3 border-t border-subtle">
                <div className="text-[11px] text-ttertiary mb-2">Error preview:</div>
                {result.errors?.slice(0, 5).map((e: any, i: number) => (
                  <div key={i} className="text-[11px] font-mono text-error">Row {e.row}: {e.field} — {e.message}</div>
                ))}
                <div className="mt-3">
                  <ExportButton href={`/api/exports/${result.errorFileId}/download`} label="Download full error report" icon="error" filename={`employee-import-errors-${result.jobId}.csv`} />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-subtle">
          <GhostButton onClick={result ? onDone : onClose}>{result ? "Done" : "Cancel"}</GhostButton>
          {!result && <PearlButton onClick={upload} disabled={uploading || !file}>{uploading ? "Uploading…" : "Upload & Import"}</PearlButton>}
        </div>
      </div>
    </Modal>
  );
}
