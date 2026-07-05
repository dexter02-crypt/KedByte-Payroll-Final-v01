"use client";

import * as React from "react";
import { useApp, gbp } from "@/store/app";
import {
  Field,
  TextInput,
  Select,
  PearlButton,
  GhostButton,
  StatusChip,
  EmptyState,
  toast,
} from "@/components/kedbyte/primitives";
import {
  validateNINO,
  validateSortCode,
  validateAccount,
  assessAutoEnrolment,
} from "@/engine/payroll";
import { cn } from "@/lib/utils";

interface CompanyLite {
  id: string;
  name: string;
}

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
];

const NI_CATEGORY_OPTIONS = [
  { value: "A", label: "A · Standard (not in pension scheme)" },
  { value: "B", label: "B · Married women/widows entitled to reduced rate" },
  { value: "C", label: "C · Over State Pension age" },
  { value: "H", label: "H · Apprentice under 25" },
  { value: "J", label: "J · Deferred pensioner" },
  { value: "M", label: "M · Employees under 21" },
  { value: "V", label: "V · In pension scheme (4.85% main)" },
  { value: "X", label: "X · No NI liability" },
  { value: "Z", label: "Z · Deferred pensioner in pension scheme" },
];

const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const STUDENT_LOAN_OPTIONS = [
  { value: "", label: "No student loan" },
  { value: "plan_1", label: "Plan 1 · Pre-2012 (England/Wales)" },
  { value: "plan_2", label: "Plan 2 · Post-2012 (England/Wales)" },
  { value: "plan_4", label: "Plan 4 · Scotland" },
  { value: "plan_5", label: "Plan 5 · Post-2023 (England)" },
];

const STARTER_DECLARATIONS = [
  {
    value: "A",
    title: "A · First job since 6 April",
    body: "No P45. Has not received any taxable pay or benefits since 6 April. Use cumulative 1257L.",
  },
  {
    value: "B",
    title: "B · Had another job since 6 April",
    body: "No P45. Had another job (or received taxable benefits) since 6 April. Use 1257L on W1/M1 basis.",
  },
  {
    value: "C",
    title: "C · Other income this year",
    body: "No P45. Has another job or receives a pension. Use BR (basic rate) on W1/M1 basis.",
  },
];

