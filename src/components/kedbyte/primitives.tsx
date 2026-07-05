"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ============ STATUS CHIP ============
const STATUS_STYLES: Record<string, string> = {
  active: "chip-active",
  approved: "chip-approved",
  accepted: "chip-active",
  enrolled: "chip-active",
  eligible: "chip-active",
  pending: "chip-pending",
  polling: "chip-pending",
  calculating: "chip-pending",
  calculating_approved: "chip-pending",
  review: "chip-pending",
  draft: "chip-suspended",
  not_assessed: "chip-suspended",
  entitled: "chip-suspended",
  rejected: "chip-rejected",
  error: "chip-rejected",
  overdue: "chip-rejected",
  opted_out: "chip-rejected",
  suspended: "chip-suspended",
  leaver: "chip-suspended",
  committed: "chip-active",
  submitted: "chip-pending",
  warn: "chip-pending",
};

export function StatusChip({ status, label }: { status: string; label?: string }) {
  const cls = STATUS_STYLES[status?.toLowerCase()] || "chip-suspended";
  return (
    <span className={cn("inline-flex items-center border px-2 py-0.5 text-[11px] font-mono font-medium uppercase tracking-wider", cls)}>
      {label || status}
    </span>
  );
}

// ============ STAT CARD ============
export function StatCard({
  label,
  value,
  delta,
  deltaDirection,
  sublabel,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  sublabel?: string;
  icon?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-surface border border-subtle p-5 flex flex-col gap-2",
        onClick && "cursor-pointer hover:bg-surface-high transition-colors"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="label-caps text-tsecondary">{label}</span>
        {icon && <span className="material-symbols-outlined text-[18px] text-ttertiary">{icon}</span>}
      </div>
      <span className="data-lg text-tprimary">{value}</span>
      <div className="flex items-center gap-2">
        {delta && (
          <span
            className={cn(
              "text-[12px] font-mono",
              deltaDirection === "up" && "text-success",
              deltaDirection === "down" && "text-error",
              deltaDirection === "neutral" && "text-tsecondary"
            )}
          >
            {delta}
          </span>
        )}
        {sublabel && <span className="text-[12px] text-tsecondary">{sublabel}</span>}
      </div>
    </div>
  );
}

