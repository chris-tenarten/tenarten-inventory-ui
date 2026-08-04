"use client";

import { ClipboardList, File, History, Send, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import DocumentViewer from "@/components/documents/DocumentViewer";
import JobTransmittalPanel from "@/modules/transmittals/JobTransmittalPanel";
import PlanningPanel from "@/modules/planning/PlanningPanel";
import type { StagedPlanningSchedules } from "@/modules/planning/schedule-staging";
import type { PlanningPhase } from "@/modules/planning/types";
import type { PlanningScheduleIssue } from "@/modules/planning/schedule-model.mjs";
import { isPlanningEnabled } from "@/modules/planning/timeline-model.mjs";
import {
  createJobAttachmentDownloadUrl,
  deleteJobAttachment,
  loadJobAttachments,
  loadProductionJobActivity,
  uploadJobAttachments,
} from "../jobs";
import type {
  JobUpdateSummary,
  ProductionJobActivity,
  ProductionJobUpdate,
} from "../jobs";
import { materialStatusLabel, materialStatusOptions } from "../material-status";
import { getJobReadiness } from "../readiness";
import { productionStatusVisuals } from "../status-visuals";
import {
  normalizeNullableNumber,
  productionValuesEqual,
} from "../update-normalization";
import type {
  JobAttachment,
  JobDocumentType,
  MaterialStatus,
  ProductionJob,
  ProductionStatus,
} from "../types";
import JobUpdatesPanel from "./JobUpdatesPanel";
import ProductionStatusBadge from "./ProductionStatusBadge";

type InspectorSection = "details" | "planning" | "updates" | "files" | "recent-changes";
const planningEnabled = isPlanningEnabled(process.env.NEXT_PUBLIC_ENABLE_PLANNING);

type Props = {
  job: ProductionJob;
  onClose: () => void;
  onUpdateJob: (
    id: string,
    changes: ProductionJobUpdate,
  ) => Promise<ProductionJob>;
  onArchive: (job: ProductionJob) => Promise<void>;
  onRestore: (job: ProductionJob) => Promise<void>;
  onStageSchedule: (job: ProductionJob, start: string, end: string) => void;
  scheduleIsStaged: boolean;
  jobUpdateSummary: JobUpdateSummary;
  onJobUpdateSummaryChanged: (
    jobId: string,
    summary: JobUpdateSummary,
  ) => void;
  onAttachmentsChanged: (jobId: string, count: number) => void;
  onPlanningPhasesChanged?: (jobId: string, phases: PlanningPhase[]) => void;
  stagedPlanningSchedules?: StagedPlanningSchedules;
  planningPhases?: PlanningPhase[];
  planningIssues?: PlanningScheduleIssue[];
  initialFocus?: string;
};

const sectionTitle =
  "border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-700";
const fieldClass =
  "mt-1 h-9 w-full rounded-sm border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100";

function readableDate(value: unknown) {
  if (typeof value !== "string" || !value) return "Not scheduled";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

const activityFieldLabels: Record<string, string> = {
  name: "Project",
  customer: "Customer",
  job_number: "Job number",
  estimate_number: "Estimate number",
  work_order_number: "Work order",
  deposit_date: "Deposit date",
  requested_delivery_date: "Requested delivery",
  estimated_man_hours: "Labor estimate",
  estimated_calendar_days: "Calendar days",
  color_plate_number: "Color plate",
  sample_submitted_date: "Sample submitted",
  approval_date: "Approval date",
  production_status: "Production status",
  material_status: "Material status",
  remarks: "Remarks",
  planned_start: "Planned start",
  planned_end: "Planned finish",
};

function readableActivityValue(
  field: string,
  value: unknown,
  previous = false,
) {
  if (value === null || value === undefined || value === "")
    return previous ? "Previous value not recorded" : "Blank";
  if (field === "material_status") return materialStatusLabel(value);
  if (field === "production_status")
    return (
      productionStatusVisuals.find((status) => status.value === value)?.label ??
      String(value)
    );
  if (
    field.includes("date") ||
    field === "planned_start" ||
    field === "planned_end"
  )
    return readableDate(value);
  if (field === "estimated_man_hours") return `${value} hours`;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function activityDescription(change: ProductionJobActivity) {
  const metadata = change.metadata as {
    old_values?: Record<string, unknown>;
    new_values?: Record<string, unknown>;
    change_note?: string;
    changed_fields?: string[];
    file_names?: string[];
    changes?: Record<string, unknown>;
  };

  if (change.event_type === "production_schedule_changed") {
    return {
      action: "Moved production",
      detail: `${readableDate(metadata.old_values?.planned_start)} – ${readableDate(metadata.old_values?.planned_end)} → ${readableDate(metadata.new_values?.planned_start)} – ${readableDate(metadata.new_values?.planned_end)}`,
      reason: metadata.change_note,
    };
  }
  if (change.event_type === "attachments_uploaded") {
    const names = Array.isArray(metadata.file_names)
      ? metadata.file_names.filter(
          (name): name is string => typeof name === "string",
        )
      : [];
    return {
      action:
        names.length === 1
          ? "Added an attachment"
          : `Added ${names.length || "multiple"} attachments`,
      detail: names.join(", ") || undefined,
    };
  }
  if (change.event_type === "job_created")
    return { action: "Created this production job" };
  if (change.event_type === "job_updated") {
    const legacy =
      metadata.changes && typeof metadata.changes === "object"
        ? (metadata.changes as Record<string, unknown>)
        : {};
    const fields =
      Array.isArray(metadata.changed_fields) && metadata.changed_fields.length
        ? metadata.changed_fields
        : Object.keys(metadata.new_values ?? legacy);
    const lines = fields.map((field) => {
      const hasOld = Boolean(
        metadata.old_values &&
        Object.prototype.hasOwnProperty.call(metadata.old_values, field),
      );
      const next = metadata.new_values?.[field] ?? legacy[field];
      return `${activityFieldLabels[field] ?? field.replaceAll("_", " ")}\n${readableActivityValue(field, metadata.old_values?.[field], !hasOld)} → ${readableActivityValue(field, next)}`;
    });
    return {
      action: "Updated job details",
      detail: lines.join("\n\n") || undefined,
    };
  }
  return { action: change.summary || "Updated this production job" };
}

export default function ProductionJobInspector({
  job,
  onClose,
  onUpdateJob,
  onArchive,
  onRestore,
  onStageSchedule,
  scheduleIsStaged,
  jobUpdateSummary,
  onJobUpdateSummaryChanged,
  onAttachmentsChanged,
  onPlanningPhasesChanged,
  stagedPlanningSchedules,
  planningPhases,
  planningIssues = [],
  initialFocus,
}: Props) {
  const [activeSection, setActiveSection] = useState<InspectorSection>(
    initialFocus === "attachments"
      ? "files"
      : initialFocus?.startsWith("planning") && planningEnabled
        ? "planning"
      : initialFocus === "job-updates"
        ? "updates"
        : initialFocus === "recent-changes"
          ? "recent-changes"
          : "details",
  );
  const [activity, setActivity] = useState<ProductionJobActivity[]>([]);
  const [activityError, setActivityError] = useState("");
  const [activityLoading, setActivityLoading] = useState(true);
  const [attachments, setAttachments] = useState<JobAttachment[]>([]);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(() => ({
    requested_delivery_date: job.requested_delivery_date || "",
    estimated_man_hours:
      job.estimated_man_hours === null ? "" : String(job.estimated_man_hours),
    estimated_calendar_days:
      job.estimated_calendar_days === null
        ? ""
        : String(job.estimated_calendar_days),
    production_status: job.production_status,
    material_status: job.material_status,
  }));
  const [attachmentError, setAttachmentError] = useState("");
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<JobDocumentType>("other");
  const [attachmentPreview, setAttachmentPreview] = useState<{
    attachment: JobAttachment;
    url: string;
  } | null>(null);
  const [attachmentFullscreen, setAttachmentFullscreen] = useState(false);
  const [transmittalOpen, setTransmittalOpen] = useState(false);
  const [focusedUpdateId, setFocusedUpdateId] = useState<string | null>(null);
  const [planningEditorOpen, setPlanningEditorOpen] = useState(false);
  const [jobUpdateCount, setJobUpdateCount] = useState(
    jobUpdateSummary.total,
  );
  const [scheduleDraft, setScheduleDraft] = useState(() => ({
    start: job.planned_start || "",
    end: job.planned_end || "",
  }));
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachmentRequest = useRef(0);
  const handleJobUpdateSummaryChanged = useCallback(
    (summary: JobUpdateSummary) => {
      setJobUpdateCount(summary.total);
      onJobUpdateSummaryChanged(job.id, summary);
    },
    [job.id, onJobUpdateSummaryChanged],
  );

  useEffect(() => {
    let live = true;
    setActivityLoading(true);
    setActivityError("");
    loadProductionJobActivity(job.id)
      .then((changes) => {
        if (live) setActivity(changes);
      })
      .catch((loadError: unknown) => {
        if (live)
          setActivityError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load recent changes.",
          );
      })
      .finally(() => {
        if (live) setActivityLoading(false);
      });
    return () => {
      live = false;
    };
  }, [job.id, job.updated_at]);

  useEffect(() => {
    let live = true;
    loadJobAttachments(job.id)
      .then((files) => {
        if (live) setAttachments(files);
      })
      .catch((loadError: unknown) => {
        if (live)
          setAttachmentError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load attachments.",
          );
      })
      .finally(() => {
        if (live) setAttachmentsLoading(false);
      });
    requestAnimationFrame(() => {
      if (initialFocus?.startsWith("planning")) return;
      const target =
        initialFocus && initialFocus !== "attachments"
          ? panel.current?.querySelector<HTMLElement>(
              `[data-field="${initialFocus}"]`,
            )
          : null;
      if (target) {
        target.focus();
      } else closeRef.current?.focus();
    });
    return () => {
      live = false;
    };
  }, [initialFocus, job.id]);

  useEffect(() => {
    setScheduleDraft({
      start: job.planned_start || "",
      end: job.planned_end || "",
    });
  }, [job.planned_end, job.planned_start]);

  const normalizedDraft: ProductionJobUpdate = {
    requested_delivery_date: draft.requested_delivery_date || null,
    estimated_man_hours:
      draft.estimated_man_hours === ""
        ? null
        : Number(draft.estimated_man_hours),
    estimated_calendar_days:
      draft.estimated_calendar_days === ""
        ? null
        : Number(draft.estimated_calendar_days),
    production_status: draft.production_status,
    material_status: draft.material_status,
  };
  const changedDraft = Object.fromEntries(
    Object.entries(normalizedDraft).filter(
      ([field, value]) =>
        !productionValuesEqual(
          field as keyof ProductionJobUpdate,
          job[field as keyof ProductionJob],
          value,
        ),
    ),
  ) as ProductionJobUpdate;
  const dirtyCount = Object.keys(changedDraft).length;

  const requestClose = useCallback(() => {
    if (
      dirtyCount &&
      !window.confirm(
        `Discard ${dirtyCount} unsaved ${dirtyCount === 1 ? "field" : "fields"} and close the Inspector?`,
      )
    )
      return;
    onClose();
  }, [dirtyCount, onClose]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (attachmentFullscreen || transmittalOpen || planningEditorOpen) return;
      if (event.key === "Escape") requestClose();
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = [
        ...panel.current.querySelectorAll<HTMLElement>(
          "button,input,select,textarea",
        ),
      ].filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable.at(-1)?.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === focusable.at(-1)
      ) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [attachmentFullscreen, requestClose, transmittalOpen, planningEditorOpen]);

  useEffect(() => {
    if (!dirtyCount) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyCount]);

  const readiness = getJobReadiness(job);
  const selectSection = (section: InspectorSection) => {
    setActiveSection(section);
  };
  const discardDraft = () => {
    setDraft({
      requested_delivery_date: job.requested_delivery_date || "",
      estimated_man_hours:
        job.estimated_man_hours === null ? "" : String(job.estimated_man_hours),
      estimated_calendar_days:
        job.estimated_calendar_days === null
          ? ""
          : String(job.estimated_calendar_days),
      production_status: job.production_status,
      material_status: job.material_status,
    });
    setSaveError("");
    setSaveMessage("");
  };
  const saveDraft = async () => {
    const hours = normalizeNullableNumber(draft.estimated_man_hours);
    const days = normalizeNullableNumber(draft.estimated_calendar_days);
    if (
      !hours.valid ||
      !days.valid ||
      (days.value !== null && !Number.isInteger(days.value))
    ) {
      setSaveError(
        "Enter valid non-negative labor hours and whole calendar days, or leave them blank.",
      );
      return;
    }
    if (!dirtyCount || saving) return;
    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    try {
      await onUpdateJob(job.id, changedDraft);
      setSaveMessage(
        scheduleIsStaged
          ? "Job details saved. Planned dates remain staged for Save All."
          : "Job details saved",
      );
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to save changes.",
      );
    } finally {
      setSaving(false);
    }
  };
  const schedule = (key: "start" | "end", value: string) => {
    const next = { ...scheduleDraft, [key]: value };
    setScheduleDraft(next);
    if (next.start && next.end) onStageSchedule(job, next.start, next.end);
  };

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setAttachmentError("");
    try {
      const uploaded = await uploadJobAttachments(
        job.id,
        [...files],
        documentType,
      );
      const next = [...uploaded, ...attachments];
      setAttachments(next);
      onAttachmentsChanged(job.id, next.length);
      if (fileRef.current) fileRef.current.value = "";
      const changes = await loadProductionJobActivity(job.id);
      setActivity(changes);
    } catch (error) {
      setAttachmentError(
        error instanceof Error ? error.message : "Unable to upload attachment.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function openAttachment(attachment: JobAttachment) {
    const request = ++attachmentRequest.current;
    setAttachmentError("");
    try {
      const url = await createJobAttachmentDownloadUrl(attachment.storage_path);
      if (request === attachmentRequest.current)
        setAttachmentPreview({ attachment, url });
    } catch (error) {
      if (request === attachmentRequest.current)
        setAttachmentError(
          error instanceof Error ? error.message : "Unable to open attachment.",
        );
    }
  }

  async function removeAttachment(attachment: JobAttachment) {
    if (!window.confirm(`Remove “${attachment.file_name}” from this job?`))
      return;
    setDeletingId(attachment.id);
    setAttachmentError("");
    try {
      await deleteJobAttachment(attachment);
      const next = attachments.filter((file) => file.id !== attachment.id);
      setAttachments(next);
      if (attachmentPreview?.attachment.id === attachment.id) {
        attachmentRequest.current += 1;
        setAttachmentPreview(null);
        setAttachmentFullscreen(false);
      }
      onAttachmentsChanged(job.id, next.length);
    } catch (error) {
      setAttachmentError(
        error instanceof Error ? error.message : "Unable to remove attachment.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const tabs: Array<{ id: InspectorSection; label: string }> = [
    { id: "details", label: "Details" },
    ...(planningEnabled ? [{ id: "planning" as const, label: "Planning" }] : []),
    { id: "updates", label: `Job Updates (${jobUpdateCount})` },
    {
      id: "files",
      label: `Files${attachments.length ? ` (${attachments.length})` : ""}`,
    },
    {
      id: "recent-changes",
      label: `Recent Changes${activity.length ? ` (${activity.length})` : ""}`,
    },
  ];
  const attachmentPreviewIndex = attachmentPreview
    ? attachments.findIndex(
        (file) => file.id === attachmentPreview.attachment.id,
      )
    : -1;

  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-950/30"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-inspector-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="ml-auto h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-500">
              {job.job_number || "Job number not recorded"}
            </div>
            <h2
              id="job-inspector-title"
              className="text-2xl font-bold text-slate-950"
            >
              {job.name}
            </h2>
            <div className="mt-2">
              <ProductionStatusBadge status={job.production_status} />
            </div>
            <div
              className={`mt-2 inline-flex px-2 py-1 text-xs font-bold ${readiness.state === "ready" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}
            >
              {readiness.label} — {readiness.guidance}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={requestClose}
            className="h-9 shrink-0 border border-slate-400 px-3 font-bold hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Job inspector sections"
          className={`mt-5 grid rounded-sm border border-slate-300 bg-slate-50 p-1 ${planningEnabled ? "grid-cols-5" : "grid-cols-4"}`}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeSection === tab.id}
              aria-controls={`inspector-${tab.id}`}
              id={`inspector-tab-${tab.id}`}
              onClick={() => selectSection(tab.id)}
              className={`min-h-9 rounded-sm px-2 py-2 text-xs font-bold focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${activeSection === tab.id ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-950"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`inspector-${activeSection}`}
          aria-labelledby={`inspector-tab-${activeSection}`}
        >
          {activeSection === "details" && (
            <>
              <section className="mt-5">
                <h3 className={sectionTitle}>Documents</h3>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setTransmittalOpen(true)}
                    className="inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap border border-blue-800 bg-blue-50 px-3 text-sm font-bold text-blue-900 hover:bg-blue-100"
                  >
                    <Send className="h-5 w-5 shrink-0" />
                    Letter of Transmittal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.location.assign(
                        `/purchasing?jobId=${encodeURIComponent(job.id)}`,
                      );
                    }}
                    className="inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap border border-blue-800 bg-blue-50 px-3 text-sm font-bold text-blue-900 hover:bg-blue-100"
                  >
                    <ClipboardList className="h-5 w-5 shrink-0" />
                    Create Purchase Order
                  </button>
                </div>
              </section>
              {saveError && (
                <div
                  role="alert"
                  className="mt-4 border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                >
                  Could not save: {saveError}
                </div>
              )}
              {saveMessage && (
                <div
                  role="status"
                  className="mt-4 border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"
                >
                  {saveMessage}
                </div>
              )}
              <section className="mt-5">
                <h3 className={sectionTitle}>Planning</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold">
                    Planned start
                    <input
                      data-field="planned-dates"
                      type="date"
                      value={scheduleDraft.start}
                      onChange={(event) =>
                        setScheduleDraft((current) => ({
                          ...current,
                          start: event.target.value,
                        }))
                      }
                      onBlur={(event) => schedule("start", event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Planned finish
                    <input
                      type="date"
                      value={scheduleDraft.end}
                      min={scheduleDraft.start || undefined}
                      onChange={(event) =>
                        setScheduleDraft((current) => ({
                          ...current,
                          end: event.target.value,
                        }))
                      }
                      onBlur={(event) => schedule("end", event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  {scheduleIsStaged && (
                    <div className="sm:col-span-2 border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
                      Planned dates are staged and will remain pending until
                      Save All succeeds or the schedule change is reverted.
                    </div>
                  )}
                  <label className="text-xs font-bold">
                    Requested delivery
                    <input
                      type="date"
                      value={draft.requested_delivery_date}
                      onChange={(event) => {
                        setDraft((current) => ({
                          ...current,
                          requested_delivery_date: event.target.value,
                        }));
                        setSaveMessage("");
                      }}
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Estimated labor
                    <input
                      data-field="labor"
                      type="number"
                      min="0"
                      value={draft.estimated_man_hours}
                      onChange={(event) => {
                        setDraft((current) => ({
                          ...current,
                          estimated_man_hours: event.target.value,
                        }));
                        setSaveMessage("");
                      }}
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Estimated calendar days
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={draft.estimated_calendar_days}
                      onChange={(event) => {
                        setDraft((current) => ({
                          ...current,
                          estimated_calendar_days: event.target.value,
                        }));
                        setSaveMessage("");
                      }}
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Production status
                    <select
                      value={draft.production_status}
                      onChange={(event) => {
                        setDraft((current) => ({
                          ...current,
                          production_status: event.target
                            .value as ProductionStatus,
                        }));
                        setSaveMessage("");
                      }}
                      className={fieldClass}
                    >
                      {productionStatusVisuals.map((visual) => (
                        <option key={visual.value} value={visual.value}>
                          {visual.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-bold">
                    Material status
                    <select
                      value={draft.material_status}
                      onChange={(event) => {
                        setDraft((current) => ({
                          ...current,
                          material_status: event.target.value as MaterialStatus,
                        }));
                        setSaveMessage("");
                      }}
                      className={fieldClass}
                    >
                      {materialStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
              <section className="mt-5">
                <h3 className={sectionTitle}>Job Details</h3>
                <dl className="mt-3 grid grid-cols-[130px_1fr] gap-2 text-sm">
                  <dt className="font-bold">Customer</dt>
                  <dd>{job.customer || "Not recorded"}</dd>
                  <dt className="font-bold">Estimate</dt>
                  <dd>{job.estimate_number || "Not recorded"}</dd>
                  <dt className="font-bold">Work order</dt>
                  <dd>{job.work_order_number || "Not recorded"}</dd>
                  <dt className="font-bold">Contract value</dt>
                  <dd>
                    {job.contract_value === null
                      ? "Not recorded"
                      : job.contract_value}
                  </dd>
                  <dt className="font-bold">Resin / Chip PO</dt>
                  <dd>
                    {[job.resin_po, job.chip_po].filter(Boolean).join(" / ") ||
                      "Not recorded"}
                  </dd>
                  <dt className="font-bold">Remarks</dt>
                  <dd className="whitespace-pre-wrap">
                    {job.remarks || "None"}
                  </dd>
                </dl>
              </section>
              {/* Archive eligibility: ['complete', 'shipped', 'cancelled'] */}
              {["complete", "shipped", "cancelled"].includes(
                job.production_status,
              ) && !job.archived_at ? (
                <section className="mt-5 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    aria-label={`Archive ${job.name}`}
                    disabled={saving}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Archive this job? It will be removed from active Production views, but its activity, manpower, attachments, material usage, and history will be preserved.",
                        )
                      )
                        return;
                      setSaving(true);
                      setSaveError("");
                      try {
                        await onArchive(job);
                      } catch (error) {
                        setSaveError(
                          error instanceof Error
                            ? error.message
                            : "Unable to archive job.",
                        );
                        setSaving(false);
                      }
                    }}
                    className="h-9 rounded-sm border border-red-400 bg-white px-3 text-sm font-bold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50"
                  >
                    Archive Job
                  </button>
                </section>
              ) : null}
              {job.archived_at ? (
                <section className="mt-5 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Restore this job to normal Production views and linking selectors?",
                        )
                      )
                        return;
                      setSaving(true);
                      setSaveError("");
                      try {
                        await onRestore(job);
                      } catch (error) {
                        setSaveError(
                          error instanceof Error
                            ? error.message
                            : "Unable to restore job.",
                        );
                        setSaving(false);
                      }
                    }}
                    className="text-sm font-bold text-blue-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    Restore job
                  </button>
                </section>
              ) : null}
              {dirtyCount > 0 && (
                <div className="sticky bottom-0 mt-5 flex items-center justify-between gap-3 border border-amber-500 bg-amber-50 p-3 shadow-lg">
                  <span className="text-sm font-bold text-amber-900">
                    {dirtyCount} unsaved {dirtyCount === 1 ? "field" : "fields"}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={discardDraft}
                      disabled={saving}
                      className="h-9 border border-slate-500 bg-white px-3 text-xs font-bold uppercase"
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveDraft()}
                      disabled={saving}
                      className="h-9 border border-slate-950 bg-slate-900 px-3 text-xs font-bold uppercase text-white disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {activeSection === "files" && (
            <section className="mt-5" data-field="attachments">
              <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  Attachments
                </h3>
                <span className="text-xs font-semibold text-slate-500">
                  {attachments.length} files
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="text-xs font-bold">
                  Document type
                  <select
                    value={documentType}
                    onChange={(event) =>
                      setDocumentType(event.target.value as JobDocumentType)
                    }
                    className="mt-1 h-9 border border-slate-400 px-2"
                  >
                    <option value="other">Other</option>
                    <option value="estimate">Estimate</option>
                    <option value="work_order">Work Order</option>
                    <option value="blend_sheet">Blend Sheet</option>
                    <option value="shop_drawing">Shop Drawing</option>
                    <option value="cut_ticket">Cut Ticket</option>
                    <option value="color_plate">Color Plate</option>
                    <option value="sample_approval">Sample / Approval</option>
                    <option value="purchase_order">Purchase Order</option>
                    <option value="photo">Photo</option>
                  </select>
                </label>
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 border border-slate-900 bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-950">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Uploading…" : "Add Attachment"}
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    disabled={uploading}
                    onChange={(event) => void upload(event.target.files)}
                    className="sr-only"
                  />
                </label>
              </div>
              {attachmentError && (
                <div
                  role="alert"
                  className="mt-3 text-sm font-semibold text-red-700"
                >
                  {attachmentError}
                </div>
              )}
              <div className="mt-3 divide-y divide-slate-300 border border-slate-300">
                {attachmentsLoading ? (
                  <div className="p-4 text-sm text-slate-500">
                    Loading attachments…
                  </div>
                ) : attachments.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">
                    No files attached yet.
                  </div>
                ) : (
                  attachments.map((attachment) => {
                    const selected =
                      attachmentPreview?.attachment.id === attachment.id;
                    return (
                      <div key={attachment.id}>
                        <div
                          className={`flex items-center justify-between gap-3 p-3 ${selected ? "bg-blue-50" : ""}`}
                        >
                          <button
                            type="button"
                            onClick={() => void openAttachment(attachment)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            aria-pressed={selected}
                          >
                            <File className="h-4 w-4 shrink-0 text-slate-500" />
                            <div className="min-w-0">
                              <div
                                className="truncate text-sm font-bold"
                                title={attachment.file_name}
                              >
                                {attachment.file_name}
                              </div>
                              <div className="text-xs text-slate-500">
                                {new Date(
                                  attachment.created_at,
                                ).toLocaleDateString()}
                                {attachment.uploaded_by
                                  ? ` · ${attachment.uploaded_by}`
                                  : ""}
                              </div>
                            </div>
                          </button>
                          {attachment.job_update_id && (
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-800">
                                {attachment.job_update_attachment_role ===
                                "resolution"
                                  ? "From resolution"
                                  : "From update"}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setFocusedUpdateId(
                                    attachment.job_update_id,
                                  );
                                  setActiveSection("updates");
                                }}
                                className="text-[10px] font-bold text-blue-800 underline underline-offset-2"
                              >
                                View update
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            disabled={deletingId === attachment.id}
                            onClick={() => void removeAttachment(attachment)}
                            aria-label={`Remove ${attachment.file_name}`}
                            title="Remove attachment"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-slate-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {selected && (
                          <div className="border-t border-slate-300 p-2">
                            <DocumentViewer
                              key={`embedded-${attachmentPreview.attachment.id}`}
                              mode="embedded"
                              title={`${job.job_number ? `${job.job_number} — ` : ""}${job.name}`}
                              filename={attachmentPreview.attachment.file_name}
                              mimeType={attachmentPreview.attachment.mime_type}
                              sizeBytes={
                                attachmentPreview.attachment.size_bytes
                              }
                              metadata={`${attachmentPreview.attachment.document_type.replaceAll("_", " ")} · ${new Date(attachmentPreview.attachment.created_at).toLocaleDateString()}`}
                              url={attachmentPreview.url}
                              onClose={() => {
                                attachmentRequest.current += 1;
                                setAttachmentPreview(null);
                              }}
                              onOpenFullscreen={() =>
                                setAttachmentFullscreen(true)
                              }
                              hasPrevious={attachmentPreviewIndex > 0}
                              hasNext={
                                attachmentPreviewIndex >= 0 &&
                                attachmentPreviewIndex < attachments.length - 1
                              }
                              onPrevious={() => {
                                const target =
                                  attachments[attachmentPreviewIndex - 1];
                                if (target) void openAttachment(target);
                              }}
                              onNext={() => {
                                const target =
                                  attachments[attachmentPreviewIndex + 1];
                                if (target) void openAttachment(target);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}

          {activeSection === "updates" && (
            <JobUpdatesPanel
              job={job}
              attachments={attachments}
              focusedUpdateId={focusedUpdateId}
              onSummaryChanged={handleJobUpdateSummaryChanged}
              onAttachmentsChanged={(nextAttachments) => {
                setAttachments(nextAttachments);
                onAttachmentsChanged(job.id, nextAttachments.length);
              }}
              onOpenAttachment={(attachment) => {
                setActiveSection("files");
                void openAttachment(attachment);
              }}
            />
          )}

          {activeSection === "planning" && planningEnabled && (
            <section className="mt-5">
              <PlanningPanel key={(planningPhases ?? []).filter((phase) => phase.job_id === job.id).map((phase) => `${phase.id}:${phase.updated_at}`).join("|")} job={job} compact initialPhaseId={initialFocus?.startsWith("planning:") ? initialFocus.slice("planning:".length) : undefined} onPhasesChanged={onPlanningPhasesChanged} onEditorOpenChanged={setPlanningEditorOpen} stagedSchedules={stagedPlanningSchedules} planningIssues={planningIssues.filter((issue) => issue.phase_ids.some((phaseId) => (planningPhases ?? []).some((phase) => phase.id === phaseId && phase.job_id === job.id)))} />
            </section>
          )}

          {activeSection === "recent-changes" && (
            <section className="mt-5">
              <div className="flex items-center gap-2 border-b border-slate-300 pb-2">
                <History className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  Recent Changes
                </h3>
              </div>
              {activityError && (
                <div
                  role="alert"
                  className="mt-3 border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                >
                  Recent Changes could not be loaded: {activityError}
                </div>
              )}
              <div className="mt-3 space-y-3">
                {activityLoading ? (
                  <p className="text-sm text-slate-500">
                    Loading recent changes…
                  </p>
                ) : activity.length === 0 && !activityError ? (
                  <p className="text-sm text-slate-500">
                    No recorded changes yet.
                  </p>
                ) : (
                  activity.map((change) => {
                    const description = activityDescription(change);
                    return (
                      <article
                        key={change.id}
                        className="border-l-2 border-slate-400 pl-3 text-sm"
                      >
                        <div className="font-bold text-slate-950">
                          {change.actor_name || "TenOps"}
                        </div>
                        <time
                          dateTime={change.occurred_at}
                          className="text-xs text-slate-500"
                        >
                          {new Date(change.occurred_at).toLocaleString()}
                        </time>
                        <div className="mt-1 font-semibold text-slate-800">
                          {description.action}
                        </div>
                        {description.detail && (
                          <div className="mt-1 whitespace-pre-line text-slate-600">
                            {description.detail}
                          </div>
                        )}
                        {description.reason && (
                          <div className="mt-1 text-slate-600">
                            <b>Reason:</b> {description.reason}
                          </div>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          )}
        </div>
      </aside>
      {attachmentPreview && attachmentFullscreen && (
        <DocumentViewer
          key={`fullscreen-${attachmentPreview.attachment.id}`}
          title={`${job.job_number ? `${job.job_number} — ` : ""}${job.name}`}
          filename={attachmentPreview.attachment.file_name}
          mimeType={attachmentPreview.attachment.mime_type}
          sizeBytes={attachmentPreview.attachment.size_bytes}
          metadata={`${attachmentPreview.attachment.document_type.replaceAll("_", " ")} · ${new Date(attachmentPreview.attachment.created_at).toLocaleDateString()}`}
          url={attachmentPreview.url}
          onClose={() => setAttachmentFullscreen(false)}
          hasPrevious={attachmentPreviewIndex > 0}
          hasNext={
            attachmentPreviewIndex >= 0 &&
            attachmentPreviewIndex < attachments.length - 1
          }
          onPrevious={() => {
            const target = attachments[attachmentPreviewIndex - 1];
            if (target) void openAttachment(target);
          }}
          onNext={() => {
            const target = attachments[attachmentPreviewIndex + 1];
            if (target) void openAttachment(target);
          }}
        />
      )}
      {transmittalOpen && (
        <JobTransmittalPanel
          key={job.id}
          job={job}
          onClose={() => setTransmittalOpen(false)}
        />
      )}
    </div>
  );
}
