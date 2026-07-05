"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useApp, type BureauView } from "@/store/app";
import { toast } from "@/components/kedbyte/primitives";
import { MyAccountModal } from "@/components/kedbyte/my-account";

// Lazy-load views to reduce initial compile memory pressure
const BureauDashboard = dynamic(() => import("@/components/kedbyte/views/bureau-dashboard").then(m => ({ default: m.BureauDashboard })), { ssr: false });
const CompaniesView = dynamic(() => import("@/components/kedbyte/views/companies").then(m => ({ default: m.CompaniesView })), { ssr: false });
const CompanyDetailView = dynamic(() => import("@/components/kedbyte/views/company-detail").then(m => ({ default: m.CompanyDetailView })), { ssr: false });
const EmployeesView = dynamic(() => import("@/components/kedbyte/views/employees").then(m => ({ default: m.EmployeesView })), { ssr: false });
const EmployeeNewView = dynamic(() => import("@/components/kedbyte/views/employee-new").then(m => ({ default: m.EmployeeNewView })), { ssr: false });
const PayRunInput = dynamic(() => import("@/components/kedbyte/views/payrun-input").then(m => ({ default: m.PayRunInput })), { ssr: false });
const PayRunCalculation = dynamic(() => import("@/components/kedbyte/views/payrun-calculation").then(m => ({ default: m.PayRunCalculation })), { ssr: false });
const PayRunReview = dynamic(() => import("@/components/kedbyte/views/payrun-review").then(m => ({ default: m.PayRunReview })), { ssr: false });
const PayRunSubmission = dynamic(() => import("@/components/kedbyte/views/payrun-submission").then(m => ({ default: m.PayRunSubmission })), { ssr: false });
const RtiView = dynamic(() => import("@/components/kedbyte/views/rti").then(m => ({ default: m.RtiView })), { ssr: false });
const PensionsView = dynamic(() => import("@/components/kedbyte/views/pensions").then(m => ({ default: m.PensionsView })), { ssr: false });
const ReportsView = dynamic(() => import("@/components/kedbyte/views/reports").then(m => ({ default: m.ReportsView })), { ssr: false });
const SettingsView = dynamic(() => import("@/components/kedbyte/views/settings").then(m => ({ default: m.SettingsView })), { ssr: false });

const NAV: { view: BureauView; label: string; icon: string }[] = [
  { view: "dashboard", label: "Dashboard", icon: "dashboard" },
  { view: "companies", label: "Companies", icon: "business" },
  { view: "employees", label: "Employees", icon: "group" },
  { view: "payrun_input", label: "Pay Runs", icon: "payments" },
  { view: "rti", label: "RTI Submissions", icon: "send" },
  { view: "pensions", label: "Pensions", icon: "account_balance" },
  { view: "reports", label: "Reports", icon: "analytics" },
  { view: "settings", label: "Settings", icon: "settings" },
];

const VIEW_LABELS: Record<BureauView, string> = {
  dashboard: "Dashboard",
  companies: "Companies",
  company_detail: "Company Detail",
  employees: "Employees",
  employee_new: "Add Employee",
  payrun_input: "Pay Run · Input",
  payrun_calculation: "Pay Run · Calculation",
  payrun_review: "Pay Run · Review",
  payrun_submission: "Pay Run · Submission",
  payrun_payslips: "Payslip Review",
  rti: "RTI Submissions",
  rti_errors: "RTI Errors",
  pensions: "Pensions",
  reports: "Reports",
  settings: "Settings",
};

