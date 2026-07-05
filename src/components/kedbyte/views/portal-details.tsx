"use client";

import * as React from "react";
import { useApp, fmtDate } from "@/store/app";
import {
  PearlButton,
  GhostButton,
  EmptyState,
  Field,
  TextInput,
  Modal,
  toast,
} from "@/components/kedbyte/primitives";
import { maskNINO, validateSortCode, validateAccount } from "@/engine/payroll";
import { cn } from "@/lib/utils";

interface EmployeeDetails {
  id?: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  emergencyContact: string | null;
  addressLine1: string | null;
  addressCity: string | null;
  addressPostcode: string | null;
  bankSortCode: string | null;
  bankAccount: string | null;
  bankAccountName: string | null;
  nino: string | null;
  dob: string | null;
  department: string | null;
  jobTitle: string | null;
}

function maskSortCode(sc?: string | null): string {
  if (!sc) return "—";
  const cleaned = sc.replace(/[-\s]/g, "");
  if (cleaned.length < 6) return "—";
  return `••-••-${cleaned.slice(4, 6)}`;
}

function maskAccount(acc?: string | null): string {
  if (!acc) return "—";
  const digits = acc.replace(/\s/g, "");
  if (digits.length < 4) return "••••";
  return `••••${digits.slice(-4)}`;
}

function SectionCard({ title, icon, children, action }: { title: string; icon: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-surface border border-subtle p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-pearl">{icon}</span>
          <h2 className="section-title text-tprimary">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ReadOnlyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-subtle last:border-b-0">
      <span className="text-[12px] text-tsecondary">{label}</span>
      <span className={cn("text-[13px] text-tprimary", mono && "font-mono")}>{value}</span>
    </div>
  );
}

