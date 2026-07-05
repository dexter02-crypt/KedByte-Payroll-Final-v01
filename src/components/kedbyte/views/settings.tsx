"use client";

import * as React from "react";
import { fmtDate } from "@/store/app";
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

// ============ TYPES ============
interface ConfigRow {
  key: string;
  value: string;
  variance: string;
  authority: string;
}

interface BankHoliday {
  date: string;
  region: string;
  name: string;
  bacsImpact: boolean;
}

interface SeededUser {
  id: string;
  email: string;
  role: string;
  status: string;
  company?: string;
}

// ============ TABS ============
const TABS = [
  { id: "company", label: "Company", icon: "business" },
  { id: "tax", label: "Tax", icon: "percent" },
  { id: "pension", label: "Pension", icon: "retirement" },
  { id: "bank", label: "Bank", icon: "account_balance" },
  { id: "users", label: "Users", icon: "group" },
  { id: "security", label: "Security", icon: "lock" },
  { id: "compliance", label: "Compliance", icon: "verified" },
  { id: "notifications", label: "Notifications", icon: "notifications" },
  { id: "system", label: "System", icon: "settings" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ============ SEEDED USERS (static) ============
const SEEDED_USERS: SeededUser[] = [
  { id: "user_admin", email: "admin@kedbyte.co.uk", role: "bureau_admin", status: "active" },
  { id: "user_smith_admin", email: "admin@smithco.co.uk", role: "company_admin", status: "active", company: "Smith & Co Ltd" },
  { id: "user_eleanor", email: "eleanor@smithco.co.uk", role: "employee", status: "active", company: "Smith & Co Ltd" },
  { id: "user_james", email: "james@smithco.co.uk", role: "employee", status: "active", company: "Smith & Co Ltd" },
  { id: "user_priya", email: "priya@acme.io", role: "employee", status: "active", company: "Acme Holdings Ltd" },
];

const ROLE_LABELS: Record<string, string> = {
  bureau_admin: "Bureau Admin",
  company_admin: "Company Admin",
  employee: "Employee",
};

function roleChip(role: string): { status: string; label: string } {
  if (role === "bureau_admin") return { status: "active", label: "Bureau Admin" };
  if (role === "company_admin") return { status: "active", label: "Company Admin" };
  if (role === "employee") return { status: "not_assessed", label: "Employee" };
  return { status: "not_assessed", label: role };
}

// ============ COMPLIANCE STATUS CARDS ============
function ComplianceCard({
  title,
  description,
  status,
  statusLabel,
  icon,
  due,
}: {
  title: string;
  description: string;
  status: string;
  statusLabel: string;
  icon: string;
  due: string;
}) {
  return (
    <div className="bg-surface border border-subtle p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <span
          className="material-symbols-outlined text-[22px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
        <StatusChip status={status} label={statusLabel} />
      </div>
      <div>
        <h4 className="text-[14px] text-tprimary font-semibold">{title}</h4>
        <p className="text-[12px] text-tsecondary mt-1">{description}</p>
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-subtle">
        <span className="label-caps text-ttertiary">Due</span>
        <span className="text-[12px] font-mono text-pearl">{due}</span>
      </div>
    </div>
  );
}

// ============ COMING SOON ============
function ComingSoon({ label }: { label: string }) {
  return (
    <div className="bg-surface border border-subtle">
      <EmptyState
        icon="construction"
        title={`${label} settings are coming soon. This module is on the product roadmap.`}
      />
    </div>
  );
}

// ============ MAIN ============
export function SettingsView() {
  const [activeTab, setActiveTab] = React.useState<TabId>("tax");
  const [taxYear, setTaxYear] = React.useState("2026-27");
  const [config, setConfig] = React.useState<ConfigRow[]>([]);
  const [bankHolidays, setBankHolidays] = React.useState<BankHoliday[]>([]);
  const [loadingConfig, setLoadingConfig] = React.useState(true);
  const [loadingBank, setLoadingBank] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);

  // Override modal
  const [overrideOpen, setOverrideOpen] = React.useState(false);
  const [overrideKey, setOverrideKey] = React.useState("");
  const [overrideValue, setOverrideValue] = React.useState("");
  const [overrideReason, setOverrideReason] = React.useState("");

  // Load settings
  React.useEffect(() => {
    setLoadingConfig(true);
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setConfig(d.config || []);
        if (d.taxYear) setTaxYear(d.taxYear);
      })
      .catch(() => toast("Failed to load settings", "error"))
      .finally(() => setLoadingConfig(false));
  }, []);

  // Load bank holidays
  React.useEffect(() => {
    setLoadingBank(true);
    fetch("/api/bank-holidays")
      .then((r) => r.json())
      .then((d) => setBankHolidays(d.bankHolidays || []))
      .catch(() => toast("Failed to load bank holidays", "error"))
      .finally(() => setLoadingBank(false));
  }, []);

  const saveOverride = () => {
    if (!overrideKey.trim() || !overrideValue.trim() || !overrideReason.trim()) {
      toast("All override fields required", "error");
      return;
    }
    toast(`Override saved · new effective-dated row for ${overrideKey}`, "success");
    setOverrideOpen(false);
    setOverrideKey("");
    setOverrideValue("");
    setOverrideReason("");
  };

  const syncHmrc = () => {
    toast("Sync job queued · polling HMRC thresholds endpoint", "info");
  };

  const syncBankHolidays = async () => {
    setSyncing(true);
    toast("Syncing gov.uk bank-holidays.json…", "info");
    // simulate a brief delay
    await new Promise((r) => setTimeout(r, 800));
    setSyncing(false);
    toast(`Bank holidays synced · ${bankHolidays.length} dates refreshed`, "success");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-tprimary">Settings</h1>
          <p className="text-[13px] text-tsecondary mt-1">
            Tax thresholds · HMRC sync · bank holidays · users · compliance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-ttertiary uppercase tracking-wider">
            Active Tax Year
          </span>
          <span className="font-mono text-[13px] text-pearl border border-subtle px-2 py-1">
            {taxYear}
          </span>
        </div>
      </div>

      {/* Tab rail + content */}
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
        {/* Vertical tab rail */}
        <nav className="flex lg:flex-col gap-0 overflow-x-auto lg:overflow-x-visible scroll-thin border border-subtle bg-surface h-fit">
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2.5 px-4 py-3 text-[13px] font-medium whitespace-nowrap transition-colors border-l-2 lg:border-l-2 border-b-0 lg:border-b border-subtle last:border-b-0 ${
                  active
                    ? "border-l-pearl text-pearl bg-surface-high"
                    : "border-l-transparent text-tsecondary hover:text-tprimary hover:bg-surface-high"
                }`}
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {t.icon}
                </span>
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Tab content */}
        <div className="min-w-0">
          {/* TAX TAB */}
          {activeTab === "tax" && (
            <div className="flex flex-col gap-5">
              {/* Tax year selector */}
              <div className="bg-surface border border-subtle p-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="flex items-end gap-4">
                  <div>
                    <div className="label-caps text-ttertiary mb-2">Active Tax Year</div>
                    <Select
                      value={taxYear}
                      onChange={setTaxYear}
                      options={[
                        { value: "2026-27", label: "2026/27" },
                        { value: "2025-26", label: "2025/26" },
                        { value: "2024-25", label: "2024/25" },
                      ]}
                      className="min-w-[180px]"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="label-caps text-ttertiary">Period</span>
                    <span className="text-[13px] text-tprimary font-mono mt-1.5">
                      6 Apr 2026 → 5 Apr 2027
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <GhostButton onClick={syncHmrc}>
                    <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">sync</span>
                    Update from HMRC
                  </GhostButton>
                  <PearlButton onClick={() => setOverrideOpen(true)}>
                    <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">edit</span>
                    Override Threshold
                  </PearlButton>
                </div>
              </div>

              {/* Thresholds table */}
              <div>
                <h2 className="section-title text-tprimary mb-3">Tax &amp; NI Thresholds</h2>
                {loadingConfig ? (
                  <div className="border border-subtle">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-12 border-b border-subtle last:border-b-0 bg-surface animate-pulse"
                      />
                    ))}
                  </div>
                ) : config.length === 0 ? (
                  <div className="bg-surface border border-subtle">
                    <EmptyState icon="inventory_2" title="No threshold data loaded." />
                  </div>
                ) : (
                  <DataTable
                    columns={[
                      { label: "Parameter" },
                      { label: "Value" },
                      { label: "Variance vs Prior Year" },
                      { label: "Authority" },
                    ]}
                  >
                    {config.map((c) => (
                      <TableRow key={c.key}>
                        <TableCell>
                          <span className="text-[13px] text-tprimary font-medium font-mono">
                            {c.key}
                          </span>
                        </TableCell>
                        <TableCell mono className="text-pearl">
                          {c.value}
                        </TableCell>
                        <TableCell>
                          {c.variance === "—" ? (
                            <span className="text-[12px] text-ttertiary font-mono">—</span>
                          ) : c.variance.toLowerCase().includes("frozen") ||
                            c.variance.toLowerCase().includes("new") ? (
                            <span className="text-[12px] font-mono text-warning">{c.variance}</span>
                          ) : c.variance.startsWith("+") || c.variance.startsWith("−") ? (
                            <span
                              className={`text-[12px] font-mono ${
                                c.variance.startsWith("+") ? "text-success" : "text-error"
                              }`}
                            >
                              {c.variance}
                            </span>
                          ) : (
                            <span className="text-[12px] font-mono text-tsecondary">
                              {c.variance}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-[11px] font-mono text-ttertiary uppercase tracking-wider border border-subtle px-1.5 py-0.5">
                            {c.authority}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </DataTable>
                )}
              </div>

              {/* Notes */}
              <div className="bg-surface-low border-l-2 border-l-warning border border-subtle p-4 flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-warning mt-0.5">info</span>
                <p className="text-[12px] text-tsecondary leading-relaxed">
                  Thresholds are auto-synced from HMRC at the start of each tax year. Manual
                  overrides create an effective-dated row in the audit log and do not modify the
                  canonical HMRC value. All overrides are visible to all bureau users.
                </p>
              </div>
            </div>
          )}

          {/* BANK TAB */}
          {activeTab === "bank" && (
            <div className="flex flex-col gap-5">
              <div className="bg-surface border border-subtle p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[28px] text-pearl">account_balance</span>
                  <div>
                    <h2 className="section-title text-tprimary">Bank Holidays · BACS Calendar</h2>
                    <p className="text-[12px] text-tsecondary mt-1">
                      Source: gov.uk bank-holidays.json · {bankHolidays.length} dates loaded
                    </p>
                  </div>
                </div>
                <PearlButton onClick={syncBankHolidays} disabled={syncing}>
                  {syncing ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle animate-spin">
                        progress_activity
                      </span>
                      Syncing…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">sync</span>
                      Sync Now
                    </>
                  )}
                </PearlButton>
              </div>

              {loadingBank ? (
                <div className="border border-subtle">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-12 border-b border-subtle last:border-b-0 bg-surface animate-pulse"
                    />
                  ))}
                </div>
              ) : bankHolidays.length === 0 ? (
                <div className="bg-surface border border-subtle">
                  <EmptyState icon="calendar_clear" title="No bank holidays loaded." />
                </div>
              ) : (
                <DataTable
                  columns={[
                    { label: "Date" },
                    { label: "Region" },
                    { label: "Name" },
                    { label: "BACS Impact" },
                  ]}
                >
                  {bankHolidays.map((b, i) => (
                    <TableRow key={i}>
                      <TableCell mono className="text-tprimary">
                        {fmtDate(b.date)}
                      </TableCell>
                      <TableCell>
                        <span className="text-[11px] font-mono text-ttertiary uppercase tracking-wider border border-subtle px-1.5 py-0.5">
                          {b.region}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[13px] text-tprimary">{b.name}</span>
                      </TableCell>
                      <TableCell>
                        {b.bacsImpact ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-warning" />
                            <span className="text-[12px] text-warning font-mono">Shifts BACS</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-ttertiary" />
                            <span className="text-[12px] text-ttertiary font-mono">No impact</span>
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </DataTable>
              )}
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === "users" && (
            <div className="flex flex-col gap-5">
              <div className="bg-surface border border-subtle p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="section-title text-tprimary">User Directory</h2>
                  <p className="text-[12px] text-tsecondary mt-1">
                    {SEEDED_USERS.length} users · {new Set(SEEDED_USERS.map((u) => u.email.split("@")[1])).size}{" "}
                    domains
                  </p>
                </div>
                <PearlButton onClick={() => toast("User invite flow coming soon", "info")}>
                  <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">
                    person_add
                  </span>
                  Invite User
                </PearlButton>
              </div>
              <DataTable
                columns={[
                  { label: "User ID" },
                  { label: "Email" },
                  { label: "Role" },
                  { label: "Company" },
                  { label: "Status" },
                ]}
              >
                {SEEDED_USERS.map((u) => {
                  const chip = roleChip(u.role);
                  return (
                    <TableRow key={u.id}>
                      <TableCell mono className="text-tsecondary">
                        {u.id}
                      </TableCell>
                      <TableCell>
                        <span className="text-[13px] text-tprimary font-mono">{u.email}</span>
                      </TableCell>
                      <TableCell>
                        <StatusChip status={chip.status} label={ROLE_LABELS[u.role] || u.role} />
                      </TableCell>
                      <TableCell className="text-tsecondary">
                        {u.company || <span className="text-ttertiary">—</span>}
                      </TableCell>
                      <TableCell>
                        <StatusChip status="active" label="Active" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </DataTable>
            </div>
          )}

          {/* COMPLIANCE TAB */}
          {activeTab === "compliance" && (
            <div className="flex flex-col gap-5">
              <div className="bg-surface border border-subtle p-5 flex items-center justify-between">
                <div>
                  <h2 className="section-title text-tprimary">Year-End Compliance Status</h2>
                  <p className="text-[12px] text-tsecondary mt-1">
                    Tax year {taxYear} · statutory filing obligations
                  </p>
                </div>
                <StatusChip status="active" label="On Track" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <ComplianceCard
                  title="P60 Distribution"
                  description="Issued to all employees by 31 May after tax year end."
                  status="active"
                  statusLabel="Complete"
                  icon="description"
                  due="31 May 2027"
                />
                <ComplianceCard
                  title="P11D Benefits"
                  description="Benefits-in-kind returns for directors &amp; P11D employees."
                  status="pending"
                  statusLabel="In Progress"
                  icon="receipt_long"
                  due="6 July 2027"
                />
                <ComplianceCard
                  title="Final FPS"
                  description="Final Full Payment Submission marking tax year close."
                  status="pending"
                  statusLabel="Pending"
                  icon="send"
                  due="19 Apr 2027"
                />
                <ComplianceCard
                  title="EPS Year-End"
                  description="Employer Payment Summary finalising NI &amp; student loan YTD."
                  status="pending"
                  statusLabel="Pending"
                  icon="summarize"
                  due="19 Apr 2027"
                />
                <ComplianceCard
                  title="AE Re-enrolment"
                  description="3-year cyclical re-enrolment declaration to TPR."
                  status="active"
                  statusLabel="Scheduled"
                  icon="retirement"
                  due="Oct 2027"
                />
                <ComplianceCard
                  title="Gender Pay Gap"
                  description="Snapshot report for employers with 250+ staff."
                  status="not_assessed"
                  statusLabel="N/A"
                  icon="balance"
                  due="30 Mar 2027"
                />
              </div>
            </div>
          )}

          {/* COMPANY TAB */}
          {activeTab === "company" && (
            <div className="flex flex-col gap-5">
              <div className="bg-surface border border-subtle p-5 flex items-center justify-between">
                <div>
                  <h2 className="section-title text-tprimary">Company Defaults</h2>
                  <p className="text-[12px] text-tsecondary mt-1">
                    Bureau-wide defaults applied to new client onboardings
                  </p>
                </div>
                <PearlButton onClick={() => toast("Edit mode coming soon", "info")}>
                  <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">edit</span>
                  Edit Defaults
                </PearlButton>
              </div>
              <ComingSoon label="Company defaults" />
            </div>
          )}

          {/* PENSION TAB */}
          {activeTab === "pension" && (
            <ComingSoon label="Pension scheme" />
          )}

          {/* SECURITY TAB */}
          {activeTab === "security" && (
            <ComingSoon label="Security" />
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === "notifications" && (
            <ComingSoon label="Notifications" />
          )}

          {/* SYSTEM TAB */}
          {activeTab === "system" && (
            <ComingSoon label="System" />
          )}
        </div>
      </div>

      {/* Override Modal */}
      <Modal open={overrideOpen} onClose={() => setOverrideOpen(false)} title="Override Threshold">
        <div className="flex flex-col gap-5">
          <div className="bg-surface-low border-l-2 border-l-warning border border-subtle p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] text-warning mt-0.5">warning</span>
            <p className="text-[12px] text-tsecondary leading-relaxed">
              Overrides create a new effective-dated row in the audit log. The canonical HMRC value
              is preserved. The override will be visible to all bureau users.
            </p>
          </div>

          <Field label="Parameter Key" hint="e.g. personalAllowance, niEeMainRate">
            <TextInput
              value={overrideKey}
              onChange={setOverrideKey}
              placeholder="personalAllowance"
              mono
            />
          </Field>

          <Field label="Override Value" hint="e.g. £13,000 or 7%">
            <TextInput
              value={overrideValue}
              onChange={setOverrideValue}
              placeholder="£13,000"
              mono
            />
          </Field>

          <Field
            label="Reason for Override"
            hint="Required for audit trail · visible to all bureau users"
            error={
              overrideReason && overrideReason.length < 8 ? "Reason must be at least 8 chars" : undefined
            }
          >
            <TextInput
              value={overrideReason}
              onChange={setOverrideReason}
              placeholder="Director's allowance adjustment per client letter"
            />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-subtle">
            <GhostButton onClick={() => setOverrideOpen(false)}>Cancel</GhostButton>
            <PearlButton onClick={saveOverride}>
              <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">save</span>
              Save Override
            </PearlButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