export function BureauShell() {
  const { user, bureauView, setBureauView, logout } = useApp();
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (user) {
      fetch(`/api/notifications?userId=${user.id}`)
        .then((r) => r.json())
        .then((d) => setNotifications(d.notifications || []))
        .catch(() => {});
    }
  }, [user]);

  // Determine which nav item is active based on current view
  const activeNav: BureauView = bureauView.startsWith("payrun")
    ? "payrun_input"
    : bureauView === "company_detail"
    ? "companies"
    : bureauView === "employee_new"
    ? "employees"
    : bureauView;

  const renderView = () => {
    switch (bureauView) {
      case "dashboard": return <BureauDashboard />;
      case "companies": return <CompaniesView />;
      case "company_detail": return <CompanyDetailView />;
      case "employees": return <EmployeesView />;
      case "employee_new": return <EmployeeNewView />;
      case "payrun_input": return <PayRunInput />;
      case "payrun_calculation": return <PayRunCalculation />;
      case "payrun_review": return <PayRunReview />;
      case "payrun_submission": return <PayRunSubmission />;
      case "rti": return <RtiView />;
      case "pensions": return <PensionsView />;
      case "reports": return <ReportsView />;
      case "settings": return <SettingsView />;
      default: return <BureauDashboard />;
    }
  };

  return (
    <div className="min-h-screen flex bg-void">
      {/* Sidebar */}
      <aside className="w-64 border-r border-subtle flex flex-col shrink-0 h-screen sticky top-0">
        <div className="h-16 flex items-center px-6 border-b border-subtle">
          <span className="label-caps text-pearl tracking-[0.3em] text-[13px]">KEDBYTE</span>
          <span className="ml-2 text-[10px] text-ttertiary font-mono">BUREAU</span>
        </div>
        <nav className="flex-1 overflow-y-auto scroll-thin py-4 px-3">
          {NAV.map((item) => (
            <button
              key={item.view}
              onClick={() => setBureauView(item.view)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium transition-colors mb-0.5 ${
                activeNav === item.view
                  ? "bg-surface-high text-pearl"
                  : "text-tsecondary hover:text-tprimary hover:bg-surface"
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: activeNav === item.view ? "'FILL' 1" : "'FILL' 0" }}
              >
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-subtle p-3">
          <button
            onClick={() => setAccountOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-high transition-colors group"
          >
            <div className="w-8 h-8 bg-surface-high border border-subtle flex items-center justify-center group-hover:border-pearl-dim transition-colors">
              <span className="text-[12px] font-mono font-bold text-pearl">
                {user?.name?.[0]?.toUpperCase() || "A"}
              </span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[12px] text-tprimary font-medium truncate">{user?.name}</div>
              <div className="text-[10px] text-ttertiary font-mono truncate">{user?.email}</div>
            </div>
            <span className="material-symbols-outlined text-[14px] text-ttertiary group-hover:text-pearl transition-colors">manage_accounts</span>
          </button>
          <button
            onClick={() => { logout(); toast("Signed out", "info"); }}
            className="w-full flex items-center gap-3 px-3 py-2 text-[12px] text-tsecondary hover:text-error transition-colors mt-1"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-subtle flex items-center justify-between px-8 sticky top-0 bg-void z-30">
          <div className="flex items-center gap-3">
            <h1 className="text-[14px] font-semibold text-tprimary">{VIEW_LABELS[bureauView]}</h1>
            <span className="text-ttertiary">/</span>
            <span className="text-[12px] text-tsecondary font-mono">Tax Year 2026/27</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center bg-surface-low border border-subtle px-3 py-1.5 w-64">
              <span className="material-symbols-outlined text-[16px] text-ttertiary mr-2">search</span>
              <input
                className="bg-transparent border-none outline-none text-[12px] text-tprimary placeholder:text-ttertiary w-full font-mono"
                placeholder="Search…"
              />
            </div>
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative p-2 text-tsecondary hover:text-tprimary hover:bg-surface transition-colors"
            >
              <span className="material-symbols-outlined">notifications</span>
              {notifications.filter((n) => !n.readAt).length > 0 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-error" />
              )}
            </button>
            <div className="h-6 w-px bg-border-subtle mx-1" style={{ backgroundColor: "rgba(245,245,245,0.06)" }} />
            <button className="px-3 py-1.5 border border-subtle text-[12px] text-tsecondary hover:text-tprimary hover:border-pearl-dim transition-colors flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">help</span>
              Support
            </button>
          </div>
        </header>

        {/* Notifications dropdown */}
        {notifOpen && (
          <div className="absolute right-8 top-14 w-80 bg-surface border border-subtle z-40 shadow-2xl">
            <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
              <span className="label-caps text-tsecondary">Notifications</span>
              <button onClick={() => setNotifOpen(false)} className="text-ttertiary hover:text-tprimary">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto scroll-thin">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] text-ttertiary">No notifications</div>
              ) : (
                notifications.slice(0, 8).map((n) => (
                  <div key={n.id} className={`px-4 py-3 border-b border-subtle ${!n.readAt ? "bg-surface-low" : ""}`}>
                    <div className="text-[12px] text-tprimary font-medium">{n.title}</div>
                    <div className="text-[11px] text-tsecondary mt-0.5">{n.body}</div>
                    <div className="text-[10px] text-ttertiary mt-1 font-mono">
                      {new Date(n.createdAt).toLocaleString("en-GB")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto scroll-thin p-8">
          {renderView()}
        </main>
      </div>
      <MyAccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}
