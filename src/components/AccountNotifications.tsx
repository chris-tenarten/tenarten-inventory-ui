"use client";

import { AlertTriangle, AtSign, Bell, MessageSquare, Sparkles, UserRoundCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS, type AppRole } from "@/lib/rbac";
import { supabase } from "@/lib/supabase";

export type AccountNotification = {
  kind: "job_update";
  id: string;
  title: string;
  update_id: string;
  job_id: string;
  job_number: string | null;
  job_name: string;
  body: string;
  source_available: boolean;
  read_at: string | null;
  created_at: string;
};

type GeneralNotification = {
  kind: "general";
  id: string;
  notification_type: string;
  title: string;
  body: string;
  metadata: { role?: AppRole; job_id?: string; update_id?: string; job_number?: string | null; job_name?: string; purpose?: string; source_available?: boolean };
  read_at: string | null;
  created_at: string;
};

type NotificationItem = AccountNotification | GeneralNotification;
type NotificationTab = "unread" | "all";
type OnboardingSpotlight = "bell" | "welcome" | null;

function relativeTime(value: string) {
  const elapsedSeconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(elapsedSeconds) < 60) return formatter.format(-elapsedSeconds, "second");
  const minutes = Math.round(elapsedSeconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return formatter.format(-days, "day");
  return new Date(value).toLocaleDateString();
}

