"use client";

import { AlertTriangle, ArrowRight, AtSign, Bell, MessageSquare, Sparkles, UserRoundCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS, type AppRole } from "@/lib/rbac";
import { supabase } from "@/lib/supabase";
import { initialNotificationOnboardingState, notificationOnboardingReducer } from "./notification-onboarding-state";
import { createNotificationArrivalSession, dismissNotificationArrival, observeLiveNotificationArrival, observeNotificationArrivals } from "./notification-arrival-state";

export type AccountNotification = {
  kind: "job_update";
  id: string;
  notification_type: string;
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
  metadata: { role?: AppRole; job_id?: string; update_id?: string; task_id?: string; message_id?: string; conversation_user_id?: string; job_number?: string | null; job_name?: string; purpose?: string; destination?: string; announcement_key?: string; source_available?: boolean };
  read_at: string | null;
  created_at: string;
};

type NotificationItem = AccountNotification | GeneralNotification;
type AccountNotificationInsert = Omit<GeneralNotification, "kind"> & { user_id: string };
type NotificationTab = "unread" | "all";
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
  const router = useRouter();
  const auth = useAuth();
  const isAuthenticated = auth.isAuthenticated;
  const profileIsActive = auth.profile?.isActive;
  const profileUserId = auth.profile?.userId;
  const [{ open, spotlight, arrivalNotificationId }, dispatchOnboarding] = useReducer(notificationOnboardingReducer, initialNotificationOnboardingState);
  const [tab, setTab] = useState<NotificationTab>("unread");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const arrivalSessionRef = useRef(createNotificationArrivalSession());
  const pendingLiveIdsRef = useRef(new Set<string>());
  const loadRequestRef = useRef(0);
  const arrivalNotificationIdRef = useRef(arrivalNotificationId);

  useEffect(() => {
    arrivalNotificationIdRef.current = arrivalNotificationId;
  }, [arrivalNotificationId]);

  const dismissArrival = useCallback((notificationId: string) => {
    dismissNotificationArrival(arrivalSessionRef.current, notificationId);
    dispatchOnboarding({ type: "finish-arrival" });
  }, []);

  const load = useCallback(async (liveNotificationId?: string) => {
    if (!isAuthenticated || !profileIsActive || !profileUserId) { setItems([]); return; }
    if (liveNotificationId) pendingLiveIdsRef.current.add(liveNotificationId);
    const requestId = ++loadRequestRef.current;
    const account = await supabase.rpc("list_my_account_notification_history", { p_limit: 100 });
    if (requestId !== loadRequestRef.current) return;
    if (account.error) { setError(account.error.message); return; }
    const accountItems = ((account.data ?? []) as Omit<GeneralNotification, "kind">[]).map((item): NotificationItem => {
      if (item.notification_type.startsWith("job_update_") && item.metadata.job_id && item.metadata.update_id && item.metadata.job_name) {
        return {
          kind: "job_update",
          id: item.id,
          notification_type: item.notification_type,
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
    const activeArrivalId = arrivalNotificationIdRef.current;
    if (activeArrivalId && !accountItems.some((item) => item.id === activeArrivalId && item.read_at === null)) {
      dispatchOnboarding({ type: "finish-arrival" });
    }
    const arrivalCandidates = accountItems.map((item) => ({ id: item.id, notificationType: item.notification_type, readAt: item.read_at }));
    const liveCandidates = arrivalCandidates.filter((item) => pendingLiveIdsRef.current.has(item.id));
    let focusId: string | null = null;
    if (liveCandidates.length) {
      for (const candidate of liveCandidates) {
        pendingLiveIdsRef.current.delete(candidate.id);
        const candidateFocusId = observeLiveNotificationArrival(arrivalSessionRef.current, candidate);
        focusId ??= candidateFocusId;
      }
    } else {
      focusId = observeNotificationArrivals(arrivalSessionRef.current, arrivalCandidates);
    }
    if (focusId) {
      setTab("unread");
      dispatchOnboarding({ type: "focus-arrival", notificationId: focusId });
    }
    setError("");
  }, [isAuthenticated, profileIsActive, profileUserId]);

  useEffect(() => {
    loadRequestRef.current += 1;
    arrivalSessionRef.current = createNotificationArrivalSession();
    pendingLiveIdsRef.current.clear();
    dispatchOnboarding({ type: "reset" });
  }, [isAuthenticated, profileIsActive, profileUserId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    window.addEventListener("tenops:notifications-changed", refresh);
    return () => { window.clearTimeout(initialLoad); window.removeEventListener("focus", refresh); window.removeEventListener("tenops:notifications-changed", refresh); };
  }, [load]);

  useEffect(() => {
    if (!isAuthenticated || !profileIsActive || !profileUserId) return;
    const channel = supabase
      .channel(`account-notifications:${profileUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "account_notifications", filter: `user_id=eq.${profileUserId}` },
        (payload) => {
          const inserted = payload.new as AccountNotificationInsert;
          if (inserted.user_id !== profileUserId || !inserted.id) return;
          void load(inserted.id);
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [isAuthenticated, load, profileIsActive, profileUserId]);

  useEffect(() => {
    const startOnboarding = () => {
      dispatchOnboarding({ type: "start" });
    };
    window.addEventListener("tenops:start-notification-onboarding", startOnboarding);
    return () => window.removeEventListener("tenops:start-notification-onboarding", startOnboarding);
  }, []);

  useEffect(() => {
    const lockMode = spotlight ?? (arrivalNotificationId ? "arrival" : null);
    if (!lockMode) {
      delete document.body.dataset.notificationOnboarding;
      return;
    }
    document.body.dataset.notificationOnboarding = lockMode;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") dispatchOnboarding({ type: "cancel-spotlight" });
      if (event.key === "Escape" && arrivalNotificationId) dismissArrival(arrivalNotificationId);
    };
    window.addEventListener("keydown", cancel);
    return () => {
      delete document.body.dataset.notificationOnboarding;
      window.removeEventListener("keydown", cancel);
    };
  }, [spotlight, arrivalNotificationId, dismissArrival]);

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
    if (arrivalNotificationId === item.id) {
      dismissNotificationArrival(arrivalSessionRef.current, item.id);
      dispatchOnboarding({ type: "finish-arrival" });
    }
    if (!await markRead(item)) return;
    if (item.kind === "general" && item.notification_type === "welcome") {
      dispatchOnboarding({ type: "cancel-spotlight" });
      dispatchOnboarding({ type: "close" });
      setWelcomeOpen(true);
      return;
    }
    if (item.kind === "general" && item.notification_type === "appearance_available") {
      dispatchOnboarding({ type: "close" });
      router.push("/settings#appearance");
      return;
    }
    if (item.kind === "general" && item.notification_type === "feature_announcement" && item.metadata.destination?.startsWith("/") && !item.metadata.destination.startsWith("//")) {
      dispatchOnboarding({ type: "close" });
      router.push(item.metadata.destination);
      return;
    }
    if (item.kind === "general" && item.notification_type === "inbox_message" && item.metadata.conversation_user_id) {
      dispatchOnboarding({ type: "close" });
      window.dispatchEvent(new CustomEvent("tenops:open-inbox", { detail: { userId: item.metadata.conversation_user_id } }));
      router.push(`/my-work?inboxUserId=${encodeURIComponent(item.metadata.conversation_user_id)}`);
      return;
    }
    if (item.kind === "general" && item.notification_type.startsWith("shared_task_") && item.metadata.task_id) {
      dispatchOnboarding({ type: "close" });
      router.push(`/my-work?view=shared&taskId=${encodeURIComponent(item.metadata.task_id)}`);
      return;
    }
    if (item.kind === "job_update" && item.source_available) {
      dispatchOnboarding({ type: "close" });
      onOpen(item);
    }
  }

  async function markAllRead() {
    if (arrivalNotificationId) dismissArrival(arrivalNotificationId);
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
  const arrivalItem = arrivalNotificationId ? items.find((item) => item.id === arrivalNotificationId) ?? null : null;
  const overlays = typeof document === "undefined" ? null : createPortal(<>
    {spotlight || arrivalItem ? <div data-notification-onboarding-scrim className="fixed inset-0 z-50 bg-slate-950/35" aria-hidden="true" /> : null}
    {open ? <div role="dialog" aria-label="Notifications" className="fixed right-3 top-[max(4rem,env(safe-area-inset-top))] z-[80] flex max-h-[calc(100dvh-max(5rem,env(safe-area-inset-top)))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden border border-slate-300 bg-white p-2 text-left shadow-xl">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-2 pb-2">
        <strong className="text-sm">Notifications</strong>
        <span className="flex items-center">
          <button type="button" onClick={() => arrivalNotificationId ? dismissArrival(arrivalNotificationId) : dispatchOnboarding({ type: "close" })} aria-label="Close Notifications" className="inline-flex h-7 w-7 items-center justify-center hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </span>
      </div>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-2 py-2">
        <div className="flex" role="tablist" aria-label="Notification views">
          {(["unread", "all"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`h-7 border px-3 text-[10px] font-bold uppercase ${tab === value ? "tenops-selected-surface" : "border-slate-300 text-slate-600"}`}>{value}</button>)}
        </div>
        {unreadCount && spotlight !== "welcome" ? <button type="button" disabled={working} onClick={() => void markAllRead()} className="text-[10px] font-bold uppercase text-blue-700 disabled:opacity-50">Mark all as read</button> : null}
      </div>
      {spotlight === "welcome" ? <div data-welcome-row-guidance className="shrink-0 border-b border-blue-200 bg-blue-50 px-2 py-2 text-[10px] font-semibold text-blue-900">Open Welcome to finish Getting Started.</div> : null}
      {arrivalItem ? <div data-notification-arrival-guidance className="shrink-0 border-b border-blue-200 bg-blue-50 px-2 py-2 text-[10px] font-semibold text-blue-900">A new personal notification needs your attention.</div> : null}
      {error ? <div role="alert" className="shrink-0 p-2 text-xs font-semibold text-red-700">Unable to load Notifications.</div> : null}
      {!error && !visibleItems.length ? <div className="p-4 text-xs text-slate-500">{tab === "unread" ? "You're all caught up." : "No notifications yet."}</div> : null}
      <div data-notification-scroll-region className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {visibleItems.map((item) => {
          const isWelcome = item.kind === "general" && item.notification_type === "welcome";
          const isArrival = item.id === arrivalNotificationId;
          return <div key={item.id} data-welcome-notification-row={isWelcome ? "true" : undefined} data-arrival-notification-row={isArrival ? "true" : undefined} className={`border-b border-slate-100 ${item.read_at && !isWelcome ? "opacity-65" : item.read_at ? "" : "bg-blue-50/40"} ${spotlight === "welcome" && isWelcome ? "relative z-[1] ring-2 ring-inset ring-blue-600" : ""} ${isArrival ? "relative z-[1] bg-blue-50 ring-2 ring-inset ring-blue-600" : ""}`}>
          <button type="button" onClick={() => void openItem(item)} className={`block w-full px-2 py-3 text-left transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${isWelcome ? "cursor-pointer hover:bg-blue-50/70" : ""}`}>
            <span className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-slate-950">{isWelcome || item.kind === "general" && item.notification_type === "feature_announcement" ? <Sparkles className="h-3.5 w-3.5 shrink-0 text-blue-700" /> : item.kind === "general" && item.notification_type === "inbox_message" ? <MessageSquare className="h-3.5 w-3.5 shrink-0 text-blue-700" /> : item.kind === "job_update" && item.title.toLowerCase().includes("mention") ? <AtSign className="h-3.5 w-3.5 shrink-0 text-blue-700" /> : <UserRoundCheck className="h-3.5 w-3.5 shrink-0 text-slate-500" />}<span className="truncate">{item.title}</span></span>
              <time dateTime={item.created_at} className="shrink-0 text-[10px] text-slate-500">{relativeTime(item.created_at)}</time>
            </span>
            {item.kind === "job_update" ? <>
              <span className="mt-1 block text-[11px] font-semibold text-slate-700">{item.job_number ? `${item.job_number} · ` : ""}{item.job_name}</span>
              <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-slate-600">{item.body}</span>
              <span className={`mt-1 block text-[10px] font-bold uppercase tracking-[0.08em] ${item.source_available ? "text-blue-700" : "text-slate-500"}`}>{item.source_available ? "Open Job Update" : "Job Update no longer available"}</span>
            </> : <>
              <span className="mt-1 block text-xs leading-relaxed text-slate-600">{item.body}</span>
              {item.metadata.role && ROLE_LABELS[item.metadata.role] ? <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-blue-700">Role: {ROLE_LABELS[item.metadata.role]}</span> : null}
              {isWelcome ? <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-blue-700">Open Welcome <ArrowRight className="h-3 w-3" aria-hidden="true" /></span> : null}
            </>}
          </button>
          {isArrival ? <div className="flex items-center justify-end gap-2 px-2 pb-3">
            <button type="button" onClick={() => dismissArrival(item.id)} className="h-8 border border-slate-300 bg-white px-3 text-[10px] font-bold uppercase text-slate-700 hover:bg-slate-50">Not now</button>
            <button type="button" onClick={() => void openItem(item)} className="tenops-selected-surface h-8 border px-3 text-[10px] font-bold uppercase">View notification</button>
          </div> : null}
          </div>;
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
    if (!open && spotlight === "bell") {
      setTab(welcomeItem?.read_at ? "all" : "unread");
    }
    dispatchOnboarding({ type: "toggle" });
  }

  return <div data-account-notifications data-onboarding-spotlight={spotlight ?? undefined} data-arrival-attention={arrivalNotificationId ?? undefined} className={`relative shrink-0 ${spotlight || arrivalNotificationId ? "z-[90]" : ""}`}>
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
      {unreadCount ? <span aria-label={`${unreadCount} unread notifications`} className="tenops-compact-type absolute right-0.5 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 font-bold leading-none text-white ring-2 ring-white">{unreadCount}</span> : null}
    </button>
    {spotlight === "bell" ? <div role="note" className="absolute right-0 top-full mt-2 w-max max-w-48 border border-blue-300 bg-white px-3 py-2 text-left shadow-lg"><div className="text-[10px] font-bold text-slate-900">Your updates live here</div><div className="mt-0.5 text-[10px] leading-relaxed text-slate-600">Open Notifications to continue.</div></div> : null}
    {overlays}
  </div>;
}
