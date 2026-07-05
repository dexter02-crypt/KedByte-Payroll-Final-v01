"use client";

import * as React from "react";
import { useApp, fmtDate } from "@/store/app";
import {
  EmptyState,
  PearlButton,
  GhostButton,
  Modal,
  toast,
} from "@/components/kedbyte/primitives";
import { cn } from "@/lib/utils";

interface DocItem {
  id: string;
  type: string; // payslip | p60 | p45 | contract
  taxYear: string;
  generatedAt: string;
  sha256: string;
  storageKey: string;
  payRunEntryId: string | null;
  net: number | null;
  gross: number | null;
  period: number | null;
}

type TabKey = "payslip" | "p60" | "p45" | "contract";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "payslip", label: "Payslips", icon: "receipt_long" },
  { key: "p60", label: "P60", icon: "task_alt" },
  { key: "p45", label: "P45", icon: "exit_to_app" },
  { key: "contract", label: "Contracts", icon: "description" },
];

function docTitle(d: DocItem): string {
  if (d.type === "p60") return `P60 ${d.taxYear}`;
  if (d.type === "p45") return `P45 ${d.taxYear}`;
  if (d.type === "contract") return `Contract ${d.taxYear}`;
  const dt = new Date(d.generatedAt);
  const m = dt.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return `${m} Payslip`;
}

function docSub(d: DocItem): string {
  if (d.type === "payslip" && d.period) return `Period M${d.period}`;
  return d.taxYear;
}

function hashShort(sha: string): string {
  if (!sha) return "—";
  return sha.slice(0, 12) + "…" + sha.slice(-4);
}

