"use client";

import {
  CheckCircle2,
  CircleAlert,
  File,
  MessageSquare,
  Paperclip,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createJobUpdate,
  loadJobAttachments,
  loadJobUpdates,
  resolveJobUpdate,
  uploadJobAttachments,
} from "../jobs";
import type { JobAttachment, JobUpdate, ProductionJob } from "../types";

const ATTRIBUTION_STORAGE_KEY = "tenops.jobUpdateAttributionName";

type Props = {
  job: ProductionJob;
  attachments: JobAttachment[];
  focusedUpdateId: string | null;
  onAttachmentsChanged: (attachments: JobAttachment[]) => void;
  onOpenAttachment: (attachment: JobAttachment) => void;
};

function storedAttributionName() {
  return typeof window === "undefined"
    ? ""
    : window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY) ?? "";
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function JobUpdatesPanel({
  job,
  attachments,
  focusedUpdateId,
  onAttachmentsChanged,
  onOpenAttachment,
}: Props) {
  const [updates, setUpdates] = useState<JobUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [authorName, setAuthorName] = useState(storedAttributionName);
  const [body, setBody] = useState("");
  const [requiresFollowUp, setRequiresFollowUp] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolverName, setResolverName] = useState(storedAttributionName);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    loadJobUpdates(job.id)
      .then((rows) => {
        if (live) setUpdates(rows);
      })
      .catch((loadError: unknown) => {
        if (live) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load Job Updates.",
          );
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [job.id]);

  useEffect(() => {
    if (!focusedUpdateId || loading) return;
    requestAnimationFrame(() => {
      document
        .getElementById(`job-update-${focusedUpdateId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [focusedUpdateId, loading]);

  const attachmentsByUpdate = useMemo(() => {
    const grouped = new Map<string, JobAttachment[]>();
    for (const attachment of attachments) {
      if (!attachment.job_update_id) continue;
      const current = grouped.get(attachment.job_update_id) ?? [];
      current.push(attachment);
      grouped.set(attachment.job_update_id, current);
    }
    return grouped;
  }, [attachments]);

  const openCount = updates.filter(
    (update) => update.requires_follow_up && !update.resolved_at,
  ).length;
  const visibleUpdates = openOnly
    ? updates.filter(
        (update) => update.requires_follow_up && !update.resolved_at,
      )
    : updates;

  async function postUpdate() {
    if (posting) return;
    setPosting(true);
    setError("");
    setMessage("");
    let created: JobUpdate | null = null;
    try {
      created = await createJobUpdate(
        job.id,
        authorName,
        body,
        requiresFollowUp,
      );
      setUpdates((current) => [created as JobUpdate, ...current]);
      window.localStorage.setItem(
        ATTRIBUTION_STORAGE_KEY,
        authorName.trim(),
      );
      setResolverName(authorName.trim());

      const failedFiles: string[] = [];
      if (selectedFiles.length) {
        for (const file of selectedFiles) {
          try {
            await uploadJobAttachments(
              job.id,
              [file],
              "other",
              created.id,
              authorName,
            );
          } catch {
            failedFiles.push(file.name);
          }
        }
        const nextAttachments = await loadJobAttachments(job.id);
        onAttachmentsChanged(nextAttachments);
      }

      setBody("");
      setRequiresFollowUp(false);
      setSelectedFiles([]);
      if (fileInput.current) fileInput.current.value = "";
      setMessage(
        selectedFiles.length && failedFiles.length === 0
          ? "Update and files posted."
          : "Update posted.",
      );
      if (failedFiles.length) {
        setError(
          `Update posted, but ${failedFiles.length === 1 ? "this file was" : "these files were"} not uploaded: ${failedFiles.join(", ")}`,
        );
      }
    } catch (postError) {
      if (created) {
        try {
          onAttachmentsChanged(await loadJobAttachments(job.id));
        } catch {
          // Preserve the primary upload error; the Files tab can be refreshed
          // by reopening the Inspector.
        }
      }
      setError(
        postError instanceof Error
          ? postError.message
          : created
            ? "Update posted, but one or more files could not be uploaded."
            : "Unable to post the update.",
      );
    } finally {
      setPosting(false);
    }
  }

  async function resolve(update: JobUpdate) {
    if (resolvingId) return;
    setResolvingId(update.id);
    setError("");
    setMessage("");
    try {
      const resolved = await resolveJobUpdate(update, resolverName);
      setUpdates((current) =>
        current.map((row) => (row.id === resolved.id ? resolved : row)),
      );
      window.localStorage.setItem(
        ATTRIBUTION_STORAGE_KEY,
        resolverName.trim(),
      );
      setMessage("Follow-up resolved.");
    } catch (resolveError) {
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : "Unable to resolve the follow-up.",
      );
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <section className="mt-5" data-field="job-updates">
      <div className="flex items-center justify-between gap-3 border-b border-slate-300 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide">
            Job Updates
          </h3>
          {openCount > 0 && (
            <span className="bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900">
              {openCount} open
            </span>
          )}
        </div>
        <div className="inline-flex border border-slate-300 text-xs font-bold">
          <button
            type="button"
            onClick={() => setOpenOnly(false)}
            className={`min-h-8 px-2 ${!openOnly ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setOpenOnly(true)}
            className={`min-h-8 border-l border-slate-300 px-2 ${openOnly ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            Open only
          </button>
        </div>
      </div>

      <div className="mt-3 border border-slate-300 bg-slate-50 p-3">
        <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
          <label className="text-xs font-bold">
            Your name
            <input
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              autoComplete="name"
              className="mt-1 h-9 w-full border border-slate-400 bg-white px-2 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="text-xs font-bold">
            Update
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              placeholder="Add critical project information, a decision, blocker, or coordination note."
              className="mt-1 w-full resize-y border border-slate-400 bg-white px-2 py-2 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 border border-slate-400 bg-white px-3 text-xs font-bold hover:bg-slate-50">
              <Paperclip className="h-4 w-4" />
              {selectedFiles.length
                ? `${selectedFiles.length} selected`
                : "Attach files"}
              <input
                ref={fileInput}
                type="file"
                multiple
                disabled={posting}
                onChange={(event) =>
                  setSelectedFiles([...(event.target.files ?? [])])
                }
                className="sr-only"
              />
            </label>
            <label className="inline-flex min-h-9 items-center gap-2 text-xs font-bold text-slate-800">
              <input
                type="checkbox"
                checked={requiresFollowUp}
                onChange={(event) =>
                  setRequiresFollowUp(event.target.checked)
                }
                className="h-4 w-4"
              />
              Requires follow-up
            </label>
          </div>
          <button
            type="button"
            onClick={() => void postUpdate()}
            disabled={posting || !authorName.trim() || !body.trim()}
            className="inline-flex min-h-9 items-center gap-2 border border-slate-950 bg-slate-900 px-3 text-xs font-bold uppercase text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageSquare className="h-4 w-4" />
            {posting ? "Posting…" : "Post update"}
          </button>
        </div>
        {selectedFiles.length > 0 && (
          <div className="mt-2 text-xs text-slate-600">
            {selectedFiles.map((file) => file.name).join(", ")}
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
        >
          {error}
        </div>
      )}
      {message && (
        <div
          role="status"
          className="mt-3 border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"
        >
          {message}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="border border-slate-300 p-4 text-sm text-slate-500">
            Loading Job Updates…
          </div>
        ) : visibleUpdates.length === 0 ? (
          <div className="border border-slate-300 p-4 text-sm text-slate-500">
            {openOnly
              ? "No open follow-ups."
              : "No Job Updates have been posted yet."}
          </div>
        ) : (
          visibleUpdates.map((update) => {
            const isOpen =
              update.requires_follow_up && update.resolved_at === null;
            const updateAttachments =
              attachmentsByUpdate.get(update.id) ?? [];
            return (
              <article
                id={`job-update-${update.id}`}
                key={update.id}
                className={`scroll-mt-5 border p-3 ${isOpen ? "border-amber-400 bg-amber-50/50" : "border-slate-300 bg-white"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-950">
                      {update.author_name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatTimestamp(update.created_at)}
                    </div>
                  </div>
                  {update.requires_follow_up ? (
                    update.resolved_at ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                        <CircleAlert className="h-3.5 w-3.5" />
                        Follow-up
                      </span>
                    )
                  ) : (
                    <span className="bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                      Update
                    </span>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                  {update.body}
                </p>

                {updateAttachments.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-slate-200 pt-2">
                    {updateAttachments.map((attachment) => (
                      <button
                        key={attachment.id}
                        type="button"
                        onClick={() => onOpenAttachment(attachment)}
                        className="flex min-h-8 max-w-full items-center gap-2 text-left text-xs font-bold text-blue-800 hover:underline"
                      >
                        <File className="h-4 w-4 shrink-0" />
                        <span className="truncate">{attachment.file_name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {update.resolved_at && update.resolved_by_name && (
                  <div className="mt-3 border-t border-emerald-200 pt-2 text-xs font-semibold text-emerald-800">
                    Resolved by {update.resolved_by_name} ·{" "}
                    {formatTimestamp(update.resolved_at)}
                  </div>
                )}

                {isOpen && (
                  <div className="mt-3 flex flex-wrap items-end justify-end gap-2 border-t border-amber-200 pt-3">
                    <label className="text-xs font-bold">
                      Resolver name
                      <input
                        value={resolverName}
                        onChange={(event) =>
                          setResolverName(event.target.value)
                        }
                        autoComplete="name"
                        className="mt-1 h-9 w-40 border border-slate-400 bg-white px-2 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void resolve(update)}
                      disabled={
                        resolvingId !== null || !resolverName.trim()
                      }
                      className="h-9 border border-emerald-700 bg-emerald-700 px-3 text-xs font-bold uppercase text-white disabled:opacity-50"
                    >
                      {resolvingId === update.id
                        ? "Resolving…"
                        : "Mark resolved"}
                    </button>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
