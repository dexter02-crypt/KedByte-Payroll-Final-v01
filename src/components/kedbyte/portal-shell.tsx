"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useApp, type PortalView } from "@/store/app";
import { toast } from "@/components/kedbyte/primitives";

// Lazy-load views to reduce initial compile memory pressure
const PortalDashboard = dynamic(() => import("@/components/kedbyte/views/portal-dashboard").then(m => ({ default: m.PortalDashboard })), { ssr: false });
const PortalPayslips = dynamic(() => import("@/components/kedbyte/views/portal-payslips").then(m => ({ default: m.PortalPayslips })), { ssr: false });
const PortalHolidays = dynamic(() => import("@/components/kedbyte/views/portal-holidays").then(m => ({ default: m.PortalHolidays })), { ssr: false });
const PortalApprovals = dynamic(() => import("@/components/kedbyte/views/portal-approvals").then(m => ({ default: m.PortalApprovals })), { ssr: false });
const PortalDetails = dynamic(() => import("@/components/kedbyte/views/portal-details").then(m => ({ default: m.PortalDetails })), { ssr: false });
const PortalDocuments = dynamic(() => import("@/components/kedbyte/views/portal-documents").then(m => ({ default: m.PortalDocuments })), { ssr: false });
const PortalNotifications = dynamic(() => import("@/components/kedbyte/views/portal-notifications").then(m => ({ default: m.PortalNotifications })), { ssr: false });

const NAV: { view: PortalView; label: string; icon: string; managerOnly?: boolean }[] = [
  { view: "dashboard", label: "Home", icon: "home" },
  { view: "payslips", label: "Pay", icon: "payments" },
  { view: "holidays", label: "Holidays", icon: "calendar_today" },
  { view: "details", label: "Profile", icon: "person" },
];

export function PortalShell() {
  const { user, portalView, setPortalView, logout } = useApp();
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);

  const loadNotifs = React.useCallback(() => {
    if (!user) return;
    fetch(`/api/notifications?userId=${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        setNotifications(d.notifications || []);
        setUnreadCount((d.notifications || []).filter((n: any) => !n.readAt).length);
      })
      .catch(() => {});
  }, [user]);

  React.useEffect(() => {
    loadNotifs();
    const interval = setInterval(loadNotifs, 30000);
    return () => clearInterval(interval);
  }, [loadNotifs]);

  const renderView = () => {
    switch (portalView) {
      case "dashboard": return <PortalDashboard onNavigate={setPortalView} />;
      case "payslips": return <PortalPayslips />;
      case "holidays": return <PortalHolidays />;
      case "approvals": return <PortalApprovals />;
      case "details": return <PortalDetails />;
      case "documents": return <PortalDocuments />;
      case "notifications": return <PortalNotifications onChanged={loadNotifs} />;
      default: return <PortalDashboard onNavigate={setPortalView} />;
    }
  };

  const fullNav = [...NAV];
  if (user?.isManager) {
    fullNav.splice(2, 0, { view: "approvals", label: "Team", icon: "groups" });
  }

  return (
    <div className="min-h-screen flex flex-col bg-void">
      {/* Top bar */}
      <header className="h-14 border-b border-subtle flex items-center justify-between px-6 sticky top-0 bg-void z-30 shrink-0">
        <span className="label-caps text-pearl tracking-[0.25em] text-[12px]">KEDBYTE</span>
        <span className="text-[11px] text-ttertiary font-mono">MY PAY</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPortalView("notifications")}
            className="relative p-2 text-tsecondary hover:text-tprimary transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-error" />
            )}
          </button>
          <button
            onClick={() => { logout(); toast("Signed out", "info"); }}
            className="p-2 text-tsecondary hover:text-tprimary transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto scroll-thin flex justify-center pb-20 lg:pb-8">
        <div className="w-full max-w-[760px] px-6 lg:px-8 py-8 lg:py-12">
          {renderView()}
        </div>
      </main>

      {/* Bottom tab bar (mobile-first ESS pattern) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-subtle flex items-center justify-around z-40">
        {fullNav.map((item) => (
          <button
            key={item.view}
            onClick={() => setPortalView(item.view)}
            className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
              portalView === item.view ? "text-pearl" : "text-ttertiary"
            }`}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={{ fontVariationSettings: portalView === item.view ? "'FILL' 1" : "'FILL' 0" }}
            >
              {item.icon}
            </span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Desktop side rail */}
      <aside className="hidden lg:flex fixed left-0 top-14 bottom-0 w-12 flex-col items-center py-6 border-r border-subtle">
        {fullNav.map((item) => (
          <button
            key={item.view}
            onClick={() => setPortalView(item.view)}
            className={`w-full flex justify-center py-3 transition-colors ${
              portalView === item.view
                ? "text-pearl border-l-2 border-pearl"
                : "text-ttertiary hover:text-tprimary"
            }`}
            title={item.label}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: portalView === item.view ? "'FILL' 1" : "'FILL' 0" }}
            >
              {item.icon}
            </span>
          </button>
        ))}
        <div className="mt-auto flex flex-col gap-3">
          <button
            onClick={() => setPortalView("documents")}
            className={`w-full flex justify-center py-2 transition-colors ${
              portalView === "documents" ? "text-pearl" : "text-ttertiary hover:text-tprimary"
            }`}
            title="Documents"
          >
            <span className="material-symbols-outlined text-[20px]">folder</span>
          </button>
        </div>
      </aside>

      {/* Desktop content offset */}
      <style>{`@media (min-width:1024px){main{padding-left:calc(50% - 380px + 12px)}}`}</style>
    </div>
  );
}
