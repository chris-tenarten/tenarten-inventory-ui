"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  applyDisplaySize,
  DISPLAY_SIZE_OPTIONS,
  type DisplaySize,
  readDisplaySize,
  saveDisplaySize,
} from "@/lib/display-size";

const settings = [
  {
    href: "/purchasing",
    title: "Vendors & Contacts",
    description: "Open Purchasing to maintain Vendor profiles and contacts.",
  },
  {
    href: "/manpower-reporting",
    title: "Workers & Tasks",
    description: "Open Manpower Reporting to maintain labor references.",
  },
];

export default function SettingsPage() {
  const [displaySize, setDisplaySize] = useState<DisplaySize>("default");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = readDisplaySize();
      setDisplaySize(stored);
      applyDisplaySize(stored);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  function changeDisplaySize(value: DisplaySize) {
    setDisplaySize(value);
    saveDisplaySize(value);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
        Administration
      </div>
      <h1 className="mt-1 text-3xl font-bold text-slate-950">Settings</h1>
      <p className="mt-1 text-sm text-slate-600">
        Operational configuration remains with the module that owns it.
      </p>
      <section className="mt-6 border border-slate-300 bg-white p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Appearance
        </div>
        <h2 className="mt-1 text-lg font-bold text-slate-950">Display Size</h2>
        <p className="mt-1 text-sm text-slate-600">
          Adjust text size and interface density across TenOps. Documents and
          generated PDFs are not affected.
        </p>
        <div
          className="mt-4 grid gap-2 sm:grid-cols-3"
          role="radiogroup"
          aria-label="Display Size"
        >
          {DISPLAY_SIZE_OPTIONS.map((option) => {
            const selected = displaySize === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => changeDisplaySize(option.value)}
                className={`min-h-20 border p-3 text-left transition ${
                  selected
                    ? "border-blue-700 bg-blue-50 shadow-[inset_0_0_0_1px_#1d4ed8]"
                    : "border-slate-300 bg-white hover:border-slate-500 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2 font-bold text-slate-950">
                  <span
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 rounded-full border ${
                      selected
                        ? "border-blue-700 bg-blue-700 shadow-[inset_0_0_0_3px_white]"
                        : "border-slate-400 bg-white"
                    }`}
                  />
                  {option.label}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          This preference is stored only in this browser.
        </p>
      </section>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {settings.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="border border-slate-300 bg-white p-4 transition hover:border-slate-500 hover:bg-slate-50"
          >
            <div className="font-bold text-slate-950">{item.title}</div>
            <div className="mt-1 text-sm text-slate-600">{item.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
