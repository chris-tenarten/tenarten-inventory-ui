"use client";

import Image from "next/image";
import { ChevronDown, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/rbac";
import { supabase } from "@/lib/supabase";
import { productionTagClassName } from "@/modules/production/components/production-tag";

type WelcomeRecord = { id: string; notification_type: string; read_at: string | null };
type WelcomeMode = "mandatory" | "replay";

const HERO_PHASES = {
  revealStart: 0,
  revealEnd: 0.65,
  holdEnd: 0.74,
} as const;

function smoothstep(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function phaseProgress(value: number, start: number, end: number) {
  return smoothstep((value - start) / Math.max(0.001, end - start));
}

function linearPhaseProgress(value: number, start: number, end: number) {
  return Math.max(0, Math.min(1, (value - start) / Math.max(0.001, end - start)));
}

function diagonalRevealClip(progress: number) {
  if (progress <= 0) return "polygon(0 0, 0 0, 0 0)";
  if (progress >= 1) return "inset(0)";
  if (progress <= 0.5) {
    const edge = progress * 200;
    return `polygon(0 0, ${edge}% 0, 0 ${edge}%)`;
  }
  const edge = progress * 200 - 100;
  return `polygon(0 0, 100% 0, 100% ${edge}%, ${edge}% 100%, 0 100%)`;
}

export default function WelcomeHero() {
  const auth = useAuth();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const welcomeIdRef = useRef<string | null>(null);
  const completedWelcomeIdRef = useRef<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<WelcomeMode>("mandatory");
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
      setMode("mandatory");
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
      setMode("replay");
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

  useEffect(() => {
    if (!visible || mode !== "replay") return;
    const closeReplay = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVisible(false);
    };
    window.addEventListener("keydown", closeReplay);
    return () => window.removeEventListener("keydown", closeReplay);
  }, [mode, visible]);

  function handleScroll() {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const element = scrollerRef.current;
      if (!element) return;
      const next = Math.min(1, element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight));
      setProgress(next);
      if (next >= (reducedMotion ? 0.08 : 0.94)) void complete();
    });
  }

  function explore() {
    const element = scrollerRef.current;
    if (!element) return;
    const revealDistance = Math.max(1, element.scrollHeight - element.clientHeight);
    element.scrollTo({
      top: revealDistance * 0.38,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  if (!visible || !auth.isAuthenticated || !auth.profile?.isActive) return null;

  const revealProgress = reducedMotion
    ? (progress > HERO_PHASES.revealStart ? 1 : 0)
    : linearPhaseProgress(progress, HERO_PHASES.revealStart, HERO_PHASES.revealEnd);
  const exitProgress = reducedMotion ? 0 : phaseProgress(progress, HERO_PHASES.holdEnd, 1);
  const cueProgress = reducedMotion
    ? (progress >= 0.12 ? 1 : 0)
    : phaseProgress(progress, 0.06, 0.24);
  return <div
    ref={scrollerRef}
    data-welcome-hero
    className="fixed inset-0 z-[80] overflow-y-auto"
    onScroll={handleScroll}
    aria-label="Welcome to TenOps introduction"
  >
    <div className="relative h-[calc(100dvh+clamp(2016px,313.6vh,3136px))]">
      <section
        data-welcome-hero-surface
        className="sticky top-0 flex h-dvh min-h-[28rem] flex-col items-center justify-center overflow-hidden bg-[#eef1f4] px-5 text-center text-slate-950"
        style={{ opacity: Math.max(0, 1 - exitProgress * 1.08) }}
      >
        <div data-welcome-content-layout className="grid h-full w-full grid-rows-[minmax(0,1fr)_auto] items-center py-[clamp(0.75rem,2vh,1.5rem)]">
          <div data-welcome-primary-region className="flex min-h-0 w-full items-center justify-center pb-[clamp(0rem,1vh,0.75rem)]">
            <div
              data-welcome-identity-group
              className="flex max-w-2xl flex-col items-center"
              style={{
                opacity: Math.max(0, 1 - exitProgress * 1.35),
                transform: `translateY(${-22 * exitProgress}px) scale(${1 - 0.035 * exitProgress})`,
              }}
            >
              <div data-welcome-logo-stack className="relative aspect-[1024/1048] shrink-0">
                <Image src="/tenarten-logo-gold-welcome.webp" alt="Tenarten Terrazzo Precast Manufacturing" fill priority sizes="(max-width: 640px) 19rem, 35rem" className="object-contain" />
                <span data-welcome-logo-steel className="absolute inset-0" style={{ clipPath: diagonalRevealClip(revealProgress) }}>
                  <Image src="/tenarten-logo-steel-welcome.webp" alt="" aria-hidden="true" fill priority sizes="(max-width: 640px) 19rem, 35rem" className="object-contain" />
                </span>
              </div>
              <div className="mt-3 text-[clamp(0.9rem,2vw,1.08rem)] font-bold uppercase tracking-[0.18em] text-slate-700">TenOps Operations Control</div>
              <div data-welcome-account-identity className="mt-3 flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1">
                <h1 className="text-[clamp(1.05rem,2.4vw,1.42rem)] font-normal tracking-tight text-slate-800">{auth.profile.displayName}</h1>
                <span data-welcome-role-tag className={`${productionTagClassName} border-slate-300 bg-slate-100 uppercase tracking-[0.06em] text-slate-600`}>{ROLE_LABELS[auth.profile.role]}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            data-welcome-scroll-affordance
            onClick={explore}
            className="inline-flex min-h-12 shrink-0 justify-self-center flex-col items-center justify-center gap-0 px-4 text-[7px] font-medium uppercase tracking-[0.1em] text-slate-500 transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            style={{ opacity: 1 - cueProgress }}
            aria-label="Scroll to explore TenOps"
          >
            <span>Scroll to explore</span>
            <ChevronDown data-welcome-chevron aria-hidden="true" className="h-5 w-5 text-slate-700" />
          </button>
        </div>
        {mode === "replay" ? <button type="button" onClick={() => setVisible(false)} aria-label="Close Welcome introduction" title="Close" className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center text-slate-500 transition hover:bg-white/60 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"><X className="h-4 w-4" aria-hidden="true" /></button> : null}
      </section>
    </div>
  </div>;
}
