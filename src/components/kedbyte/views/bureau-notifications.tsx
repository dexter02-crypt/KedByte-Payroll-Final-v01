"use client";

import * as React from "react";
import { useApp, fmtDateTime, type BureauView } from "@/store/app";
import {
  EmptyState,
  PearlButton,
  GhostButton,
  Modal,
  Field,
  TextInput,
  Select,
  toast,
} from "@/components/kedbyte/primitives";

// ============================================================
// BUREAU NOTIFICATIONS VIEW — full-page notification center
// Every notification is fully clickable and routes to its source
// ============================================================

export function BureauNotificationsView() {
  const { user, setBureauView } = useApp();
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState("all");
  const [tab, setTab] = React.useState<"notifications" | "tickets">("notifications");
  const [tickets, setTickets] = React.useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = React.useState(true);
  const [supportOpen, setSupportOpen] = React.useState(false);

  const load = React.useCallback(() => {
    if (!user) return;
    fetch(`/api/notifications?userId=${user.id}`)
      .then((r) => r.json())
      .then((d) => setNotifications(d.notifications || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const loadTickets = React.useCallback(() => {
    fetch(`/api/support?userId=${user?.id || "user_admin"}`)
      .then((r) => r.json())
      .then((d) => setTickets(d.tickets || []))
      .catch(() => {})
      .finally(() => setLoadingTickets(false));
  }, [user]);

  React.useEffect(() => {
    load();
    loadTickets();
    const interval = setInterval(() => { load(); loadTickets(); }, 10000);
    return () => clearInterval(interval);
  }, [load, loadTickets]);

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

  // Route a notification to its source page
  const routeNotification = (n: any) => {
    markRead(n.id);
    const url = n.actionUrl || "";
    // API download links
    if (url.startsWith("/api/")) {
      window.open(url + `?uid=${user?.id}`, "_blank");
      return;
    }
    // Route mapping
    const routes: Record<string, BureauView> = {
      rti: "rti",
      settings: "settings",
      payslips: "payrun_payslips",
      documents: "dashboard",
      payruns: "payrun_input",
      dashboard: "dashboard",
      pensions: "pensions",
      details: "dashboard",
      holidays: "dashboard",
    };
    // Type-based routing
    const typeRoutes: Record<string, BureauView> = {
      export_ready: "settings",
      rti_status: "rti",
      rti_rejected: "rti",
      payslip_ready: "payrun_payslips",
      p60_ready: "settings",
      holiday_decision: "dashboard",
      bank_change: "settings",
      pay_date: "payrun_input",
      sync_complete: "settings",
      dps_fetch_complete: "settings",
      job_failed: "settings",
      support_ticket: "notifications",
      mfa_reset: "settings",
      password_changed: "settings",
      password_reset: "settings",
      yearend_complete: "settings",
    };
    const target = routes[url] || typeRoutes[n.type] || "dashboard";
    if (target === "notifications") {
      setTab("tickets");
    } else {
      setBureauView(target);
    }
  };

  const filtered = filter === "unread"
    ? notifications.filter((n) => !n.readAt)
    : filter === "read"
    ? notifications.filter((n) => n.readAt)
    : notifications;

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const typeIcon = (type: string) => {
    const icons: Record<string, string> = {
      export_ready: "download", rti_status: "send", rti_rejected: "error",
      payslip_ready: "description", p60_ready: "task_alt", holiday_decision: "event",
      bank_change: "account_balance", pay_date: "payments", sync_complete: "sync",
      dps_fetch_complete: "sync", job_failed: "error", support_ticket: "support_agent",
      mfa_reset: "lock_reset", password_changed: "key", password_reset: "mail_lock",
      yearend_complete: "event_available",
    };
    return icons[type] || "notifications";
  };

  const typeColor = (type: string) => {
    if (["export_ready", "payslip_ready", "p60_ready", "sync_complete", "yearend_complete"].includes(type)) return "text-success";
    if (["rti_status", "dps_fetch_complete", "pay_date"].includes(type)) return "text-warning";
    if (["rti_rejected", "job_failed", "error"].includes(type)) return "text-error";
    if (type === "support_ticket") return "text-pearl";
    return "text-ttertiary";
  };

  const typeRouteLabel = (type: string, actionUrl?: string) => {
    const labels: Record<string, string> = {
      export_ready: "Go to System →",
      rti_status: "Go to RTI →",
      rti_rejected: "Go to RTI Errors →",
      payslip_ready: "Go to Payslips →",
      p60_ready: "Go to Documents →",
      holiday_decision: "Go to Holidays →",
      bank_change: "Go to Settings →",
      pay_date: "Go to Pay Runs →",
      sync_complete: "Go to System →",
      dps_fetch_complete: "Go to System →",
      job_failed: "Go to System →",
      support_ticket: "View Tickets →",
      mfa_reset: "Go to Settings →",
      password_changed: "Go to Settings →",
      password_reset: "Go to Settings →",
      yearend_complete: "Go to Documents →",
    };
    return labels[type] || (actionUrl ? "Open →" : "");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="page-title text-tprimary">Notifications & Support</h1>
          <p className="text-[13px] text-tsecondary mt-1">
            {tab === "notifications" ? `${notifications.length} total · ${unreadCount} unread · auto-refresh 10s` : `${tickets.length} support tickets`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "notifications" && unreadCount > 0 && (
            <GhostButton onClick={markAllRead}>
              <span className="material-symbols-outlined text-[14px] mr-1.5 align-middle">done_all</span>
              Mark all read
            </GhostButton>
          )}
          {tab === "tickets" && (
            <PearlButton onClick={() => setSupportOpen(true)}>
              <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">add</span>
              New Ticket
            </PearlButton>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-subtle">
        <button
          onClick={() => setTab("notifications")}
          className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors ${tab === "notifications" ? "border-pearl text-pearl" : "border-transparent text-tsecondary hover:text-tprimary"}`}
          style={tab === "notifications" ? { borderColor: "var(--accent-pearl)" } : {}}
        >
          Notifications ({notifications.length})
        </button>
        <button
          onClick={() => setTab("tickets")}
          className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors ${tab === "tickets" ? "border-pearl text-pearl" : "border-transparent text-tsecondary hover:text-tprimary"}`}
          style={tab === "tickets" ? { borderColor: "var(--accent-pearl)" } : {}}
        >
          Support Tickets ({tickets.length})
        </button>
      </div>

      {/* NOTIFICATIONS TAB */}
      {tab === "notifications" && (
        <>
          {/* Filter */}
          <div className="flex gap-2">
            {[
              { id: "all", label: `All (${notifications.length})` },
              { id: "unread", label: `Unread (${unreadCount})` },
              { id: "read", label: `Read (${notifications.length - unreadCount})` },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={`px-3 py-1.5 text-[11px] font-medium border transition-colors ${filter === t.id ? "border-pearl text-pearl bg-surface-high" : "border-subtle text-tsecondary hover:text-tprimary"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Notification list — entire row is clickable */}
          {loading ? (
            <div className="text-[13px] text-ttertiary font-mono">Loading…</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon="notifications_off" title={filter === "unread" ? "No unread notifications — you're all caught up." : "No notifications in this filter."} />
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((n) => (
                <button
                  key={n.id}
                  onClick={() => routeNotification(n)}
                  className={`w-full text-left bg-surface border border-subtle p-4 flex items-start gap-4 transition-colors hover:bg-surface-high cursor-pointer ${!n.readAt ? "border-l-2" : ""}`}
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
                      <span className="text-[10px] text-pearl font-medium uppercase tracking-wider">{typeRouteLabel(n.type, n.actionUrl)}</span>
                    </div>
                  </div>

                  {/* Unread indicator */}
                  {!n.readAt && (
                    <div className="flex items-center shrink-0" onClick={(e) => { e.stopPropagation(); markRead(n.id); }}>
                      <span className="text-[10px] text-tsecondary hover:text-pearl uppercase tracking-wider">Mark read</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* SUPPORT TICKETS TAB */}
      {tab === "tickets" && (
        <>
          {loadingTickets ? (
            <div className="text-[13px] text-ttertiary font-mono">Loading tickets…</div>
          ) : tickets.length === 0 ? (
            <EmptyState icon="support_agent" title="No support tickets yet. Click 'New Ticket' to create one." action={() => setSupportOpen(true)} actionLabel="Create Ticket" />
          ) : (
            <div className="flex flex-col gap-2">
              {tickets.map((t) => (
                <div key={t.ticketRef} className="bg-surface border border-subtle p-4 flex items-start gap-4">
                  <span className="material-symbols-outlined text-[20px] mt-0.5 shrink-0 text-pearl">support_agent</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] text-tprimary font-medium">Ticket #{t.ticketRef}</span>
                      <span className="text-[10px] text-ttertiary font-mono uppercase tracking-wider border border-subtle px-1.5 py-0.5">{t.topic}</span>
                    </div>
                    <p className="text-[12px] text-tsecondary mt-1">
                      {t.email ? `From: ${t.email} · ` : ""}{t.messageLength || 0} chars · Created {fmtDateTime(t.createdAt)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-success font-mono uppercase tracking-wider">● Open</span>
                      <span className="text-[10px] text-ttertiary font-mono">Response within 4 business hours</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-subtle">
        <span className="text-[11px] text-ttertiary font-mono">
          {tab === "notifications" ? `Showing ${filtered.length} of ${notifications.length}` : `Showing ${tickets.length} tickets`}
        </span>
        <GhostButton onClick={() => setBureauView("dashboard")}>
          <span className="material-symbols-outlined text-[14px] mr-1.5 align-middle">arrow_back</span>
          Back to Dashboard
        </GhostButton>
      </div>

      {/* Support ticket modal */}
      <SupportTicketModal open={supportOpen} onClose={() => { setSupportOpen(false); loadTickets(); load(); }} userId={user?.id || "user_admin"} />
    </div>
  );
}

// ============ SUPPORT TICKET MODAL (inline) ============
function SupportTicketModal({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
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
        body: JSON.stringify({ topic, email, message, userId }),
      });
      const d = await res.json();
      setSending(false);
      if (res.ok || res.status === 201) {
        setTicketRef(d.ticketRef);
        setSent(true);
        toast(d.message || `Ticket ${d.ticketRef} created`, "success");
      } else {
        toast(d.error || "Failed", "error");
      }
    } catch { setSending(false); toast("Network error", "error"); }
  };

  const reset = () => { setTopic(""); setMessage(""); setEmail(""); setSent(false); setTicketRef(""); };

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title="New Support Ticket" wide>
      <div className="flex flex-col gap-4">
        {sent ? (
          <div className="flex flex-col items-center py-8 gap-4">
            <span className="material-symbols-outlined text-[48px] text-success">check_circle</span>
            <div className="text-center">
              <h3 className="text-[16px] font-semibold text-tprimary">Ticket #{ticketRef} created</h3>
              <p className="text-[12px] text-tsecondary mt-1">Our team will respond within 4 business hours. You can track this ticket in the Support Tickets tab.</p>
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
                <button key={t.id} onClick={() => setTopic(t.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 border text-[12px] font-medium transition-colors ${topic === t.id ? "border-pearl bg-surface-high text-pearl" : "border-subtle text-tsecondary hover:text-tprimary hover:border-pearl-dim"}`}>
                  <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
            <Field label="Your Email (optional)">
              <TextInput value={email} onChange={setEmail} placeholder="your@email.co.uk" />
            </Field>
            <Field label="Describe the issue">
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5}
                placeholder="e.g. When I click Submit FPS, nothing happens..."
                className="bg-surface-low border border-subtle px-3 py-2 text-[13px] text-tprimary placeholder:text-ttertiary outline-none focus:border-pearl transition-colors resize-none" />
            </Field>
            <div className="flex justify-end gap-3 pt-2 border-t border-subtle">
              <GhostButton onClick={() => { onClose(); reset(); }}>Cancel</GhostButton>
              <PearlButton onClick={submit} disabled={sending || !topic || !message}>
                {sending ? "Submitting…" : "Submit Ticket"}
              </PearlButton>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
