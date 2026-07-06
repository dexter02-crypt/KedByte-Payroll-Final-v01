"use client";

import * as React from "react";
import { toast } from "@/components/kedbyte/primitives";
<<<<<<< HEAD

// ExportButton — handles MODE A (direct download) and MODE B (async + notify)
export function ExportButton({ href, label, icon, method = "GET", body, filename }: { href: string; label: string; icon?: string; method?: "GET" | "POST"; body?: any; filename?: string; }) {
=======
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
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
  const [state, setState] = React.useState<"idle" | "preparing" | "ready" | "error">("idle");
  const [downloadUrl, setDownloadUrl] = React.useState<string>();
  const jobIdRef = React.useRef<string>();

  async function click() {
    setState("preparing");
    try {
<<<<<<< HEAD
      const res = await fetch(href, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      if (res.status === 200) {
=======
      const res = await fetch(href, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 200) {
        // MODE A — direct download: stream arrived
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
        const blob = await res.blob();
        const cd = res.headers.get("Content-Disposition") || "";
        const nameMatch = cd.match(/filename="?([^"]+)"?/);
        const fname = nameMatch?.[1] || filename || "export.csv";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
<<<<<<< HEAD
        a.href = url; a.download = fname;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
=======
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
        URL.revokeObjectURL(url);
        setState("idle");
        toast(`${fname} downloaded`, "success");
        return;
      }
<<<<<<< HEAD
      if (res.status === 202) {
        const d = await res.json();
        jobIdRef.current = d.jobId;
        toast(d.message || "Export queued — preparing…", "info");
=======

      if (res.status === 202) {
        // MODE B — async: wait for completion (poll)
        const d = await res.json();
        jobIdRef.current = d.jobId;
        toast(d.message || "Export queued — preparing…", "info");
        // Poll for completion
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
        const poll = async () => {
          for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            try {
              const statusRes = await fetch(`/api/exports/${jobIdRef.current}/status`);
              if (statusRes.ok) {
                const sd = await statusRes.json();
                if (sd.status === "completed") {
<<<<<<< HEAD
                  setDownloadUrl(`/api/exports/${jobIdRef.current}/download?uid=user_admin`);
                  setState("ready");
                  toast(`${sd.result?.fileName || "Export"} ready`, "success");
                  return;
                }
                if (sd.status === "failed") { setState("error"); toast("Export failed", "error"); return; }
              }
            } catch {}
          }
          setState("error"); toast("Export timed out", "error");
=======
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
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
        };
        poll();
        return;
      }
<<<<<<< HEAD
      if (res.status === 409 || res.status === 429) {
        const d = await res.json();
        setState("idle");
        toast(d.error || "Error", "error");
        return;
      }
      const d = await res.json().catch(() => ({}));
      setState("error");
      toast(d.error || `Export failed (HTTP ${res.status})`, "error");
    } catch (e: any) { setState("error"); toast(e.message || "Network error", "error"); }
=======

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
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
  }

  if (state === "ready" && downloadUrl) {
    return (
<<<<<<< HEAD
      <a href={downloadUrl} download onClick={() => { setState("idle"); setDownloadUrl(undefined); }} className="inline-flex items-center gap-2 px-4 py-2 bg-pearl text-ink text-[13px] font-semibold hover:bg-white transition-colors">
=======
      <a
        href={downloadUrl}
        download
        onClick={() => { setState("idle"); setDownloadUrl(undefined); }}
        className="inline-flex items-center gap-2 px-4 py-2 bg-pearl text-ink text-[13px] font-semibold hover:bg-white transition-colors"
      >
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
        <span className="material-symbols-outlined text-[14px]">download</span>
        Download {label}
      </a>
    );
  }
<<<<<<< HEAD
  return (
    <button onClick={click} disabled={state === "preparing"} className="inline-flex items-center gap-2 px-3 py-1.5 border border-subtle text-tsecondary text-[13px] font-medium hover:text-tprimary hover:border-pearl-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
      {state === "preparing" ? <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span> : state === "error" ? <span className="material-symbols-outlined text-[14px] text-error">error</span> : <span className="material-symbols-outlined text-[14px]">{icon || "download"}</span>}
=======

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
>>>>>>> 0775c07bf34355cd5dbbfdd7e77e9a993af3a236
      {state === "preparing" ? "Preparing…" : state === "error" ? "Failed — retry" : label}
    </button>
  );
}
