"use client";

import * as React from "react";
import { useApp, fmtDateTime } from "@/store/app";
import {
  EmptyState,
  GhostButton,
  toast,
} from "@/components/kedbyte/primitives";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  actionUrl: string | null;
}

function notifIcon(type: string): string {
  switch (type) {
    case "payslip_ready": return "description";
    case "holiday_decision": return "event";
    case "bank_change": return "account_balance";
    case "p60_ready": return "task_alt";
    case "pay_date": return "payments";
    case "rti_status": return "send";
    default: return "info";
  }
}

function notifColor(type: string): string {
  switch (type) {
    case "payslip_ready": return "text-pearl";
    case "holiday_decision": return "text-success";
    case "bank_change": return "text-warning";
    case "p60_ready": return "text-success";
    case "pay_date": return "text-pearl";
    default: return "text-tsecondary";
  }
}

export function PortalNotifications({ onChanged }: { onChanged: () => void }) {
  const { user, setPortalView } = useApp();
  const [items, setItems] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [markingAll, setMarkingAll] = React.useState(false);

  const load = React.useCallback(() => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/notifications?userId=${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setItems(d.notifications || []);
      })
      .catch(() => toast("Failed to load notifications", "error"))
      .finally(() => setLoading(false));
  }, [user]);

  React.useEffect(() => {
    load();
  }, [load]);

  const unread = items.filter((n) => !n.readAt).length;

  const markRead = async (id: string) => {
    // Optimistic update
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-read", notificationId: id }),
      });
      onChanged();
    } catch {
      toast("Failed to mark as read", "error");
      load();
    }
  };

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    setMarkingAll(true);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-all-read", userId: user.id }),
      });
      toast("All notifications marked as read", "success");
      onChanged();
    } catch {
      toast("Failed to mark all as read", "error");
      load();
    } finally {
      setMarkingAll(false);
    }
  };

  const handleRowClick = (n: Notification) => {
    if (!n.readAt) markRead(n.id);
    if (n.actionUrl) {
      // actionUrl values like "payslips", "holidays" map to portal views
      const validViews = ["dashboard", "payslips", "holidays", "approvals", "details", "documents", "notifications"];
      if (validViews.includes(n.actionUrl)) {
        setPortalView(n.actionUrl as any);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-8 bg-surface-high animate-pulse" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-surface border border-subtle p-4 h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="page-title text-tprimary">Notifications</h1>
          <p className="text-[13px] text-tsecondary mt-1">
            {unread > 0 ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "You're all caught up"}
          </p>
        </div>
        {unread > 0 && (
          <GhostButton onClick={markAllRead} disabled={markingAll}>
            <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">done_all</span>
            {markingAll ? "Marking…" : "Mark all read"}
          </GhostButton>
        )}
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="bg-surface border border-subtle">
          <EmptyState icon="notifications_off" title="No notifications yet." />
        </div>
      ) : (
        <div className="bg-surface border border-subtle divide-y divide-subtle">
          {items.map((n) => {
            const isUnread = !n.readAt;
            return (
              <button
                key={n.id}
                onClick={() => handleRowClick(n)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-high",
                  isUnread && "bg-surface-low"
                )}
              >
                <span className={cn("material-symbols-outlined text-[20px] shrink-0 mt-0.5", notifColor(n.type))}>
                  {notifIcon(n.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[13px] truncate", isUnread ? "text-tprimary font-semibold" : "text-tprimary font-medium")}>
                      {n.title}
                    </span>
                    {isUnread && <span className="w-1.5 h-1.5 bg-pearl shrink-0" />}
                  </div>
                  <p className={cn("text-[12px] mt-0.5 leading-relaxed", isUnread ? "text-tsecondary" : "text-ttertiary")}>
                    {n.body}
                  </p>
                  <div className="text-[11px] text-ttertiary font-mono mt-1.5">{fmtDateTime(n.createdAt)}</div>
                </div>
                {n.actionUrl && (
                  <span className="material-symbols-outlined text-[16px] text-ttertiary shrink-0 mt-0.5">arrow_forward</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {items.length > 0 && (
        <div className="flex items-center justify-between text-[11px] text-ttertiary font-mono">
          <span>Showing {items.length} notification{items.length === 1 ? "" : "s"}</span>
          <button onClick={load} className="hover:text-tprimary transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">refresh</span>
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
