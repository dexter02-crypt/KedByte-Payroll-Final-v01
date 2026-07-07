"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ============ TYPES ============
export type Surface = "bureau" | "portal";

export type BureauView =
  | "dashboard"
  | "companies"
  | "company_detail"
  | "employees"
  | "employee_new"
  | "payrun_input"
  | "payrun_calculation"
  | "payrun_review"
  | "payrun_submission"
  | "payrun_payslips"
  | "rti"
  | "rti_errors"
  | "pensions"
  | "reports"
  | "settings"
  | "notifications";

export type PortalView =
  | "dashboard"
  | "payslips"
  | "payslip_detail"
  | "holidays"
  | "approvals"
  | "details"
  | "documents"
  | "notifications";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
  surface: Surface;
  companyId?: string;
  employeeId?: string;
  isManager?: boolean;
}

interface AppState {
  // auth
  user: AuthUser | null;
  authenticated: boolean;
  // routing
  surface: Surface;
  bureauView: BureauView;
  portalView: PortalView;
  // context params
  activeCompanyId: string | null;
  activePayRunId: string | null;
  activeEmployeeId: string | null;
  activePayslipId: string | null;
  settingsSection: string | null; // "system" | "tax" | "bank" | null — which settings tab to open
  // actions
  login: (user: AuthUser) => void;
  logout: () => void;
  setSurface: (s: Surface) => void;
  setBureauView: (v: BureauView) => void;
  setPortalView: (v: PortalView) => void;
  setActiveCompany: (id: string | null) => void;
  setActivePayRun: (id: string | null) => void;
  setActiveEmployee: (id: string | null) => void;
  setActivePayslip: (id: string | null) => void;
  setSettingsSection: (s: string | null) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      authenticated: false,
      surface: "bureau",
      bureauView: "dashboard",
      portalView: "dashboard",
      activeCompanyId: null,
      activePayRunId: null,
      activeEmployeeId: null,
      activePayslipId: null,
      settingsSection: null,
      login: (user) =>
        set({
          user,
          authenticated: true,
          surface: user.surface,
          bureauView: user.surface === "bureau" ? "dashboard" : "dashboard",
          portalView: user.surface === "portal" ? "dashboard" : "dashboard",
        }),
      logout: () =>
        set({
          user: null,
          authenticated: false,
          surface: "bureau",
          bureauView: "dashboard",
          portalView: "dashboard",
          activeCompanyId: null,
          activePayRunId: null,
          activeEmployeeId: null,
          activePayslipId: null,
          settingsSection: null,
        }),
      setSurface: (s) => set({ surface: s }),
      setBureauView: (v) => set({ bureauView: v }),
      setPortalView: (v) => set({ portalView: v }),
      setActiveCompany: (id) => set({ activeCompanyId: id }),
      setActivePayRun: (id) => set({ activePayRunId: id }),
      setActiveEmployee: (id) => set({ activeEmployeeId: id }),
      setActivePayslip: (id) => set({ activePayslipId: id }),
      setSettingsSection: (s) => set({ settingsSection: s }),
    }),
    { name: "kedbyte-payroll" }
  )
);

// ============ HELPERS ============
export function gbp(v: number | null | undefined, opts?: { signed?: boolean }): string {
  if (v === null || v === undefined || isNaN(v)) return "—";
  const sign = opts?.signed && v > 0 ? "+" : "";
  return sign + "£" + v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function gbpShort(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v)) return "—";
  if (Math.abs(v) >= 1_000_000) return "£" + (v / 1_000_000).toFixed(2) + "M";
  if (Math.abs(v) >= 1_000) return "£" + (v / 1_000).toFixed(1) + "k";
  return "£" + v.toFixed(2);
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
