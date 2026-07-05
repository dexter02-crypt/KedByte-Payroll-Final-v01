"use client";

import * as React from "react";
import { toast } from "@/components/kedbyte/primitives";
import { cn } from "@/lib/utils";

// ============================================================
// ExportButton — use for EVERY export in the product
// Spec §2.3: handles both MODE A (direct download) and MODE B (async + notify)
// Direct downloads feel instant; async ones morph in place
// ============================================================

export function ExportButton({
  href,
  label,
  icon,
  method = "GET",
  body,
  filename,
}: {
  href: string;
  label: string;
  icon?: string;
  method?: "GET" | "POST";
  body?: any;
  filename?: string; // hint for download
}) {
  const [state, setState] = React.useState<"idle" | "preparing" | "ready" | "error">("idle");
  const [downloadUrl, setDownloadUrl] = React.useState<string>();
  const jobIdRef = React.useRef<string>();

  async function click() {
    setState("preparing");
    try {
      const res = await fetch(href, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 200) {
        // MODE A — direct download: stream arrived
        const blob = await res.blob();
        const cd = res.headers.get("Content-Disposition") || "";
        const nameMatch = cd.match(/filename="?([^"]+)"?/);
        const fname = nameMatch?.[1] || filename || "export.csv";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setState("idle");
        toast(`${fname} downloaded`, "success");
        return;
      }

      if (res.status === 202) {
        // MODE B — async: wait for completion (poll)
        const d = await res.json();
        jobIdRef.current = d.jobId;
        toast(d.message || "Export queued — preparing…", "info");
        // Poll for completion
        const poll = async () => {
          for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            try {
              const statusRes = await fetch(`/api/exports/${jobIdRef.current}/status`);
              if (statusRes.ok) {
                const sd = await statusRes.json();
                if (sd.status === "completed") {
                  setDownloadUrl(`/api/exports/${jobIdRef.current}/download`);
                  setState("ready");
                  toast(`${sd.filename || "Export"} ready`, "success");
                  return;
                }
                if (sd.status === "failed") {
                  setState("error");
                  toast("Export failed", "error");
                  return;
                }
              }
            } catch {}
          }
          setState("error");
          toast("Export timed out", "error");
        };
        poll();
        return;
      }

      if (res.status === 409) {
        const d = await res.json();
        setState("idle");
        toast(d.error || "Conflict — check preconditions", "error");
        return;
      }

      if (res.status === 429) {
        const d = await res.json();
        setState("idle");
        toast(d.error || "Rate limit reached", "error");
        return;
      }

      const d = await res.json().catch(() => ({}));
      setState("error");
      toast(d.error || `Export failed (HTTP ${res.status})`, "error");
    } catch (e: any) {
      setState("error");
      toast(e.message || "Network error", "error");
    }
  }

  if (state === "ready" && downloadUrl) {
    return (
      <a
        href={downloadUrl}
        download
        onClick={() => { setState("idle"); setDownloadUrl(undefined); }}
        className="inline-flex items-center gap-2 px-4 py-2 bg-pearl text-ink text-[13px] font-semibold hover:bg-white transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">download</span>
        Download {label}
      </a>
    );
  }

  return (
    <button
      onClick={click}
      disabled={state === "preparing"}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 border border-subtle text-tsecondary text-[13px] font-medium hover:text-tprimary hover:border-pearl-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
      )}
    >
      {state === "preparing" ? (
        <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
      ) : state === "error" ? (
        <span className="material-symbols-outlined text-[14px] text-error">error</span>
      ) : (
        <span className="material-symbols-outlined text-[14px]">{icon || "download"}</span>
      )}
      {state === "preparing" ? "Preparing…" : state === "error" ? "Failed — retry" : label}
    </button>
  );
}
