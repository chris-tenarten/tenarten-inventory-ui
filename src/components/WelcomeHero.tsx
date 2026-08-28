"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { BRANDING } from "@/lib/dev-branding.mjs";
import { ROLE_LABELS } from "@/lib/rbac";
import { supabase } from "@/lib/supabase";
import { productionTagClassName } from "@/modules/production/components/production-tag";

type WelcomeRecord = { id: string; notification_type: string; read_at: string | null };
type WelcomeMode = "boot" | "replay";

const BOOT_PLAYED_KEY_PREFIX = "tenops.welcomeHeroPlayed:";
const HERO_DURATION_MS = 4600;
const HERO_REDUCED_DURATION_MS = 450;
const ONLINE_HOLD_MS = 900;
const FADE_DURATION_MS = 850;

function smoothstep(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
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

function diagonalRevealCoverage(progress: number) {
  const clamped = Math.max(0, Math.min(1, progress));
  return clamped <= 0.5
    ? 2 * clamped * clamped
    : 1 - 2 * (1 - clamped) * (1 - clamped);
}

export default function WelcomeHero() {
  const auth = useAuth();
  const coverRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const animationStartedAtRef = useRef<number | null>(null);
  const animationCompletedAtRef = useRef<number | null>(null);
  const fadeStartedAtRef = useRef<number | null>(null);
  const criticalAppReadyRef = useRef(false);
  const lastAuthenticatedUserRef = useRef<string | null>(null);
  const welcomeIdRef = useRef<string | null>(null);
  const welcomeUnreadRef = useRef(false);
  const completedWelcomeIdRef = useRef<string | null>(null);
  const modeRef = useRef<WelcomeMode>("boot");
  const preparingBootRef = useRef(false);
  const [preparingBoot, setPreparingBoot] = useState(false);
  const [visible, setVisible] = useState(false);
  const [bootClaimed, setBootClaimed] = useState(false);
  const [mode, setMode] = useState<WelcomeMode>("boot");
  const [progress, setProgress] = useState(0);
  const [fadeProgress, setFadeProgress] = useState(0);
  const [heroAnimationComplete, setHeroAnimationComplete] = useState(false);
  const [criticalAppReady, setCriticalAppReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const heroEligible = auth.ready && !auth.requiresPasswordSetup && auth.isAuthenticated && Boolean(auth.profile?.isActive) && auth.accessAllowed && Boolean(auth.user);
  const bootRequired = heroEligible && !bootClaimed && typeof window !== "undefined" && !window.sessionStorage.getItem(`${BOOT_PLAYED_KEY_PREFIX}${auth.user?.id}`);
  const heroVisible = heroEligible && (visible || bootRequired);
  const heroStartingCoverVisible = !auth.requiresPasswordSetup && (preparingBoot || (bootRequired && !visible));
  const heroCoverVisible = heroStartingCoverVisible || heroVisible;

  const resetTimeline = useCallback(() => {
    animationStartedAtRef.current = null;
    animationCompletedAtRef.current = null;
    fadeStartedAtRef.current = null;
    setProgress(0);
    setFadeProgress(0);
    setHeroAnimationComplete(false);
  }, []);

  const finish = useCallback(() => {
    setVisible(false);
    setProgress(1);
    setFadeProgress(1);
    if (modeRef.current === "replay" || (welcomeUnreadRef.current && completedWelcomeIdRef.current !== welcomeIdRef.current)) {
      completedWelcomeIdRef.current = welcomeIdRef.current;
      window.dispatchEvent(new Event("tenops:start-notification-onboarding"));
    }
  }, []);

  const loadWelcome = useCallback(async () => {
    if (!auth.isAuthenticated || !auth.profile?.isActive) {
      welcomeIdRef.current = null;
      welcomeUnreadRef.current = false;
      return;
    }
    const { data, error } = await supabase.rpc("list_my_account_notification_history", { p_limit: 100 });
    if (error) return;
    const welcome = ((data ?? []) as WelcomeRecord[]).find((item) => item.notification_type === "welcome") ?? null;
    welcomeIdRef.current = welcome?.id ?? null;
    welcomeUnreadRef.current = Boolean(welcome && welcome.read_at === null);
  }, [auth.isAuthenticated, auth.profile?.isActive]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const prepare = () => {
      // The cover is kept mounted so login can hand off visual ownership
      // synchronously before Supabase publishes the authenticated session.
      if (coverRef.current) coverRef.current.hidden = false;
      preparingBootRef.current = true;
      setPreparingBoot(true);
    };
    const cancel = () => {
      if (coverRef.current) coverRef.current.hidden = true;
      preparingBootRef.current = false;
      setPreparingBoot(false);
    };
    window.addEventListener("tenops:prepare-hero-boot", prepare);
    window.addEventListener("tenops:cancel-hero-boot", cancel);
    return () => {
      window.removeEventListener("tenops:prepare-hero-boot", prepare);
      window.removeEventListener("tenops:cancel-hero-boot", cancel);
    };
  }, []);

  useEffect(() => {
    if (!auth.ready) return;
    const timeout = window.setTimeout(() => {
      if (auth.requiresPasswordSetup || !auth.isAuthenticated || !auth.profile?.isActive || !auth.accessAllowed || !auth.user) {
        if (lastAuthenticatedUserRef.current) {
          window.sessionStorage.removeItem(`${BOOT_PLAYED_KEY_PREFIX}${lastAuthenticatedUserRef.current}`);
        }
        lastAuthenticatedUserRef.current = null;
        if (!auth.isAuthenticated || auth.profileError || auth.profile) {
          preparingBootRef.current = false;
          setPreparingBoot(false);
        }
        setBootClaimed(false);
        setVisible(false);
        return;
      }

      const userId = auth.user.id;
      lastAuthenticatedUserRef.current = userId;
      void loadWelcome();
      const playedKey = `${BOOT_PLAYED_KEY_PREFIX}${userId}`;
      if (window.sessionStorage.getItem(playedKey) && !preparingBootRef.current) {
        setBootClaimed(true);
        return;
      }
      window.sessionStorage.setItem(playedKey, "true");
      setBootClaimed(true);
      preparingBootRef.current = false;
      setPreparingBoot(false);
      modeRef.current = "boot";
      setMode("boot");
      resetTimeline();
      setVisible(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [auth.accessAllowed, auth.isAuthenticated, auth.profile, auth.profileError, auth.ready, auth.requiresPasswordSetup, auth.user, loadWelcome, resetTimeline]);

  useEffect(() => {
    const refresh = () => void loadWelcome();
    const replay = () => {
      if (auth.requiresPasswordSetup || !auth.isAuthenticated || !auth.profile?.isActive || !auth.accessAllowed) return;
      modeRef.current = "replay";
      setMode("replay");
      resetTimeline();
      setVisible(true);
    };
    window.addEventListener("tenops:notifications-changed", refresh);
    window.addEventListener("tenops:replay-welcome-hero", replay);
    return () => {
      window.removeEventListener("tenops:notifications-changed", refresh);
      window.removeEventListener("tenops:replay-welcome-hero", replay);
    };
  }, [auth.accessAllowed, auth.isAuthenticated, auth.profile?.isActive, auth.requiresPasswordSetup, loadWelcome, resetTimeline]);

  useEffect(() => {
    const markReady = () => {
      criticalAppReadyRef.current = true;
      setCriticalAppReady(true);
    };
    const timeout = window.setTimeout(() => {
      criticalAppReadyRef.current = window.location.pathname !== "/";
      setCriticalAppReady(criticalAppReadyRef.current);
    }, 0);
    window.addEventListener("tenops:critical-app-ready", markReady);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("tenops:critical-app-ready", markReady);
    };
  }, [auth.user?.id]);

  useEffect(() => {
    if (!heroCoverVisible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.dataset.welcomeHero = mode;
    return () => {
      document.body.style.overflow = previousOverflow;
      delete document.body.dataset.welcomeHero;
    };
  }, [heroCoverVisible, mode]);

  useEffect(() => {
    if (!heroVisible) return;
    const duration = reducedMotion ? HERO_REDUCED_DURATION_MS : HERO_DURATION_MS;
    const fadeDuration = reducedMotion ? 180 : FADE_DURATION_MS;

    const tick = (now: number) => {
      if (animationStartedAtRef.current === null) animationStartedAtRef.current = now;
      const nextProgress = Math.min(1, (now - animationStartedAtRef.current) / duration);
      setProgress(reducedMotion && nextProgress > 0 ? 1 : nextProgress);

      if (nextProgress >= 1) {
        if (animationCompletedAtRef.current === null) {
          animationCompletedAtRef.current = now;
          setHeroAnimationComplete(true);
        }
        if (criticalAppReadyRef.current && now - animationCompletedAtRef.current >= ONLINE_HOLD_MS) {
          if (fadeStartedAtRef.current === null) fadeStartedAtRef.current = now;
          const nextFade = Math.min(1, (now - fadeStartedAtRef.current) / fadeDuration);
          setFadeProgress(smoothstep(nextFade));
          if (nextFade >= 1) {
            finish();
            return;
          }
        }
      }
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [finish, heroVisible, reducedMotion]);

  useEffect(() => {
    if (!visible || mode !== "replay") return;
    const closeReplay = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVisible(false);
    };
    window.addEventListener("keydown", closeReplay);
    return () => window.removeEventListener("keydown", closeReplay);
  }, [mode, visible]);

  const heroProgress = reducedMotion ? (progress > 0 ? 1 : 0) : smoothstep(progress);
  const logoProgress = heroProgress;
  const percent = Math.round(diagonalRevealCoverage(logoProgress) * 100);
  const statusLabel = heroAnimationComplete ? "OPERATIONS ENGINE ONLINE" : "OPERATIONS ENGINE INITIATING";

  return <>
    <div
      ref={coverRef}
      hidden={!heroStartingCoverVisible}
      data-welcome-hero-cover
      data-dev-branding={BRANDING.showDeveloperArtwork ? "true" : undefined}
      className="fixed inset-0 z-[81] bg-[#eef1f4]"
      aria-hidden="true"
    >
      <section className="flex h-dvh min-h-[28rem] flex-col items-center justify-center overflow-hidden px-5 text-center text-slate-950">
        <div className="grid h-full w-full grid-rows-[minmax(0,1fr)_auto] items-center py-[clamp(0.75rem,2vh,1.5rem)]">
          <div className="flex min-h-0 w-full items-center justify-center">
            <div className="flex max-w-2xl flex-col items-center">
              <div data-welcome-logo-stack className="relative aspect-[1024/1048] shrink-0">
                <Image src="/tenarten-logo-gold-welcome.webp" alt="" aria-hidden="true" fill priority sizes="(max-width: 640px) 19rem, 35rem" className="object-contain" />
              </div>
              <div className="mt-3 text-[clamp(0.9rem,2vw,1.08rem)] font-bold uppercase tracking-[0.18em] text-slate-700">TenOps Operations Control</div>
            </div>
          </div>
          <div data-welcome-progress-cover className="mx-auto mb-[clamp(1rem,3vh,2.25rem)] w-full max-w-md px-2">
            <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">
              <span className="min-w-0 flex-1 truncate text-left">OPERATIONS ENGINE INITIATING</span>
              <span className="tabular-nums">0%</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden bg-slate-300">
              <div data-welcome-progress-fill className="h-full w-0 bg-slate-800" />
            </div>
          </div>
        </div>
      </section>
    </div>
    {heroVisible ? <div
    data-welcome-hero
    data-dev-branding={BRANDING.showDeveloperArtwork ? "true" : undefined}
    data-hero-animation-complete={heroAnimationComplete ? "true" : "false"}
    data-critical-app-ready={criticalAppReady ? "true" : "false"}
    className="fixed inset-0 z-[80]"
    aria-label="TenOps operations engine startup"
    aria-live="polite"
  >
    <section
      data-welcome-hero-surface
      className="flex h-dvh min-h-[28rem] flex-col items-center justify-center overflow-hidden bg-[#eef1f4] px-5 text-center text-slate-950"
      style={{ opacity: Math.max(0, 1 - fadeProgress) }}
    >
      <div data-welcome-content-layout className="grid h-full w-full grid-rows-[minmax(0,1fr)_auto] items-center py-[clamp(0.75rem,2vh,1.5rem)]">
        <div data-welcome-primary-region className="flex min-h-0 w-full items-center justify-center">
          <div
            data-welcome-identity-group
            className="flex max-w-2xl flex-col items-center"
            style={{ transform: `translateY(${-18 * fadeProgress}px) scale(${1 - 0.025 * fadeProgress})` }}
          >
            <div data-welcome-logo-stack className="relative aspect-[1024/1048] shrink-0">
              <Image src="/tenarten-logo-gold-welcome.webp" alt="Tenarten Terrazzo Precast Manufacturing" fill priority sizes="(max-width: 640px) 19rem, 35rem" className="object-contain" />
              <span data-welcome-logo-steel className="absolute inset-0" style={{ clipPath: diagonalRevealClip(logoProgress) }}>
                <Image src="/tenarten-logo-steel-welcome.webp" alt="" aria-hidden="true" fill priority sizes="(max-width: 640px) 19rem, 35rem" className="object-contain" />
              </span>
            </div>
            <div className="mt-3 text-[clamp(0.9rem,2vw,1.08rem)] font-bold uppercase tracking-[0.18em] text-slate-700">TenOps Operations Control</div>
            {auth.profile ? <div data-welcome-account-identity className="mt-3 flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <h1 className="text-[clamp(1.05rem,2.4vw,1.42rem)] font-normal tracking-tight text-slate-800">{auth.profile.displayName}</h1>
              <span data-welcome-role-tag className={`${productionTagClassName} border-slate-300 bg-slate-100 uppercase tracking-[0.06em] text-slate-600`}>{ROLE_LABELS[auth.profile.role]}</span>
            </div> : null}
          </div>
        </div>
        <div data-welcome-progress className="mx-auto mb-[clamp(1rem,3vh,2.25rem)] w-full max-w-md px-2">
          <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">
            <span className={`min-w-0 flex-1 truncate text-left ${heroAnimationComplete ? "text-emerald-700" : ""}`}>{statusLabel}</span>
            <span className="tabular-nums">{percent}%</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden bg-slate-300" role="progressbar" aria-label={statusLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <div data-welcome-progress-fill className="h-full bg-slate-800" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>
      {mode === "replay" ? <button type="button" onClick={() => setVisible(false)} aria-label="Close Welcome introduction" title="Close" className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center text-slate-500 transition hover:bg-white/60 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"><X className="h-4 w-4" aria-hidden="true" /></button> : null}
    </section>
    </div> : null}
  </>;
}
