"use client";

import { ChevronDown, Megaphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import EarlyAccessBadge from "@/components/EarlyAccessBadge";
import { EARLY_ACCESS_ENABLED } from "@/lib/early-access.mjs";

type Announcement = {
  title: string;
  status: "EARLY ACCESS" | "UPDATED";
  summary: string[];
  quickStart?: string[];
  available: string;
};

const letterOfTransmittalAnnouncement: Announcement = {
  title: "Letter of Transmittal",
  status: "UPDATED",
  summary: [
    "Customer Name is now editable while remaining linked to the Production job.",
    "Customer Name is preserved in issued document history.",
    "Recipient address fields now support multiline formatting.",
    "Line breaks are preserved in Preview and generated PDFs.",
  ],
  available: "Available now",
};

const planningAnnouncement: Announcement = {
  title: "Planning",
  status: "EARLY ACCESS",
  summary: [
    "Coordinate approvals, drawings, samples, dependencies, and Production interruptions directly from each Production job.",
  ],
  quickStart: [
    "Open Production.",
    "Select a job and click the Layers button.",
    "Create up to four coordination Phases and add Items beneath each Phase.",
    "Use Overlay for Timeline work, Planning Only for Inspector coordination, and Pause for Production interruptions outside the four-Phase cap.",
    "Use Depends On to build prerequisite chains, then expand Planning lanes in Timeline to see sequencing and connectors.",
    "Find reusable Phase templates under Settings → Phase Library.",
  ],
  available: "Available in Early Access",
};

const announcements = EARLY_ACCESS_ENABLED
  ? [letterOfTransmittalAnnouncement, planningAnnouncement]
  : [letterOfTransmittalAnnouncement];

const updatedStatusStyle = "border-slate-300 bg-slate-100 text-slate-700";
const dismissalKey = "tenops.production.whats-new.dismissed.v1";

export default function WhatsNewBulletin() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(window.sessionStorage.getItem(dismissalKey) === "true");
    } catch {
      setDismissed(false);
    } finally {
      setStorageReady(true);
    }
  }, []);

  function dismiss() {
    try {
      window.sessionStorage.setItem(dismissalKey, "true");
    } catch {}
    setDismissed(true);
  }

  if (!storageReady || dismissed) return null;

  return (
    <section aria-labelledby="whats-new-title" className="w-full overflow-hidden rounded-sm border border-slate-200 border-l-[3px] border-l-amber-500 bg-amber-50/20 shadow-sm">
      <header className="flex items-center gap-2.5 border-b border-slate-200 bg-white/70 px-4 py-2.5">
        <Megaphone className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="whats-new-title" className="text-sm font-bold text-slate-950">What&apos;s New</h2>
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">Recent updates</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss What’s New announcements" title="Dismiss announcements" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="divide-y divide-slate-200/80">
        {announcements.map((announcement, index) => {
          const expanded = expandedIndex === index;
          const panelId = `whats-new-panel-${index}`;
          return (
            <article key={announcement.title}>
              <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpandedIndex((current) => current === index ? null : index)} className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600">
                <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${expanded ? "bg-amber-600" : "bg-slate-400"}`} />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">{announcement.title}</span>
                {announcement.status === "EARLY ACCESS" ? (
                  <EarlyAccessBadge className="text-[9px] tracking-[0.1em]" />
                ) : (
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${updatedStatusStyle}`}>{announcement.status}</span>
                )}
                <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
              </button>
              <div id={panelId} className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="min-h-0 overflow-hidden">
                  <div className="border-t border-slate-100/80 py-2.5 pl-8 pr-4 text-[11px] leading-[1.55] text-slate-600">
                    <ul className="space-y-0.5">
                      {announcement.summary.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                    {announcement.quickStart && (
                      <div className="mt-2">
                        <div className="font-bold text-slate-800">Quick Start</div>
                        <ul className="mt-0.5 space-y-0.5">
                          {announcement.quickStart.map((item) => <li key={item}>• {item}</li>)}
                        </ul>
                      </div>
                    )}
                    <p className="mt-2 border-t border-slate-200/70 pt-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{announcement.available}</p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
