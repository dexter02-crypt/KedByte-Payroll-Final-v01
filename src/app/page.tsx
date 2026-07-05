"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useApp } from "@/store/app";
import { ToastHost, toast } from "@/components/kedbyte/primitives";
import { LoginScreen } from "@/components/kedbyte/login";

// Lazy-load shells so only the active one compiles
const BureauShell = dynamic(() => import("@/components/kedbyte/bureau-shell").then(m => ({ default: m.BureauShell })), {
  ssr: false,
  loading: () => <div className="min-h-screen flex items-center justify-center bg-void"><span className="text-[12px] text-ttertiary font-mono">loading bureau console…</span></div>,
});
const PortalShell = dynamic(() => import("@/components/kedbyte/portal-shell").then(m => ({ default: m.PortalShell })), {
  ssr: false,
  loading: () => <div className="min-h-screen flex items-center justify-center bg-void"><span className="text-[12px] text-ttertiary font-mono">loading my pay…</span></div>,
});

export default function Home() {
  const { authenticated, surface } = useApp();

  // Fire-and-forget: ensure DB is seeded (non-blocking, no loading screen)
  React.useEffect(() => {
    fetch("/api/seed", { method: "GET" }).catch(() => {});
  }, []);

  return (
    <>
      {!authenticated ? (
        <LoginScreen />
      ) : surface === "bureau" ? (
        <BureauShell />
      ) : (
        <PortalShell />
      )}
      <ToastHost />
    </>
  );
}
