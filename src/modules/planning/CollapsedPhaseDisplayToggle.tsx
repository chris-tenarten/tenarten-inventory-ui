"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import {
  COLLAPSED_PHASE_DISPLAY_MODES,
  readCollapsedPhaseDisplayMode,
  type CollapsedPhaseDisplayMode,
  writeCollapsedPhaseDisplayMode,
} from "./collapsed-phase-display";

export default function CollapsedPhaseDisplayToggle() {
  const [mode, setMode] = useState<CollapsedPhaseDisplayMode>("fill");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMode(readCollapsedPhaseDisplayMode()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div role="radiogroup" aria-label="Collapsed Phase bar display" className="inline-flex h-9 border border-slate-300">
      <span className="inline-flex items-center gap-1 border-r border-slate-300 px-2 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
        <Settings2 className="h-3 w-3 shrink-0" aria-hidden="true" />
        Phase bars
      </span>
      {COLLAPSED_PHASE_DISPLAY_MODES.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          onClick={() => {
            setMode(value);
            writeCollapsedPhaseDisplayMode(value);
          }}
          className={`border-r border-slate-300 px-2.5 text-[10px] font-bold capitalize last:border-r-0 ${
            mode === value ? "tenops-selected-surface bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
