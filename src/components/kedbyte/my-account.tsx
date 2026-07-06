"use client";

import * as React from "react";
import { useApp, fmtDateTime } from "@/store/app";
import { Modal, PearlButton, GhostButton, Field, TextInput, Select, toast, StatusChip } from "@/components/kedbyte/primitives";

// ============================================================
// MY ACCOUNT — modal accessible from both bureau + portal shells
// Sections: Password · MFA · Sessions · Email preferences
// ============================================================

export function MyAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useApp();
  const [tab, setTab] = React.useState<"password" | "mfa" | "sessions" | "preferences">("password");

  return (
    <Modal open={open} onClose={onClose} title="My Account" wide>
      <div className="flex flex-col gap-6">
        {/* User header */}
        <div className="flex items-center gap-4 pb-4 border-b border-subtle">
          <div className="w-12 h-12 bg-surface-high border border-subtle flex items-center justify-center">
            <span className="text-[18px] font-mono font-bold text-pearl">{user?.name?.[0]?.toUpperCase() || "U"}</span>
          </div>
          <div>
            <div className="text-[15px] text-tprimary font-semibold">{user?.name}</div>
            <div className="text-[12px] text-ttertiary font-mono">{user?.email}</div>
            <div className="text-[11px] text-tsecondary mt-1">{user?.role?.replace(/_/g, " ")} · {user?.surface === "bureau" ? "Bureau Portal" : "Employee Portal"}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-subtle">
          {[
            { id: "password", label: "Password", icon: "key" },
            { id: "mfa", label: "MFA", icon: "lock" },
            { id: "sessions", label: "Sessions", icon: "devices" },
            { id: "preferences", label: "Preferences", icon: "tune" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors flex items-center gap-2 ${
                tab === t.id ? "border-pearl text-pearl" : "border-transparent text-tsecondary hover:text-tprimary"
              }`}
              style={tab === t.id ? { borderColor: "var(--accent-pearl)" } : {}}
            >
              <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "password" && <ChangePasswordTab userId={user?.id || ""} onDone={onClose} />}
        {tab === "mfa" && <MfaTab userId={user?.id || ""} />}
        {tab === "sessions" && <SessionsTab userId={user?.id || ""} onLogoutOthers={() => { logout(); onClose(); }} />}
        {tab === "preferences" && <PreferencesTab userId={user?.id || ""} />}
      </div>
    </Modal>
  );
}

// ============ PASSWORD TAB ============
function ChangePasswordTab({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [current, setCurrent] = React.useState("");
  const [newPass, setNewPass] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);

  // Strength meter
  const strength = React.useMemo(() => {
    if (!newPass) return 0;
    let s = 0;
    if (newPass.length >= 12) s += 25;
    if (newPass.length >= 16) s += 15;
    if (/[A-Z]/.test(newPass) && /[a-z]/.test(newPass)) s += 20;
    if (/\d/.test(newPass)) s += 20;
    if (/[^A-Za-z0-9]/.test(newPass)) s += 20;
    return Math.min(100, s);
  }, [newPass]);

  const strengthLabel = strength < 40 ? "Weak" : strength < 70 ? "Fair" : strength < 90 ? "Strong" : "Vault-grade";
  const strengthColor = strength < 40 ? "text-error" : strength < 70 ? "text-warning" : "text-success";

  const save = async () => {
    setError("");
    if (!current) { setError("Current password required"); return; }
    if (newPass.length < 12) { setError("New password must be at least 12 characters"); return; }
    if (newPass !== confirm) { setError("Passwords do not match"); return; }
    setSaving(true);
    const res = await fetch("/api/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, currentPassword: current, newPassword: newPass }),
    });
    const d = await res.json();
    setSaving(false);
    if (res.ok) {
      toast("Password changed — other sessions revoked", "success");
      setCurrent(""); setNewPass(""); setConfirm("");
      onDone();
    } else {
      setError(d.error || "Failed");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-subtle bg-surface-low px-4 py-3 flex items-center gap-3">
        <span className="material-symbols-outlined text-[16px] text-warning">info</span>
        <p className="text-[12px] text-tsecondary">Password policy: minimum 12 characters, checked against breach list (HIBP k-anonymity). No forced composition rules per NIST 800-63B.</p>
      </div>
      {error && <div className="border border-subtle bg-surface-low px-3 py-2 text-[12px] text-error">{error}</div>}
      <Field label="Current Password">
        <div className="relative">
          <TextInput value={current} onChange={setCurrent} type={showCurrent ? "text" : "password"} placeholder="••••••••" className="w-full pr-10" />
          <button onClick={() => setShowCurrent(!showCurrent)} className="absolute right-2 top-1/2 -translate-y-1/2 text-ttertiary hover:text-pearl">
            <span className="material-symbols-outlined text-[16px]">{showCurrent ? "visibility_off" : "visibility"}</span>
          </button>
        </div>
      </Field>
      <Field label="New Password" hint="Min 12 characters">
        <div className="relative">
          <TextInput value={newPass} onChange={setNewPass} type={showNew ? "text" : "password"} placeholder="••••••••" className="w-full pr-10" />
          <button onClick={() => setShowNew(!showNew)} className="absolute right-2 top-1/2 -translate-y-1/2 text-ttertiary hover:text-pearl">
            <span className="material-symbols-outlined text-[16px]">{showNew ? "visibility_off" : "visibility"}</span>
          </button>
        </div>
      </Field>
      {/* Strength meter */}
      {newPass && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-surface-low border border-subtle">
            <div className={`h-full transition-all ${strength < 40 ? "bg-error" : strength < 70 ? "bg-warning" : "bg-success"}`} style={{ width: `${strength}%` }} />
          </div>
          <span className={`text-[11px] font-mono uppercase tracking-wider ${strengthColor}`}>{strengthLabel}</span>
        </div>
      )}
      <Field label="Confirm New Password">
        <TextInput value={confirm} onChange={setConfirm} type="password" placeholder="••••••••" />
      </Field>
      <div className="flex justify-end gap-3 pt-2 border-t border-subtle">
        <GhostButton onClick={onDone}>Cancel</GhostButton>
        <PearlButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Change Password"}</PearlButton>
      </div>
    </div>
  );
}

// ============ MFA TAB ============
function MfaTab({ userId }: { userId: string }) {
  const [enabled, setEnabled] = React.useState(false);
  const [step, setStep] = React.useState<"overview" | "enrolling" | "backup">("overview");
  const [code, setCode] = React.useState("");
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);

  const startEnrol = () => {
    setStep("enrolling");
    // Generate fake backup codes
    setBackupCodes(Array.from({ length: 10 }, () => Math.random().toString(36).slice(2, 10).toUpperCase()));
  };

  const verifyEnrol = () => {
    if (code.length !== 6) { toast("Enter the 6-digit code", "error"); return; }
    setEnabled(true);
    setStep("backup");
    toast("MFA enabled — save your backup codes", "success");
  };

  const disable = async () => {
    setEnabled(false);
    setStep("overview");
    toast("MFA disabled", "info");
  };

  if (step === "enrolling") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-tsecondary">Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password), then enter the 6-digit code.</p>
        {/* Fake QR code */}
        <div className="flex justify-center">
          <div className="w-48 h-48 bg-tprimary grid grid-cols-8 grid-rows-8 gap-0.5 p-3">
            {Array.from({ length: 64 }, (_, i) => (
              <div key={i} className={Math.random() > 0.5 ? "bg-void" : "bg-tprimary"} />
            ))}
          </div>
        </div>
        <Field label="6-digit verification code">
          <TextInput value={code} onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} placeholder="000000" mono className="text-center text-[20px] tracking-[0.5em]" />
        </Field>
        <div className="flex justify-end gap-3">
          <GhostButton onClick={() => setStep("overview")}>Cancel</GhostButton>
          <PearlButton onClick={verifyEnrol}>Verify & Enable</PearlButton>
        </div>
      </div>
    );
  }

  if (step === "backup") {
    return (
      <div className="flex flex-col gap-4">
        <div className="border border-subtle bg-surface-low px-4 py-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-[16px] text-warning">warning</span>
          <p className="text-[12px] text-tsecondary">Save these 10 backup codes in a secure location. Each can be used once if you lose your authenticator device.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {backupCodes.map((c, i) => (
            <div key={i} className="px-3 py-2 border border-subtle bg-surface-low text-center">
              <span className="font-mono text-[14px] text-pearl">{c}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-subtle">
          <PearlButton onClick={() => setStep("overview")}>I've saved them</PearlButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-4 py-3 border border-subtle">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-tsecondary">lock</span>
          <div>
            <div className="text-[13px] text-tprimary font-medium">TOTP Authenticator</div>
            <div className="text-[11px] text-ttertiary">Time-based one-time passwords</div>
          </div>
        </div>
        {enabled ? <StatusChip status="active" label="Enabled" /> : <StatusChip status="suspended" label="Off" />}
      </div>
      {!enabled ? (
        <PearlButton onClick={startEnrol}>
          <span className="material-symbols-outlined text-[14px] align-middle mr-1">qr_code_scanner</span>
          Set up MFA
        </PearlButton>
      ) : (
        <div className="flex gap-3">
          <GhostButton onClick={() => toast("New backup codes generated", "info")}>Regenerate backup codes</GhostButton>
          <GhostButton onClick={disable}>Disable MFA</GhostButton>
        </div>
      )}
    </div>
  );
}

// ============ SESSIONS TAB ============
function SessionsTab({ userId, onLogoutOthers }: { userId: string; onLogoutOthers: () => void }) {
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/account/sessions?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const revokeOthers = async () => {
    await fetch("/api/account/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, revokeAll: true }),
    });
    toast("All other sessions revoked", "success");
    onLogoutOthers();
  };

  if (loading) return <div className="text-[13px] text-ttertiary font-mono">Loading…</div>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-tsecondary">Active sessions across your devices. Revoke any you don't recognize.</p>
      <div className="border border-subtle">
        {sessions.map((s, i) => (
          <div key={s.id} className={`flex items-center justify-between px-4 py-3 ${i < sessions.length - 1 ? "border-b border-subtle" : ""}`}>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[18px] text-tsecondary">{s.device.includes("iOS") ? "phone_iphone" : s.device.includes("Windows") ? "laptop_windows" : "laptop_mac"}</span>
              <div>
                <div className="text-[13px] text-tprimary">{s.device} {s.current && <span className="ml-2 text-[10px] text-success uppercase tracking-wider font-mono">Current</span>}</div>
                <div className="text-[11px] text-ttertiary font-mono">{s.ip} · {fmtDateTime(s.lastSeen)}</div>
              </div>
            </div>
            {!s.current && (
              <button onClick={() => toast("Session revoked", "success")} className="text-[11px] text-error hover:text-pearl uppercase tracking-wider">Revoke</button>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-2 border-t border-subtle">
        <GhostButton onClick={revokeOthers}>
          <span className="material-symbols-outlined text-[14px] align-middle mr-1">logout</span>
          Revoke all other sessions
        </GhostButton>
      </div>
    </div>
  );
}

// ============ PREFERENCES TAB ============
function PreferencesTab({ userId }: { userId: string }) {
  const [digest, setDigest] = React.useState("immediate");
  const [emailNotifications, setEmailNotifications] = React.useState(true);

  const save = () => {
    toast("Preferences saved", "success");
  };

  return (
    <div className="flex flex-col gap-4">
      <Field label="Email Digest">
        <Select value={digest} onChange={setDigest} options={[
          { value: "immediate", label: "Immediate (each event)" },
          { value: "daily", label: "Daily digest" },
          { value: "off", label: "Off (in-app only)" },
        ]} />
      </Field>
      <div className="flex items-center gap-3 px-4 py-3 border border-subtle">
        <input type="checkbox" id="emailNotif" checked={emailNotifications} onChange={(e) => setEmailNotifications(e.target.checked)} className="accent-pearl" />
        <label htmlFor="emailNotif" className="text-[13px] text-tprimary">Email notifications for critical events (RTI rejected, bank changes, MFA resets)</label>
      </div>
      <div className="flex justify-end pt-2 border-t border-subtle">
        <PearlButton onClick={save}>Save Preferences</PearlButton>
      </div>
    </div>
  );
}
