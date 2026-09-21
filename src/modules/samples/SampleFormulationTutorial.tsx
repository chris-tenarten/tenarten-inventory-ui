"use client";

import { ChevronLeft, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const sampleTutorialSteps = [
  "finished-pieces",
  "production-pour",
  "chip-mix",
  "aggregates",
  "filler",
  "resin-hardener",
  "review",
] as const;

export type SampleTutorialStep = (typeof sampleTutorialSteps)[number];

type StepDefinition = {
  title: string;
  anchor: string;
  body: React.ReactNode;
  note?: React.ReactNode;
  next: string;
  advanced?: boolean;
};

const steps: Record<SampleTutorialStep, StepDefinition> = {
  "finished-pieces": {
    title: "Start with what you’re making",
    anchor: "finished-pieces",
    body: <><p>Finished Pieces describes how many Sample pieces you intend to end up with, their dimensions, and their thickness.</p><p className="mt-2 font-semibold">These dimensions describe the pieces you&apos;re making. The Production Pour—not the finished-piece area—is what TenOps uses to calculate material quantities.</p></>,
    note: <>For a standard Sample, this normally starts with four 6″ × 6″ pieces at 3/8″ thickness.</>,
    next: "Next: Production Pour",
  },
  "production-pour": {
    title: "Set the Production Pour",
    anchor: "production-pour",
    body: <><p>Production Pour is the actual footprint of material being mixed and poured. Its width, length, and thickness determine the pour volume used for formulation quantities.</p><p className="mt-2">Finished Pieces and Production Pour are related operationally, but they are separate inputs in TenOps.</p></>,
    note: <>A standard pour is 12″ × 12″ × 3/8″. Changing Finished Pieces alone does not change material requirements when this pour stays the same.</>,
    next: "Next: Chip Mix",
  },
  "chip-mix": {
    title: "Understand the Chip Mix",
    anchor: "chip-summary",
    body: <><p>TenOps calculates how much aggregate the Production Pour needs.</p><p className="mt-2">Production volume and effective Chip density determine the total Chip Mix. You normally select a formulation profile and let TenOps handle this calculation.</p><p className="mt-2">For a standard Sample, the result starts at 64 oz of Chip Mix using an effective Chip density of 128 lb/CFT.</p></>,
    note: <>Effective Chip density is an advanced formulation value. Change it only when the formulation itself requires a different density.</>,
    next: "Next: Aggregate Composition",
    advanced: true,
  },
  aggregates: {
    title: "Build the Aggregate composition",
    anchor: "aggregate-section",
    body: <><p>Now decide what makes up the Chip Mix. Give each Aggregate a percentage; together, the Aggregate percentages should total 100%.</p><p className="mt-2">TenOps converts each percentage into ounces automatically. Changing the percentages changes how the Chip Mix is divided—it does not change the total Chip Mix.</p></>,
    note: <><span>With a 64 oz Chip Mix, 40 / 30 / 20 / 5 / 5% becomes 25.6 / 19.2 / 12.8 / 3.2 / 3.2 oz.</span><span className="mt-2 block">Green fields are values you specify. Calculated values update automatically. A calculated quantity you explicitly override receives the separate Modified treatment.</span></>,
    next: "Next: Filler",
  },
  filler: {
    title: "Edit Filler—or adjust the formulation",
    anchor: "filler",
    body: <><p className="font-bold">Changing a quantity and changing the formulation are not the same thing.</p><p className="mt-2">Filler is independent during normal editing. If you change Filler from 18 oz to 22 oz, Chip Mix stays 64 oz and density stays 128 lb/CFT.</p><p className="mt-2">TenOps may show that the result differs from the selected profile&apos;s expected dry-material balance. That is allowed.</p><p className="mt-2">Use Adjust Formulation only when you intend to coordinate Filler, effective Chip density, and Chip Mix while preserving the profile relationship.</p></>,
    note: <>An intentional adjustment from 18 to 22 oz Filler changes the standard example from 64 to 60 oz Chip Mix and from 128 to 120 lb/CFT. Aggregate percentages stay the same; their calculated ounces update.</>,
    next: "Next: Resin and Hardener",
  },
  "resin-hardener": {
    title: "Add Resin and Hardener",
    anchor: "resin-hardener",
    body: <><p>Resin and Hardener are separate from the dry Chip Mix and Filler calculation.</p><p className="mt-2">Aggregate and Filler are measured by weight in oz. Resin and Hardener are measured by volume in fl oz.</p><p className="mt-2">Hardener normally calculates from the Resin : Hardener ratio. Manual ratio overrides remain in place until you reset them.</p></>,
    note: <>Captured operating defaults include Key, MTT, and Terroxy at 5:1, and Sherwin-Williams at 4:1. These are TenOps formulation defaults, not universal manufacturer compatibility rules. For a standard 5:1 Sample, 15 fl oz Resin produces 3 fl oz Hardener.</>,
    next: "Next: Review",
  },
  review: {
    title: "Review what the shop will measure",
    anchor: "working-sheet",
    body: <><p>Review the quantities and units before saving: Aggregate and Filler use oz; Resin and Hardener use fl oz.</p><p className="mt-2">Generate Working Sheet creates the operational worksheet marked WORKING SAMPLE - NOT ISSUED.</p><p className="mt-2">Save Version creates a checkpoint you can restore later. Formal Issue is separate and creates an immutable issued snapshot.</p></>,
    note: <>The tutorial does not save, generate, version, or issue anything. Use the normal controls when you are ready.</>,
    next: "Finish Tutorial",
  },
};

const highlightedClasses = ["relative", "z-[61]", "ring-2", "ring-blue-700", "ring-offset-2"];

export default function SampleFormulationTutorial({
  step,
  onStepChange,
  onExit,
  onShowAdvanced,
}: {
  step: SampleTutorialStep;
  onStepChange: (step: SampleTutorialStep) => void;
  onExit: () => void;
  onShowAdvanced: () => void;
}) {
  const definition = steps[step];
  const index = sampleTutorialSteps.indexOf(step);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [position, setPosition] = useState({ left: 16, top: 96 });

  const targets = useCallback(
    () => Array.from(document.querySelectorAll<HTMLElement>(`[data-sample-tutorial~="${definition.anchor}"]`)),
    [definition.anchor],
  );

  const place = useCallback(() => {
    const matches = targets();
    if (!matches.length || window.matchMedia("(max-width: 639px)").matches) return;
    const rects = matches.map((target) => target.getBoundingClientRect());
    const rect = {
      left: Math.min(...rects.map((item) => item.left)),
      right: Math.max(...rects.map((item) => item.right)),
      top: Math.min(...rects.map((item) => item.top)),
      bottom: Math.max(...rects.map((item) => item.bottom)),
    };
    const width = 360;
    const gap = 16;
    const left = window.innerWidth - rect.right >= width + gap
      ? rect.right + gap
      : rect.left >= width + gap
        ? rect.left - width - gap
        : Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
    const beside = left > rect.right || left + width < rect.left;
    const top = beside
      ? Math.max(16, Math.min(rect.top, window.innerHeight - 420))
      : Math.max(16, Math.min(rect.bottom + gap, window.innerHeight - 420));
    setPosition({ left, top });
  }, [targets]);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => restoreFocusRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const matches = targets();
    const describedBy = "sample-formulation-tutorial-heading";
    matches.forEach((target) => {
      highlightedClasses.forEach((className) => target.classList.add(className));
      target.setAttribute("aria-describedby", describedBy);
      target.setAttribute("data-sample-tutorial-current", "true");
    });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    matches[0]?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    const frame = window.requestAnimationFrame(() => {
      place();
      headingRef.current?.focus({ preventScroll: true });
    });
    let placementFrame = 0;
    const onResize = () => {
      if (placementFrame) return;
      placementFrame = window.requestAnimationFrame(() => {
        placementFrame = 0;
        place();
      });
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.cancelAnimationFrame(frame);
      if (placementFrame) window.cancelAnimationFrame(placementFrame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      matches.forEach((target) => {
        highlightedClasses.forEach((className) => target.classList.remove(className));
        target.removeAttribute("aria-describedby");
        target.removeAttribute("data-sample-tutorial-current");
      });
    };
  }, [place, targets]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector('[role="dialog"][aria-label="Adjust Formulation"]')) return;
      event.preventDefault();
      onExit();
    };
    document.addEventListener("keydown", escape, true);
    return () => document.removeEventListener("keydown", escape, true);
  }, [onExit]);

  const cardStyle = useMemo(
    () => narrow ? undefined : { left: position.left, top: position.top },
    [narrow, position],
  );
  const next = () => index === sampleTutorialSteps.length - 1
    ? onExit()
    : onStepChange(sampleTutorialSteps[index + 1]);

  return <>
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] bg-slate-950/20" />
    <aside
      role="region"
      aria-label="Sample formulation tutorial"
      className={`z-[70] max-h-[calc(100vh-2rem)] overflow-y-auto border border-blue-300 bg-white p-4 text-sm text-slate-800 shadow-xl ${narrow ? "fixed inset-x-0 bottom-0 max-h-[42vh] w-full" : "fixed w-[min(360px,calc(100vw-2rem))]"}`}
      style={cardStyle}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-800">Step {index + 1} of {sampleTutorialSteps.length}</p>
          <h2 id="sample-formulation-tutorial-heading" ref={headingRef} tabIndex={-1} className="mt-1 text-base font-bold outline-none">{definition.title}</h2>
        </div>
        <button type="button" onClick={onExit} aria-label="Exit Sample formulation tutorial" className="flex h-11 w-11 shrink-0 items-center justify-center border border-slate-300 bg-white focus-visible:ring-2 focus-visible:ring-blue-700"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-3 leading-5">{definition.body}</div>
      {definition.note && <div className="mt-3 border-l-2 border-slate-300 pl-3 text-xs leading-5 text-slate-600">{definition.note}</div>}
      {definition.advanced && <button type="button" onClick={onShowAdvanced} className="mt-3 min-h-11 border border-slate-300 bg-white px-3 text-xs font-bold focus-visible:ring-2 focus-visible:ring-blue-700">Show advanced details</button>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" disabled={index === 0} onClick={() => onStepChange(sampleTutorialSteps[index - 1])} className="inline-flex min-h-11 items-center justify-center gap-1 border border-slate-300 bg-white px-3 text-xs font-bold disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-blue-700"><ChevronLeft className="h-4 w-4" />Back</button>
        <button type="button" onClick={next} className="min-h-11 bg-blue-900 px-4 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2">{definition.next}</button>
      </div>
      <button type="button" onClick={onExit} className="mt-3 min-h-11 w-full text-xs font-bold text-slate-600 underline focus-visible:ring-2 focus-visible:ring-blue-700">Exit Tutorial</button>
      <span aria-live="polite" className="sr-only">Step {index + 1} of {sampleTutorialSteps.length}: {definition.title}</span>
    </aside>
  </>;
}
