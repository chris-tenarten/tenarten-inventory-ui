"use client";

import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/rbac";
import { supabase } from "@/lib/supabase";

type WelcomeRecord = { id: string; notification_type: string; read_at: string | null };

function smoothstep(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

export default function WelcomeHero() {
  const auth = useAuth();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const welcomeIdRef = useRef<string | null>(null);
  const completedWelcomeIdRef = useRef<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const complete = useCallback(() => {
    setVisible(false);
    setProgress(1);
    completedWelcomeIdRef.current = welcomeIdRef.current;
    window.dispatchEvent(new Event("tenops:start-notification-onboarding"));
  }, []);

  const loadPendingWelcome = useCallback(async () => {
    if (!auth.isAuthenticated || !auth.profile?.isActive) {
      setVisible(false);
      welcomeIdRef.current = null;
      return;
    }
    const { data, error } = await supabase.rpc("list_my_account_notification_history", { p_limit: 100 });
    if (error) return;
    const welcome = ((data ?? []) as WelcomeRecord[]).find((item) => item.notification_type === "welcome") ?? null;
    welcomeIdRef.current = welcome?.id ?? null;
    if (welcome && welcome.read_at === null && completedWelcomeIdRef.current !== welcome.id) {
      setProgress(0);
      setVisible(true);
    }
  }, [auth.isAuthenticated, auth.profile?.isActive]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadPendingWelcome(), 0);
    const refresh = () => void loadPendingWelcome();
    const replay = () => {
      if (!auth.isAuthenticated || !auth.profile?.isActive) return;
      setProgress(0);
      setVisible(true);
      window.requestAnimationFrame(() => scrollerRef.current?.scrollTo({ top: 0 }));
    };
    window.addEventListener("tenops:notifications-changed", refresh);
    window.addEventListener("tenops:replay-welcome-hero", replay);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("tenops:notifications-changed", refresh);
      window.removeEventListener("tenops:replay-welcome-hero", replay);
    };
  }, [auth.isAuthenticated, auth.profile?.isActive, loadPendingWelcome]);

  useEffect(() => () => { if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current); }, []);

  function handleScroll() {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const element = scrollerRef.current;
      if (!element) return;
      const next = Math.min(1, element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight));
      setProgress(reducedMotion && next > 0.08 ? 1 : smoothstep(next));
      if (next >= (reducedMotion ? 0.08 : 0.94)) void complete();
    });
  }

  if (!visible || !auth.isAuthenticated || !auth.profile?.isActive) return null;

  const motionProgress = reducedMotion ? 0 : progress;
  return <div
    ref={scrollerRef}
    data-welcome-hero
    className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain"
    onScroll={handleScroll}
    aria-label="Welcome to TenOps introduction"
  >
    <div className="relative h-[calc(100dvh+clamp(2016px,313.6vh,3136px))]">
      <section
        data-welcome-hero-surface
        className="sticky top-0 flex h-dvh min-h-[28rem] flex-col items-center justify-center overflow-hidden bg-[#eef1f4] px-5 text-center text-slate-950"
        style={{ opacity: Math.max(0, 1 - progress * 1.08) }}
      >
        <div
          className="flex max-w-2xl flex-col items-center"
          style={{
            opacity: Math.max(0, 1 - progress * 1.35),
            transform: `translateY(${-22 * motionProgress}px) scale(${1 - 0.035 * motionProgress})`,
          }}
        >
          <Image src="/tenarten-logo-hero.webp" alt="Tenarten Terrazzo Precast Manufacturing" width={1024} height={1024} priority className="h-auto w-[clamp(11rem,28vw,19rem)] object-contain" />
          <div className="mt-7 text-[clamp(0.9rem,2vw,1.08rem)] font-bold uppercase tracking-[0.18em] text-slate-700">TenOps Operations Control</div>
          <h1 className="mt-3 text-[clamp(1.05rem,2.4vw,1.42rem)] font-normal tracking-tight text-slate-800">Welcome, {auth.profile.displayName}</h1>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{ROLE_LABELS[auth.profile.role]}</p>
        </div>
        <ChevronDown data-welcome-chevron aria-hidden="true" className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] h-5 w-5 text-slate-400" style={{ opacity: Math.max(0, 1 - progress * 2.4) }} />
        <button type="button" onClick={() => void complete()} className="absolute right-4 top-4 h-8 cursor-pointer border border-transparent px-2 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500 transition hover:border-slate-300 hover:bg-white/60 hover:text-slate-900 active:translate-y-px active:bg-slate-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700">Skip introduction</button>
      </section>
    </div>
  </div>;
}
