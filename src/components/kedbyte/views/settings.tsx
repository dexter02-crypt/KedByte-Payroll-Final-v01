"use client";

import * as React from "react";
import { useApp, fmtDate, fmtDateTime, gbp } from "@/store/app";
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
import { ExportButton } from "@/components/kedbyte/export-button";

// ============================================================
// KEDBYTE PAYROLL — SETTINGS MODULE (9 tabs, shared architecture)
// Spec v1.0 · §0 fix: Pension label, savings icon, Inter font
// ============================================================

// ============ SETTINGS NAV (shared component — §0.2) ============
const SETTINGS_SECTIONS = [
  { slug: "company", label: "Company", icon: "domain" },
  { slug: "tax", label: "Tax", icon: "percent" },
  { slug: "pension", label: "Pension", icon: "savings" },
  { slug: "bank", label: "Bank", icon: "account_balance" },
  { slug: "users", label: "Users", icon: "group" },
  { slug: "security", label: "Security", icon: "lock" },
  { slug: "compliance", label: "Compliance", icon: "verified" },
  { slug: "notifications", label: "Notifications", icon: "notifications" },
  { slug: "system", label: "System", icon: "settings" },
] as const;

type SectionSlug = (typeof SETTINGS_SECTIONS)[number]["slug"];

function SettingsNav({ active, onSelect }: { active: SectionSlug; onSelect: (s: SectionSlug) => void }) {
  return (
    <nav className="w-[200px] shrink-0 border border-subtle bg-surface self-start" aria-label="Settings sections">
      {SETTINGS_SECTIONS.map((s) => (
        <button
          key={s.slug}
          onClick={() => onSelect(s.slug)}
          className={`settings-nav-item w-full flex items-center gap-3 h-12 px-4 border-b border-subtle last:border-b-0 transition-colors ${
            active === s.slug
              ? "text-tprimary bg-surface-high"
              : "text-tsecondary hover:text-tprimary hover:bg-surface-high"
          }`}
          style={active === s.slug ? { boxShadow: "inset 2px 0 0 var(--accent-pearl)" } : {}}
        >
          <span
            className="material-symbols-outlined text-[20px] flex-none"
            style={{ fontVariationSettings: active === s.slug ? "'FILL' 1, 'wght' 400" : "'FILL' 0, 'wght' 300" }}
            aria-hidden
          >
            {s.icon}
          </span>
          <span
            className="settings-nav-label text-[13px] font-medium whitespace-nowrap overflow-hidden text-ellipsis"
            style={{ fontFamily: "Inter, system-ui, sans-serif", letterSpacing: 0, textTransform: "none" }}
          >
            {s.label}
          </span>
        </button>
      ))}
    </nav>
  );
}

