"use client";

import {
  CheckCircle2,
  File,
  Flag,
  MessageSquare,
  Paperclip,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { operationalFirstName } from "@/lib/identity-presentation";
import {
  createJobUpdate,
  deleteJobUpdate,
  editJobUpdate,
  loadJobAttachments,
  loadJobUpdateCollaborators,
  loadJobUpdateMentions,
  loadJobUpdates,
  markJobUpdatesSeen,
  resolveJobUpdate,
  uploadJobAttachments,
} from "../jobs";
import type { JobUpdateSummary } from "../jobs";
import type { JobAttachment, JobUpdate, JobUpdateCollaborator, JobUpdateMention, ProductionJob } from "../types";
import {
  PRODUCTION_PERSONNEL_NAMES,
} from "../production-personnel";
import { summarizeJobUpdates } from "../job-update-summary";
import { getResolutionResolverName } from "../job-update-resolution";
import {
  canEditJobUpdate,
  getJobUpdateEditDraft,
  getJobUpdateEditValidationError,
  hasJobUpdateEditChanges,
  type JobUpdateEditDraft,
} from "../job-update-editing";
import JobUpdateMentionTextarea, { type SelectedMention } from "./JobUpdateMentionTextarea";

const ATTRIBUTION_STORAGE_KEY = "tenops.jobUpdateAttributionName";
const OTHER_AUTHOR_VALUE = "__other__";

type Props = {
  job: ProductionJob;
  attachments: JobAttachment[];
  focusedUpdateId: string | null;
  onFocusedUpdateResolved?: (updateId: string, found: boolean) => void;
  onSummaryChanged: (summary: JobUpdateSummary) => void;
  onAttachmentsChanged: (attachments: JobAttachment[]) => void;
  onOpenAttachment: (attachment: JobAttachment) => void;
};

type ResolutionDraft = {
  message: string;
  files: File[];
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

function formatLatestTimestamp(value: string) {
  const date = new Date(value);
  const today = new Date();
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (date.toDateString() === today.toDateString()) return `Today at ${time}`;
  return formatTimestamp(value);
}

function renderMentionedBody(body: string, mentions: JobUpdateMention[]) {
  if (!mentions.length) return body;
  const mentionByToken = new Map(mentions.map((mention) => [`@${mention.displayName}`, mention]));
  const tokens = [...mentionByToken.keys()].sort((left, right) => right.length - left.length);
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(${tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}\\p{N}_])`, "gu");
  return body.split(pattern).map((part, index) => mentionByToken.has(part) ? (
    <span key={`${part}-${index}`} className="font-semibold text-blue-700">{part}</span>
  ) : part);
}

function AuthorControl({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const isPreset = PRODUCTION_PERSONNEL_NAMES.some((option) => option === value);
  const [custom, setCustom] = useState(Boolean(value && !isPreset));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <select
        aria-label={label}
        value={custom ? OTHER_AUTHOR_VALUE : isPreset ? value : ""}
        disabled={disabled}
        onChange={(event) => {
          if (event.target.value === OTHER_AUTHOR_VALUE) {
            setCustom(true);
            onChange("");
            return;
          }
          setCustom(false);
          onChange(event.target.value);
        }}
        className="h-9 rounded-sm border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
      >
        <option value="" disabled>
          Select
        </option>
        {PRODUCTION_PERSONNEL_NAMES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={OTHER_AUTHOR_VALUE}>Other…</option>
      </select>
      {custom && (
        <input
          aria-label={`${label} custom name`}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="name"
          placeholder="Name"
          className="h-9 w-36 rounded-sm border border-slate-300 bg-white px-2 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
        />
      )}
    </div>
  );
}

export default function JobUpdatesPanel({
  job,
  attachments,
  focusedUpdateId,
  onFocusedUpdateResolved,
  onSummaryChanged,
  onAttachmentsChanged,
  onOpenAttachment,
}: Props) {
  const auth = useAuth();
  const [updates, setUpdates] = useState<JobUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [authorName, setAuthorName] = useState(storedAttributionName);
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<SelectedMention[]>([]);
  const [mentionsByUpdate, setMentionsByUpdate] = useState<Record<string, JobUpdateMention[]>>({});
  const [collaborators, setCollaborators] = useState<JobUpdateCollaborator[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolverName, setResolverName] = useState(storedAttributionName);
  const resolvedFocusedUpdateIdRef = useRef<string | null>(null);
  const [resolverNamesByUpdate, setResolverNamesByUpdate] = useState<
    Record<string, string>
  >({});
  const [resolutionDrafts, setResolutionDrafts] = useState<
    Record<string, ResolutionDraft>
  >({});
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<JobUpdateEditDraft | null>(null);
  const [editMentions, setEditMentions] = useState<SelectedMention[]>([]);
  const [editError, setEditError] = useState("");
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JobUpdate | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const postingRef = useRef(false);
  const resolvingIdsRef = useRef(new Set<string>());

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    setEditingUpdateId(null);
    setEditDraft(null);
    setEditError("");
    Promise.all([
      loadJobUpdates(job.id),
      auth.isAuthenticated && auth.profile?.isActive ? loadJobUpdateMentions(job.id) : Promise.resolve([]),
      auth.isAuthenticated && auth.profile?.isActive ? loadJobUpdateCollaborators() : Promise.resolve([]),
    ])
      .then(([rows, loadedMentions, loadedCollaborators]) => {
        if (live) {
          setUpdates(rows);
          setCollaborators(loadedCollaborators);
          setMentionsByUpdate(loadedMentions.reduce<Record<string, JobUpdateMention[]>>((grouped, mention) => {
            grouped[mention.updateId] = [...(grouped[mention.updateId] ?? []), mention];
            return grouped;
          }, {}));
        }
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
  }, [auth.isAuthenticated, auth.profile?.isActive, job.id]);

  useEffect(() => {
    if (!focusedUpdateId || loading) return;
    if (resolvedFocusedUpdateIdRef.current === focusedUpdateId) return;
    resolvedFocusedUpdateIdRef.current = focusedUpdateId;
    const target = document.getElementById(`job-update-${focusedUpdateId}`);
    if (!target) {
      setError("The requested Job Update is no longer available.");
      onFocusedUpdateResolved?.(focusedUpdateId, false);
      return;
    }
    const frame = requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      onFocusedUpdateResolved?.(focusedUpdateId, true);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusedUpdateId, loading, onFocusedUpdateResolved]);

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

  const summary = useMemo(() => summarizeJobUpdates(updates), [updates]);
  const openCount = summary.openFollowUpCount;
  const mentionableCollaborators = useMemo(
    () => collaborators.filter((user) => !["developer", "guest"].includes(user.role.toLocaleLowerCase())),
    [collaborators],
  );
  const latestUpdate = updates[0] ?? null;

  useEffect(() => {
    if (loading) return;
    if (!auth.isAuthenticated || !auth.profile?.isActive) {
      onSummaryChanged(summary);
      return;
    }
    let live = true;
    void markJobUpdatesSeen(job.id).then(() => {
      if (live) onSummaryChanged({ ...summary, hasUnseenActivity: false });
    }).catch(() => {
      if (live) onSummaryChanged(summary);
    });
    return () => { live = false; };
  }, [auth.isAuthenticated, auth.profile?.isActive, job.id, loading, onSummaryChanged, summary]);

  async function postUpdate() {
    if (postingRef.current) return;
    postingRef.current = true;
    setPosting(true);
    setError("");
    setMessage("");
    let created: JobUpdate | null = null;
    try {
      created = await createJobUpdate(
        job.id,
        auth.profile?.displayName ?? authorName,
        body,
        false,
        null,
        null,
        mentions.map((mention) => mention.userId),
      );
      setUpdates((current) => [created as JobUpdate, ...current]);
      window.localStorage.setItem(
        ATTRIBUTION_STORAGE_KEY,
        (auth.profile?.displayName ?? authorName).trim(),
      );
      setResolverName((auth.profile?.displayName ?? authorName).trim());

      const failedFiles: string[] = [];
      if (selectedFiles.length) {
        for (const file of selectedFiles) {
          try {
            await uploadJobAttachments(
              job.id,
              [file],
              "other",
              created.id,
              auth.profile?.displayName ?? authorName,
            );
          } catch {
            failedFiles.push(file.name);
          }
        }
        const nextAttachments = await loadJobAttachments(job.id);
        onAttachmentsChanged(nextAttachments);
      }

      setBody("");
      setMentions([]);
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
      postingRef.current = false;
      setPosting(false);
    }
  }

  async function resolve(update: JobUpdate) {
    if (resolvingIdsRef.current.size > 0) return;
    resolvingIdsRef.current.add(update.id);
    const resolutionDraft = resolutionDrafts[update.id] ?? {
      message: "",
      files: [],
    };
    setResolvingId(update.id);
    setError("");
    setMessage("");
    let resolved: JobUpdate | null = null;
    const preferredResolverName = getResolutionResolverName(
      update,
      resolverNamesByUpdate[update.id],
      resolverName,
    );
    const selectedResolverName = auth.isAuthenticated
      ? auth.profile?.displayName ?? ""
      : preferredResolverName;
    try {
      const resolvedUpdate = await resolveJobUpdate(
        update,
        selectedResolverName,
        resolutionDraft.message,
        auth.isAuthenticated ? auth.profile?.userId ?? null : null,
      );
      resolved = resolvedUpdate;
      setUpdates((current) =>
        current.map((row) =>
          row.id === resolvedUpdate.id ? resolvedUpdate : row,
        ),
      );
      window.dispatchEvent(new Event("tenops:notifications-changed"));
      window.localStorage.setItem(
        ATTRIBUTION_STORAGE_KEY,
        selectedResolverName.trim(),
      );

      const failedFiles: string[] = [];
      for (const file of resolutionDraft.files) {
        try {
          await uploadJobAttachments(
            job.id,
            [file],
            "other",
            update.id,
            selectedResolverName,
            "resolution",
          );
        } catch {
          failedFiles.push(file.name);
        }
      }
      if (resolutionDraft.files.length) {
        onAttachmentsChanged(await loadJobAttachments(job.id));
      }
      setResolutionDrafts((current) => {
        const next = { ...current };
        delete next[update.id];
        return next;
      });
      setMessage(
        resolutionDraft.files.length && failedFiles.length === 0
          ? "Marked resolved and files uploaded."
          : "Marked resolved.",
      );
      if (failedFiles.length) {
        setError(
          `Item resolved, but ${failedFiles.length === 1 ? "this file was" : "these files were"} not uploaded: ${failedFiles.join(", ")}`,
        );
      }
    } catch (resolveError) {
      if (resolved) {
        try {
          onAttachmentsChanged(await loadJobAttachments(job.id));
        } catch {
          // The resolved item remains canonical even if files cannot refresh.
        }
      }
      setError(
        resolved
          ? `Item resolved, but files could not be refreshed${resolveError instanceof Error ? `: ${resolveError.message}` : "."}`
          : resolveError instanceof Error
            ? resolveError.message
            : "Unable to resolve this item.",
      );
    } finally {
      resolvingIdsRef.current.delete(update.id);
      setResolvingId(null);
    }
  }

  function beginEdit(update: JobUpdate) {
    if (!canEditJobUpdate(update)) return;
    setEditingUpdateId(update.id);
    setEditDraft(getJobUpdateEditDraft(update));
    setEditMentions((mentionsByUpdate[update.id] ?? []).map((mention) => ({ userId: mention.userId, displayName: mention.displayName })));
    setEditError("");
    setMessage("");
  }

  function cancelEdit() {
    if (savingEditId) return;
    setEditingUpdateId(null);
    setEditDraft(null);
    setEditMentions([]);
    setEditError("");
  }

  async function saveEdit(update: JobUpdate) {
    if (!editDraft || savingEditId) return;
    const validationError = getJobUpdateEditValidationError(editDraft);
    if (validationError) {
      setEditError(validationError);
      return;
    }

    setSavingEditId(update.id);
    setEditError("");
    setMessage("");
    try {
      const edited = await editJobUpdate(
        update.id,
        editDraft.body,
        editDraft.requiresFollowUp,
        editDraft.followUpAssigneeName,
        editDraft.followUpAssigneeUserId,
        editMentions.map((mention) => mention.userId),
      );
      setUpdates((current) =>
        current.map((row) => (row.id === edited.id ? edited : row)),
      );
      setEditingUpdateId(null);
      setEditDraft(null);
      setMentionsByUpdate((current) => ({ ...current, [update.id]: editMentions.map((mention) => ({ updateId: update.id, userId: mention.userId, displayName: mention.displayName, isActive: true })) }));
      setEditMentions([]);
      setMessage("Changes saved.");
    } catch (saveError) {
      setEditError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save changes. Try again.",
      );
    } finally {
      setSavingEditId(null);
    }
  }

  function canDeleteUpdate(update: JobUpdate) {
    if (!auth.isAuthenticated || !auth.profile?.isActive) return false;
    return update.author_user_id === auth.profile.userId || auth.can("deleteJobUpdate");
  }

  async function confirmDelete() {
    if (!deleteTarget || deletingId) return;
    setDeletingId(deleteTarget.id);
    setError("");
    setMessage("");
    try {
      await deleteJobUpdate(deleteTarget.id);
      setUpdates((current) => current.filter((update) => update.id !== deleteTarget.id));
      setMentionsByUpdate((current) => {
        const next = { ...current };
        delete next[deleteTarget.id];
        return next;
      });
      onAttachmentsChanged(await loadJobAttachments(job.id));
      window.dispatchEvent(new Event("tenops:notifications-changed"));
      setDeleteTarget(null);
      setMessage("Job Update deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this Job Update.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mt-5" data-field="job-updates">
      <div className="border-b border-slate-300 pb-3">
        <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-2 text-xs">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Last updated
            </div>
            {latestUpdate ? (
              <div className="mt-1 text-slate-600">
                <span className="font-bold text-slate-900">
                  {operationalFirstName(latestUpdate.author_name)}
                </span>
                <span className="mx-1.5 text-slate-300">·</span>
                {formatLatestTimestamp(latestUpdate.created_at)}
              </div>
            ) : (
              <div className="mt-1 text-slate-500">No updates yet</div>
            )}
          </div>
          {openCount > 0 && (
            <div className="inline-flex items-center gap-1.5 font-bold text-amber-900">
              <Flag className="h-3.5 w-3.5 fill-amber-100" />
              {openCount} {openCount === 1 ? "needs" : "need"} attention
            </div>
          )}
        </div>
      </div>

      <section className="mt-4">
        <h4 className="text-sm font-bold text-slate-950">Update history</h4>
        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="border border-slate-300 p-4 text-sm text-slate-500">
              Loading Job Updates…
            </div>
          ) : updates.length === 0 ? (
            <div className="border border-slate-300 p-4 text-sm text-slate-500">
              No Job Updates have been posted yet.
            </div>
          ) : (
            updates.map((update) => {
              const isOpen =
                update.requires_follow_up && update.resolved_at === null;
              const updateAttachments =
                (attachmentsByUpdate.get(update.id) ?? []).filter(
                  (attachment) =>
                    attachment.job_update_attachment_role !== "resolution",
                );
              const resolutionAttachments =
                (attachmentsByUpdate.get(update.id) ?? []).filter(
                  (attachment) =>
                    attachment.job_update_attachment_role === "resolution",
                );
              const resolutionDraft = resolutionDrafts[update.id] ?? {
                message: "",
                files: [],
              };
              const preferredResolverName = getResolutionResolverName(
                update,
                resolverNamesByUpdate[update.id],
                resolverName,
              );
              const selectedResolverName = auth.isAuthenticated
                ? auth.profile?.displayName ?? ""
                : preferredResolverName;
              const isEditing = editingUpdateId === update.id && editDraft;
              const editValidationError = isEditing
                ? getJobUpdateEditValidationError(editDraft)
                : null;
              const editHasChanges = isEditing
                ? hasJobUpdateEditChanges(update, editDraft) ||
                  JSON.stringify(editMentions.map((mention) => mention.userId).sort()) !==
                    JSON.stringify((mentionsByUpdate[update.id] ?? []).map((mention) => mention.userId).sort())
                : false;
              return (
                <article
                  id={`job-update-${update.id}`}
                  key={update.id}
                  className={`scroll-mt-5 border bg-white p-3 transition ${focusedUpdateId === update.id ? "ring-2 ring-blue-600 ring-offset-2" : ""} ${isOpen ? "border-slate-300 border-l-4 border-l-amber-500" : "border-slate-300"}`}
                >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-950">
                      {operationalFirstName(update.author_name)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatTimestamp(update.created_at)}
                      {update.edited_at && (
                        <span title={`Last edited ${formatTimestamp(update.edited_at)}`}>
                          {" "}· Edited
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {update.requires_follow_up ? (
                      update.resolved_at ? (
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Resolved
                        {update.follow_up_assignee_name
                          ? ` · ${operationalFirstName(update.follow_up_assignee_name)}`
                          : ""}
                      </span>
                      ) : (
                      <span className="inline-flex items-center gap-1 bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                        <Flag className="h-3.5 w-3.5 fill-amber-50" />
                        Needs attention
                        {update.follow_up_assignee_name
                          ? ` · ${operationalFirstName(update.follow_up_assignee_name)}`
                          : ""}
                      </span>
                      )
                    ) : (
                      <span className="bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                        Update
                      </span>
                    )}
                    {canEditJobUpdate(update) && !isEditing && (
                      <button
                        type="button"
                        onClick={() => beginEdit(update)}
                        className="inline-flex min-h-8 items-center gap-1 px-1.5 text-xs font-semibold text-slate-500 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    )}
                    {canDeleteUpdate(update) && !isEditing && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(update)}
                        className="inline-flex min-h-8 items-center gap-1 px-1.5 text-xs font-semibold text-slate-500 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                {isEditing ? (
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <label className="block text-xs font-bold text-slate-700">
                      Update
                      <div className="mt-1">
                        <JobUpdateMentionTextarea
                          value={editDraft.body}
                          mentions={editMentions}
                          collaborators={mentionableCollaborators}
                          disabled={savingEditId !== null}
                          onChange={(nextBody, nextMentions) => {
                            setEditDraft({ ...editDraft, body: nextBody });
                            setEditMentions(nextMentions);
                          }}
                        />
                      </div>
                    </label>
                    {editError && (
                      <div role="alert" className="mt-3 border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                        {editError}
                      </div>
                    )}
                    <div className="mt-3 flex justify-end gap-2 border-t border-slate-200 pt-3">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={savingEditId !== null}
                        className="h-9 border border-slate-300 bg-white px-3 text-xs font-bold uppercase text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveEdit(update)}
                        disabled={
                          savingEditId !== null ||
                          Boolean(editValidationError) ||
                          !editHasChanges
                        }
                        className="h-9 border border-slate-950 bg-slate-900 px-3 text-xs font-bold uppercase text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingEditId === update.id ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{renderMentionedBody(update.body, mentionsByUpdate[update.id] ?? [])}</p>
                  </div>
                )}

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

                {update.resolved_at &&
                  update.resolved_by_name &&
                  (update.resolution_message ||
                  resolutionAttachments.length > 0 ? (
                    <section className="mt-4 border-t border-slate-200 bg-slate-50 p-3">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Resolution
                      </div>
                      <div className="mt-2 text-sm font-bold text-slate-900">
                        {operationalFirstName(update.resolved_by_name)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatLatestTimestamp(update.resolved_at)}
                      </div>
                      {update.resolution_message && (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {update.resolution_message}
                        </p>
                      )}
                      {resolutionAttachments.length > 0 && (
                        <div className="mt-3 space-y-1 border-t border-slate-200 pt-2">
                          {resolutionAttachments.map((attachment) => (
                            <button
                              key={attachment.id}
                              type="button"
                              onClick={() => onOpenAttachment(attachment)}
                              className="flex min-h-8 max-w-full items-center gap-2 text-left text-xs font-bold text-blue-800 hover:underline"
                            >
                              <File className="h-4 w-4 shrink-0" />
                              <span className="truncate">
                                {attachment.file_name}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  ) : (
                    <div className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-500">
                      Resolved by {operationalFirstName(update.resolved_by_name)} ·{" "}
                      {formatTimestamp(update.resolved_at)}
                    </div>
                  ))}

                {isOpen && !isEditing && (
                  <div className="mt-3 border-t border-amber-200 pt-3">
                    {auth.isAuthenticated ? (
                      <div className="text-xs text-slate-600">
                        Resolve as <strong className="text-slate-900">{operationalFirstName(auth.profile?.displayName)}</strong>
                      </div>
                    ) : (
                      <AuthorControl
                        label="Resolve as"
                        value={selectedResolverName}
                        onChange={(value) => setResolverNamesByUpdate((current) => ({ ...current, [update.id]: value }))}
                        disabled={resolvingId !== null}
                      />
                    )}
                    <label className="mt-3 block text-xs font-bold text-slate-700">
                      Resolution notes{" "}
                      <span className="font-normal text-slate-500">
                        (optional)
                      </span>
                      <textarea
                        value={resolutionDraft.message}
                        disabled={resolvingId !== null}
                        onChange={(event) =>
                          setResolutionDrafts((current) => ({
                            ...current,
                            [update.id]: {
                              ...resolutionDraft,
                              message: event.target.value,
                            },
                          }))
                        }
                        rows={2}
                        className="mt-1 w-full resize-y border border-slate-300 bg-white px-2 py-2 text-sm font-normal outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                      />
                    </label>
                    <label className="mt-2 inline-flex min-h-8 cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950">
                      <Paperclip className="h-3.5 w-3.5" />
                      {resolutionDraft.files.length
                        ? `${resolutionDraft.files.length} selected`
                        : "Attach files (optional)"}
                      <input
                        type="file"
                        multiple
                        disabled={resolvingId !== null}
                        onChange={(event) =>
                          setResolutionDrafts((current) => ({
                            ...current,
                            [update.id]: {
                              ...resolutionDraft,
                              files: [...(event.target.files ?? [])],
                            },
                          }))
                        }
                        className="sr-only"
                      />
                    </label>
                    {resolutionDraft.files.length > 0 && (
                      <div className="mt-1 text-xs text-slate-500">
                        {resolutionDraft.files
                          .map((file) => file.name)
                          .join(", ")}
                      </div>
                    )}
                    <div className="mt-3 flex justify-end border-t border-amber-200 pt-3">
                      <button
                        type="button"
                        onClick={() => void resolve(update)}
                        disabled={
                          resolvingId !== null || !selectedResolverName.trim()
                        }
                        className="h-9 border border-emerald-700 bg-emerald-700 px-3 text-xs font-bold uppercase text-white disabled:opacity-50"
                      >
                        {resolvingId === update.id
                          ? "Resolving…"
                          : "Mark resolved"}
                      </button>
                    </div>
                  </div>
                )}
                </article>
              );
            })
          )}
        </div>
      </section>

      <div className="mt-5 border border-slate-300 bg-slate-50/70 p-3">
        <h4 className="text-sm font-bold text-slate-950">Post a job update</h4>
        <div className="mt-3">
          {auth.isAuthenticated && auth.profile?.isActive ? (
            <div className="text-xs text-slate-600">Posting as <strong className="text-slate-900">{operationalFirstName(auth.profile.displayName)}</strong></div>
          ) : (
            <AuthorControl label="Posting as" value={authorName} onChange={setAuthorName} disabled={posting} />
          )}
        </div>
        <div className="mt-3">
          <label className="sr-only" htmlFor={`job-update-body-${job.id}`}>
            Job update
          </label>
          <JobUpdateMentionTextarea
            id={`job-update-body-${job.id}`}
            value={body}
            mentions={mentions}
            collaborators={mentionableCollaborators}
            disabled={posting}
            onChange={(nextBody, nextMentions) => {
              setBody(nextBody);
              setMentions(nextMentions);
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
            <label className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950">
              <Paperclip className="h-3.5 w-3.5" />
              {selectedFiles.length
                ? `${selectedFiles.length} selected`
                : "Attach files (optional)"}
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
          </div>
          <button
            type="button"
            onClick={() => void postUpdate()}
            disabled={posting || !(auth.profile?.displayName ?? authorName).trim() || !body.trim()}
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
      {deleteTarget ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-job-update-title">
          <div className="w-full max-w-md border border-slate-400 bg-white p-5 shadow-2xl">
            <h3 id="delete-job-update-title" className="text-lg font-bold text-slate-950">Delete Job Update?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">This permanently removes the Update from the Job history and cannot be undone. Supporting files remain available on the Job.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={deletingId !== null} onClick={() => setDeleteTarget(null)} className="h-9 border border-slate-300 bg-white px-3 text-xs font-bold uppercase text-slate-700 disabled:opacity-50">Cancel</button>
              <button type="button" disabled={deletingId !== null} onClick={() => void confirmDelete()} className="h-9 border border-red-800 bg-red-800 px-3 text-xs font-bold uppercase text-white disabled:opacity-50">{deletingId ? "Deleting…" : "Delete Update"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