export function PortalDetails() {
  const { user } = useApp();
  const [emp, setEmp] = React.useState<EmployeeDetails | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Editable fields
  const [addressLine1, setAddressLine1] = React.useState("");
  const [addressCity, setAddressCity] = React.useState("");
  const [addressPostcode, setAddressPostcode] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [emergencyContact, setEmergencyContact] = React.useState("");
  const [dirty, setDirty] = React.useState(false);

  // Bank change modal
  const [bankModal, setBankModal] = React.useState(false);
  const [bankSort, setBankSort] = React.useState("");
  const [bankAcc, setBankAcc] = React.useState("");
  const [bankName, setBankName] = React.useState("");
  const [bankSubmitting, setBankSubmitting] = React.useState(false);

  // Cooling-off banner
  const [coolingOff, setCoolingOff] = React.useState<{ activatesAt: string } | null>(null);
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    if (!coolingOff) return;
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [coolingOff]);

  const load = React.useCallback(() => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/ess/details?userId=${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        const e = d.employee;
        setEmp(e);
        setAddressLine1(e.addressLine1 || "");
        setAddressCity(e.addressCity || "");
        setAddressPostcode(e.addressPostcode || "");
        setPhone(e.phone || "");
        setEmergencyContact(e.emergencyContact || "");
        setDirty(false);
      })
      .catch(() => toast("Failed to load details", "error"))
      .finally(() => setLoading(false));
  }, [user]);

  React.useEffect(() => {
    load();
  }, [load]);

  const onChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setDirty(true);
  };

  const saveFields = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ess/details", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          fields: {
            addressLine1,
            addressCity,
            addressPostcode,
            phone,
            emergencyContact,
          },
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      toast("Details updated", "success");
      setDirty(false);
      load();
    } catch (e: any) {
      toast(e.message || "Failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const submitBankChange = async () => {
    if (!user) return;
    if (!validateSortCode(bankSort)) {
      toast("Sort code must be 6 digits", "error");
      return;
    }
    if (!validateAccount(bankAcc)) {
      toast("Account number must be 6–8 digits", "error");
      return;
    }
    if (!bankName.trim()) {
      toast("Account name required", "error");
      return;
    }
    setBankSubmitting(true);
    try {
      const res = await fetch("/api/ess/details", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          bankChange: {
            sortCode: bankSort.replace(/[-\s]/g, ""),
            account: bankAcc.replace(/\s/g, ""),
            name: bankName.trim(),
          },
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      if (d.coolingOff) {
        setCoolingOff({ activatesAt: d.activatesAt });
        toast("Bank change scheduled · activates in 24h", "info");
      } else {
        toast("Bank details updated", "success");
      }
      setBankModal(false);
      setBankSort("");
      setBankAcc("");
      setBankName("");
      load();
    } catch (e: any) {
      toast(e.message || "Failed", "error");
    } finally {
      setBankSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-8 bg-surface-high animate-pulse" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-surface border border-subtle p-5 h-40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!emp) {
    return (
      <div className="bg-surface border border-subtle">
        <EmptyState icon="error" title="Could not load your details." action={load} actionLabel="Retry" />
      </div>
    );
  }

  const coolingMs = coolingOff ? new Date(coolingOff.activatesAt).getTime() - now : 0;
  const coolingHours = Math.max(0, Math.floor(coolingMs / (60 * 60 * 1000)));
  const coolingMins = Math.max(0, Math.floor((coolingMs % (60 * 60 * 1000)) / (60 * 1000)));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title text-tprimary">Personal Details</h1>
        <p className="text-[13px] text-tsecondary mt-1">Keep your contact and bank details up to date.</p>
      </div>

      {/* Bank cooling-off banner */}
      {coolingOff && coolingMs > 0 && (
        <div className="bg-surface border border-warning/40 p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-[20px] text-warning shrink-0">schedule</span>
          <div className="flex-1">
            <div className="text-[13px] text-tprimary font-medium">Bank change scheduled · activates in 24h</div>
            <div className="text-[11px] text-tsecondary font-mono mt-1">
              Activates in {coolingHours}h {coolingMins}m · {fmtDate(coolingOff.activatesAt)}
            </div>
            <div className="text-[11px] text-ttertiary mt-2">
              Both you and the bureau admin have been notified. The change will apply automatically once the cooling-off period ends.
            </div>
          </div>
          <button
            onClick={() => setCoolingOff(null)}
            className="text-ttertiary hover:text-tprimary transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Bank details with cooling-off warning */}
      <SectionCard title="Bank Details" icon="account_balance">
        <div className="bg-surface-low border border-warning/30 p-3 flex items-start gap-2">
          <span className="material-symbols-outlined text-[16px] text-warning shrink-0 mt-0.5">warning</span>
          <p className="text-[11px] text-tsecondary leading-relaxed">
            For security, bank detail changes are subject to a <span className="text-warning">24-hour cooling-off period</span>. Both you and the bureau admin will be notified.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Sort Code">
            <div className="px-3 py-2 bg-surface-low border border-subtle text-[13px] font-mono text-tprimary">
              {maskSortCode(emp.bankSortCode)}
            </div>
          </Field>
          <Field label="Account Number">
            <div className="px-3 py-2 bg-surface-low border border-subtle text-[13px] font-mono text-tprimary">
              {maskAccount(emp.bankAccount)}
            </div>
          </Field>
          <Field label="Account Name">
            <div className="px-3 py-2 bg-surface-low border border-subtle text-[13px] text-tprimary truncate">
              {emp.bankAccountName || "—"}
            </div>
          </Field>
        </div>
        <GhostButton onClick={() => setBankModal(true)}>
          <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">edit</span>
          Update Bank Details
        </GhostButton>
      </SectionCard>

      {/* Editable: Address + Contact */}
      <SectionCard
        title="Contact & Address"
        icon="contact_mail"
        action={
          dirty ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-warning font-mono">Unsaved changes</span>
              <PearlButton onClick={saveFields} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </PearlButton>
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <div className="label-caps text-ttertiary mb-2">Address</div>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Address Line 1">
                <TextInput value={addressLine1} onChange={onChange(setAddressLine1)} placeholder="123 High Street" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <TextInput value={addressCity} onChange={onChange(setAddressCity)} placeholder="London" />
                </Field>
                <Field label="Postcode">
                  <TextInput value={addressPostcode} onChange={onChange(setAddressPostcode)} placeholder="SW1A 1AA" mono />
                </Field>
              </div>
            </div>
          </div>
          <div>
            <div className="label-caps text-ttertiary mb-2">Contact</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Phone">
                <TextInput value={phone} onChange={onChange(setPhone)} placeholder="07700 900000" />
              </Field>
              <Field label="Emergency Contact">
                <TextInput value={emergencyContact} onChange={onChange(setEmergencyContact)} placeholder="Name & phone" />
              </Field>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Read-only: Identity & Employment */}
      <SectionCard title="Identity & Employment" icon="badge">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <ReadOnlyRow label="Full Name" value={`${emp.firstName} ${emp.lastName}`} />
          <ReadOnlyRow label="Date of Birth" value={emp.dob ? fmtDate(emp.dob) : "—"} mono />
          <ReadOnlyRow label="National Insurance No." value={maskNINO(emp.nino)} mono />
          <ReadOnlyRow label="Email" value={emp.email || "—"} mono />
          <ReadOnlyRow label="Department" value={emp.department || "—"} />
          <ReadOnlyRow label="Job Title" value={emp.jobTitle || "—"} />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <span className="material-symbols-outlined text-[14px] text-ttertiary">lock</span>
          <p className="text-[11px] text-ttertiary">
            RTI-sensitive fields (name, DOB, NI number) require admin approval to change.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GhostButton onClick={() => toast("RTI-sensitive field change requires admin approval", "info")}>
            Request Name Change
          </GhostButton>
          <GhostButton onClick={() => toast("RTI-sensitive field change requires admin approval", "info")}>
            Request DOB Change
          </GhostButton>
          <GhostButton onClick={() => toast("RTI-sensitive field change requires admin approval", "info")}>
            Request NINO Change
          </GhostButton>
        </div>
      </SectionCard>

      {/* Bank change modal */}
      <Modal open={bankModal} onClose={() => setBankModal(false)} title="Update Bank Details">
        <div className="flex flex-col gap-4">
          <div className="bg-surface-low border border-warning/30 p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] text-warning shrink-0 mt-0.5">warning</span>
            <p className="text-[11px] text-tsecondary leading-relaxed">
              This change will be held for a 24-hour cooling-off period before taking effect. Both you and the bureau admin will be notified.
            </p>
          </div>
          <Field label="New Sort Code" hint="6 digits, e.g. 200415">
            <TextInput
              value={bankSort}
              onChange={(v) => setBankSort(v.replace(/[^0-9-]/g, ""))}
              placeholder="200415"
              mono
            />
          </Field>
          <Field label="New Account Number" hint="6–8 digits">
            <TextInput
              value={bankAcc}
              onChange={(v) => setBankAcc(v.replace(/[^0-9]/g, ""))}
              placeholder="12345678"
              mono
            />
          </Field>
          <Field label="Account Name">
            <TextInput
              value={bankName}
              onChange={setBankName}
              placeholder="MR J SMITH"
            />
          </Field>
          <div className="flex gap-2 pt-1">
            <GhostButton onClick={() => setBankModal(false)} className="flex-1">Cancel</GhostButton>
            <PearlButton onClick={submitBankChange} disabled={bankSubmitting} className="flex-1">
              {bankSubmitting ? "Submitting…" : "Schedule Change"}
            </PearlButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
