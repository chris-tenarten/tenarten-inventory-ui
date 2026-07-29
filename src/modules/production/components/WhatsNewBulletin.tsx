"use client";

import { ChevronDown, Megaphone } from "lucide-react";
import { useState } from "react";

type Announcement = {
  title: string;
  status: "NEW" | "EARLY ACCESS" | "UPDATED";
  description: string;
  howTo: string;
  available: string;
};

const announcements: Announcement[] = [
  {
    title: "Letter of Transmittal",
    status: "EARLY ACCESS",
    description:
      "Create and generate Letters of Transmittal directly from Production jobs.",
    howTo:
      "Open a Production job and select Letter of Transmittal. Use Preview PDF at any time while completing the form to review the document. When all required information has been entered, select Generate & Download to issue the final document.",
    available: "Available now",
  },
  {
    title: "Job Updates",
    status: "NEW",
    description:
      "Record important production updates, decisions, and follow-up requests.",
    howTo:
      "Use the Job Updates shortcut beneath any Production job in the Overview to jump directly to the Job Updates tab. You can also open a Production job and select the Job Updates tab manually. Add an informational update, or mark an update as Needs attention when follow-up is required. Supporting files can also be attached to updates.",
    available: "Available now",
  },
];

const statusStyles: Record<Announcement["status"], string> = {
  "EARLY ACCESS": "border-amber-300 bg-amber-50 text-amber-800",
  NEW: "border-blue-200 bg-blue-50 text-blue-800",
  UPDATED: "border-slate-300 bg-slate-100 text-slate-700",
};

export default function WhatsNewBulletin() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <section
      aria-labelledby="whats-new-title"
      className="w-full overflow-hidden rounded-sm border border-slate-200 border-l-[3px] border-l-amber-500 bg-amber-50/20 shadow-sm"
    >
      <header className="flex items-center gap-2.5 border-b border-slate-200 bg-white/70 px-4 py-2.5">
        <Megaphone className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <div>
          <h2 id="whats-new-title" className="text-sm font-bold text-slate-950">
            What&apos;s New
          </h2>
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
            Recent updates
          </p>
        </div>
      </header>

      <div className="divide-y divide-slate-200/80">
        {announcements.map((announcement, index) => {
          const expanded = expandedIndex === index;
          const panelId = `whats-new-panel-${index}`;

          return (
            <article key={announcement.title}>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() =>
                  setExpandedIndex((current) => current === index ? null : index)
                }
                className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${expanded ? "bg-amber-600" : "bg-slate-400"}`}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">
                  {announcement.title}
                </span>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${statusStyles[announcement.status]}`}
                >
                  {announcement.status}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
                />
              </button>
              <div
                id={panelId}
                className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="border-t border-slate-100/80 py-2.5 pl-8 pr-4 text-[11px] leading-[1.55] text-slate-600">
                    <p>{announcement.description}</p>
                    <p className="mt-1.5">
                      <span className="font-bold text-slate-800">How to use: </span>
                      {announcement.howTo}
                    </p>
                    <p className="mt-2 border-t border-slate-200/70 pt-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      {announcement.available}
                    </p>
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