export default function AccountNotifications({ onOpen }: { onOpen(notification: AccountNotification): void }) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotificationTab>("unread");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [spotlight, setSpotlight] = useState<OnboardingSpotlight>(null);

  const load = useCallback(async () => {
    if (!auth.isAuthenticated || !auth.profile?.isActive) { setItems([]); return; }
    const account = await supabase.rpc("list_my_account_notification_history", { p_limit: 100 });
    if (account.error) { setError(account.error.message); return; }
    const accountItems = ((account.data ?? []) as Omit<GeneralNotification, "kind">[]).map((item): NotificationItem => {
      if (item.notification_type.startsWith("job_update_") && item.metadata.job_id && item.metadata.update_id && item.metadata.job_name) {
        return {
          kind: "job_update",
          id: item.id,
          title: item.title,
          update_id: item.metadata.update_id,
          job_id: item.metadata.job_id,
          job_number: item.metadata.job_number ?? null,
          job_name: item.metadata.job_name,
          body: item.body.split("\n").slice(1).join("\n") || item.body,
          source_available: item.metadata.source_available !== false,
          read_at: item.read_at,
          created_at: item.created_at,
        };
      }
      return { ...item, kind: "general" };
    });
    setItems(accountItems);
    setError("");
  }, [auth.isAuthenticated, auth.profile?.isActive]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    window.addEventListener("tenops:notifications-changed", refresh);
    return () => { window.clearTimeout(initialLoad); window.removeEventListener("focus", refresh); window.removeEventListener("tenops:notifications-changed", refresh); };
  }, [load]);

  useEffect(() => {
    const startOnboarding = () => {
      setOpen(false);
      setSpotlight("bell");
    };
    window.addEventListener("tenops:start-notification-onboarding", startOnboarding);
    return () => window.removeEventListener("tenops:start-notification-onboarding", startOnboarding);
  }, []);

  useEffect(() => {
    if (!spotlight) {
      delete document.body.dataset.notificationOnboarding;
      return;
    }
    document.body.dataset.notificationOnboarding = spotlight;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSpotlight(null);
    };
    window.addEventListener("keydown", cancel);
    return () => {
      delete document.body.dataset.notificationOnboarding;
      window.removeEventListener("keydown", cancel);
    };
  }, [spotlight]);

  const unreadCount = useMemo(() => items.filter((item) => item.read_at === null).length, [items]);
  const visibleItems = useMemo(() => tab === "unread" ? items.filter((item) => item.read_at === null) : items, [items, tab]);

  async function markRead(item: NotificationItem) {
    if (item.read_at) return true;
    const { error: readError } = await supabase.rpc("mark_my_account_notification_read", { p_notification_id: item.id });
    if (readError) { setError(readError.message); return false; }
    const readAt = new Date().toISOString();
    setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, read_at: readAt } : candidate));
    return true;
  }

  async function openItem(item: NotificationItem) {
    if (!await markRead(item)) return;
    if (item.kind === "general" && item.notification_type === "welcome") {
      setSpotlight(null);
      setOpen(false);
      setWelcomeOpen(true);
      return;
    }
    if (item.kind === "job_update" && item.source_available) {
      setOpen(false);
      onOpen(item);
    }
  }

  async function markAllRead() {
    setWorking(true);
    const { error: readError } = await supabase.rpc("mark_all_my_account_notifications_read");
    if (readError) setError(readError.message);
    else {
      const readAt = new Date().toISOString();
      setItems((current) => current.map((item) => item.read_at ? item : { ...item, read_at: readAt }));
      setError("");
    }
    setWorking(false);
  }

  if (!auth.isAuthenticated || !auth.profile?.isActive) return null;
  const welcomeItem = items.find((item): item is GeneralNotification => item.kind === "general" && item.notification_type === "welcome") ?? null;
  const overlays = typeof document === "undefined" ? null : createPortal(<>
    {spotlight ? <div data-notification-onboarding-scrim className="fixed inset-0 z-50 bg-slate-950/35" aria-hidden="true" /> : null}
    {open ? <div role="dialog" aria-label="Notifications" className="fixed right-3 top-[max(4rem,env(safe-area-inset-top))] z-[80] flex max-h-[calc(100dvh-max(5rem,env(safe-area-inset-top)))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden border border-slate-300 bg-white p-2 text-left shadow-xl">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-2 pb-2">
        <strong className="text-sm">Notifications</strong>
        <span className="flex items-center">
          <button type="button" onClick={() => { setOpen(false); setSpotlight(null); }} aria-label="Close Notifications" className="inline-flex h-7 w-7 items-center justify-center hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </span>
      </div>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-2 py-2">
        <div className="flex" role="tablist" aria-label="Notification views">
          {(["unread", "all"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`h-7 border px-3 text-[10px] font-bold uppercase ${tab === value ? "tenops-selected-surface" : "border-slate-300 text-slate-600"}`}>{value}</button>)}
        </div>
        {unreadCount && spotlight !== "welcome" ? <button type="button" disabled={working} onClick={() => void markAllRead()} className="text-[10px] font-bold uppercase text-blue-700 disabled:opacity-50">Mark all as read</button> : null}
      </div>
      {spotlight === "welcome" ? <div data-welcome-row-guidance className="shrink-0 border-b border-blue-200 bg-blue-50 px-2 py-2 text-[10px] font-semibold text-blue-900">Open Welcome to finish Getting Started.</div> : null}
      {error ? <div role="alert" className="shrink-0 p-2 text-xs font-semibold text-red-700">Unable to load Notifications.</div> : null}
      {!error && !visibleItems.length ? <div className="p-4 text-xs text-slate-500">{tab === "unread" ? "You're all caught up." : "No notifications yet."}</div> : null}
      <div data-notification-scroll-region className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {visibleItems.map((item) => {
          const isWelcome = item.kind === "general" && item.notification_type === "welcome";
          return <button key={item.id} type="button" data-welcome-notification-row={isWelcome ? "true" : undefined} onClick={() => void openItem(item)} className={`block w-full border-b border-slate-100 px-2 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none ${item.read_at ? "opacity-65" : "bg-blue-50/40"} ${spotlight === "welcome" && isWelcome ? "relative z-[1] ring-2 ring-inset ring-blue-600" : ""}`}>
            <span className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-slate-950">{isWelcome ? <Sparkles className="h-3.5 w-3.5 shrink-0 text-blue-700" /> : item.kind === "job_update" && item.title.toLowerCase().includes("mention") ? <AtSign className="h-3.5 w-3.5 shrink-0 text-blue-700" /> : <UserRoundCheck className="h-3.5 w-3.5 shrink-0 text-slate-500" />}<span className="truncate">{item.title}</span></span>
              <time dateTime={item.created_at} className="shrink-0 text-[10px] text-slate-500">{relativeTime(item.created_at)}</time>
            </span>
            {item.kind === "job_update" ? <>
              <span className="mt-1 block text-[11px] font-semibold text-slate-700">{item.job_number ? `${item.job_number} · ` : ""}{item.job_name}</span>
              <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-slate-600">{item.body}</span>
              <span className={`mt-1 block text-[10px] font-bold uppercase tracking-[0.08em] ${item.source_available ? "text-blue-700" : "text-slate-500"}`}>{item.source_available ? "Open Job Update" : "Job Update no longer available"}</span>
            </> : <>
              <span className="mt-1 block text-xs leading-relaxed text-slate-600">{item.body}</span>
              {item.metadata.role && ROLE_LABELS[item.metadata.role] ? <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-blue-700">Role: {ROLE_LABELS[item.metadata.role]}</span> : null}
            </>}
          </button>;
        })}
      </div>
    </div> : null}
    {welcomeOpen ? <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setWelcomeOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="welcome-tenops-title" className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden border border-slate-300 bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between border-b border-slate-200 px-4 py-3"><div><h2 id="welcome-tenops-title" className="text-lg font-bold text-slate-950">Welcome to TenOps</h2><p className="mt-0.5 text-xs text-slate-600">{auth.profile?.displayName} · {auth.profile ? ROLE_LABELS[auth.profile.role] : ""}</p></div><button type="button" onClick={() => setWelcomeOpen(false)} aria-label="Close Welcome to TenOps" className="inline-flex h-8 w-8 items-center justify-center hover:bg-slate-100"><X className="h-4 w-4" /></button></header>
        <div className="min-h-0 flex-1 divide-y divide-slate-200 overflow-y-auto overscroll-contain px-4">
          <div className="flex gap-3 py-3"><Bell className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" /><div><h3 className="text-xs font-bold text-slate-950">Notifications</h3><p className="mt-0.5 text-xs leading-relaxed text-slate-600">Direct @mentions, assignments, and other account-specific activity appear here. Generic Job Updates do not create personal bell notifications.</p></div></div>
          <div className="flex gap-3 py-3"><AtSign className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" /><div><h3 className="text-xs font-bold text-slate-950">@mentions and Job Updates</h3><p className="mt-0.5 text-xs leading-relaxed text-slate-600">Use the Job Update control to open each Job’s conversation. Type @ and select an active TenOps user to notify them directly.</p></div></div>
          <div className="flex gap-3 py-3"><MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" /><div><h3 className="text-xs font-bold text-slate-950">Follow-ups</h3><p className="mt-0.5 text-xs leading-relaxed text-slate-600">Job Update assignments and resolution track the operational work. Notifications alert people specifically mentioned or assigned.</p></div></div>
          <div className="flex gap-3 py-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><div><h3 className="text-xs font-bold text-slate-950">Production Attention</h3><p className="mt-0.5 text-xs leading-relaxed text-slate-600">Unscheduled Jobs are priority scheduling exceptions. Other “Needs Attention” items remain in the secondary operational queue.</p></div></div>
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3"><button type="button" onClick={() => { setWelcomeOpen(false); window.dispatchEvent(new Event("tenops:replay-welcome-hero")); }} className="h-8 px-2 text-[10px] font-bold uppercase tracking-[0.06em] text-blue-700 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-700">Replay introduction</button><button type="button" onClick={() => setWelcomeOpen(false)} className="tenops-selected-surface h-9 border px-3 text-xs font-bold">Got it — open TenOps</button></footer>
      </section>
    </div> : null}
  </>, document.body);

  function toggleNotifications() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && spotlight === "bell") {
      setTab(welcomeItem?.read_at ? "all" : "unread");
      setSpotlight("welcome");
    }
  }

  return <div data-account-notifications data-onboarding-spotlight={spotlight ?? undefined} className={`relative shrink-0 ${spotlight ? "z-[90]" : ""}`}>
    <button
      type="button"
      onClick={toggleNotifications}
      aria-label="Notifications"
      title="Notifications"
      aria-expanded={open}
      aria-haspopup="dialog"
      className={`relative inline-flex h-9 w-9 items-center justify-center text-slate-600 transition hover:bg-slate-200/40 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:h-10 sm:w-10 ${spotlight === "bell" ? "bg-white text-blue-800 ring-2 ring-blue-500 shadow-lg" : ""}`}
    >
      <Bell className="h-4 w-4" aria-hidden="true" />
      {unreadCount ? <span aria-label={`${unreadCount} unread notifications`} className="absolute right-0.5 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">{unreadCount}</span> : null}
    </button>
    {spotlight === "bell" ? <div role="note" className="absolute right-0 top-full mt-2 w-max max-w-48 border border-blue-300 bg-white px-3 py-2 text-left shadow-lg"><div className="text-[10px] font-bold text-slate-900">Your updates live here</div><div className="mt-0.5 text-[10px] leading-relaxed text-slate-600">Open Notifications to continue.</div></div> : null}
    {overlays}
  </div>;
}
