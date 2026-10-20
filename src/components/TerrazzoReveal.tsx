"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { createWelcomeSparks } from "./welcome-sparks.mjs";

// iTenify's three opaque plate exits and bounded spark field, registered to
// the existing TenOps crest canvas. The parent alone owns readiness and time.
export default function TerrazzoReveal({ elapsed, active, onAssetError }: {
  elapsed: number; active: boolean; onAssetError: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const heat = useRef<HTMLCanvasElement>(null);
  const rear = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createWelcomeSparks> | null>(null);
  const time = useRef(elapsed);
  const onError = useRef(onAssetError);
  useEffect(() => { onError.current = onAssetError; }, [onAssetError]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const mask = new window.Image();
    const prepare = () => {
      if (cancelled || !mask.complete || !mask.naturalWidth || !root.current || !mark.current || !front.current || !heat.current || !rear.current) return;
      try {
        renderer.current = createWelcomeSparks(root.current, mark.current, front.current, heat.current, rear.current, mask);
      } catch {
        onError.current();
        return;
      }
      if (time.current < 2000) renderer.current.render(time.current);
    };
    mask.onload = prepare;
    mask.onerror = () => onError.current();
    mask.src = "/tenarten-logo-steel-welcome.webp";
    const resize = () => { renderer.current?.clear(); prepare(); };
    window.addEventListener("resize", resize);
    return () => { cancelled = true; renderer.current?.clear(); renderer.current = null; window.removeEventListener("resize", resize); };
  }, [active]);
  useEffect(() => {
    time.current = elapsed;
    if (elapsed < 2000) renderer.current?.render(elapsed);
    else renderer.current?.clear();
  }, [elapsed]);
  const ease = (delay: number, duration: number) => {
    const p = Math.max(0, Math.min(1, (elapsed - delay) / duration));
    return p * p * (3 - 2 * p);
  };
  return <div aria-hidden="true" className="absolute inset-0" style={{ visibility: active ? "visible" : "hidden" }}>
    <Image src="/tenarten-logo-terrazzo-welcome.webp" alt="" fill sizes="(max-width: 640px) 19rem, 35rem" className="object-contain" onError={onAssetError} />
    <div ref={mark} className="absolute" style={{ left: "14.453125%", top: "4.007634%", width: "71.09375%", height: "76.908397%" }}>
      <canvas ref={rear} className="absolute inset-0 h-full w-full" />
    </div>
    {[
      { name: "cap", clip: "inset(0 0 74.045802% 0)", x: 0, y: -100, p: ease(1630, 1400) },
      { name: "left", clip: "inset(25.954198% 50% 19.083969% 0)", x: -100, y: 0, p: ease(1720, 1582) },
      { name: "right", clip: "inset(25.954198% 0 19.083969% 50%)", x: 100, y: 0, p: ease(1770, 1582) },
    ].map(plate => <span key={plate.name} data-welcome-plate={plate.name} className="absolute inset-0" style={{ clipPath: plate.clip, transform: `translate(${plate.x * plate.p}vw, ${plate.y * plate.p}vh)`, opacity: plate.p >= 1 ? 0 : 1 }}>
      <Image src="/tenarten-logo-steel-welcome.webp" alt="" fill sizes="(max-width: 640px) 19rem, 35rem" className="object-contain" />
    </span>)}
    <div className="absolute" style={{ left: "14.453125%", top: "4.007634%", width: "71.09375%", height: "76.908397%" }}><canvas ref={heat} className="absolute inset-0 h-full w-full" /></div>
    <div ref={root} className="pointer-events-none fixed inset-0"><canvas ref={front} className="absolute inset-0 h-full w-full" /></div>
  </div>;
}