// ============ STEPPER (4-node pay run wizard) ============
export function Stepper({ steps, current }: { steps: { label: string; icon: string }[]; current: number }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-7 h-7 border flex items-center justify-center",
                  done && "border-pearl bg-pearl text-ink",
                  active && "border-pearl text-pearl",
                  !done && !active && "border-subtle text-ttertiary"
                )}
              >
                {done ? (
                  <span className="material-symbols-outlined text-[16px]">check</span>
                ) : (
                  <span className="text-[12px] font-mono font-bold">{i + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-[13px] font-medium",
                  active ? "text-tprimary" : done ? "text-tsecondary" : "text-ttertiary"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("flex-1 h-px min-w-[24px]", done ? "bg-pearl/40" : "bg-border-subtle")} style={{ backgroundColor: done ? "rgba(232,228,224,0.4)" : "rgba(245,245,245,0.06)" }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ============ TERMINAL LOG (signature element) ============
export function TerminalLog({ lines, running }: { lines: { ts: string; text: string; level: string }[]; running?: boolean }) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  const colorFor = (level: string) => {
    if (level === "ok") return "text-success";
    if (level === "warn") return "text-warning";
    if (level === "error") return "text-error";
    return "text-tprimary";
  };

  return (
    <div className="bg-surface-low border border-subtle flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-subtle">
        <span className="label-caps text-tsecondary">Calculation Engine Log</span>
        {running && (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-warning uppercase tracking-wider">
            <span className="w-1.5 h-1.5 bg-warning animate-pulse" />
            Running
          </span>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin p-4 font-mono text-[12px] leading-relaxed">
        {lines.length === 0 && (
          <div className="text-ttertiary">
            <span className="text-success">●</span> Engine idle — awaiting calculation trigger…
          </div>
        )}
        {lines.map((line, i) => (
          <div key={i} className={cn("log-in flex gap-3", colorFor(line.level))}>
            <span className="text-ttertiary shrink-0">{line.ts}</span>
            <span className="whitespace-pre-wrap break-all">{line.text}</span>
          </div>
        ))}
        {running && (
          <div className="text-pearl mt-1">
            <span className="caret-blink">▊</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ EMPTY STATE ============
export function EmptyState({ icon, title, action, actionLabel }: { icon: string; title: string; action?: () => void; actionLabel?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <span className="material-symbols-outlined text-[48px] text-ttertiary mb-4">{icon}</span>
      <p className="text-tsecondary text-[15px] mb-6 max-w-sm">{title}</p>
      {action && actionLabel && (
        <button onClick={action} className="px-4 py-2 bg-pearl text-ink text-[13px] font-semibold hover:bg-white transition-colors">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ============ BUTTON VARIANTS ============
export function PearlButton({ children, onClick, disabled, className, type = "button" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn("px-4 py-2 bg-pearl text-ink text-[13px] font-semibold hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed", className)}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, disabled, className }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn("px-4 py-2 border border-subtle text-tsecondary text-[13px] font-medium hover:text-tprimary hover:border-pearl-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed", className)}
    >
      {children}
    </button>
  );
}

// ============ DATA TABLE ============
export function DataTable({ columns, children }: { columns: { label: string; className?: string }[]; children: React.ReactNode }) {
  return (
    <div className="border border-subtle overflow-x-auto scroll-thin">
      <table className="w-full">
        <thead>
          <tr className="border-b border-subtle bg-surface">
            {columns.map((c, i) => (
              <th key={i} className={cn("text-left px-4 py-3 label-caps text-tsecondary font-semibold whitespace-nowrap", c.className)}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function TableRow({ children, onClick, selected }: { children: React.ReactNode; onClick?: () => void; selected?: boolean }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-subtle transition-colors",
        onClick && "cursor-pointer",
        selected ? "bg-surface-high" : "hover:bg-surface-high"
      )}
    >
      {children}
    </tr>
  );
}

export function TableCell({ children, className, mono }: { children: React.ReactNode; className?: string; mono?: boolean }) {
  return <td className={cn("px-4 py-3 text-[13px] text-tprimary", mono && "font-mono", className)}>{children}</td>;
}

// ============ FIELD ============
export function Field({ label, children, hint, error }: { label: string; children: React.ReactNode; hint?: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="label-caps text-tsecondary">{label}</label>
      {children}
      {hint && !error && <span className="text-[11px] text-ttertiary">{hint}</span>}
      {error && <span className="text-[11px] text-error">{error}</span>}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, type = "text", mono, className }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; mono?: boolean; className?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "bg-surface-low border border-subtle px-3 py-2 text-[13px] text-tprimary placeholder:text-ttertiary outline-none focus:border-pearl transition-colors",
        mono && "font-mono",
        className
      )}
    />
  );
}

export function Select({ value, onChange, options, className }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn("bg-surface-low border border-subtle px-3 py-2 text-[13px] text-tprimary outline-none focus:border-pearl transition-colors", className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-surface-low">
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ============ TOAST ============
let toastId = 0;
const toastListeners = new Set<(t: { id: number; title: string; type: string }) => void>();
export function toast(title: string, type: "success" | "error" | "info" = "info") {
  const id = ++toastId;
  toastListeners.forEach((l) => l({ id, title, type }));
}

export function ToastHost() {
  const [toasts, setToasts] = React.useState<{ id: number; title: string; type: string }[]>([]);
  React.useEffect(() => {
    const l = (t: { id: number; title: string; type: string }) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3000);
    };
    toastListeners.add(l);
    return () => { toastListeners.delete(l); };
  }, []);
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "bg-surface border-l-2 px-4 py-3 min-w-[260px] log-in",
            t.type === "success" && "border-l-success",
            t.type === "error" && "border-l-error",
            t.type === "info" && "border-l-pearl"
          )}
          style={{ borderLeftColor: t.type === "success" ? "#4ADE80" : t.type === "error" ? "#F87171" : "#E8E4E0" }}
        >
          <span className="text-[13px] text-tprimary">{t.title}</span>
        </div>
      ))}
    </div>
  );
}

// ============ MODAL ============
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div
        className={cn("bg-surface border border-subtle max-h-[85vh] overflow-y-auto scroll-thin", wide ? "w-[90vw] max-w-3xl" : "w-[90vw] max-w-lg")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-subtle sticky top-0 bg-surface z-10">
          <h2 className="page-title text-tprimary">{title}</h2>
          <button onClick={onClose} className="text-ttertiary hover:text-tprimary transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