function calcAge(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function EmptyFormState() {
  return {
    firstName: "",
    lastName: "",
    email: "",
    dob: "",
    nino: "",
    gender: "",
    startDate: new Date().toISOString().slice(0, 10),
    department: "",
    jobTitle: "",
    employmentType: "full_time",
    salaryAnnual: "30000",
    contractedWeeklyHours: "37.5",
    taxCode: "1257L",
    niCategory: "A",
    starterDeclaration: "A",
    bankSortCode: "",
    bankAccount: "",
    bankAccountName: "",
    studentLoanPlan: "",
    postgradLoan: false,
    addressLine1: "",
    addressCity: "",
    addressPostcode: "",
  };
}

export function EmployeeNewView() {
  const { activeCompanyId, setActiveCompany, setBureauView } = useApp();
  const [companies, setCompanies] = React.useState<CompanyLite[]>([]);
  const [loadingCompanies, setLoadingCompanies] = React.useState(true);
  const [selectedCompany, setSelectedCompany] = React.useState<string>("");
  const [form, setForm] = React.useState(EmptyFormState());
  const [submitting, setSubmitting] = React.useState<null | "draft" | "active">(null);

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

  React.useEffect(() => {
    if (selectedCompany && selectedCompany !== activeCompanyId) {
      setActiveCompany(selectedCompany);
    }
  }, [selectedCompany, activeCompanyId, setActiveCompany]);

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Live NINO validation
  const ninoValid = form.nino ? validateNINO(form.nino) : null;

  // Live AE assessment
  const age = calcAge(form.dob);
  const monthlyEarnings = form.salaryAnnual ? parseFloat(form.salaryAnnual) / 12 : 0;
  const aeAssessment = React.useMemo(() => {
    if (age === null || !monthlyEarnings) return null;
    return assessAutoEnrolment(age, monthlyEarnings);
  }, [age, monthlyEarnings]);

  const bankSortValid = !form.bankSortCode || validateSortCode(form.bankSortCode);
  const bankAccValid = !form.bankAccount || validateAccount(form.bankAccount);

  const canSubmit =
    selectedCompany &&
    form.firstName.trim() &&
    form.lastName.trim() &&
    form.email.trim() &&
    form.dob &&
    form.nino.trim() &&
    ninoValid &&
    form.startDate &&
    form.salaryAnnual &&
    parseFloat(form.salaryAnnual) > 0 &&
    bankSortValid &&
    bankAccValid;

  const submit = async (status: "draft" | "active") => {
    if (!canSubmit) {
      toast("Please complete required fields", "error");
      return;
    }
    setSubmitting(status);
    try {
      const payload = {
        companyId: selectedCompany,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        dob: form.dob,
        nino: form.nino.replace(/\s+/g, "").toUpperCase(),
        gender: form.gender || undefined,
        address: {
          line1: form.addressLine1,
          city: form.addressCity,
          postcode: form.addressPostcode,
        },
        startDate: form.startDate,
        starterDeclaration: form.starterDeclaration,
        salaryAnnual: parseFloat(form.salaryAnnual),
        contractedWeeklyHours: parseFloat(form.contractedWeeklyHours) || 37.5,
        department: form.department || undefined,
        jobTitle: form.jobTitle || undefined,
        employmentType: form.employmentType,
        niCategory: form.niCategory,
        taxCode: form.taxCode,
        studentLoanPlan: form.studentLoanPlan || undefined,
        postgradLoan: form.postgradLoan,
        bank: {
          sortCode: form.bankSortCode.replace(/[-\s]/g, ""),
          account: form.bankAccount,
          name: form.bankAccountName || `${form.firstName} ${form.lastName}`.trim(),
        },
        status,
      };
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create employee");
      }
      const d = await res.json();
      const verb = status === "draft" ? "drafted" : "created";
      toast(`Employee ${verb} · ${d.payrollId}`, "success");
      setBureauView("employees");
    } catch (e: any) {
      toast(e.message || "Failed to create employee", "error");
    } finally {
      setSubmitting(null);
    }
  };

  // Empty state: no companies
  if (!loadingCompanies && companies.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <div className="bg-surface border border-subtle">
          <EmptyState
            icon="business"
            title="No companies available. Add a company before creating employees."
            action={() => setBureauView("companies")}
            actionLabel="Add Company"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Header />

      {/* Company selector */}
      <div className="bg-surface border border-subtle p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[18px] text-pearl">business</span>
          <div>
            <div className="label-caps text-tsecondary">Add to Company</div>
            {loadingCompanies ? (
              <div className="h-7 w-48 bg-surface-high animate-pulse mt-1" />
            ) : (
              <Select
                value={selectedCompany}
                onChange={setSelectedCompany}
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
                className="mt-1 min-w-[240px]"
              />
            )}
          </div>
        </div>
        <div className="text-[11px] text-ttertiary font-mono">
          Fields marked <span className="text-error">*</span> are required
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form — 2/3 */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Personal Details */}
          <section className="bg-surface border border-subtle p-6">
            <SectionHeader icon="badge" title="Personal Details" subtitle="Identity and contact information" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <Field label="First Name" error={!form.firstName.trim() && submitting ? "Required" : undefined}>
                <TextInput value={form.firstName} onChange={(v) => setField("firstName", v)} placeholder="Eleanor" />
              </Field>
              <Field label="Last Name" error={!form.lastName.trim() && submitting ? "Required" : undefined}>
                <TextInput value={form.lastName} onChange={(v) => setField("lastName", v)} placeholder="Pemberton" />
              </Field>
              <Field label="Email" error={!form.email.trim() && submitting ? "Required" : undefined}>
                <TextInput
                  type="email"
                  value={form.email}
                  onChange={(v) => setField("email", v)}
                  placeholder="eleanor@smithco.co.uk"
                  mono
                />
              </Field>
              <Field label="Date of Birth" error={!form.dob && submitting ? "Required" : undefined}>
                <TextInput type="date" value={form.dob} onChange={(v) => setField("dob", v)} mono />
              </Field>
              <Field
                label="National Insurance Number"
                hint="AB 12 34 56 C"
                error={
                  form.nino && !ninoValid ? "Invalid NINO format" : !form.nino.trim() && submitting ? "Required" : undefined
                }
              >
                <div className="relative">
                  <TextInput
                    value={form.nino}
                    onChange={(v) => setField("nino", v.toUpperCase())}
                    placeholder="AB 12 34 56 C"
                    mono
                    className="pr-10"
                  />
                  {form.nino && (
                    <span
                      className={cn(
                        "material-symbols-outlined text-[18px] absolute right-3 top-1/2 -translate-y-1/2",
                        ninoValid ? "text-success" : "text-error"
                      )}
                    >
                      {ninoValid ? "check_circle" : "cancel"}
                    </span>
                  )}
                </div>
              </Field>
              <Field label="Gender">
                <Select value={form.gender} onChange={(v) => setField("gender", v)} options={GENDER_OPTIONS} className="w-full" />
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
              <Field label="Start Date" error={!form.startDate && submitting ? "Required" : undefined}>
                <TextInput type="date" value={form.startDate} onChange={(v) => setField("startDate", v)} mono />
              </Field>
            </div>
          </section>

          {/* Employment */}
          <section className="bg-surface border border-subtle p-6">
            <SectionHeader icon="work" title="Employment" subtitle="Role, pay, and statutory classification" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <Field label="Department">
                <TextInput value={form.department} onChange={(v) => setField("department", v)} placeholder="Finance" />
              </Field>
              <Field label="Job Title">
                <TextInput value={form.jobTitle} onChange={(v) => setField("jobTitle", v)} placeholder="Accountant" />
              </Field>
              <Field label="Employment Type">
                <Select value={form.employmentType} onChange={(v) => setField("employmentType", v)} options={EMPLOYMENT_TYPE_OPTIONS} className="w-full" />
              </Field>
              <Field label="Annual Salary (Gross)" hint="Gross per annum before deductions">
                <TextInput
                  type="number"
                  value={form.salaryAnnual}
                  onChange={(v) => setField("salaryAnnual", v)}
                  placeholder="36000"
                  mono
                />
              </Field>
              <Field label="Contracted Weekly Hours">
                <TextInput
                  type="number"
                  value={form.contractedWeeklyHours}
                  onChange={(v) => setField("contractedWeeklyHours", v)}
                  placeholder="37.5"
                  mono
                />
              </Field>
              <Field label="NI Category" hint="Determines NI letter used for calculations">
                <Select value={form.niCategory} onChange={(v) => setField("niCategory", v)} options={NI_CATEGORY_OPTIONS} className="w-full" />
              </Field>
              <Field label="Tax Code" hint="Override from starter declaration default">
                <TextInput value={form.taxCode} onChange={(v) => setField("taxCode", v.toUpperCase())} placeholder="1257L" mono />
              </Field>
            </div>
          </section>

          {/* Starter Declaration */}
          <section className="bg-surface border border-subtle p-6">
            <SectionHeader icon="assignment" title="Starter Declaration" subtitle="Required when no P45 is provided" />
            <div className="flex flex-col gap-2 mt-4">
              {STARTER_DECLARATIONS.map((d) => {
                const active = form.starterDeclaration === d.value;
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setField("starterDeclaration", d.value)}
                    className={cn(
                      "text-left px-4 py-3 border flex items-start gap-3 transition-colors",
                      active
                        ? "border-pearl-dim bg-surface-high"
                        : "border-subtle hover:bg-surface-high"
                    )}
                  >
                    <span
                      className={cn(
                        "material-symbols-outlined text-[18px] mt-0.5",
                        active ? "text-pearl" : "text-ttertiary"
                      )}
                      style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      {active ? "radio_button_checked" : "radio_button_unchecked"}
                    </span>
                    <div className="flex-1">
                      <div className="text-[13px] text-tprimary font-medium">{d.title}</div>
                      <div className="text-[12px] text-tsecondary mt-1 leading-relaxed">{d.body}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 px-3 py-2 bg-surface-low border border-subtle flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px] text-pearl">info</span>
              <span className="text-[11px] text-tsecondary">
                Tax code will be set automatically based on declaration:{" "}
                <span className="font-mono text-tprimary">
                  {form.starterDeclaration === "A" ? "1257L cumulative"
                    : form.starterDeclaration === "B" ? "1257L W1/M1"
                    : "BR W1/M1"}
                </span>
              </span>
            </div>
          </section>

          {/* Bank Details */}
          <section className="bg-surface border border-subtle p-6">
            <SectionHeader icon="account_balance" title="Bank Details" subtitle="For BACS salary payment" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <Field label="Sort Code" hint="6 digits" error={!bankSortValid ? "Invalid sort code" : undefined}>
                <TextInput
                  value={form.bankSortCode}
                  onChange={(v) => setField("bankSortCode", v.replace(/[^\d-]/g, ""))}
                  placeholder="20-00-00"
                  mono
                />
              </Field>
              <Field label="Account Number" hint="6–8 digits" error={!bankAccValid ? "Invalid account" : undefined}>
                <TextInput
                  value={form.bankAccount}
                  onChange={(v) => setField("bankAccount", v.replace(/[^\d]/g, ""))}
                  placeholder="12345678"
                  mono
                />
              </Field>
              <Field label="Account Name" hint="Defaults to employee name if blank">
                <TextInput
                  value={form.bankAccountName}
                  onChange={(v) => setField("bankAccountName", v)}
                  placeholder="Eleanor Pemberton"
                />
              </Field>
            </div>
          </section>

          {/* Student Loans */}
          <section className="bg-surface border border-subtle p-6">
            <SectionHeader icon="school" title="Student &amp; Postgrad Loans" subtitle="Deduction plan configuration" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 items-start">
              <Field label="Student Loan Plan" hint="Determines annual threshold for deduction">
                <Select value={form.studentLoanPlan} onChange={(v) => setField("studentLoanPlan", v)} options={STUDENT_LOAN_OPTIONS} className="w-full" />
              </Field>
              <Field label="Postgraduate Loan">
                <button
                  type="button"
                  onClick={() => setField("postgradLoan", !form.postgradLoan)}
                  className={cn(
                    "px-3 py-2 border text-[13px] flex items-center gap-2 transition-colors w-full",
                    form.postgradLoan
                      ? "border-pearl-dim text-pearl bg-surface-high"
                      : "border-subtle text-tsecondary"
                  )}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {form.postgradLoan ? "check_box" : "check_box_outline_blank"}
                  </span>
                  {form.postgradLoan ? "Postgraduate loan deduction active" : "No postgraduate loan"}
                </button>
              </Field>
            </div>
          </section>
        </div>

        {/* Right rail — Pension + Summary — 1/3 */}
        <div className="flex flex-col gap-6">
          {/* Live AE panel */}
          <section className="bg-surface border border-subtle p-6 sticky top-4">
            <SectionHeader icon="account_balance" title="Auto-Enrolment" subtitle="Live assessment" />
            <div className="mt-4 flex flex-col gap-3">
              {/* Inputs echo */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface-low border border-subtle p-3">
                  <div className="label-caps text-ttertiary">Age</div>
                  <div className="data-sm text-tprimary mt-1">
                    {age !== null ? `${age} yrs` : "—"}
                  </div>
                </div>
                <div className="bg-surface-low border border-subtle p-3">
                  <div className="label-caps text-ttertiary">Monthly Earnings</div>
                  <div className="data-sm text-tprimary mt-1">
                    {monthlyEarnings ? gbp(monthlyEarnings) : "—"}
                  </div>
                </div>
              </div>

              {/* Result */}
              {aeAssessment ? (
                <div
                  className={cn(
                    "p-4 border",
                    aeAssessment.result === "eligible"
                      ? "border-success/30 bg-surface-low"
                      : "border-subtle bg-surface-low"
                  )}
                  style={{
                    borderColor:
                      aeAssessment.result === "eligible"
                        ? "rgba(74,222,128,0.3)"
                        : aeAssessment.result === "non_eligible"
                        ? "rgba(251,191,36,0.3)"
                        : "rgba(82,82,91,0.3)",
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="label-caps text-tsecondary">Assessment Result</span>
                    <StatusChip
                      status={
                        aeAssessment.result === "eligible"
                          ? "eligible"
                          : aeAssessment.result === "non_eligible"
                          ? "review"
                          : "entitled"
                      }
                      label={
                        aeAssessment.result === "eligible"
                          ? "Eligible Jobholder"
                          : aeAssessment.result === "non_eligible"
                          ? "Non-eligible"
                          : "Entitled Worker"
                      }
                    />
                  </div>
                  <p className="text-[12px] text-tsecondary leading-relaxed">
                    {aeAssessment.result === "eligible" &&
                      "Aged 22–SPa, earnings above £10,000/yr. Must be auto-enrolled into a qualifying pension scheme on day one."}
                    {aeAssessment.result === "non_eligible" &&
                      "Aged 16–74, earnings above £10,000/yr but outside 22–SPa. May opt in voluntarily — employer must contribute."}
                    {aeAssessment.result === "entitled" &&
                      "Earnings below the qualifying threshold. May join the scheme but employer contributions are not mandatory."}
                  </p>
                  {aeAssessment.action === "enrolled" && (
                    <div className="mt-3 flex items-center gap-2 text-[11px] font-mono text-success">
                      <span className="material-symbols-outlined text-[14px]">task_alt</span>
                      Auto-enrolment will trigger on activation
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 border border-dashed border-subtle text-center">
                  <span className="material-symbols-outlined text-[24px] text-ttertiary">hourglass_empty</span>
                  <p className="text-[12px] text-ttertiary mt-2">
                    Enter DOB and salary to assess auto-enrolment status
                  </p>
                </div>
              )}

              {/* Statutory thresholds reference */}
              <div className="text-[11px] text-ttertiary font-mono leading-relaxed pt-2 border-t border-subtle">
                <div className="flex justify-between py-0.5">
                  <span>AE Trigger (annual)</span>
                  <span className="text-tsecondary">£10,000.00</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span>Qualifying Earnings Band</span>
                  <span className="text-tsecondary">£6,240 — £50,270</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span>Min Total Contribution</span>
                  <span className="text-tsecondary">8%</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span>Min Employer Contribution</span>
                  <span className="text-tsecondary">3%</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Footer actions */}
      <div className="sticky bottom-0 bg-void border-t border-subtle -mx-8 px-8 py-4 flex items-center justify-between gap-2 z-20">
        <GhostButton onClick={() => setBureauView("employees")}>
          <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">arrow_back</span>
          Cancel
        </GhostButton>
        <div className="flex items-center gap-2">
          <GhostButton onClick={() => submit("draft")} disabled={!canSubmit || submitting !== null}>
            {submitting === "draft" ? (
              <>
                <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle animate-spin">progress_activity</span>
                Saving…
              </>
            ) : (
              "Save as Draft"
            )}
          </GhostButton>
          <PearlButton onClick={() => submit("active")} disabled={!canSubmit || submitting !== null}>
            {submitting === "active" ? (
              <>
                <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle animate-spin">progress_activity</span>
                Activating…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">check</span>
                Activate
              </>
            )}
          </PearlButton>
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <h1 className="page-title text-tprimary">Add Employee</h1>
        <p className="text-[13px] text-tsecondary mt-1">
          Create a new employee record and run live auto-enrolment assessment
        </p>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="material-symbols-outlined text-[18px] text-pearl">{icon}</span>
      <div>
        <h2 className="section-title text-tprimary">{title}</h2>
        {subtitle && <p className="text-[11px] text-ttertiary mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