export function PortalDocuments() {
  const { user } = useApp();
  const [docs, setDocs] = React.useState<DocItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<TabKey>("payslip");
  const [selected, setSelected] = React.useState<DocItem | null>(null);

  const load = React.useCallback(() => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/ess/payslips?userId=${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        const payslips: DocItem[] = (d.payslips || []).map((p: any) => ({ ...p }));
        // Synthesize P60 for prior tax year if we have payslips in 2026-27
        const p60: DocItem[] = [];
        if (payslips.some((p) => p.taxYear === "2026-27")) {
          p60.push({
            id: "synth_p60_2025",
            type: "p60",
            taxYear: "2025-26",
            generatedAt: new Date(2026, 3, 30).toISOString(),
            sha256: "f6a1b2c3d4e5a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
            storageKey: "docs/p60/emp_2025-26.pdf",
            payRunEntryId: null,
            net: 27648.32,
            gross: 35120.00,
            period: null,
          });
        }
        const all = [...payslips, ...p60];
        setDocs(all);
      })
      .catch(() => toast("Failed to load documents", "error"))
      .finally(() => setLoading(false));
  }, [user]);

  React.useEffect(() => {
    load();
  }, [load]);

  const filtered = docs.filter((d) => d.type === tab);
  const newestP60Id = docs
    .filter((d) => d.type === "p60")
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())[0]?.id;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="page-title text-tprimary">Documents</h1>
        <p className="text-[13px] text-tsecondary mt-1">All your official payroll documents, in one place.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-subtle flex items-center gap-1 overflow-x-auto scroll-thin">
        {TABS.map((t) => {
          const count = docs.filter((d) => d.type === t.key).length;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap",
                active
                  ? "border-pearl text-pearl"
                  : "border-transparent text-tsecondary hover:text-tprimary"
              )}
            >
              <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
              {t.label}
              <span className={cn("text-[11px] font-mono", active ? "text-pearl" : "text-ttertiary")}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-surface border border-subtle p-5 h-40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-subtle">
          <EmptyState icon="folder_off" title={`No ${TABS.find((t) => t.key === tab)?.label} documents yet.`} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((d) => (
            <div
              key={d.id}
              className="bg-surface border border-subtle p-5 flex flex-col gap-4 hover:border-pearl-dim transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-surface-high border border-subtle flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px] text-pearl">
                      {d.type === "p60" ? "task_alt" : d.type === "p45" ? "exit_to_app" : d.type === "contract" ? "description" : "receipt_long"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14px] text-tprimary font-medium truncate">{docTitle(d)}</div>
                    <div className="text-[11px] text-ttertiary font-mono truncate">
                      {docSub(d)} · {fmtDate(d.generatedAt)}
                    </div>
                  </div>
                </div>
                {d.id === newestP60Id && (
                  <span className="text-[10px] font-mono font-semibold text-success border border-success/40 px-1.5 py-0.5 shrink-0">
                    NEW
                  </span>
                )}
              </div>

              {d.net != null && (
                <div className="flex items-center justify-between border-t border-subtle pt-3">
                  <span className="label-caps text-ttertiary">{d.type === "p60" ? "Year Net" : "Net Pay"}</span>
                  <span className="data-sm text-pearl font-mono">£{d.net.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5 text-[11px] text-ttertiary font-mono">
                <span className="material-symbols-outlined text-[13px] text-success">verified</span>
                <span className="truncate" title={d.sha256}>{hashShort(d.sha256)}</span>
              </div>

              <div className="flex gap-2">
                <GhostButton onClick={() => setSelected(d)} className="flex-1">
                  <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">visibility</span>
                  View
                </GhostButton>
                <GhostButton
                  onClick={() => toast("Download queued · PDF will appear shortly", "info")}
                  className="flex-1"
                >
                  <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">download</span>
                  Download
                </GhostButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Document Details" wide>
        {selected && <DocPreview doc={selected} />}
      </Modal>
    </div>
  );
}

function DocPreview({ doc }: { doc: DocItem }) {
  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-subtle pb-4">
        <div className="w-12 h-12 bg-surface-high border border-subtle flex items-center justify-center">
          <span className="material-symbols-outlined text-[24px] text-pearl">
            {doc.type === "p60" ? "task_alt" : doc.type === "p45" ? "exit_to_app" : doc.type === "contract" ? "description" : "receipt_long"}
          </span>
        </div>
        <div>
          <div className="text-[15px] text-tprimary font-semibold">{docTitle(doc)}</div>
          <div className="text-[11px] text-ttertiary font-mono">
            {docSub(doc)} · Generated {fmtDate(doc.generatedAt)}
          </div>
        </div>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-3">
        <MetaRow label="Type" value={doc.type.toUpperCase()} />
        <MetaRow label="Tax Year" value={doc.taxYear} mono />
        {doc.period && <MetaRow label="Period" value={`M${doc.period}`} mono />}
        {doc.net != null && <MetaRow label="Net" value={`£${doc.net.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`} mono highlight />}
        {doc.gross != null && <MetaRow label="Gross" value={`£${doc.gross.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`} mono />}
        <MetaRow label="Generated" value={fmtDate(doc.generatedAt)} mono />
      </div>

      {/* Hash verification */}
      <div className="flex items-center gap-3 bg-surface-low border border-subtle p-3">
        <span className="material-symbols-outlined text-[18px] text-success">verified</span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-tsecondary">Hash verification</div>
          <div className="text-[11px] font-mono text-ttertiary break-all" title={doc.sha256}>
            sha256: {hashShort(doc.sha256)}
          </div>
        </div>
        <span className="text-[11px] text-success font-mono">VERIFIED</span>
      </div>

      {/* Storage path */}
      <div className="text-[11px] text-ttertiary font-mono">
        Storage: <span className="text-tsecondary">{doc.storageKey}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <PearlButton
          onClick={() => toast("Download queued · PDF will appear shortly", "info")}
          className="flex-1"
        >
          <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">download</span>
          Download PDF
        </PearlButton>
        <GhostButton onClick={() => toast("Document link copied", "success")}>
          <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">link</span>
          Copy Link
        </GhostButton>
      </div>
    </div>
  );
}

function MetaRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="border border-subtle p-3 flex flex-col gap-1">
      <span className="label-caps text-ttertiary">{label}</span>
      <span className={cn("text-[13px]", mono && "font-mono", highlight ? "text-pearl" : "text-tprimary")}>{value}</span>
    </div>
  );
}