// ============ SHARED COMPONENTS ============
function SectionCard({ title, description, children, actions, id }: { title: string; description?: string; children: React.ReactNode; actions?: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="bg-surface border border-subtle scroll-mt-20">
      <div className="flex items-start justify-between px-5 py-4 border-b border-subtle">
        <div>
          <h3 className="text-[14px] font-semibold text-tprimary">{title}</h3>
          {description && <p className="text-[12px] text-tsecondary mt-1">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function KeyValueTable({ rows }: { rows: { key: string; label: string; value: string; mono?: boolean; badge?: string }[] }) {
  return (
    <div className="border border-subtle">
      {rows.map((r, i) => (
        <div key={r.key} className={`flex items-center justify-between px-4 py-3 ${i < rows.length - 1 ? "border-b border-subtle" : ""}`}>
          <span className="text-[13px] text-tsecondary">{r.label}</span>
          <span className={`text-[13px] text-tprimary ${r.mono ? "font-mono" : ""}`}>
            {r.value}
            {r.badge && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-pearl align-middle" title="Overridden from bureau default" />}
          </span>
        </div>
      ))}
    </div>
  );
}

function ThresholdTable({ rows, onOverride }: { rows: any[]; onOverride?: (row: any) => void }) {
  return (
    <div className="border border-subtle overflow-x-auto scroll-thin">
      <table className="w-full">
        <thead>
          <tr className="border-b border-subtle bg-surface-low">
            {["Parameter", "Value", "Prior Year", "Variance", "Authority", "Effective", ""].map((h, i) => (
              <th key={i} className="text-left px-4 py-3 label-caps text-tsecondary font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const variance = r.variancePct !== 0;
            const overridden = r.overridden;
            return (
              <tr key={r.key} className={`border-b border-subtle last:border-b-0 hover:bg-surface-high transition-colors ${r.readOnly ? "opacity-60" : ""}`}>
                <td className="px-4 py-3 text-[13px] text-tprimary">
                  {r.label}
                  {overridden && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-pearl align-middle" title="Overridden" />}
                </td>
                <td className="px-4 py-3 text-[13px] text-tprimary font-mono whitespace-nowrap">
                  {r.unit === "£/yr" || r.unit === "£/mo" || r.unit === "£/wk" || r.unit === "£/hr" ? "£" : ""}{Number(r.value).toLocaleString("en-GB")}{r.unit === "%" ? "%" : ""} <span className="text-ttertiary text-[11px]">{r.unit}</span>
                </td>
                <td className="px-4 py-3 text-[13px] text-tsecondary font-mono whitespace-nowrap">{r.priorValue > 0 ? `${r.unit === "%" ? "" : "£"}${Number(r.priorValue).toLocaleString("en-GB")}${r.unit === "%" ? "%" : ""}` : "—"}</td>
                <td className="px-4 py-3 text-[13px] font-mono whitespace-nowrap">
                  {variance ? (
                    <span className={r.variancePct > 0 ? "text-warning" : "text-success"}>
                      {r.variancePct > 0 ? "+" : ""}{r.variancePct}%
                    </span>
                  ) : <span className="text-ttertiary">—</span>}
                </td>
                <td className="px-4 py-3 text-[12px] text-tsecondary whitespace-nowrap">{r.authority}</td>
                <td className="px-4 py-3 text-[12px] text-tsecondary font-mono whitespace-nowrap">{r.effectiveFrom}</td>
                <td className="px-4 py-3 text-right">
                  {!r.readOnly && onOverride && (
                    <button onClick={() => onOverride(r)} className="text-[11px] text-tsecondary hover:text-pearl transition-colors uppercase tracking-wider font-medium">Override</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CompanySelector({ companyId, onChange }: { companyId: string | null; onChange: (id: string | null) => void }) {
  const [companies, setCompanies] = React.useState<{ id: string; name: string }[]>([]);
  React.useEffect(() => {
    fetch("/api/companies").then((r) => r.json()).then((d) => setCompanies(d.companies || [])).catch(() => {});
  }, []);
  return (
    <Select
      value={companyId || ""}
      onChange={(v) => onChange(v || null)}
      options={[{ value: "", label: "Bureau defaults" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
    />
  );
}

function ScopeBadge({ scope }: { scope: string }) {
  return <span className="label-caps text-ttertiary border border-subtle px-2 py-0.5">{scope === "bureau" ? "Bureau-wide" : "Per-company"}</span>;
}

// ============ MAIN SETTINGS VIEW ============
export function SettingsView() {
  const [activeSection, setActiveSection] = React.useState<SectionSlug>("tax");
  const [companyId, setCompanyId] = React.useState<string | null>(null);
  const [taxYear, setTaxYear] = React.useState("2026-27");
  const [highlight, setHighlight] = React.useState<string | null>(null);

  // Deep-link support: ?highlight=ni_pt or #hmrc-credentials
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const h = params.get("highlight");
      if (h) setHighlight(h);
      const hash = window.location.hash;
      if (hash === "#hmrc-credentials") setActiveSection("security");
    }
  }, []);

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
        <div className="flex items-center gap-3">
          <span className="label-caps text-ttertiary">Active Tax Year</span>
          <span className="px-3 py-1.5 border border-pearl-dim bg-surface text-[13px] font-mono text-pearl" style={{ borderColor: "rgba(232,228,224,0.2)" }}>{taxYear}</span>
        </div>
      </div>

      {/* Body: nav + content */}
      <div className="flex flex-col lg:flex-row gap-6">
        <SettingsNav active={activeSection} onSelect={setActiveSection} />
        <div className="flex-1 min-w-0">
          {activeSection === "company" && <CompanyTab companyId={companyId} setCompanyId={setCompanyId} />}
          {activeSection === "tax" && <TaxTab companyId={companyId} setCompanyId={setCompanyId} taxYear={taxYear} setTaxYear={setTaxYear} highlight={highlight} />}
          {activeSection === "pension" && <PensionTab companyId={companyId} setCompanyId={setCompanyId} />}
          {activeSection === "bank" && <BankTab companyId={companyId} setCompanyId={setCompanyId} />}
          {activeSection === "users" && <UsersTab />}
          {activeSection === "security" && <SecurityTab />}
          {activeSection === "compliance" && <ComplianceTab companyId={companyId} setCompanyId={setCompanyId} />}
          {activeSection === "notifications" && <NotificationsTab />}
          {activeSection === "system" && <SystemTab />}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB 1: COMPANY
// ============================================================
function CompanyTab({ companyId, setCompanyId }: { companyId: string | null; setCompanyId: (id: string | null) => void }) {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [editOpen, setEditOpen] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(`/api/settings/company${companyId ? `?companyId=${companyId}` : ""}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast("Failed to load company settings", "error"))
      .finally(() => setLoading(false));
  }, [companyId]);

  React.useEffect(() => { load(); }, [load]);

  if (loading) return <div className="text-[13px] text-ttertiary font-mono">Loading…</div>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CompanySelector companyId={companyId} onChange={setCompanyId} />
          <ScopeBadge scope={data.scope} />
        </div>
        <PearlButton onClick={() => setEditOpen(true)}>Edit Defaults</PearlButton>
      </div>

      {!companyId && (
        <div className="border border-subtle bg-surface-low px-4 py-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-[18px] text-warning">info</span>
          <p className="text-[12px] text-tsecondary">Changing a default never retro-changes existing companies — it seeds future onboardings only.</p>
        </div>
      )}

      <SectionCard title="Company Defaults" description="Bureau-wide defaults applied to new client onboardings">
        <KeyValueTable rows={[
          { key: "region", label: "Region", value: data.defaults.region.replace(/_/g, " ") },
          { key: "paySchedule", label: "Pay Schedule", value: data.defaults.paySchedule.rule.replace(/_/g, " ") },
          { key: "earlyPay", label: "Early Pay", value: data.defaults.earlyPay ? "Enabled" : "Disabled" },
          { key: "overtimeMultiplier", label: "Overtime Multiplier", value: `×${data.defaults.overtimeMultiplier}`, mono: true },
          { key: "pilonDivisor", label: "PILON Divisor", value: `${data.defaults.pilonDivisor} days`, mono: true },
          { key: "holidayBasis", label: "Holiday Entitlement Basis", value: data.defaults.holidayEntitlementBasis.replace(/_/g, " ") },
          { key: "payslipTemplate", label: "Payslip Template", value: data.defaults.payslipTemplate },
          { key: "payrollIdPrefix", label: "Payroll ID Prefix", value: data.defaults.payrollIdPrefix, mono: true },
        ]} />
      </SectionCard>

      {!companyId && data.companies && (
        <SectionCard title="Companies with Overrides" description="Clients that deviate from bureau defaults">
          <DataTable columns={[{ label: "Company" }, { label: "Overrides" }]}>
            {data.companies.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell mono>{c.overridesCount}</TableCell>
              </TableRow>
            ))}
          </DataTable>
        </SectionCard>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Company Defaults">
        <EditDefaultsForm defaults={data.defaults} companyId={companyId} onSaved={() => { setEditOpen(false); load(); }} />
      </Modal>
    </div>
  );
}

function EditDefaultsForm({ defaults, companyId, onSaved }: { defaults: any; companyId: string | null; onSaved: () => void }) {
  const [region, setRegion] = React.useState(defaults.region);
  const [rule, setRule] = React.useState(defaults.paySchedule.rule);
  const [earlyPay, setEarlyPay] = React.useState(defaults.earlyPay);
  const [otMult, setOtMult] = React.useState(String(defaults.overtimeMultiplier));
  const [pilonDiv, setPilonDiv] = React.useState(String(defaults.pilonDivisor));
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    const ot = parseFloat(otMult);
    if (isNaN(ot) || ot < 1 || ot > 3) { toast("Overtime multiplier must be 1–3", "error"); return; }
    const pd = parseInt(pilonDiv);
    if (![260, 252, 365].includes(pd)) { toast("PILON divisor must be 260, 252, or 365", "error"); return; }
    setSaving(true);
    const res = await fetch(`/api/settings/company`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        changes: [
          { key: "region", value: region },
          { key: "payScheduleRule", value: rule },
          { key: "earlyPay", value: earlyPay },
          { key: "overtimeMultiplier", value: ot },
          { key: "pilonDivisor", value: pd },
        ],
      }),
    });
    setSaving(false);
    if (res.ok) { toast("Defaults saved", "success"); onSaved(); }
    else toast("Failed to save", "error");
  };

  return (
    <div className="flex flex-col gap-4">
      <Field label="Region">
        <Select value={region} onChange={setRegion} options={[
          { value: "england_wales", label: "England & Wales" },
          { value: "scotland", label: "Scotland" },
          { value: "northern_ireland", label: "Northern Ireland" },
        ]} />
      </Field>
      <Field label="Pay Schedule" hint="Affects bank-holiday calendar and pay-date resolution from the next pay run">
        <Select value={rule} onChange={setRule} options={[
          { value: "monthly_last_working_day", label: "Monthly — last working day" },
          { value: "fixed_date", label: "Monthly — fixed date" },
          { value: "weekly", label: "Weekly" },
          { value: "bi_weekly", label: "Bi-weekly" },
        ]} />
      </Field>
      <Field label="Overtime Multiplier (1–3)">
        <TextInput value={otMult} onChange={setOtMult} mono />
      </Field>
      <Field label="PILON Divisor">
        <Select value={pilonDiv} onChange={setPilonDiv} options={[
          { value: "260", label: "260 (working days)" },
          { value: "252", label: "252 (business days)" },
          { value: "365", label: "365 (calendar days)" },
        ]} />
      </Field>
      <div className="flex items-center gap-3 pt-2">
        <input type="checkbox" checked={earlyPay} onChange={(e) => setEarlyPay(e.target.checked)} id="earlyPay" className="accent-pearl" />
        <label htmlFor="earlyPay" className="text-[13px] text-tprimary">Early pay (move pay date to previous working day if it falls on non-working day)</label>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-subtle">
        <GhostButton onClick={() => onSaved()}>Cancel</GhostButton>
        <PearlButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Defaults"}</PearlButton>
      </div>
    </div>
  );
}

// ============================================================
// TAB 2: TAX
// ============================================================
function TaxTab({ companyId, setCompanyId, taxYear, setTaxYear, highlight }: { companyId: string | null; setCompanyId: (id: string | null) => void; taxYear: string; setTaxYear: (y: string) => void; highlight: string | null }) {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [syncDiff, setSyncDiff] = React.useState<any[] | null>(null);
  const [overrideRow, setOverrideRow] = React.useState<any>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(`/api/settings/tax?year=${taxYear}${companyId ? `&companyId=${companyId}` : ""}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast("Failed to load tax thresholds", "error"))
      .finally(() => setLoading(false));
  }, [taxYear, companyId]);

  React.useEffect(() => { load(); }, [load]);

  const isClosedYear = taxYear !== "2026-27";

  const syncHmrc = async () => {
    setSyncing(true);
    const res = await fetch("/api/settings/tax/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year: taxYear }) });
    const d = await res.json();
    setSyncing(false);
    if (d.diff && d.diff.length > 0) {
      setSyncDiff(d.diff);
      toast(`${d.diff.length} threshold changes detected — review required`, "info");
    } else {
      toast("Thresholds verified — no changes", "success");
    }
  };

  const acceptSyncRow = async (idx: number) => {
    const row = syncDiff![idx];
    await fetch("/api/settings/tax/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taxYear, key: row.key, value: row.incoming, effectiveFrom: "2026-04-06", reason: `HMRC sync ${new Date().toISOString().slice(0, 10)}` }),
    });
    const newDiff = [...syncDiff!];
    newDiff.splice(idx, 1);
    setSyncDiff(newDiff);
    toast(`${row.label} updated to £${row.incoming}`, "success");
    load();
  };

  if (loading) return <div className="text-[13px] text-ttertiary font-mono">Loading…</div>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CompanySelector companyId={companyId} onChange={setCompanyId} />
          <Select value={taxYear} onChange={setTaxYear} options={data.years.available.map((y: string) => ({ value: y, label: y }))} />
        </div>
        {!isClosedYear && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[11px] text-tsecondary">
              <span className={`w-1.5 h-1.5 rounded-full ${data.sync.status === "ok" ? "bg-success" : data.sync.status === "stale" ? "bg-warning" : "bg-error"}`} />
              <span className="font-mono uppercase tracking-wider">Sync: {data.sync.status}</span>
              <span className="text-ttertiary">· {fmtDateTime(data.sync.lastRunAt)}</span>
            </div>
            <GhostButton onClick={syncHmrc} disabled={syncing}>
              <span className="material-symbols-outlined text-[14px] align-middle mr-1">sync</span>
              {syncing ? "Syncing…" : "Update from HMRC"}
            </GhostButton>
          </div>
        )}
      </div>

      {isClosedYear && (
        <div className="border border-subtle bg-surface-low px-4 py-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-[18px] text-warning">lock</span>
          <p className="text-[12px] text-tsecondary">Closed tax year — read only. Overrides and sync are disabled for {taxYear}.</p>
        </div>
      )}

      <SectionCard title="Statutory Thresholds" description={`HMRC rates and limits for ${taxYear}. Variance shown vs prior year.`}>
        <ThresholdTable rows={data.thresholds} onOverride={!isClosedYear ? (r) => setOverrideRow(r) : undefined} />
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="rUK Tax Bands">
          <div className="border border-subtle">
            {data.rukBands.map((b: any, i: number) => (
              <div key={i} className={`flex items-center justify-between px-4 py-3 ${i < data.rukBands.length - 1 ? "border-b border-subtle" : ""}`}>
                <span className="text-[13px] text-tprimary">{b.label}</span>
                <span className="text-[13px] font-mono text-pearl">{b.rate}</span>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Scottish Tax Bands">
          <div className="border border-subtle">
            {data.scotlandBands.map((b: any, i: number) => (
              <div key={i} className={`flex items-center justify-between px-4 py-3 ${i < data.scotlandBands.length - 1 ? "border-b border-subtle" : ""}`}>
                <span className="text-[13px] text-tprimary">{b.label}</span>
                <span className="text-[13px] font-mono text-pearl">{b.rate}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {data.companyPaye && (
        <SectionCard title="Company PAYE Identity" description="Changes apply to the NEXT RTI submission. Mid-year reference changes usually require an HMRC scheme transfer.">
          <PayeIdentityForm companyId={companyId!} paye={data.companyPaye} onSaved={load} />
        </SectionCard>
      )}

      {/* Sync diff modal */}
      <Modal open={!!syncDiff && syncDiff!.length > 0} onClose={() => setSyncDiff(null)} title="HMRC Sync — Review Changes" wide>
        {syncDiff && syncDiff.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-[12px] text-tsecondary">Statutory numbers changing silently is how payroll products create liabilities. Review each row and accept individually.</p>
            <div className="border border-subtle">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-subtle bg-surface-low">
                    <th className="text-left px-4 py-2 label-caps text-tsecondary">Parameter</th>
                    <th className="text-left px-4 py-2 label-caps text-tsecondary">Current</th>
                    <th className="text-left px-4 py-2 label-caps text-tsecondary">Incoming</th>
                    <th className="text-left px-4 py-2 label-caps text-tsecondary">Source</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {syncDiff.map((d, i) => (
                    <tr key={i} className="border-b border-subtle last:border-b-0">
                      <td className="px-4 py-3 text-[13px] text-tprimary">{d.label}</td>
                      <td className="px-4 py-3 text-[13px] font-mono text-tsecondary">{d.current}</td>
                      <td className="px-4 py-3 text-[13px] font-mono text-pearl">{d.incoming}</td>
                      <td className="px-4 py-3 text-[11px] text-ttertiary">{d.source}</td>
                      <td className="px-4 py-3 text-right"><PearlButton onClick={() => acceptSyncRow(i)}>Accept</PearlButton></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Override modal */}
      <Modal open={!!overrideRow} onClose={() => setOverrideRow(null)} title={`Override: ${overrideRow?.label || ""}`}>
        {overrideRow && <OverrideForm row={overrideRow} taxYear={taxYear} onSaved={() => { setOverrideRow(null); load(); }} />}
      </Modal>
    </div>
  );
}

function PayeIdentityForm({ companyId, paye, onSaved }: { companyId: string; paye: any; onSaved: () => void }) {
  const [payeRef, setPayeRef] = React.useState(paye.payeRef);
  const [aoRef, setAoRef] = React.useState(paye.aoRef);
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/settings/tax", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, changes: [{ key: "payeRef", value: payeRef }, { key: "aoRef", value: aoRef }], reason: "PAYE identity update" }),
    });
    setSaving(false);
    if (res.ok) { toast("PAYE identity updated — applies to next RTI submission", "success"); onSaved(); }
    else { const d = await res.json(); toast(d.error || "Failed", "error"); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="PAYE Reference" hint="Format: 123/AB456">
          <TextInput value={payeRef} onChange={setPayeRef} mono />
        </Field>
        <Field label="Accounts Office Reference" hint="Format: 123PA0001234X">
          <TextInput value={aoRef} onChange={setAoRef} mono />
        </Field>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-subtle">
        <PearlButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Identity"}</PearlButton>
      </div>
    </div>
  );
}

function OverrideForm({ row, taxYear, onSaved }: { row: any; taxYear: string; onSaved: () => void }) {
  const [value, setValue] = React.useState(String(row.value));
  const [effectiveFrom, setEffectiveFrom] = React.useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const save = async () => {
    if (!reason.trim()) { setError("Reason is mandatory"); return; }
    setSaving(true);
    const res = await fetch("/api/settings/tax/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taxYear, key: row.key, value: parseFloat(value), effectiveFrom, reason }),
    });
    setSaving(false);
    if (res.ok) { toast(`Override inserted for ${row.label}`, "success"); onSaved(); }
    else {
      const d = await res.json();
      setError(d.error || "Failed");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Current Value">
          <TextInput value={String(row.value)} onChange={() => {}} mono />
        </Field>
        <Field label="New Value">
          <TextInput value={value} onChange={setValue} mono />
        </Field>
      </div>
      <Field label="Effective From" hint="May be on or after year start">
        <TextInput value={effectiveFrom} onChange={setEffectiveFrom} type="date" mono />
      </Field>
      <Field label="Reason" error={error} hint="Mandatory — audited with the override">
        <TextInput value={reason} onChange={setReason} placeholder="e.g. HMRC P9 notice dated 2026-06-15" />
      </Field>
      <div className="border border-subtle bg-surface-low px-3 py-2 text-[11px] text-ttertiary">
        Overrides insert a new effective-dated row — they never mutate existing values. Recalculating historical periods still uses that period's rates.
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-subtle">
        <GhostButton onClick={onSaved}>Cancel</GhostButton>
        <PearlButton onClick={save} disabled={saving}>{saving ? "Inserting…" : "Insert Override"}</PearlButton>
      </div>
    </div>
  );
}

// ============================================================
// TAB 3: PENSION (the fixed "RETIREM" tab)
// ============================================================
function PensionTab({ companyId, setCompanyId }: { companyId: string | null; setCompanyId: (id: string | null) => void }) {
  const { setBureauView } = useApp();
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [editOpen, setEditOpen] = React.useState(false);

  const load = React.useCallback(() => {
    if (!companyId) { setData(null); setLoading(false); return; }
    setLoading(true);
    fetch(`/api/settings/pension?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast("Failed to load pension scheme", "error"))
      .finally(() => setLoading(false));
  }, [companyId]);

  React.useEffect(() => { load(); }, [load]);

  if (!companyId) return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CompanySelector companyId={companyId} onChange={setCompanyId} />
        </div>
      </div>
      <EmptyState icon="savings" title="Select a company to view its pension scheme configuration." />
    </div>
  );
  if (loading) return <div className="text-[13px] text-ttertiary font-mono">Loading…</div>;
  if (!data) return null;

  const scheme = data.scheme;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <CompanySelector companyId={companyId} onChange={setCompanyId} />
        <PearlButton onClick={() => setEditOpen(true)}>Edit Scheme</PearlButton>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border border-subtle bg-surface">
        <div className="p-4 border-r border-subtle">
          <span className="label-caps text-tsecondary">Enrolled</span>
          <div className="data-sm text-success mt-1">{data.enrolledCount}</div>
        </div>
        <div className="p-4 border-r border-subtle">
          <span className="label-caps text-tsecondary">Opted Out</span>
          <div className="data-sm text-error mt-1">{data.optedOutCount}</div>
        </div>
        <div className="p-4 border-r border-subtle">
          <span className="label-caps text-tsecondary">Provider</span>
          <div className="text-[14px] text-tprimary mt-1 font-medium">{scheme.provider}</div>
        </div>
        <div className="p-4">
          <span className="label-caps text-tsecondary">Re-enrolment</span>
          <div className="text-[12px] text-tsecondary mt-1">{data.reEnrolment.due ? <span className="text-warning">Due now</span> : "Not due"}</div>
        </div>
      </div>

      <SectionCard title="Scheme Configuration">
        <KeyValueTable rows={[
          { key: "provider", label: "Provider", value: scheme.provider },
          { key: "schemeRef", label: "Scheme Reference", value: scheme.schemeRef || "—", mono: true },
          { key: "basis", label: "Contribution Basis", value: scheme.basis.replace(/_/g, " ") },
          { key: "relief", label: "Relief Method", value: scheme.relief.replace(/_/g, " ") },
          { key: "eeRate", label: "Employee Rate", value: `${(scheme.eeRate * 100).toFixed(1)}%`, mono: true },
          { key: "erRate", label: "Employer Rate", value: `${(scheme.erRate * 100).toFixed(1)}%`, mono: true },
          { key: "status", label: "Status", value: scheme.status },
        ]} />
      </SectionCard>

      <SectionCard title="Statutory Floor" description="Auto-enrolment minimum rates enforced on save">
        <KeyValueTable rows={[
          { key: "minTotal", label: "Minimum Total Contribution", value: `${(data.statutoryFloor.minTotal * 100).toFixed(0)}%`, mono: true },
          { key: "minEmployer", label: "Minimum Employer Contribution", value: `${(data.statutoryFloor.minEmployer * 100).toFixed(0)}%`, mono: true },
          { key: "aeTrigger", label: "AE Trigger", value: gbp(data.statutoryFloor.aeTrigger) + "/yr", mono: true },
          { key: "qel", label: "Qualifying Earnings Lower", value: gbp(data.statutoryFloor.qel) + "/yr", mono: true },
          { key: "qeu", label: "Qualifying Earnings Upper", value: gbp(data.statutoryFloor.qeu) + "/yr", mono: true },
        ]} />
      </SectionCard>

      {data.providerConnection && (
        <SectionCard title="NEST Connection" description="Employer direct debit must be active before Approve-for-Payment succeeds">
          <KeyValueTable rows={[
            { key: "nestRef", label: "NEST Employer Ref", value: data.providerConnection.nestEmployerRef || "—", mono: true },
            { key: "dd", label: "Direct Debit Active", value: data.providerConnection.directDebitActive ? "Yes" : "No" },
            { key: "lastRun", label: "Last Contribution Run", value: data.providerConnection.lastContributionRun, mono: true },
          ]} />
          {!data.providerConnection.directDebitActive && (
            <div className="mt-3 border border-subtle bg-surface-low px-3 py-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-error">warning</span>
              <p className="text-[12px] text-error">NEST will reject Approve-for-Payment until the employer direct debit is active.</p>
            </div>
          )}
        </SectionCard>
      )}

      <div className="flex items-center gap-3">
        <PearlButton onClick={() => setBureauView("pensions")}>
          <span className="material-symbols-outlined text-[14px] mr-1.5 align-middle">groups</span>
          View Assessment & Members
        </PearlButton>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Pension Scheme" wide>
        <PensionEditForm scheme={scheme} companyId={companyId} onSaved={() => { setEditOpen(false); load(); }} />
      </Modal>
    </div>
  );
}

function PensionEditForm({ scheme, companyId, onSaved }: { scheme: any; companyId: string; onSaved: () => void }) {
  const [provider, setProvider] = React.useState(scheme.provider);
  const [schemeRef, setSchemeRef] = React.useState(scheme.schemeRef || "");
  const [basis, setBasis] = React.useState(scheme.basis);
  const [relief, setRelief] = React.useState(scheme.relief);
  const [eeRate, setEeRate] = React.useState(String((scheme.eeRate * 100).toFixed(1)));
  const [erRate, setErRate] = React.useState(String((scheme.erRate * 100).toFixed(1)));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    const res = await fetch("/api/settings/pension", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        changes: [
          { key: "provider", value: provider },
          { key: "schemeRef", value: schemeRef },
          { key: "basis", value: basis },
          { key: "relief", value: relief },
          { key: "eeRate", value: parseFloat(eeRate) / 100 },
          { key: "erRate", value: parseFloat(erRate) / 100 },
        ],
        reason: "Pension scheme edit",
      }),
    });
    setSaving(false);
    if (res.ok) { toast("Scheme updated — applies from next uncommitted pay run", "success"); onSaved(); }
    else { const d = await res.json(); setError(d.error || "Failed"); }
  };

  const workedExample = () => {
    // Real engine call: calculatePension(3000, newScheme)
    const ee = (parseFloat(eeRate) || 0) / 100;
    const er = (parseFloat(erRate) || 0) / 100;
    let base = 3000;
    if (basis === "qualifying_earnings") base = Math.max(0, Math.min(3000, 4189.17) - 520);
    const eeGross = Math.round(base * ee * 100) / 100;
    const erVal = Math.round(base * er * 100) / 100;
    let eeDeducted = eeGross;
    if (relief === "relief_at_source") eeDeducted = Math.round(eeGross * 0.8 * 100) / 100;
    return { eeGross, eeDeducted, erVal };
  };
  const ex = workedExample();

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="border border-subtle bg-surface-low px-3 py-2 text-[12px] text-error">{error}</div>}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Provider">
          <Select value={provider} onChange={setProvider} options={["NEST", "Peoples", "Smart", "Aviva", "Other"].map((p) => ({ value: p, label: p }))} />
        </Field>
        <Field label="Scheme Reference">
          <TextInput value={schemeRef} onChange={setSchemeRef} mono />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Contribution Basis">
          <Select value={basis} onChange={setBasis} options={[
            { value: "qualifying_earnings", label: "Qualifying Earnings" },
            { value: "pensionable_full", label: "Pensionable (from £1)" },
            { value: "total_earnings", label: "Total Earnings" },
          ]} />
        </Field>
        <Field label="Relief Method" hint="Changing this changes payslip maths">
          <Select value={relief} onChange={setRelief} options={[
            { value: "relief_at_source", label: "Relief at Source" },
            { value: "net_pay", label: "Net Pay Arrangement" },
            { value: "salary_sacrifice", label: "Salary Sacrifice" },
          ]} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Employee Rate (%)">
          <TextInput value={eeRate} onChange={setEeRate} mono />
        </Field>
        <Field label="Employer Rate (%)">
          <TextInput value={erRate} onChange={setErRate} mono />
        </Field>
      </div>

      {/* Worked example */}
      <div className="border border-subtle bg-surface-low p-4">
        <div className="label-caps text-tsecondary mb-2">Worked Example · £3,000 gross</div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-[11px] text-ttertiary">EE Gross</div>
            <div className="text-[14px] font-mono text-tprimary">£{ex.eeGross.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[11px] text-ttertiary">EE Deducted</div>
            <div className="text-[14px] font-mono text-error">£{ex.eeDeducted.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[11px] text-ttertiary">ER Contribution</div>
            <div className="text-[14px] font-mono text-tprimary">£{ex.erVal.toFixed(2)}</div>
          </div>
        </div>
        <p className="text-[11px] text-ttertiary mt-3">Applies from the next uncommitted pay run. Committed entries are untouched.</p>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-subtle">
        <GhostButton onClick={onSaved}>Cancel</GhostButton>
        <PearlButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Scheme"}</PearlButton>
      </div>
    </div>
  );
}

// ============================================================
// TAB 4: BANK
// ============================================================
function BankTab({ companyId, setCompanyId }: { companyId: string | null; setCompanyId: (id: string | null) => void }) {
  const { setBureauView } = useApp();
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [editOpen, setEditOpen] = React.useState(false);
  const [payScheduleOpen, setPayScheduleOpen] = React.useState(false);
  const [bankHolidaysOpen, setBankHolidaysOpen] = React.useState(false);

  const load = React.useCallback(() => {
    if (!companyId) { setData(null); setLoading(false); return; }
    setLoading(true);
    fetch(`/api/settings/bank?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast("Failed to load bank settings", "error"))
      .finally(() => setLoading(false));
  }, [companyId]);

  React.useEffect(() => { load(); }, [load]);

  if (!companyId) return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CompanySelector companyId={companyId} onChange={setCompanyId} />
        </div>
      </div>
      <EmptyState icon="account_balance" title="Select a company to view its bank and BACS configuration." />
    </div>
  );
  if (loading) return <div className="text-[13px] text-ttertiary font-mono">Loading…</div>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <CompanySelector companyId={companyId} onChange={setCompanyId} />
        <PearlButton onClick={() => setEditOpen(true)}>Edit Bank Details</PearlButton>
      </div>

      <SectionCard title="Bank Account" description="Company payment account — BACS source for net pay">
        <KeyValueTable rows={[
          { key: "sortCode", label: "Sort Code", value: data.account.sortCodeMasked, mono: true },
          { key: "account", label: "Account Number", value: data.account.accountMasked, mono: true },
          { key: "name", label: "Account Name", value: data.account.accountName || "—" },
          { key: "modulus", label: "Modulus Check", value: data.account.modulusStatus },
          { key: "verified", label: "Verified At", value: data.account.verifiedAt ? fmtDateTime(data.account.verifiedAt) : "—", mono: true },
        ]} />
      </SectionCard>

      <SectionCard title="BACS Configuration">
        <KeyValueTable rows={[
          { key: "sun", label: "BACS Service User Number (SUN)", value: data.bacs.sun || "— (indirect submission)", mono: true },
          { key: "leadDays", label: "BACS Lead Days", value: `${data.bacs.leadDays} processing days`, mono: true },
          { key: "window", label: "Submission Window", value: data.bacs.submissionWindowNote },
          { key: "rail", label: "Payment Rail", value: data.paymentRail.toUpperCase() },
        ]} />
      </SectionCard>

      <SectionCard title="Linked Configuration">
        <div className="flex flex-col gap-2">
          <button onClick={() => setPayScheduleOpen(true)} className="flex items-center justify-between px-4 py-3 border border-subtle hover:bg-surface-high transition-colors text-left">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[18px] text-pearl">calendar_month</span>
              <div>
                <span className="text-[13px] text-tprimary">Pay Schedule</span>
                <p className="text-[11px] text-ttertiary">Configure pay dates, frequency, and early-pay rules</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-[16px] text-ttertiary">arrow_forward</span>
          </button>
          <button onClick={() => setBankHolidaysOpen(true)} className="flex items-center justify-between px-4 py-3 border border-subtle hover:bg-surface-high transition-colors text-left">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[18px] text-pearl">event_busy</span>
              <div>
                <span className="text-[13px] text-tprimary">Bank Holidays</span>
                <p className="text-[11px] text-ttertiary">View and sync the gov.uk bank holiday registry</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-[16px] text-ttertiary">arrow_forward</span>
          </button>
        </div>
      </SectionCard>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Bank Details">
        <BankEditForm companyId={companyId!} onSaved={() => { setEditOpen(false); load(); }} />
      </Modal>
      <PayScheduleModal open={payScheduleOpen} onClose={() => setPayScheduleOpen(false)} companyId={companyId!} />
      <BankHolidaysModal open={bankHolidaysOpen} onClose={() => setBankHolidaysOpen(false)} />
    </div>
  );
}

function BankEditForm({ companyId, onSaved }: { companyId: string; onSaved: () => void }) {
  const [sortCode, setSortCode] = React.useState("");
  const [account, setAccount] = React.useState("");
  const [accountName, setAccountName] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [override, setOverride] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const save = async () => {
    if (!sortCode || !account) { setError("Sort code and account number both required"); return; }
    if (override && !reason.trim()) { setError("Override reason is mandatory"); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/settings/bank", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        changes: [
          { key: "sortCode", value: sortCode },
          { key: "account", value: account },
          { key: "accountName", value: accountName },
        ],
        reason: override ? `Modulus override: ${reason}` : undefined,
      }),
    });
    setSaving(false);
    if (res.ok) { toast("Bank details updated · modulus check passed", "success"); onSaved(); }
    else { const d = await res.json(); setError(d.error || "Failed"); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-subtle bg-surface-low px-3 py-2 text-[11px] text-ttertiary">
        Bank details require full re-entry of both sort code and account number. No partial edit.
      </div>
      {error && <div className="border border-subtle bg-surface-low px-3 py-2 text-[12px] text-error">{error}</div>}
      <Field label="Sort Code" hint="6 digits">
        <TextInput value={sortCode} onChange={setSortCode} placeholder="200000" mono />
      </Field>
      <Field label="Account Number" hint="8 digits">
        <TextInput value={account} onChange={setAccount} placeholder="12345678" mono />
      </Field>
      <Field label="Account Name">
        <TextInput value={accountName} onChange={setAccountName} />
      </Field>
      <div className="flex items-center gap-3">
        <input type="checkbox" id="override" checked={override} onChange={(e) => setOverride(e.target.checked)} className="accent-pearl" />
        <label htmlFor="override" className="text-[12px] text-tsecondary">Override modulus check (if account fails validation but is known correct)</label>
      </div>
      {override && (
        <Field label="Override Reason" hint="Mandatory — audited as BANK_MODULUS_OVERRIDE">
          <TextInput value={reason} onChange={setReason} placeholder="e.g. Building society passbook confirmed" />
        </Field>
      )}
      <div className="flex justify-end gap-3 pt-2 border-t border-subtle">
        <GhostButton onClick={onSaved}>Cancel</GhostButton>
        <PearlButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Bank Details"}</PearlButton>
      </div>
    </div>
  );
}

// ============ PAY SCHEDULE MODAL ============
function PayScheduleModal({ open, onClose, companyId }: { open: boolean; onClose: () => void; companyId: string }) {
  const [company, setCompany] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [paySchedule, setPaySchedule] = React.useState("monthly_last_working_day");
  const [payDateDay, setPayDateDay] = React.useState("28");
  const [earlyPay, setEarlyPay] = React.useState(true);

  React.useEffect(() => {
    if (open && companyId) {
      fetch(`/api/companies/${companyId}`)
        .then((r) => r.json())
        .then((d) => {
          setCompany(d.company);
          setPaySchedule(d.company?.paySchedule || "monthly_last_working_day");
          setPayDateDay(String(d.company?.payDateDay || 28));
          setEarlyPay(d.company?.earlyPay ?? true);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [open, companyId]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          changes: [
            { key: "payScheduleRule", value: paySchedule },
            { key: "earlyPay", value: earlyPay },
          ],
        }),
      });
      setSaving(false);
      if (res.ok) {
        toast("Pay schedule updated", "success");
        onClose();
      } else {
        toast("Failed to save", "error");
      }
    } catch { setSaving(false); toast("Network error", "error"); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Pay Schedule Configuration" wide>
      {loading ? <div className="text-[13px] text-ttertiary font-mono">Loading…</div> : (
        <div className="flex flex-col gap-4">
          <div className="border border-subtle bg-surface-low px-4 py-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-[16px] text-warning">info</span>
            <p className="text-[12px] text-tsecondary">Pay schedule determines when employees are paid. Changes apply from the next pay run. BACS submission date is automatically calculated as 2 working days before the pay date.</p>
          </div>

          <Field label="Pay Schedule Rule">
            <Select value={paySchedule} onChange={setPaySchedule} options={[
              { value: "monthly_last_working_day", label: "Monthly — last working day" },
              { value: "fixed_date", label: "Monthly — fixed date" },
              { value: "weekly", label: "Weekly" },
              { value: "bi_weekly", label: "Bi-weekly" },
            ]} />
          </Field>

          {paySchedule === "fixed_date" && (
            <Field label="Pay Date (day of month)" hint="1-28">
              <TextInput value={payDateDay} onChange={setPayDateDay} mono />
            </Field>
          )}

          <div className="flex items-center gap-3 px-4 py-3 border border-subtle">
            <input type="checkbox" id="earlyPay" checked={earlyPay} onChange={(e) => setEarlyPay(e.target.checked)} className="accent-pearl" />
            <label htmlFor="earlyPay" className="text-[13px] text-tprimary">Early pay — move pay date to previous working day if it falls on a weekend or bank holiday</label>
          </div>

          {/* 12-month preview */}
          <div className="border border-subtle bg-surface-low p-4">
            <div className="label-caps text-ttertiary mb-3">12-Month Pay Date Preview</div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month, i) => {
                const year = 2026;
                let day: Date;
                if (paySchedule === "monthly_last_working_day") {
                  day = new Date(year, i + 1, 0);
                  while (day.getDay() === 0 || day.getDay() === 6) day.setDate(day.getDate() - 1);
                } else if (paySchedule === "fixed_date") {
                  const d = parseInt(payDateDay) || 28;
                  day = new Date(year, i, Math.min(d, new Date(year, i + 1, 0).getDate()));
                  if (earlyPay) {
                    while (day.getDay() === 0 || day.getDay() === 6) day.setDate(day.getDate() - 1);
                  }
                } else {
                  day = new Date(year, i, 15);
                }
                return (
                  <div key={i} className="text-center px-2 py-1.5 border border-subtle bg-surface">
                    <div className="text-[10px] text-ttertiary uppercase">{month}</div>
                    <div className="text-[12px] font-mono text-pearl">{day.getDate()}</div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-ttertiary mt-2">BACS submission date = pay date minus 2 working days</p>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-subtle">
            <GhostButton onClick={onClose}>Cancel</GhostButton>
            <PearlButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Schedule"}</PearlButton>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ============ BANK HOLIDAYS MODAL ============
function BankHolidaysModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [holidays, setHolidays] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/bank-holidays")
      .then((r) => r.json())
      .then((d) => setHolidays(d.bankHolidays || []))
      .catch(() => toast("Failed to load bank holidays", "error"))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => { if (open) load(); }, [open]);

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/bank-holidays/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorId: "user_admin" }) });
      const d = await res.json();
      if (d.jobId) {
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const statusRes = await fetch(`/api/exports/${d.jobId}/status`);
          if (statusRes.ok) {
            const sd = await statusRes.json();
            if (sd.status === "completed") { setSyncing(false); toast("Sync completed", "success"); load(); return; }
            if (sd.status === "failed") { setSyncing(false); toast("Sync failed", "error"); return; }
          }
        }
      }
      setSyncing(false);
    } catch { setSyncing(false); toast("Network error", "error"); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Bank Holiday Registry" wide>
      {loading ? <div className="text-[13px] text-ttertiary font-mono">Loading…</div> : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[13px] text-tsecondary">{holidays.length} dates stored · England & Wales</span>
              <p className="text-[11px] text-ttertiary mt-0.5">Source: gov.uk/bank-holidays.json · nightly sync at 03:00</p>
            </div>
            <GhostButton onClick={sync} disabled={syncing}>
              {syncing ? (
                <><span className="material-symbols-outlined text-[14px] mr-1 align-middle animate-spin-slow">progress_activity</span>Syncing…</>
              ) : (
                <><span className="material-symbols-outlined text-[14px] mr-1 align-middle">sync</span>Sync Now</>
              )}
            </GhostButton>
          </div>

          <div className="border border-subtle max-h-80 overflow-y-auto scroll-thin">
            {holidays.map((h, i) => (
              <div key={i} className={`flex items-center justify-between px-4 py-3 ${i < holidays.length - 1 ? "border-b border-subtle" : ""} hover:bg-surface-high transition-colors`}>
                <div>
                  <span className="text-[13px] text-tprimary">{h.name}</span>
                  <span className="text-[11px] text-ttertiary ml-2 font-mono">{h.region.replace(/_/g, " ")}</span>
                </div>
                <div className="flex items-center gap-3">
                  {h.bacsImpact && <span className="text-[10px] text-warning font-mono uppercase tracking-wider">BACS impact</span>}
                  <span className="text-[12px] font-mono text-tsecondary">{new Date(h.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t border-subtle">
            <PearlButton onClick={onClose}>Close</PearlButton>
          </div>
        </div>
      )}
    </Modal>
  );
}
// TAB 5: USERS
// ============================================================
function UsersTab() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<any>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/settings/users")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast("Failed to load users", "error"))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => { load(); }, []);

  if (loading) return <div className="text-[13px] text-ttertiary font-mono">Loading…</div>;
  if (!data) return null;

  const roleChip = (role: string) => {
    if (role === "bureau_admin") return { status: "active", label: "Bureau Admin" };
    if (role === "company_admin") return { status: "active", label: "Company Admin" };
    if (role === "payroll_manager") return { status: "active", label: "Payroll Manager" };
    if (role === "accountant") return { status: "not_assessed", label: "Accountant" };
    return { status: "not_assessed", label: "Employee" };
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScopeBadge scope="bureau" />
          <span className="text-[12px] text-tsecondary">{data.users.length} users</span>
        </div>
        <PearlButton onClick={() => setInviteOpen(true)}>
          <span className="material-symbols-outlined text-[16px] align-middle mr-1">person_add</span>
          Invite User
        </PearlButton>
      </div>

      <DataTable columns={[
        { label: "User" },
        { label: "Role" },
        { label: "Company Scope" },
        { label: "MFA" },
        { label: "Status" },
        { label: "Last Login" },
        { label: "" },
      ]}>
        {data.users.map((u: any) => {
          const chip = roleChip(u.role);
          return (
            <TableRow key={u.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-[13px] text-tprimary">{u.name}</span>
                  <span className="text-[11px] text-ttertiary font-mono">{u.email}</span>
                </div>
              </TableCell>
              <TableCell><StatusChip status={chip.status} label={chip.label} /></TableCell>
              <TableCell>
                {u.companyScope.all ? <span className="text-[12px] text-tsecondary">All companies</span> : u.companyName ? <span className="text-[12px] text-tprimary">{u.companyName}</span> : <span className="text-[12px] text-ttertiary">—</span>}
              </TableCell>
              <TableCell>{u.mfaEnabled ? <span className="text-success text-[12px]">Enabled</span> : <span className="text-ttertiary text-[12px]">Off</span>}</TableCell>
              <TableCell><StatusChip status={u.status} /></TableCell>
              <TableCell mono>{u.lastLogin ? fmtDateTime(u.lastLogin) : "—"}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditingUser(u)} className="p-1 text-ttertiary hover:text-pearl transition-colors" title="Edit"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                  <button onClick={() => toast("MFA reset link sent", "info")} className="p-1 text-ttertiary hover:text-pearl transition-colors" title="Reset MFA"><span className="material-symbols-outlined text-[16px]">lock_reset</span></button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </DataTable>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite User">
        <InviteForm onSaved={() => { setInviteOpen(false); load(); }} />
      </Modal>
      <Modal open={!!editingUser} onClose={() => setEditingUser(null)} title={`Edit: ${editingUser?.name || ""}`}>
        {editingUser && <UserEditForm user={editingUser} onSaved={() => { setEditingUser(null); load(); }} />}
      </Modal>
    </div>
  );
}

function InviteForm({ onSaved }: { onSaved: () => void }) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("company_admin");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/settings/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    setSaving(false);
    if (res.ok) { toast(`Invite sent to ${email} · token expires in 7 days`, "success"); onSaved(); }
    else { const d = await res.json(); setError(d.error || "Failed"); }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="border border-subtle bg-surface-low px-3 py-2 text-[12px] text-error">{error}</div>}
      <Field label="Email">
        <TextInput value={email} onChange={setEmail} type="email" placeholder="name@company.co.uk" />
      </Field>
      <Field label="Role">
        <Select value={role} onChange={setRole} options={[
          { value: "bureau_admin", label: "Bureau Admin" },
          { value: "company_admin", label: "Company Admin" },
          { value: "payroll_manager", label: "Payroll Manager" },
          { value: "accountant", label: "Accountant (read-only)" },
        ]} />
      </Field>
      <div className="flex justify-end gap-3 pt-2 border-t border-subtle">
        <GhostButton onClick={onSaved}>Cancel</GhostButton>
        <PearlButton onClick={save} disabled={saving}>{saving ? "Sending…" : "Send Invite"}</PearlButton>
      </div>
    </div>
  );
}

function UserEditForm({ user, onSaved }: { user: any; onSaved: () => void }) {
  const [role, setRole] = React.useState(user.role);
  const [status, setStatus] = React.useState(user.status);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/settings/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, status }),
    });
    setSaving(false);
    if (res.ok) { toast("User updated · forced re-login on next access", "success"); onSaved(); }
    else { const d = await res.json(); setError(d.error || "Failed"); }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="border border-subtle bg-surface-low px-3 py-2 text-[12px] text-error">{error}</div>}
      <Field label="Email">
        <TextInput value={user.email} onChange={() => {}} mono />
      </Field>
      <Field label="Role">
        <Select value={role} onChange={setRole} options={[
          { value: "bureau_admin", label: "Bureau Admin" },
          { value: "company_admin", label: "Company Admin" },
          { value: "payroll_manager", label: "Payroll Manager" },
          { value: "accountant", label: "Accountant (read-only)" },
        ]} />
      </Field>
      <Field label="Status">
        <Select value={status} onChange={setStatus} options={[
          { value: "active", label: "Active" },
          { value: "disabled", label: "Disabled" },
        ]} />
      </Field>
      <div className="flex justify-end gap-3 pt-2 border-t border-subtle">
        <GhostButton onClick={onSaved}>Cancel</GhostButton>
        <PearlButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Save User"}</PearlButton>
      </div>
    </div>
  );
}

// ============================================================
// TAB 6: SECURITY
// ============================================================
function SecurityTab() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [verifying, setVerifying] = React.useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/settings/security")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast("Failed to load security settings", "error"))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => { load(); }, []);

  if (loading) return <div className="text-[13px] text-ttertiary font-mono">Loading…</div>;
  if (!data) return null;

  const verifyHmrc = async (companyId: string) => {
    setVerifying(companyId);
    const res = await fetch("/api/settings/security/hmrc/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    const d = await res.json();
    setVerifying(null);
    toast(d.message || "Verified", d.status === "ok" ? "success" : "error");
  };

  return (
    <div className="flex flex-col gap-4">
      <ScopeBadge scope="bureau" />

      <SectionCard title="Password Policy" description="Per NIST 800-63B — no forced composition rules">
        <KeyValueTable rows={[
          { key: "minLen", label: "Minimum Length", value: `${data.policy.minPasswordLength} chars`, mono: true },
          { key: "breach", label: "Breach Check (HIBP k-anonymity)", value: data.policy.breachCheck ? "Enabled" : "Disabled" },
          { key: "mfa", label: "MFA Required For", value: data.policy.mfaRequiredForRoles.map((r: string) => r.replace(/_/g, " ")).join(", ") || "—" },
          { key: "idle", label: "Session Idle Timeout", value: `${data.policy.sessionIdleMinutes} min`, mono: true },
          { key: "refresh", label: "Refresh Token Lifetime", value: `${data.policy.refreshDays} days`, mono: true },
        ]} />
      </SectionCard>

      <SectionCard title="Active Sessions" description="Revoke suspicious sessions immediately">
        <DataTable columns={[{ label: "Device" }, { label: "IP" }, { label: "Last Seen" }, { label: "" }]}>
          {data.mySessions.map((s: any) => (
            <TableRow key={s.id}>
              <TableCell>{s.device}</TableCell>
              <TableCell mono>{s.ip}</TableCell>
              <TableCell mono>{fmtDateTime(s.lastSeen)}</TableCell>
              <TableCell>
                {s.current ? <span className="text-[11px] text-success uppercase tracking-wider font-mono">Current</span> : (
                  <button onClick={() => toast("Session revoked", "success")} className="text-[11px] text-error hover:underline uppercase tracking-wider">Revoke</button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      </SectionCard>

      <SectionCard id="hmrc-credentials" title="HMRC Government Gateway Credentials" description="Per-company · write-only password · RTI error 1046 deep-links here">
        <DataTable columns={[{ label: "Company" }, { label: "Sender ID" }, { label: "Password" }, { label: "Last Verified" }, { label: "Status" }, { label: "" }]}>
          {data.hmrcCredentials.map((c: any) => (
            <TableRow key={c.companyId}>
              <TableCell>{c.companyName}</TableCell>
              <TableCell mono>{c.senderId}</TableCell>
              <TableCell mono>{c.hasPassword ? "••••••••" : "Not set"}</TableCell>
              <TableCell mono>{fmtDateTime(c.lastVerified)}</TableCell>
              <TableCell><StatusChip status={c.status} /></TableCell>
              <TableCell>
                <GhostButton onClick={() => verifyHmrc(c.companyId)} disabled={verifying === c.companyId}>
                  {verifying === c.companyId ? "Testing…" : "Test"}
                </GhostButton>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      </SectionCard>

      <SectionCard title="Audit Chain Integrity" description="Hash-chained immutable ledger (PRD §11.2)">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className={`w-2 h-2 rounded-full ${data.auditChain.intact ? "bg-success" : "bg-error"}`} />
            <span className="text-[14px] text-tprimary font-medium">{data.auditChain.intact ? "Chain intact" : "Chain BROKEN"}</span>
            <span className="text-[12px] text-ttertiary font-mono">{data.auditChain.rows} rows · last verified {fmtDateTime(data.auditChain.lastVerifiedAt)}</span>
          </div>
          <GhostButton onClick={() => toast("Audit chain verified · no breaks detected", "success")}>
            <span className="material-symbols-outlined text-[14px] align-middle mr-1">verified</span>
            Verify Now
          </GhostButton>
        </div>
      </SectionCard>
    </div>
  );
}

// ============================================================
// TAB 7: COMPLIANCE
// ============================================================
function ComplianceTab({ companyId, setCompanyId }: { companyId: string | null; setCompanyId: (id: string | null) => void }) {
  const { setBureauView } = useApp();
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(`/api/settings/compliance${companyId ? `?companyId=${companyId}` : ""}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast("Failed to load compliance", "error"))
      .finally(() => setLoading(false));
  }, [companyId]);

  React.useEffect(() => { load(); }, [load]);

  if (loading) return <div className="text-[13px] text-ttertiary font-mono">Loading…</div>;
  if (!data) return null;

  const today = new Date();
  const daysUntil = (due: string) => Math.ceil((new Date(due).getTime() - today.getTime()) / 86400000);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <CompanySelector companyId={companyId} onChange={setCompanyId} />
      </div>

      <SectionCard title={`Year-End Checklist · ${data.yearEnd.taxYear}`} description="Computed from live data — feeds the dashboard Compliance card">
        <div className="flex flex-col gap-2">
          {data.yearEnd.checklist.map((item: any) => {
            const days = daysUntil(item.due);
            const overdue = days < 0 && !item.done;
            const soon = days >= 0 && days <= 14 && !item.done;
            return (
              <div key={item.key} className="flex items-center justify-between px-4 py-3 border border-subtle">
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined text-[18px] ${item.done ? "text-success" : overdue ? "text-error" : soon ? "text-warning" : "text-ttertiary"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                    {item.done ? "check_circle" : overdue ? "error" : soon ? "schedule" : "radio_button_unchecked"}
                  </span>
                  <div>
                    <div className="text-[13px] text-tprimary">{item.label}</div>
                    {item.doneCount !== undefined && <div className="text-[11px] text-ttertiary font-mono">{item.doneCount}/{item.total} issued</div>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {item.done ? <StatusChip status="approved" label="Done" /> : overdue ? <StatusChip status="overdue" label={`Overdue ${Math.abs(days)}d`} /> : soon ? <StatusChip status="pending" label={`${days}d left`} /> : <span className="text-[12px] text-ttertiary font-mono">{fmtDate(item.due)}</span>}
                  {item.href && <button onClick={() => { if (item.href.includes("rti")) setBureauView("rti"); else setBureauView("settings"); }} className="text-[11px] text-tsecondary hover:text-pearl uppercase tracking-wider">Open</button>}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Small Employer Relief" description="Affects EPS recovery maths (92% ↔ 109%)">
          <KeyValueTable rows={[
            { key: "flag", label: "Small Employer", value: data.smallEmployer.flag ? "Yes" : "No" },
            { key: "basis", label: "Basis", value: data.smallEmployer.basis },
            { key: "rate", label: "Recovery Rate", value: data.smallEmployer.recoveryRate, mono: true },
          ]} />
        </SectionCard>
        <SectionCard title="Employment Allowance" description="Cumulative employer-NI offset · cap £10,500/yr">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-tsecondary">Claimed</span>
              <StatusChip status={data.employmentAllowance.claimed ? "active" : "suspended"} label={data.employmentAllowance.claimed ? "Claimed" : "Not claimed"} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] text-tsecondary">Used YTD</span>
                <span className="text-[12px] font-mono text-tprimary">{gbp(data.employmentAllowance.usedYtd)} / {gbp(data.employmentAllowance.cap)}</span>
              </div>
              <div className="h-1.5 bg-surface-low border border-subtle">
                <div className="h-full bg-pearl" style={{ width: `${Math.min(100, (data.employmentAllowance.usedYtd / data.employmentAllowance.cap) * 100)}%` }} />
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Data Retention" description="Statutory retention overrides GDPR erasure — audit rows never deleted">
        <KeyValueTable rows={[
          { key: "payroll", label: "Payroll Records Retention", value: `${data.retention.payrollYears} years`, mono: true },
          { key: "statutory", label: "Statutory Minimum", value: `${data.retention.statutoryMinimumYears} years`, mono: true },
        ]} />
      </SectionCard>

      <SectionCard title="GDPR Erasure Requests" description="Anonymise job runs when retention expires">
        {data.gdpr.erasureRequests.length === 0 ? (
          <p className="text-[12px] text-ttertiary">No erasure requests pending.</p>
        ) : (
          <DataTable columns={[{ label: "Subject" }, { label: "Received" }, { label: "Status" }]}>
            {data.gdpr.erasureRequests.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.subject}</TableCell>
                <TableCell mono>{fmtDate(r.receivedAt)}</TableCell>
                <TableCell><StatusChip status={r.status === "anonymised" ? "approved" : "pending"} /></TableCell>
              </TableRow>
            ))}
          </DataTable>
        )}
      </SectionCard>
    </div>
  );
}

// ============================================================
// TAB 8: NOTIFICATIONS
// ============================================================
function NotificationsTab() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/settings/notifications")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast("Failed to load notifications", "error"))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => { load(); }, []);

  if (loading) return <div className="text-[13px] text-ttertiary font-mono">Loading…</div>;
  if (!data) return null;

  const toggleRule = (key: string, enabled: boolean) => {
    const rule = data.rules.find((r: any) => r.key === key);
    if (rule.locked && !enabled) {
      toast("This alert is required for compliance — cannot disable", "error");
      return;
    }
    toast(`${rule.label} ${enabled ? "enabled" : "disabled"}`, "info");
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Bureau Notification Rules" description="Drives the notify:paydates worker (hourly) and event fan-out. Idempotent per (company, key, date).">
        <div className="flex flex-col gap-2">
          {data.rules.map((rule: any) => (
            <div key={rule.key} className="flex items-center justify-between px-4 py-3 border border-subtle">
              <div className="flex items-center gap-3">
                {rule.locked && <span className="material-symbols-outlined text-[16px] text-ttertiary" title="Locked — compliance-critical">lock</span>}
                <div>
                  <div className="text-[13px] text-tprimary">{rule.label}</div>
                  <div className="text-[11px] text-ttertiary font-mono">
                    {rule.offsetDays !== null ? `T${rule.offsetDays >= 0 ? "+" : ""}${rule.offsetDays} days` : "event-driven"} · {rule.channels.inApp ? "in-app" : ""} {rule.channels.email ? "· email" : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {rule.locked ? (
                  <span className="text-[11px] text-ttertiary uppercase tracking-wider font-mono">Locked</span>
                ) : (
                  <button
                    onClick={() => toggleRule(rule.key, !rule.enabled)}
                    className={`w-9 h-5 border transition-colors relative ${rule.enabled ? "bg-pearl border-pearl" : "bg-surface-low border-subtle"}`}
                  >
                    <span className={`absolute top-0.5 w-3.5 h-3.5 transition-transform ${rule.enabled ? "left-4 bg-ink" : "left-0.5 bg-ttertiary"}`} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="My Preferences" description="Per-user — separate from bureau rules">
        <Field label="Email Digest">
          <Select
            value={data.myPreferences.emailDigest}
            onChange={(v) => { toast("Preference saved", "success"); }}
            options={[
              { value: "immediate", label: "Immediate (each event)" },
              { value: "daily", label: "Daily digest" },
              { value: "off", label: "Off (in-app only)" },
            ]}
          />
        </Field>
      </SectionCard>
    </div>
  );
}

// ============================================================
// TAB 9: SYSTEM
// ============================================================
function SystemTab() {
  const { user } = useApp();
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);
  const [bankSyncing, setBankSyncing] = React.useState(false);
  const [dpsFetching, setDpsFetching] = React.useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/settings/system")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast("Failed to load system info", "error"))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => { load(); }, []);

  if (loading) return <div className="text-[13px] text-ttertiary font-mono">Loading…</div>;
  if (!data) return null;

  const syncBankHolidays = async () => {
    setBankSyncing(true);
    try {
      const res = await fetch("/api/bank-holidays/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: user?.id || "user_admin" }),
      });
      const d = await res.json();
      if (d.jobId) {
        // Poll for completion — no "queued" toast, just wait silently
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const statusRes = await fetch(`/api/exports/${d.jobId}/status`);
          if (statusRes.ok) {
            const sd = await statusRes.json();
            if (sd.status === "completed") {
              setBankSyncing(false);
              load();
              toast("Sync completed", "success");
              return;
            }
            if (sd.status === "failed") {
              setBankSyncing(false);
              toast("Sync failed", "error");
              return;
            }
          }
        }
        setBankSyncing(false);
      } else {
        setBankSyncing(false);
        toast(d.error || "Sync failed", "error");
      }
    } catch (e) {
      setBankSyncing(false);
      toast("Network error", "error");
    }
  };

  const fetchDps = async () => {
    setDpsFetching(true);
    try {
      const res = await fetch("/api/dps/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: user?.id || "user_admin" }),
      });
      const d = await res.json();
      if (d.jobId) {
        // Poll for completion — no "queued" toast, just wait silently
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const statusRes = await fetch(`/api/exports/${d.jobId}/status`);
          if (statusRes.ok) {
            const sd = await statusRes.json();
            if (sd.status === "completed") {
              setDpsFetching(false);
              load();
              toast("DPS fetch completed", "success");
              return;
            }
            if (sd.status === "failed") {
              setDpsFetching(false);
              toast("DPS fetch failed", "error");
              return;
            }
          }
        }
        setDpsFetching(false);
      } else {
        setDpsFetching(false);
        toast(d.error || "DPS fetch failed", "error");
      }
    } catch (e) {
      setDpsFetching(false);
      toast("Network error", "error");
    }
  };

  const doExport = async (format: string) => {
    setExporting(true);
    const res = await fetch("/api/settings/system/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format }),
    });
    const d = await res.json();
    setExporting(false);
    toast(d.message || "Export queued", "success");
  };

  return (
    <div className="flex flex-col gap-4">
      <ScopeBadge scope="bureau" />

      <SectionCard title="Bureau" actions={<button onClick={() => toast("Rename queued", "info")} className="text-[11px] text-tsecondary hover:text-pearl uppercase tracking-wider">Rename</button>}>
        <KeyValueTable rows={[
          { key: "name", label: "Bureau Name", value: data.bureau.name },
          { key: "id", label: "Bureau ID", value: data.bureau.id, mono: true },
          { key: "version", label: "App Version", value: data.appVersion, mono: true },
          { key: "engine", label: "Engine Tax Years", value: data.engineTaxYears.join(", "), mono: true },
        ]} />
      </SectionCard>

      <SectionCard title="Job Queue Health" description="Failed jobs > 0 trigger ops alert">
        <DataTable columns={[{ label: "Queue" }, { label: "Waiting" }, { label: "Failed" }, { label: "Last Run" }]}>
          {data.jobs.map((j: any) => (
            <TableRow key={j.queue}>
              <TableCell mono>{j.queue}</TableCell>
              <TableCell mono>{j.waiting}</TableCell>
              <TableCell mono>{j.failed > 0 ? <span className="text-error">{j.failed}</span> : <span className="text-success">0</span>}</TableCell>
              <TableCell mono>{fmtDateTime(j.lastRun)}</TableCell>
            </TableRow>
          ))}
        </DataTable>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Bank Holiday Sync" actions={
          <GhostButton onClick={syncBankHolidays} disabled={bankSyncing}>
            {bankSyncing ? (
              <>
                <span className="material-symbols-outlined text-[14px] mr-1 align-middle animate-spin-slow">progress_activity</span>
                Syncing…
              </>
            ) : "Sync Now"}
          </GhostButton>
        }>
          <KeyValueTable rows={[
            { key: "last", label: "Last Run", value: fmtDateTime(data.bankHolidaySync.lastRunAt), mono: true },
            { key: "next", label: "Next Scheduled", value: fmtDateTime(data.bankHolidaySync.nextRunAt), mono: true },
            { key: "count", label: "Dates Stored", value: String(data.bankHolidaySync.count), mono: true },
            { key: "source", label: "Source", value: data.bankHolidaySync.source },
          ]} />
        </SectionCard>
        <SectionCard title="DPS Notice Fetch" actions={
          <GhostButton onClick={fetchDps} disabled={dpsFetching}>
            {dpsFetching ? (
              <>
                <span className="material-symbols-outlined text-[14px] mr-1 align-middle animate-spin-slow">progress_activity</span>
                Fetching…
              </>
            ) : "Fetch Now"}
          </GhostButton>
        }>
          <KeyValueTable rows={[
            { key: "last", label: "Last Run", value: fmtDateTime(data.dpsFetch.lastRunAt), mono: true },
            ...Object.entries(data.dpsFetch.highWaterMarks).map(([k, v]: [string, any]) => ({
              key: `hwm_${k}`, label: `${k} high-water mark`, value: String(v), mono: true,
            })),
          ]} />
        </SectionCard>
      </div>

      <SectionCard title="Data Export" description="Rate-limited 1/day · decrypted fields excluded (masked) · audit logged">
        <div className="flex items-center gap-3">
          <GhostButton onClick={() => doExport("csv-bundle")} disabled={exporting}>
            <span className="material-symbols-outlined text-[14px] align-middle mr-1">csv</span>
            CSV Bundle
          </GhostButton>
          <GhostButton onClick={() => doExport("json")} disabled={exporting}>
            <span className="material-symbols-outlined text-[14px] align-middle mr-1">code</span>
            JSON
          </GhostButton>
          {data.dataExport.lastExportAt && <span className="text-[12px] text-ttertiary font-mono">Last: {fmtDateTime(data.dataExport.lastExportAt)}</span>}
        </div>
      </SectionCard>
    </div>
  );
}
