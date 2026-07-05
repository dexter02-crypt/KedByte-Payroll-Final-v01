"use client";

import * as React from "react";
import { useApp, fmtDate } from "@/store/app";
import {
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
import { validatePAYERef, validateAORef } from "@/engine/payroll";

interface CompanyRow {
  id: string;
  name: string;
  payeRef: string;
  accountsOfficeRef: string;
  region: string;
  paySchedule: string;
  status: string;
  employeeCount: number;
  nextPayDate: string | null;
}

const PAY_SCHEDULE_OPTIONS = [
  { value: "monthly_last_working_day", label: "Monthly — Last working day" },
  { value: "fixed_date", label: "Monthly — Fixed date" },
  { value: "weekly_friday", label: "Weekly — Friday" },
  { value: "fortnightly_friday", label: "Fortnightly — Friday" },
];

const PENSION_PROVIDER_OPTIONS = [
  { value: "NEST", label: "NEST" },
  { value: "Peoples", label: "People's Pension" },
  { value: "Smart", label: "Smart Pension" },
  { value: "Aviva", label: "Aviva" },
  { value: "Other", label: "Other" },
];

const REGION_OPTIONS = [
  { value: "england_wales", label: "England & Wales" },
  { value: "scotland", label: "Scotland" },
  { value: "northern_ireland", label: "Northern Ireland" },
];

const SCHEDULE_LABELS: Record<string, string> = {
  monthly_last_working_day: "Monthly · LWD",
  fixed_date: "Monthly · Fixed",
  weekly_friday: "Weekly · Fri",
  fortnightly_friday: "Fortnightly · Fri",
};

function EmptyFormState() {
  return {
    name: "",
    payeRef: "",
    accountsOfficeRef: "",
    addressLine1: "",
    addressCity: "",
    addressPostcode: "",
    bankSortCode: "",
    bankAccount: "",
    bankAccountName: "",
    region: "england_wales",
    paySchedule: "monthly_last_working_day",
    payDateDay: "",
    earlyPay: true,
    pensionProvider: "NEST",
    pensionEeRate: "5",
    pensionErRate: "3",
  };
}

export function CompaniesView() {
  const { setActiveCompany, setBureauView } = useApp();
  const [companies, setCompanies] = React.useState<CompanyRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [addOpen, setAddOpen] = React.useState(false);
  const [form, setForm] = React.useState(EmptyFormState());
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch("/api/companies")
      .then((r) => r.json())
      .then((d) => setCompanies(d.companies || []))
      .catch(() => toast("Failed to load companies", "error"))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const filtered = companies.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.payeRef.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const validPaye = !form.payeRef || validatePAYERef(form.payeRef);
  const validAo = !form.accountsOfficeRef || validateAORef(form.accountsOfficeRef);
  const canSubmit =
    form.name.trim() &&
    form.payeRef.trim() &&
    form.accountsOfficeRef.trim() &&
    validPaye &&
    validAo &&
    !submitting;

  const submit = async () => {
    if (!canSubmit) {
      toast("Please complete required fields", "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        payeRef: form.payeRef.toUpperCase().trim(),
        accountsOfficeRef: form.accountsOfficeRef.toUpperCase().trim(),
        address: {
          line1: form.addressLine1,
          city: form.addressCity,
          postcode: form.addressPostcode,
        },
        bank: {
          sortCode: form.bankSortCode,
          account: form.bankAccount,
          name: form.bankAccountName || form.name.trim(),
        },
        region: form.region,
        paySchedule: {
          rule: form.paySchedule,
          day: form.payDateDay ? parseInt(form.payDateDay) : undefined,
          earlyPay: form.earlyPay,
        },
        pension: {
          provider: form.pensionProvider,
          eeRate: parseFloat(form.pensionEeRate) / 100,
          erRate: parseFloat(form.pensionErRate) / 100,
        },
      };
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create company");
      const d = await res.json();
      toast(`Company "${form.name.trim()}" created`, "success");
      setAddOpen(false);
      setForm(EmptyFormState());
      load();
      // Navigate to detail
      setActiveCompany(d.id);
      setBureauView("company_detail");
    } catch (e) {
      toast("Failed to create company", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openRow = (c: CompanyRow) => {
    setActiveCompany(c.id);
    setBureauView("company_detail");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-tprimary">Companies</h1>
          <p className="text-[13px] text-tsecondary mt-1">
            Manage client payrolls —{" "}
            <span className="font-mono text-tprimary">{companies.length}</span> active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PearlButton onClick={() => setAddOpen(true)}>
            <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">add</span>
            Add Company
          </PearlButton>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex items-center bg-surface-low border border-subtle px-3 py-2 flex-1 max-w-md">
          <span className="material-symbols-outlined text-[16px] text-ttertiary mr-2">search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or PAYE ref…"
            className="bg-transparent border-none outline-none text-[13px] text-tprimary placeholder:text-ttertiary w-full font-mono"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "All statuses" },
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
            { value: "draft", label: "Draft" },
          ]}
          className="min-w-[160px]"
        />
      </div>

      {/* Table or empty */}
      {loading ? (
        <div className="border border-subtle">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 border-b border-subtle last:border-b-0 bg-surface animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-subtle">
          {companies.length === 0 ? (
            <EmptyState
              icon="business"
              title="No companies yet. Add your first client to begin running payroll."
              action={() => setAddOpen(true)}
              actionLabel="Add Company"
            />
          ) : (
            <EmptyState icon="search_off" title="No companies match your filters." />
          )}
        </div>
      ) : (
        <DataTable
          columns={[
            { label: "Company" },
            { label: "Employees", className: "text-right" },
            { label: "Pay Schedule" },
            { label: "Next Pay Date" },
            { label: "Status" },
          ]}
        >
          {filtered.map((c) => (
            <TableRow key={c.id} onClick={() => openRow(c)}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-surface-high border border-subtle flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-mono font-bold text-pearl">
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] text-tprimary font-medium truncate">{c.name}</div>
                    <div className="text-[11px] text-ttertiary font-mono mt-0.5">{c.payeRef}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell mono className="text-right">
                {c.employeeCount}
              </TableCell>
              <TableCell>
                <span className="text-[12px] text-tsecondary font-mono">
                  {SCHEDULE_LABELS[c.paySchedule] || c.paySchedule}
                </span>
              </TableCell>
              <TableCell mono className="text-tsecondary">
                {c.nextPayDate ? fmtDate(c.nextPayDate) : "—"}
              </TableCell>
              <TableCell>
                <StatusChip status={c.status} />
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      )}

      {/* Add Company Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Company" wide>
        <div className="flex flex-col gap-6">
          {/* Company Details */}
          <section>
            <h3 className="section-title text-tprimary mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-pearl">business</span>
              Company Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Company Name" error={!form.name.trim() && submitting ? "Required" : undefined}>
                <TextInput value={form.name} onChange={(v) => setField("name", v)} placeholder="Smith & Co Ltd" />
              </Field>
              <Field label="PAYE Reference" hint="Format: 123/AB456" error={!validPaye ? "Invalid PAYE ref" : undefined}>
                <TextInput
                  value={form.payeRef}
                  onChange={(v) => setField("payeRef", v)}
                  placeholder="123/AB456"
                  mono
                />
              </Field>
              <Field
                label="Accounts Office Ref"
                hint="Format: 123PA0001234X"
                error={!validAo ? "Invalid AO ref" : undefined}
              >
                <TextInput
                  value={form.accountsOfficeRef}
                  onChange={(v) => setField("accountsOfficeRef", v)}
                  placeholder="123PA0001234X"
                  mono
                />
              </Field>
              <Field label="Region">
                <Select value={form.region} onChange={(v) => setField("region", v)} options={REGION_OPTIONS} className="w-full" />
              </Field>
              <Field label="Address Line 1">
                <TextInput value={form.addressLine1} onChange={(v) => setField("addressLine1", v)} placeholder="14 Cannon Street" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <TextInput value={form.addressCity} onChange={(v) => setField("addressCity", v)} placeholder="London" />
                </Field>
                <Field label="Postcode">
                  <TextInput value={form.addressPostcode} onChange={(v) => setField("addressPostcode", v)} placeholder="EC4M 6XH" mono />
                </Field>
              </div>
            </div>
          </section>

          {/* Bank Details */}
          <section>
            <h3 className="section-title text-tprimary mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-pearl">account_balance</span>
              Bank Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Sort Code" hint="6 digits">
                <TextInput
                  value={form.bankSortCode}
                  onChange={(v) => setField("bankSortCode", v.replace(/[^\d-]/g, ""))}
                  placeholder="20-00-00"
                  mono
                />
              </Field>
              <Field label="Account Number" hint="6–8 digits">
                <TextInput
                  value={form.bankAccount}
                  onChange={(v) => setField("bankAccount", v.replace(/[^\d]/g, ""))}
                  placeholder="12345678"
                  mono
                />
              </Field>
              <Field label="Account Name">
                <TextInput
                  value={form.bankAccountName}
                  onChange={(v) => setField("bankAccountName", v)}
                  placeholder="Smith & Co Ltd"
                />
              </Field>
            </div>
          </section>

          {/* Payroll Config */}
          <section>
            <h3 className="section-title text-tprimary mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-pearl">settings</span>
              Payroll Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Pay Schedule">
                <Select
                  value={form.paySchedule}
                  onChange={(v) => setField("paySchedule", v)}
                  options={PAY_SCHEDULE_OPTIONS}
                  className="w-full"
                />
              </Field>
              {form.paySchedule === "fixed_date" && (
                <Field label="Pay Day (1–28)" hint="Day of month">
                  <TextInput
                    type="number"
                    value={form.payDateDay}
                    onChange={(v) => setField("payDateDay", v.replace(/[^\d]/g, "").slice(0, 2))}
                    placeholder="28"
                    mono
                  />
                </Field>
              )}
              <Field label="Pension Provider">
                <Select
                  value={form.pensionProvider}
                  onChange={(v) => setField("pensionProvider", v)}
                  options={PENSION_PROVIDER_OPTIONS}
                  className="w-full"
                />
              </Field>
              <Field label="Employee Rate %" hint="5 = 5%">
                <TextInput
                  type="number"
                  value={form.pensionEeRate}
                  onChange={(v) => setField("pensionEeRate", v)}
                  placeholder="5"
                  mono
                />
              </Field>
              <Field label="Employer Rate %" hint="3 = 3%">
                <TextInput
                  type="number"
                  value={form.pensionErRate}
                  onChange={(v) => setField("pensionErRate", v)}
                  placeholder="3"
                  mono
                />
              </Field>
              <Field label="Early Pay" hint="Pay on previous working day if BACS lands on weekend">
                <button
                  type="button"
                  onClick={() => setField("earlyPay", !form.earlyPay)}
                  className={`px-3 py-2 border text-[13px] flex items-center gap-2 ${
                    form.earlyPay
                      ? "border-pearl-dim text-pearl bg-surface-high"
                      : "border-subtle text-tsecondary"
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {form.earlyPay ? "check_box" : "check_box_outline_blank"}
                  </span>
                  {form.earlyPay ? "Enabled" : "Disabled"}
                </button>
              </Field>
            </div>
          </section>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-subtle">
            <GhostButton onClick={() => setAddOpen(false)} disabled={submitting}>
              Cancel
            </GhostButton>
            <PearlButton onClick={submit} disabled={!canSubmit}>
              {submitting ? (
                <>
                  <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle animate-spin">progress_activity</span>
                  Creating…
                </>
              ) : (
                "Create Company"
              )}
            </PearlButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
