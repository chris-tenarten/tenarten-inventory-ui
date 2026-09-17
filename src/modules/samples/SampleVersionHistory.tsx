"use client";
import { Eye, History, RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import {
  formatSampleError,
  logSampleError,
  translateSampleError,
  validateSampleForOutput,
} from "./sample-errors";
import type { SampleRecord } from "./types";
import {
  generateWorkingSamplePdf,
  restoreSampleWorkingVersion,
  saveSampleWorkingVersion,
} from "./queries";

export default function SampleVersionHistory({
  sample,
  onSave,
  onReload,
  onPreview,
}: {
  sample: SampleRecord;
  onSave: () => Promise<SampleRecord>;
  onReload: (sampleId: string) => Promise<void>;
  onPreview: (url: string, filename: string) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const showError = (
    caught: unknown,
    operation:
      | "save-draft"
      | "save-version"
      | "working-pdf"
      | "restore-version",
    prefix = "",
  ) => {
    const translated = translateSampleError(caught, operation);
    logSampleError(translated);
    setError(
      prefix
        ? `${prefix} ${translated.message} ${translated.guidance} ${translated.safeState}${translated.retrySafe ? " Retrying is safe." : ""}`
        : formatSampleError(translated),
    );
  };
  const checkpoint = async () => {
    setBusy("save-version");
    setError("");
    let saved: SampleRecord;
    try {
      saved = await onSave();
    } catch (caught) {
      showError(
        caught,
        "save-draft",
        "Version not saved — Draft could not be saved.",
      );
      setBusy("");
      return;
    }
    try {
      await saveSampleWorkingVersion(saved.id, note);
      setNote("");
      await onReload(saved.id);
    } catch (caught) {
      showError(caught, "save-version");
    } finally {
      setBusy("");
    }
  };
  const view = async (versionId?: string, versionNumber?: number) => {
    setBusy(versionId ?? "current");
    setError("");
    let target = sample;
    if (!versionId) {
      const readiness = validateSampleForOutput(sample);
      if (readiness) {
        logSampleError(readiness);
        setError(formatSampleError(readiness));
        setBusy("");
        return;
      }
      try {
        target = await onSave();
      } catch (caught) {
        showError(
          caught,
          "save-draft",
          "Working Sheet not generated — Draft could not be saved.",
        );
        setBusy("");
        return;
      }
    }
    try {
      const blob = await generateWorkingSamplePdf(target.id, versionId);
      onPreview(
        URL.createObjectURL(blob),
        `${target.colorPlateNumber || "Sample"}-${versionNumber ? `Version-${versionNumber}` : "Working"}.pdf`,
      );
    } catch (caught) {
      showError(
        caught,
        "working-pdf",
        versionId
          ? ""
          : "Draft saved, but Working Sheet could not be generated. Your Sample changes were saved.",
      );
    } finally {
      setBusy("");
    }
  };
  const restore = async (versionId: string) => {
    if (
      !window.confirm(
        "Use this saved version as the Current Draft?\n\nThe saved version and all newer versions will remain unchanged.",
      )
    )
      return;
    setBusy(`restore:${versionId}`);
    setError("");
    try {
      await restoreSampleWorkingVersion(sample.id, versionId);
      await onReload(sample.id);
    } catch (caught) {
      showError(caught, "restore-version");
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="border border-slate-300 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
            <History className="h-4 w-4" />
            Formula Versions
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Current Draft is what you are editing. Saved Versions are reusable
            checkpoints, not formal issues.
          </p>
        </div>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void view()}
          className="inline-flex min-h-11 items-center gap-2 border border-blue-900 bg-blue-900 px-4 text-sm font-bold text-white"
        >
          <Eye className="h-4 w-4" />
          Generate Working Sheet
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 border border-red-300 bg-red-50 p-2 text-xs font-semibold text-red-800"
        >
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={note}
          maxLength={200}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional note before trying another formula"
          className="h-11 min-w-0 flex-1 border border-slate-300 px-3 text-sm"
        />
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void checkpoint()}
          className="inline-flex min-h-11 items-center justify-center gap-2 border border-slate-900 px-4 text-sm font-bold"
        >
          <Save className="h-4 w-4" />
          {busy === "save-version" ? "Saving…" : "Save Version"}
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {sample.workingVersions.length ? (
          sample.workingVersions.map((version) => (
            <article
              key={version.id}
              className="flex flex-wrap items-center gap-3 border border-slate-200 p-3"
            >
              <div className="min-w-0 flex-1">
                <strong className="text-sm">
                  Saved Version {version.versionNumber}
                </strong>
                <span className="ml-2 text-xs text-slate-500">
                  {new Date(version.savedAt).toLocaleString()} ·{" "}
                  {version.savedByName}
                </span>
                {version.versionNote && (
                  <p className="mt-1 text-xs text-slate-600">
                    {version.versionNote}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void view(version.id, version.versionNumber)}
                className="inline-flex min-h-9 items-center gap-1 border border-slate-300 px-3 text-xs font-bold"
              >
                <Eye className="h-3.5 w-3.5" />
                Working Sheet
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void restore(version.id)}
                className="inline-flex min-h-9 items-center gap-1 border border-slate-300 px-3 text-xs font-bold"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Use as Current Draft
              </button>
            </article>
          ))
        ) : (
          <p className="text-sm text-slate-500">No saved versions yet.</p>
        )}
      </div>
    </section>
  );
}
