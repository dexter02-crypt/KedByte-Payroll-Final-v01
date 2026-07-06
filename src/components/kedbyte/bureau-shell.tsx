"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useApp, type BureauView } from "@/store/app";
import { toast, PearlButton, GhostButton, Field, TextInput, Modal } from "@/components/kedbyte/primitives";
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
  const [supportOpen, setSupportOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [prevNotifCount, setPrevNotifCount] = React.useState(0);

  // Real-time notification polling — refreshes every 10 seconds
  const loadNotifs = React.useCallback(() => {
    if (!user) return;
    fetch(`/api/notifications?userId=${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        const newNotifs = d.notifications || [];
        // Detect new notifications for toast alert
        const unreadCount = newNotifs.filter((n: any) => !n.readAt).length;
        if (unreadCount > prevNotifCount && prevNotifCount > 0) {
          const fresh = newNotifs.slice(0, unreadCount - prevNotifCount);
          fresh.forEach((n: any) => toast(`🔔 ${n.title}`, "info"));
        }
        setPrevNotifCount(unreadCount);
        setNotifications(newNotifs);
      })
      .catch(() => {});
  }, [user, prevNotifCount]);

  React.useEffect(() => {
    loadNotifs(); // Initial load
    const interval = setInterval(loadNotifs, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [loadNotifs]);

  // Mark notification as read when clicked
  const markNotifRead = async (notifId: string, actionUrl?: string | null) => {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-read", notificationId: notifId }),
    });
    loadNotifs(); // Refresh immediately
  };

  const markAllRead = async (uid: string) => {
    if (!uid) return;
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-all-read", userId: uid }),
      });
      const d = await res.json();
      if (d.ok) {
        toast(`Marked ${d.updated || "all"} notifications as read`, "success");
        loadNotifs();
      }
    } catch (e) {
      toast("Failed to mark all read", "error");
    }
  };

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
            <button
              onClick={() => setSupportOpen(true)}
              className="px-3 py-1.5 border border-subtle text-[12px] text-tsecondary hover:text-tprimary hover:border-pearl-dim transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[14px]">help</span>
              Support
            </button>
          </div>
        </header>

        {/* Notifications dropdown */}
        {notifOpen && (
          <div className="fixed right-4 top-14 w-96 bg-surface border border-subtle z-[100] flex flex-col" style={{ maxHeight: "80vh", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
            <div className="px-4 py-3 border-b border-subtle flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="label-caps text-tsecondary">Notifications</span>
                {notifications.filter((n) => !n.readAt).length > 0 && (
                  <span className="text-[11px] font-mono text-warning">{notifications.filter((n) => !n.readAt).length} unread</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {notifications.filter((n) => !n.readAt).length > 0 && (
                  <button onClick={() => markAllRead(user?.id || "")} className="text-[10px] text-tsecondary hover:text-pearl uppercase tracking-wider">Mark all read</button>
                )}
                <button onClick={() => setNotifOpen(false)} className="text-ttertiary hover:text-tprimary">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scroll-thin" style={{ minHeight: "200px" }}>
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] text-ttertiary">No notifications</div>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => { markNotifRead(n.id, n.actionUrl); if (n.actionUrl && !n.actionUrl.startsWith("/api/")) setNotifOpen(false); }}
                    className={`w-full text-left px-4 py-3 border-b border-subtle transition-colors hover:bg-surface-high ${!n.readAt ? "bg-surface-low" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`material-symbols-outlined text-[16px] mt-0.5 shrink-0 ${
                        n.type === "export_ready" ? "text-success" :
                        n.type === "rti_status" ? "text-warning" :
                        n.type === "rti_rejected" || n.type === "job_failed" ? "text-error" :
                        n.type === "payslip_ready" || n.type === "p60_ready" ? "text-success" :
                        "text-ttertiary"
                      }`}>
                        {n.type === "export_ready" ? "download" :
                         n.type === "rti_status" || n.type === "rti_rejected" ? "send" :
                         n.type === "payslip_ready" ? "description" :
                         n.type === "p60_ready" ? "task_alt" :
                         n.type === "holiday_decision" ? "event" :
                         n.type === "bank_change" ? "account_balance" :
                         n.type === "pay_date" ? "payments" :
                         n.type === "sync_complete" || n.type === "dps_fetch_complete" ? "sync" :
                         "notifications"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-tprimary font-medium">{n.title}</div>
                        <div className="text-[11px] text-tsecondary mt-0.5">{n.body}</div>
                        <div className="text-[10px] text-ttertiary mt-1 font-mono">
                          {new Date(n.createdAt).toLocaleString("en-GB")}
                        </div>
                      </div>
                      {!n.readAt && <span className="w-1.5 h-1.5 bg-pearl rounded-full shrink-0 mt-1" />}
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="px-4 py-2 border-t border-subtle flex items-center justify-between shrink-0">
              <span className="text-[10px] text-ttertiary font-mono">Auto-refresh every 10s · {notifications.length} total</span>
              <button onClick={() => { setNotifOpen(false); window.open("/portal/notifications", "_blank"); }} className="text-[10px] text-tsecondary hover:text-pearl uppercase tracking-wider">View all</button>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto scroll-thin p-8">
          {renderView()}
        </main>
      </div>
      <MyAccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </div>
  );
}

// ============ SUPPORT MODAL ============
function SupportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useApp();
  const [topic, setTopic] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [ticketRef, setTicketRef] = React.useState("");

  const submit = async () => {
    if (!topic || !message) { toast("Topic and message are required", "error"); return; }
    setSending(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, email, message, userId: user?.id || "user_admin" }),
      });
      const d = await res.json();
      setSending(false);
      if (res.ok || res.status === 201) {
        setTicketRef(d.ticketRef);
        setSent(true);
        toast(d.message || `Support ticket ${d.ticketRef} created`, "success");
      } else {
        toast(d.error || "Failed to create ticket", "error");
      }
    } catch (e) {
      setSending(false);
      toast("Network error", "error");
    }
  };

  const reset = () => { setTopic(""); setMessage(""); setEmail(""); setSent(false); setTicketRef(""); };

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title="Support" wide>
      <div className="flex flex-col gap-4">
        {sent ? (
          <div className="flex flex-col items-center py-8 gap-4">
            <span className="material-symbols-outlined text-[48px] text-success">check_circle</span>
            <div className="text-center">
              <h3 className="text-[16px] font-semibold text-tprimary">Support ticket submitted</h3>
              <p className="text-[12px] text-tsecondary mt-1">Reference #{ticketRef} — our team will respond within 4 business hours.</p>
            </div>
            <PearlButton onClick={() => { onClose(); reset(); }}>Close</PearlButton>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { id: "engine", label: "Calculation Engine", icon: "calculate" },
                { id: "rti", label: "RTI / HMRC", icon: "send" },
                { id: "pension", label: "Pensions", icon: "savings" },
                { id: "payrun", label: "Pay Run", icon: "payments" },
                { id: "export", label: "Exports", icon: "download" },
                { id: "other", label: "Other", icon: "help" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTopic(t.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 border text-[12px] font-medium transition-colors ${
                    topic === t.id
                      ? "border-pearl bg-surface-high text-pearl"
                      : "border-subtle text-tsecondary hover:text-tprimary hover:border-pearl-dim"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            <Field label="Your Email (optional)" hint="For follow-up — we'll use your account email by default">
              <TextInput value={email} onChange={setEmail} placeholder="your@email.co.uk" />
            </Field>

            <Field label="Describe the issue" hint="Include steps to reproduce, expected vs actual behaviour, and any error messages">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="e.g. When I click Submit FPS, the button shows 'Submitting...' but nothing happens. Expected: FPS submission to HMRC."
                className="bg-surface-low border border-subtle px-3 py-2 text-[13px] text-tprimary placeholder:text-ttertiary outline-none focus:border-pearl transition-colors resize-none"
              />
            </Field>

            <div className="border border-subtle bg-surface-low px-4 py-3 flex items-start gap-3">
              <span className="material-symbols-outlined text-[16px] text-ttertiary mt-0.5">info</span>
              <div className="text-[11px] text-tsecondary">
                <p className="font-medium text-tprimary mb-1">Quick References</p>
                <p>• Engine self-test: <span className="font-mono text-pearl">GET /api/engine/verify</span></p>
                <p>• Health check: <span className="font-mono text-pearl">GET /api/health</span></p>
                <p>• Documentation: <span className="font-mono text-pearl">README.md, TESTING.md, DEPLOYMENT.md</span></p>
                <p>• GitHub: <span className="font-mono text-pearl">github.com/dexter02-crypt/KedByte-Payroll-Final-v01</span></p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-subtle">
              <GhostButton onClick={() => { onClose(); reset(); }}>Cancel</GhostButton>
              <PearlButton onClick={submit} disabled={sending || !topic || !message}>
                {sending ? (
                  <>
                    <span className="material-symbols-outlined text-[14px] mr-1 align-middle animate-spin">progress_activity</span>
                    Submitting…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px] mr-1 align-middle">send</span>
                    Submit Ticket
                  </>
                )}
              </PearlButton>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
