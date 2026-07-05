"use client";

import * as React from "react";
import { useApp } from "@/store/app";
import { PearlButton, GhostButton, Field, TextInput, toast } from "@/components/kedbyte/primitives";
import { validateNINO } from "@/engine/payroll";

export function LoginScreen() {
  const { login } = useApp();
  const [surface, setSurface] = React.useState<"bureau" | "portal">("bureau");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleLogin = async () => {
    setError("");
    if (!email || !password) {
      setError("Email and password required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, surface }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }
      toast(`Welcome back, ${data.user.name}`, "success");
      login(data.user);
    } catch (e) {
      setError("Network error");
      setLoading(false);
    }
  };

  const fillDemo = (acct: string) => {
    setEmail(acct);
    setPassword("demo1234");
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-void">
      {/* Left brand panel */}
      <div className="lg:flex-1 flex flex-col justify-between p-8 lg:p-16 lg:min-h-screen border-b lg:border-b-0 lg:border-r border-subtle">
        <div className="flex items-center gap-3">
          <span className="label-caps text-pearl tracking-[0.3em] text-[14px]">KEDBYTE</span>
          <span className="text-ttertiary text-[12px] font-mono">PAYROLL</span>
        </div>
        <div className="hidden lg:block py-20">
          <h1 className="text-[40px] leading-[1.1] font-semibold text-tprimary tracking-tight max-w-md">
            The system is not perceived as fast.
            <br />
            <span className="text-tsecondary">It is perceived as present.</span>
          </h1>
          <p className="mt-6 text-tsecondary text-[15px] max-w-md leading-relaxed">
            Multi-tenant UK payroll bureau platform with HMRC RTI compliance built in as a first-class workflow.
            2026/27 statutory engine. Every penny verified.
          </p>
          <div className="mt-10 flex gap-8">
            <div>
              <div className="data-sm text-pearl">31</div>
              <div className="label-caps text-ttertiary">Screens</div>
            </div>
            <div>
              <div className="data-sm text-pearl">2026/27</div>
              <div className="label-caps text-ttertiary">Tax Year</div>
            </div>
            <div>
              <div className="data-sm text-pearl">£0.01</div>
              <div className="label-caps text-ttertiary">Precision</div>
            </div>
          </div>
        </div>
        <div className="text-[11px] text-ttertiary font-mono">
          Bureau ID: bureau_kedbyte · Tax Year 2026/27 · Engine v2.0 FINAL LOCK
        </div>
      </div>

      {/* Right login panel */}
      <div className="lg:w-[440px] flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-[340px]">
          {/* Surface toggle */}
          <div className="flex border border-subtle mb-8">
            <button
              onClick={() => setSurface("bureau")}
              className={`flex-1 py-2.5 text-[12px] font-medium uppercase tracking-wider transition-colors ${
                surface === "bureau" ? "bg-pearl text-ink" : "text-tsecondary hover:text-tprimary"
              }`}
            >
              Bureau Portal
            </button>
            <button
              onClick={() => setSurface("portal")}
              className={`flex-1 py-2.5 text-[12px] font-medium uppercase tracking-wider transition-colors ${
                surface === "portal" ? "bg-pearl text-ink" : "text-tsecondary hover:text-tprimary"
              }`}
            >
              Employee Portal
            </button>
          </div>

          <h2 className="page-title text-tprimary mb-1">
            {surface === "bureau" ? "Bureau Login" : "My Pay Login"}
          </h2>
          <p className="text-[13px] text-tsecondary mb-8">
            {surface === "bureau"
              ? "Payroll professionals only."
              : "Access your payslips, holidays and documents."}
          </p>

          <div className="flex flex-col gap-4">
            <Field label="Email">
              <TextInput
                value={email}
                onChange={setEmail}
                placeholder={surface === "bureau" ? "admin@kedbyte.co.uk" : "eleanor@smithco.co.uk"}
                type="email"
              />
            </Field>
            <Field label="Password">
              <TextInput value={password} onChange={setPassword} placeholder="••••••••" type="password" />
            </Field>

            {error && <p className="text-[12px] text-error">{error}</p>}

            <PearlButton onClick={handleLogin} disabled={loading} className="mt-2">
              {loading ? "Signing in…" : "Sign In"}
            </PearlButton>
          </div>

          {/* Demo accounts */}
          <div className="mt-10 pt-6 border-t border-subtle">
            <p className="label-caps text-ttertiary mb-3">Demo Accounts</p>
            <div className="flex flex-col gap-2">
              {surface === "bureau" ? (
                <>
                  <DemoAccount label="Bureau Admin" email="admin@kedbyte.co.uk" onClick={() => fillDemo("admin@kedbyte.co.uk")} />
                  <DemoAccount label="Company Admin (Smith & Co)" email="admin@smithco.co.uk" onClick={() => fillDemo("admin@smithco.co.uk")} />
                </>
              ) : (
                <>
                  <DemoAccount label="Employee (Eleanor — Manager)" email="eleanor@smithco.co.uk" onClick={() => fillDemo("eleanor@smithco.co.uk")} />
                  <DemoAccount label="Employee (James)" email="james@smithco.co.uk" onClick={() => fillDemo("james@smithco.co.uk")} />
                  <DemoAccount label="Employee (Priya — Acme)" email="priya@acme.io" onClick={() => fillDemo("priya@acme.io")} />
                </>
              )}
            </div>
            <p className="text-[11px] text-ttertiary mt-4 font-mono">Any password works in demo mode.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoAccount({ label, email, onClick }: { label: string; email: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between px-3 py-2 border border-subtle hover:border-pearl-dim hover:bg-surface transition-colors text-left group"
    >
      <div>
        <div className="text-[12px] text-tprimary font-medium">{label}</div>
        <div className="text-[11px] text-ttertiary font-mono">{email}</div>
      </div>
      <span className="material-symbols-outlined text-[16px] text-ttertiary group-hover:text-pearl transition-colors">arrow_forward</span>
    </button>
  );
}
