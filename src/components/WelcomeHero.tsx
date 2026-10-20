"use client";

import Image from "next/image";
import TerrazzoReveal from "./TerrazzoReveal";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { BRANDING } from "@/lib/dev-branding.mjs";
import { ROLE_LABELS } from "@/lib/rbac";
import type { WelcomeNotificationStatus } from "./AccountNotifications";
import { productionTagClassName } from "@/modules/production/components/production-tag";

import { pendingNotificationId } from "@/lib/notification-entry";

type WelcomeMode = "boot" | "replay";

const BOOT_PLAYED_KEY_PREFIX = "tenops.welcomeHeroPlayed:";
const HERO_DURATION_MS = 4600;
const HERO_REDUCED_DURATION_MS = 450;
const ONLINE_HOLD_MS = 900;
const FADE_DURATION_MS = 850;
const ISOLATION_MS = 650;
const TRANSFORMATION_MS = 3500;
const TERRAZZO_HOLD_MS = 888;

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

export default function WelcomeHero({ welcomeStatus }: { welcomeStatus: WelcomeNotificationStatus | null }) {
  const auth = useAuth();
  const heroRef = useRef<HTMLDivElement | null>(null);
  const coverRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const animationStartedAtRef = useRef<number | null>(null);
  const animationCompletedAtRef = useRef<number | null>(null);
  const decorationStartedAtRef = useRef<number | null>(null);
  const skipRequestedRef = useRef(false);
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
  const [decorationElapsed, setDecorationElapsed] = useState(0);
  const [assetFailed, setAssetFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fadeProgress, setFadeProgress] = useState(0);
  const [heroAnimationComplete, setHeroAnimationComplete] = useState(false);
  const [criticalAppReady, setCriticalAppReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const heroEligible = auth.ready && !auth.requiresPasswordSetup && auth.isAuthenticated && Boolean(auth.profile?.isActive) && auth.accessAllowed && Boolean(auth.user);
  const notificationEntry = Boolean(pendingNotificationId());
  const bootRequired = !notificationEntry && heroEligible && !bootClaimed && typeof window !== "undefined" && !window.sessionStorage.getItem(`${BOOT_PLAYED_KEY_PREFIX}${auth.user?.id}`);
  const heroVisible = !notificationEntry && heroEligible && (visible || bootRequired);
  const heroStartingCoverVisible = !notificationEntry && !auth.requiresPasswordSetup && (preparingBoot || (bootRequired && !visible));
  const heroCoverVisible = heroStartingCoverVisible || heroVisible;

  const resetTimeline = useCallback(() => {
    decorationStartedAtRef.current = null;
    skipRequestedRef.current = false;
    setDecorationElapsed(0);
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

  useEffect(() => {
    // AccountNotifications owns the authoritative history and refresh paths.
    // Never carry welcome state across account changes or inactive sessions.
    const current = auth.isAuthenticated && auth.profile?.isActive
      && welcomeStatus?.userId === auth.profile.userId ? welcomeStatus : null;
    welcomeIdRef.current = current?.id ?? null;
    welcomeUnreadRef.current = current?.unread ?? false;
  }, [auth.isAuthenticated, auth.profile?.isActive, auth.profile?.userId, welcomeStatus]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const prepare = () => {
      if (pendingNotificationId()) return;
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
    const notificationOpen=()=>{setVisible(false);setBootClaimed(true);preparingBootRef.current=false;setPreparingBoot(false);};
    window.addEventListener("tenops:notification-entry",notificationOpen);
    window.addEventListener("tenops:prepare-hero-boot", prepare);
    window.addEventListener("tenops:cancel-hero-boot", cancel);
    return () => {
      window.removeEventListener("tenops:notification-entry",notificationOpen);
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
      const playedKey = `${BOOT_PLAYED_KEY_PREFIX}${userId}`;
      if (pendingNotificationId()) {
        window.sessionStorage.setItem(playedKey, "true");setBootClaimed(true);setVisible(false);preparingBootRef.current=false;setPreparingBoot(false);return;
      }
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
  }, [auth.accessAllowed, auth.isAuthenticated, auth.profile, auth.profileError, auth.ready, auth.requiresPasswordSetup, auth.user, resetTimeline]);

  useEffect(() => {
    const replay = () => {
      if (auth.requiresPasswordSetup || !auth.isAuthenticated || !auth.profile?.isActive || !auth.accessAllowed) return;
      modeRef.current = "replay";
      setMode("replay");
      resetTimeline();
      setVisible(true);
    };
    window.addEventListener("tenops:replay-welcome-hero", replay);
    return () => {
      window.removeEventListener("tenops:replay-welcome-hero", replay);
    };
  }, [auth.accessAllowed, auth.isAuthenticated, auth.profile?.isActive, auth.requiresPasswordSetup, resetTimeline]);

  useEffect(() => {
    const markReady = () => {
      // Production announces readiness for rendered errors too. Release visual
      // ownership immediately so that its real recovery UI remains accessible.
      if (document.querySelector('[data-app-shell] main [role="alert"]')) finish();
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
  }, [auth.user?.id, finish]);

  useEffect(() => {
    if (!heroCoverVisible) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    const siblings = Array.from(coverRef.current?.parentElement?.children ?? []).filter((node): node is HTMLElement => node instanceof HTMLElement && !node.hasAttribute("data-welcome-hero") && !node.hasAttribute("data-welcome-hero-cover"));
    const priorInert = siblings.map(node => node.inert);
    siblings.forEach(node => { node.inert = true; });
    heroRef.current?.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";
    document.body.dataset.welcomeHero = mode;
    return () => {
      document.body.style.overflow = previousOverflow;
      siblings.forEach((node, index) => { node.inert = priorInert[index]; });
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
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
        if (criticalAppReadyRef.current && now - animationCompletedAtRef.current >= (reducedMotion ? 0 : ONLINE_HOLD_MS)) {
          if (decorationStartedAtRef.current === null) decorationStartedAtRef.current = now;
          const elapsed = now - decorationStartedAtRef.current;
          if (elapsed <= ISOLATION_MS + TRANSFORMATION_MS + 50) setDecorationElapsed(elapsed);
          const decorationDone = reducedMotion || assetFailed || skipRequestedRef.current || elapsed >= ISOLATION_MS + TRANSFORMATION_MS + TERRAZZO_HOLD_MS;
          if (!decorationDone) {
            frameRef.current = window.requestAnimationFrame(tick);
            return;
          }
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
  }, [assetFailed, finish, heroVisible, reducedMotion]);

  const skipAvailable = heroVisible && heroAnimationComplete && criticalAppReady && decorationElapsed >= ISOLATION_MS && !reducedMotion && !assetFailed && fadeProgress === 0;
  const skip = useCallback(() => {
    if (skipAvailable) skipRequestedRef.current = true;
  }, [skipAvailable]);

  useEffect(() => {
    if (!heroVisible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        if (skipAvailable) heroRef.current?.querySelector<HTMLButtonElement>("[data-welcome-skip]")?.focus();
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']")) return;
      if (event.code === "Space" && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        skip();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [heroVisible, skip, skipAvailable]);

  const secondaryOpacity = 1 - smoothstep(decorationElapsed / ISOLATION_MS);
  const transformationElapsed = Math.max(0, decorationElapsed - ISOLATION_MS);
  const phase = fadeProgress > 0 ? "entrance" : decorationElapsed === 0 ? "opening" : decorationElapsed < ISOLATION_MS ? "isolate" : transformationElapsed < TRANSFORMATION_MS ? "transform" : "hold";
  const brandLabel = `${BRANDING.productName} ${BRANDING.subtitle ?? "OPERATIONS CONTROL"}`;

  const heroProgress = reducedMotion ? (progress > 0 ? 1 : 0) : smoothstep(progress);
  const logoProgress = heroProgress;
  const percent = Math.round(diagonalRevealCoverage(logoProgress) * 100);
  const statusLabel = heroAnimationComplete && criticalAppReady ? "OPERATIONS ENGINE ONLINE" : "OPERATIONS ENGINE INITIATING";

  return <>
    <div
      ref={coverRef}
      hidden={!heroStartingCoverVisible}
      data-welcome-hero-cover
      data-dev-branding={BRANDING.showDeveloperArtwork ? "true" : undefined}
      className="fixed inset-0 z-[251] bg-[#eef1f4]"
      aria-hidden="true"
    >
      <section className="flex h-dvh min-h-[28rem] flex-col items-center justify-center overflow-hidden px-5 text-center text-slate-950">
        <div className="grid h-full w-full grid-rows-[minmax(0,1fr)_auto] items-center py-[clamp(0.75rem,2vh,1.5rem)]">
          <div className="flex min-h-0 w-full items-center justify-center">
            <div className="flex max-w-2xl flex-col items-center">
              <div data-welcome-logo-stack className="relative aspect-[1024/1048] shrink-0">
                <Image src="/tenarten-logo-gold-welcome.webp" alt="" aria-hidden="true" fill priority sizes="(max-width: 640px) 19rem, 35rem" className="object-contain" />
              </div>
              <div className="mt-3 text-[clamp(0.9rem,2vw,1.08rem)] font-bold uppercase tracking-[0.18em] text-slate-700">{brandLabel}</div>
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
    ref={heroRef}
    tabIndex={-1}
    role="dialog"
    aria-modal="true"
    style={{ opacity: Math.max(0, 1 - fadeProgress) }}
    data-welcome-hero
    data-dev-branding={BRANDING.showDeveloperArtwork ? "true" : undefined}
    data-hero-animation-complete={heroAnimationComplete ? "true" : "false"}
    data-critical-app-ready={criticalAppReady ? "true" : "false"}
    className="fixed inset-0 z-[250] outline-none"
    aria-label={`${BRANDING.productName} startup presentation`}
    data-welcome-phase={phase}
    aria-live="polite"
  >
    <section
      data-welcome-hero-surface
      className="flex h-dvh min-h-[28rem] flex-col items-center justify-center overflow-hidden bg-[#eef1f4] px-5 text-center text-slate-950"
    >
      <div data-welcome-content-layout className="grid h-full w-full grid-rows-[minmax(0,1fr)_auto] items-center py-[clamp(0.75rem,2vh,1.5rem)]">
        <div data-welcome-primary-region className="flex min-h-0 w-full items-center justify-center">
          <div
            data-welcome-identity-group
            className="flex max-w-2xl flex-col items-center"
          >
            <div data-welcome-logo-stack className="relative aspect-[1024/1048] shrink-0">
              <Image src="/tenarten-logo-gold-welcome.webp" alt="Tenarten Terrazzo Precast Manufacturing" fill priority sizes="(max-width: 640px) 19rem, 35rem" className="object-contain" onError={() => setAssetFailed(true)} style={{ opacity: decorationElapsed > 0 ? 0 : 1 }} />
              {decorationElapsed > 0 ? <span data-welcome-embedded-wordmark className="absolute inset-0" style={{ clipPath: "inset(80.916031% 0 0 0)", opacity: secondaryOpacity }}><Image src="/tenarten-logo-steel-welcome.webp" alt="" aria-hidden="true" fill sizes="(max-width: 640px) 19rem, 35rem" className="object-contain" /></span> : null}
              <TerrazzoReveal elapsed={transformationElapsed} active={decorationElapsed > 0 && !reducedMotion && !assetFailed} onAssetError={() => setAssetFailed(true)} />
              <span data-welcome-logo-steel className="absolute inset-0" style={{ clipPath: diagonalRevealClip(logoProgress), visibility: decorationElapsed > 0 && !reducedMotion && !assetFailed ? "hidden" : "visible" }}>
                <Image src="/tenarten-logo-steel-welcome.webp" onError={() => setAssetFailed(true)} alt="" aria-hidden="true" fill priority sizes="(max-width: 640px) 19rem, 35rem" className="object-contain" />
              </span>
            </div>
            <div data-welcome-secondary style={{ opacity: secondaryOpacity }} className="mt-3 text-[clamp(0.9rem,2vw,1.08rem)] font-bold uppercase tracking-[0.18em] text-slate-700">{brandLabel}</div>
            {auth.profile ? <div data-welcome-account-identity style={{ opacity: secondaryOpacity }} className="mt-3 flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <h1 className="text-[clamp(1.05rem,2.4vw,1.42rem)] font-normal tracking-tight text-slate-800">{auth.profile.displayName}</h1>
              <span data-welcome-role-tag className={`${productionTagClassName} border-slate-300 bg-slate-100 uppercase tracking-[0.06em] text-slate-600`}>{ROLE_LABELS[auth.profile.role]}</span>
            </div> : null}
          </div>
        </div>
        <div data-welcome-progress style={{ opacity: secondaryOpacity }} className="mx-auto mb-[clamp(1rem,3vh,2.25rem)] w-full max-w-md px-2">
          <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">
            <span className={`min-w-0 flex-1 truncate text-left ${heroAnimationComplete ? "text-emerald-700" : ""}`}>{statusLabel}</span>
            <span className="tabular-nums">{percent}%</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden bg-slate-300" role="progressbar" aria-label="Crest animation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <div data-welcome-progress-fill className="h-full bg-slate-800" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>
      {skipAvailable ? <button type="button" data-welcome-skip onClick={skip} className="welcome-skip absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 min-h-11 -translate-x-1/2 px-4 text-[11px] text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600" aria-label="Skip remaining startup animation">
        <span className="welcome-skip-desktop">Press Space to skip</span><span className="welcome-skip-touch">Tap to skip</span>
      </button> : null}
    </section>
    </div> : null}
  </>;
}
