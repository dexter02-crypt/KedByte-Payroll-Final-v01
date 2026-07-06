"use client";

import * as React from "react";
import { useApp, fmtDateTime } from "@/store/app";
import {
  DataTable,
  TableRow,
  TableCell,
  StatusChip,
  EmptyState,
  PearlButton,
  GhostButton,
  toast,
} from "@/components/kedbyte/primitives";

// ============================================================
// BUREAU NOTIFICATIONS VIEW — full-page notification center
// ============================================================

export function BureauNotificationsView() {
  const { user, setBureauView } = useApp();
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState("all");

  const load = React.useCallback(() => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/notifications?userId=${user.id}`)
      .then((r) => r.json())
      .then((d) => setNotifications(d.notifications || []))
      .catch(() => toast("Failed to load notifications", "error"))
      .finally(() => setLoading(false));
  }, [user]);

  React.useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const markRead = async (notifId: string) => {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-read", notificationId: notifId }),
    });
    load();
  };

  const markAllRead = async () => {
    if (!user) return;
    const res = await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-all-read", userId: user.id }),
    });
    const d = await res.json();
    toast(`Marked ${d.updated || "all"} as read`, "success");
    load();
  };

  const filtered = filter === "unread"
    ? notifications.filter((n) => !n.readAt)
    : filter === "read"
    ? notifications.filter((n) => n.readAt)
    : notifications;

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const typeIcon = (type: string) => {
    const icons: Record<string, string> = {
      export_ready: "download",
      rti_status: "send",
      rti_rejected: "error",
      payslip_ready: "description",
      p60_ready: "task_alt",
      holiday_decision: "event",
      bank_change: "account_balance",
      pay_date: "payments",
      sync_complete: "sync",
      dps_fetch_complete: "sync",
      job_failed: "error",
      support_ticket: "support_agent",
      mfa_reset: "lock_reset",
      password_changed: "key",
      password_reset: "mail_lock",
    };
    return icons[type] || "notifications";
  };

  const typeColor = (type: string) => {
    if (type === "export_ready" || type === "payslip_ready" || type === "p60_ready" || type === "sync_complete") return "text-success";
    if (type === "rti_status" || type === "dps_fetch_complete") return "text-warning";
    if (type === "rti_rejected" || type === "job_failed" || type === "error") return "text-error";
    return "text-ttertiary";
  };

  if (loading) return <div className="text-[13px] text-ttertiary font-mono">Loading…</div>;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-tprimary">Notifications</h1>
          <p className="text-[13px] text-tsecondary mt-1">
            {notifications.length} total · {unreadCount} unread · auto-refresh every 10s
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <GhostButton onClick={markAllRead}>
              <span className="material-symbols-outlined text-[14px] mr-1.5 align-middle">done_all</span>
              Mark all read
            </GhostButton>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-subtle">
        {[
          { id: "all", label: `All (${notifications.length})` },
          { id: "unread", label: `Unread (${unreadCount})` },
          { id: "read", label: `Read (${notifications.length - unreadCount})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors ${
              filter === t.id ? "border-pearl text-pearl" : "border-transparent text-tsecondary hover:text-tprimary"
            }`}
            style={filter === t.id ? { borderColor: "var(--accent-pearl)" } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      {filtered.length === 0 ? (
        <EmptyState icon="notifications_off" title={filter === "unread" ? "No unread notifications — you're all caught up." : "No notifications in this filter."} />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`bg-surface border border-subtle p-4 flex items-start gap-4 transition-colors hover:bg-surface-high ${!n.readAt ? "border-l-2 border-l-pearl" : ""}`}
              style={!n.readAt ? { borderLeftColor: "var(--accent-pearl)" } : {}}
            >
              {/* Icon */}
              <span className={`material-symbols-outlined text-[20px] mt-0.5 shrink-0 ${typeColor(n.type)}`}>
                {typeIcon(n.type)}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] text-tprimary font-medium">{n.title}</span>
                  {!n.readAt && <span className="w-1.5 h-1.5 bg-pearl rounded-full shrink-0" />}
                </div>
                <p className="text-[12px] text-tsecondary mt-1">{n.body}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] text-ttertiary font-mono">{fmtDateTime(n.createdAt)}</span>
                  <span className="text-[10px] text-ttertiary font-mono uppercase tracking-wider">· {n.type.replace(/_/g, " ")}</span>
                  {n.actionUrl && !n.actionUrl.startsWith("/api/") && (
                    <button
                      onClick={() => {
                        if (n.actionUrl === "rti") setBureauView("rti");
                        else if (n.actionUrl === "settings") setBureauView("settings");
                        else if (n.actionUrl === "payslips") setBureauView("payrun_payslips");
                        else if (n.actionUrl === "documents") setBureauView("dashboard");
                        else if (n.actionUrl === "payruns") setBureauView("payrun_input");
                        markRead(n.id);
                      }}
                      className="text-[10px] text-pearl hover:underline uppercase tracking-wider"
                    >
                      Open →
                    </button>
                  )}
                  {n.actionUrl && n.actionUrl.startsWith("/api/") && (
                    <button
                      onClick={() => { window.open(n.actionUrl + `?uid=${user?.id}`, "_blank"); markRead(n.id); }}
                      className="text-[10px] text-pearl hover:underline uppercase tracking-wider"
                    >
                      Download →
                    </button>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {!n.readAt && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="text-[10px] text-tsecondary hover:text-pearl uppercase tracking-wider"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-subtle">
        <span className="text-[11px] text-ttertiary font-mono">Showing {filtered.length} of {notifications.length} notifications</span>
        <GhostButton onClick={() => setBureauView("dashboard")}>
          <span className="material-symbols-outlined text-[14px] mr-1.5 align-middle">arrow_back</span>
          Back to Dashboard
        </GhostButton>
      </div>
    </div>
  );
}
