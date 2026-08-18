"use client";

import { ClipboardList, File, History, Pencil, RotateCcw, Send, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import DocumentViewer from "@/components/documents/DocumentViewer";
import JobTransmittalPanel from "@/modules/transmittals/JobTransmittalPanel";
import PlanningPanel from "@/modules/planning/PlanningPanel";
import type { StagedPlanningSchedules } from "@/modules/planning/schedule-staging";
import type { InspectorOrdinarySaveState } from "../schedule-staging";
import type { PlanningItem, PlanningPhase } from "@/modules/planning/types";
import type { PlanningScheduleIssue } from "@/modules/planning/schedule-model.mjs";
import { isPlanningEnabled } from "@/modules/planning/timeline-model.mjs";
import {
  createJobAttachmentDownloadUrl,
  deleteJobAttachment,
  loadJobAttachments,
  loadProductionJobActivity,
  loadProductionReworkCycles,
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
  ProductionReworkCycle,
  ProductionStatus,
} from "../types";
import JobUpdatesPanel from "./JobUpdatesPanel";
import ProductionStatusBadge from "./ProductionStatusBadge";
import ReworkBadge from "./ReworkBadge";
import { canCreateProductionRework } from "./ReworkQuickAction";
import UnscheduledBadge from "./UnscheduledBadge";

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
  onOrdinarySaveStateChange: (state: InspectorOrdinarySaveState) => void;
  jobUpdateSummary: JobUpdateSummary;
  onJobUpdateSummaryChanged: (
    jobId: string,
    summary: JobUpdateSummary,
  ) => void;
  onAttachmentsChanged: (jobId: string, count: number) => void;
  onPlanningPhasesChanged?: (jobId: string, phases: PlanningPhase[]) => void;
  onPlanningItemsChanged?: (jobId: string, items: PlanningItem[]) => void;
  stagedPlanningSchedules?: StagedPlanningSchedules;
  planningPhases?: PlanningPhase[];
  planningIssues?: PlanningScheduleIssue[];
  initialFocus?: string;
  onScheduleJob: (job: ProductionJob) => void;
  onCreateRework: (job: ProductionJob) => void;
};

const sectionTitle =
  "border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-700";
const fieldClass =
  "mt-1 h-9 w-full rounded-sm border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100";

type InspectorDraft = {
  name: string;
  customer: string;
  job_number: string;
  estimate_number: string;
  work_order_number: string;
  contract_value: string;
  deposit_date: string;
  requested_delivery_date: string;
  estimated_man_hours: string;
  estimated_calendar_days: string;
  color_plate_number: string;
  sample_submitted_date: string;
  approval_date: string;
  production_status: ProductionStatus;
  material_status: MaterialStatus;
  remarks: string;
};

function inspectorDraftFromJob(job: ProductionJob): InspectorDraft {
  return {
    name: job.name,
    customer: job.customer ?? "",
    job_number: job.job_number ?? "",
    estimate_number: job.estimate_number ?? "",
    work_order_number: job.work_order_number ?? "",
    contract_value:
      job.contract_value === null ? "" : String(job.contract_value),
    deposit_date: job.deposit_date ?? "",
    requested_delivery_date: job.requested_delivery_date ?? "",
    estimated_man_hours:
      job.estimated_man_hours === null ? "" : String(job.estimated_man_hours),
    estimated_calendar_days:
      job.estimated_calendar_days === null
        ? ""
        : String(job.estimated_calendar_days),
    color_plate_number: job.color_plate_number ?? "",
    sample_submitted_date: job.sample_submitted_date ?? "",
    approval_date: job.approval_date ?? "",
    production_status: job.production_status,
    material_status: job.material_status,
    remarks: job.remarks ?? "",
  };
}

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
  contract_value: "Contract value",
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
  if (field === "contract_value") {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: "USD",
        }).format(amount)
      : String(value);
  }
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
  onOrdinarySaveStateChange,
  jobUpdateSummary,
  onJobUpdateSummaryChanged,
  onAttachmentsChanged,
  onPlanningPhasesChanged,
  onPlanningItemsChanged,
  stagedPlanningSchedules,
  planningPhases,
  planningIssues = [],
  initialFocus,
  onScheduleJob,
  onCreateRework,
}: Props) {
  const [activeSection, setActiveSection] = useState<InspectorSection>(
    initialFocus === "attachments"
      ? "files"
      : initialFocus?.startsWith("planning") && planningEnabled
        ? "planning"
      : initialFocus?.startsWith("job-updates")
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
  const [draft, setDraft] = useState(() => inspectorDraftFromJob(job));
  const [headerNameEditing, setHeaderNameEditing] = useState(false);
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
  const [focusedUpdateId, setFocusedUpdateId] = useState<string | null>(() =>
    initialFocus?.startsWith("job-updates:") ? initialFocus.slice("job-updates:".length) : null,
  );
  const [planningEditorOpen, setPlanningEditorOpen] = useState(false);
  const [reworkCycles, setReworkCycles] = useState<ProductionReworkCycle[]>([]);
  const [jobUpdateCount, setJobUpdateCount] = useState(
    jobUpdateSummary.total,
  );
  const [scheduleDraft, setScheduleDraft] = useState(() => ({
    start: job.planned_start || "",
    end: job.planned_end || "",
  }));
  const scheduleIsIncomplete = Boolean(scheduleDraft.start) !== Boolean(scheduleDraft.end);
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const projectNameRef = useRef<HTMLInputElement>(null);
  const headerProjectNameRef = useRef<HTMLInputElement>(null);
  const headerNameSessionStartRef = useRef(job.name);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachmentRequest = useRef(0);
  const mutationInFlightRef = useRef(false);
  const uploadInFlightRef = useRef(false);
  const deletingAttachmentIdsRef = useRef(new Set<string>());
  const handleJobUpdateSummaryChanged = useCallback(
    (summary: JobUpdateSummary) => {
      setJobUpdateCount(summary.total);
      onJobUpdateSummaryChanged(job.id, summary);
    },
    [job.id, onJobUpdateSummaryChanged],
  );

  useEffect(() => {
    let live = true;
    loadProductionReworkCycles(job.id)
      .then((cycles) => { if (live) setReworkCycles(cycles); })
      .catch(() => { if (live) setReworkCycles([]); });
    return () => { live = false; };
  }, [job.id, job.rework_cycle?.updated_at]);

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

  useEffect(() => {
    if (!headerNameEditing) return;
    requestAnimationFrame(() => {
      headerProjectNameRef.current?.focus();
      headerProjectNameRef.current?.select();
    });
  }, [headerNameEditing]);

  const normalizedDraft: ProductionJobUpdate = {
    name: draft.name.trim(),
    customer: draft.customer.trim() || null,
    job_number: draft.job_number.trim() || null,
    estimate_number: draft.estimate_number.trim() || null,
    work_order_number: draft.work_order_number.trim() || null,
    contract_value:
      draft.contract_value === "" ? null : Number(draft.contract_value),
    deposit_date: draft.deposit_date || null,
    requested_delivery_date: draft.requested_delivery_date || null,
    estimated_man_hours:
      draft.estimated_man_hours === ""
        ? null
        : Number(draft.estimated_man_hours),
    estimated_calendar_days:
      draft.estimated_calendar_days === ""
        ? null
        : Number(draft.estimated_calendar_days),
    color_plate_number: draft.color_plate_number.trim() || null,
    sample_submitted_date: draft.sample_submitted_date || null,
    approval_date: draft.approval_date || null,
    production_status: draft.production_status,
    material_status: draft.material_status,
    remarks: draft.remarks.trim() || null,
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

  useEffect(() => {
    onOrdinarySaveStateChange({ jobId: job.id, dirty: dirtyCount > 0, saving });
  }, [dirtyCount, job.id, onOrdinarySaveStateChange, saving]);

  useEffect(() => () => {
    onOrdinarySaveStateChange({ jobId: job.id, dirty: false, saving: false });
  }, [job.id, onOrdinarySaveStateChange]);

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
  const updateDraft = <Key extends keyof InspectorDraft>(
    field: Key,
    value: InspectorDraft[Key],
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setSaveError("");
    setSaveMessage("");
  };
  const discardDraft = () => {
    setDraft(inspectorDraftFromJob(job));
    setHeaderNameEditing(false);
    setSaveError("");
    setSaveMessage("");
  };
  const saveDraft = async () => {
    const hours = normalizeNullableNumber(draft.estimated_man_hours);
    const days = normalizeNullableNumber(draft.estimated_calendar_days);
    const contractValue = normalizeNullableNumber(draft.contract_value);
    if (!draft.name.trim()) {
      setSaveError("Project name is required.");
      projectNameRef.current?.focus();
      return;
    }
    if (
      !hours.valid ||
      !days.valid ||
      !contractValue.valid ||
      (contractValue.value !== null && contractValue.value < 0) ||
      (days.value !== null && !Number.isInteger(days.value))
    ) {
      setSaveError(
        "Enter a valid non-negative contract value and labor hours, plus whole calendar days, or leave them blank.",
      );
      return;
    }
    if (!dirtyCount || mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    try {
      const updated = await onUpdateJob(job.id, changedDraft);
      setDraft(inspectorDraftFromJob(updated));
      setHeaderNameEditing(false);
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
      mutationInFlightRef.current = false;
      setSaving(false);
    }
  };
  const schedule = (key: "start" | "end", value: string) => {
    const next = { ...scheduleDraft, [key]: value };
    setScheduleDraft(next);
    if (next.start && next.end) onStageSchedule(job, next.start, next.end);
  };

  async function upload(files: FileList | null) {
    if (!files?.length || uploadInFlightRef.current) return;
    uploadInFlightRef.current = true;
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
      uploadInFlightRef.current = false;
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
    if (deletingAttachmentIdsRef.current.has(attachment.id)) return;
    if (!window.confirm(`Remove “${attachment.file_name}” from this job?`))
      return;
    deletingAttachmentIdsRef.current.add(attachment.id);
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
      deletingAttachmentIdsRef.current.delete(attachment.id);
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
        className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4">
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-500">
              {draft.job_number || "Job number not recorded"}
            </div>
            <div className="flex min-w-0 items-center gap-1.5">
              {headerNameEditing ? (
                <input
                  ref={headerProjectNameRef}
                  id="job-inspector-title"
                  aria-label="Project name"
                  value={draft.name}
                  onChange={(event) => updateDraft("name", event.target.value)}
                  onBlur={() => setHeaderNameEditing(false)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      updateDraft("name", headerNameSessionStartRef.current);
                      setHeaderNameEditing(false);
                    }
                  }}
                  className="h-10 min-w-0 flex-1 rounded-sm border border-blue-600 bg-white px-2 text-2xl font-bold text-slate-950 outline-none ring-2 ring-blue-100"
                />
              ) : (
                <>
                  <h2
                    id="job-inspector-title"
                    className="min-w-0 truncate text-2xl font-bold text-slate-950"
                    title={draft.name || "Untitled job"}
                  >
                    {draft.name || "Untitled job"}
                  </h2>
                  <button
                    type="button"
                    aria-label="Edit project name"
                    title="Edit project name"
                    onClick={() => {
                      headerNameSessionStartRef.current = draft.name;
                      setHeaderNameEditing(true);
                    }}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-slate-500 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
            <div className="mt-1.5">
              <ProductionStatusBadge status={job.production_status} />
            </div>
            {job.rework_cycle ? <div className="mt-1.5"><ReworkBadge sequence={job.rework_cycle.sequence_number} /></div> : null}
            {canCreateProductionRework(job) ? (
              <button
                type="button"
                data-rework-quick-action
                onClick={() => onCreateRework(job)}
                className="mt-1.5 inline-flex h-7 items-center gap-1.5 border px-2 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Create Rework
              </button>
            ) : null}
            {!job.planned_start || !job.planned_end ? <div className="mt-1.5"><UnscheduledBadge onClick={() => onScheduleJob(job)} /></div> : null}
            <div
              className={`mt-1.5 inline-flex px-2 py-0.5 text-xs font-bold ${readiness.state === "ready" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}
            >
              {readiness.label} — {readiness.guidance}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={requestClose}
            className="h-8 shrink-0 border border-slate-400 px-3 text-sm font-bold hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Job inspector sections"
          className="mx-4 mt-2.5 flex shrink-0 overflow-x-auto border-b border-slate-300"
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
              className={`min-h-8 min-w-max flex-1 whitespace-nowrap border-b-2 px-2 py-1 text-[11px] font-bold focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${activeSection === tab.id ? "border-slate-900 bg-slate-100/70 text-slate-950" : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-950"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`inspector-${activeSection}`}
          aria-labelledby={`inspector-tab-${activeSection}`}
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-4"
        >
          {activeSection === "details" && (
            <>
              <section className="mt-4 rounded-sm border border-slate-200 bg-slate-50 p-3" aria-labelledby="production-history-title">
                <div className="flex items-center justify-between gap-3">
                  <h3 id="production-history-title" className="text-xs font-bold uppercase tracking-[0.1em] text-slate-700">Production History</h3>
                </div>
                <div className="mt-2 text-xs text-slate-700"><strong>Original Production</strong> · {(job.original_production_status ?? (reworkCycles.length ? "complete" : job.production_status)).replaceAll("_", " ")}</div>
                {reworkCycles.map((cycle) => <div key={cycle.id} className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-700">
                  <div className="flex flex-wrap items-center gap-2"><ReworkBadge sequence={cycle.sequence_number} /><strong>{cycle.reason_category === "quality_qc" ? "Quality / QC" : cycle.reason_category === "shipping_handling" ? "Shipping / Handling Damage" : cycle.reason_category === "customer_change" ? "Customer Change" : "Other"}</strong><span>· {cycle.production_status.replaceAll("_", " ")}</span></div>
                  <p className="mt-1 text-slate-600">{cycle.scope_details}</p>
                  <p className="mt-1 text-[10px] text-slate-500">Intake {cycle.intake_date}{cycle.planned_start && cycle.planned_end ? ` · Production ${cycle.planned_start} – ${cycle.planned_end}` : " · Dates not set"}{cycle.completed_at ? ` · Completed ${cycle.completed_at.slice(0, 10)}` : ""}</p>
                </div>)}
              </section>
              <section
                aria-label="Job identity"
                className="mt-4 grid gap-3 sm:grid-cols-2"
              >
                <label className="text-xs font-bold">
                  Job number
                  <input
                    data-field="job-number"
                    value={draft.job_number}
                    onChange={(event) =>
                      updateDraft("job_number", event.target.value)
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="text-xs font-bold">
                  Project name
                  <input
                    ref={projectNameRef}
                    data-field="project-name"
                    required
                    value={draft.name}
                    onChange={(event) => updateDraft("name", event.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="text-xs font-bold sm:col-span-2">
                  Customer
                  <input
                    list="production-customer-suggestions"
                    autoComplete="off"
                    value={draft.customer}
                    onChange={(event) =>
                      updateDraft("customer", event.target.value)
                    }
                    className={fieldClass}
                  />
                </label>
              </section>
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
              <section className="mt-5">
                <h3 className={sectionTitle}>Planning</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold">
                    Planned start
                    <input
                      data-field="planned-dates"
                      type="date"
                      value={scheduleDraft.start}
                      onChange={(event) => schedule("start", event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Planned finish
                    <input
                      type="date"
                      value={scheduleDraft.end}
                      min={scheduleDraft.start || undefined}
                      onChange={(event) => schedule("end", event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  {scheduleIsStaged && (
                    <div className="sm:col-span-2 border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
                      Planned dates are staged and will remain pending until
                      Save All succeeds or the schedule change is reverted.
                    </div>
                  )}
                  {!scheduleIsStaged && scheduleIsIncomplete && (
                    <div role="status" className="sm:col-span-2 border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
                      Schedule incomplete. Enter both planned dates to stage this change for Save All.
                    </div>
                  )}
                  <label className="text-xs font-bold">
                    Requested delivery
                    <input
                      data-field="requested-delivery"
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
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold">
                    Work order
                    <input
                      value={draft.work_order_number}
                      onChange={(event) => updateDraft("work_order_number", event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Estimate number
                    <input
                      value={draft.estimate_number}
                      onChange={(event) => updateDraft("estimate_number", event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Color plate number
                    <input
                      value={draft.color_plate_number}
                      onChange={(event) => updateDraft("color_plate_number", event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Approval date
                    <input
                      type="date"
                      value={draft.approval_date}
                      onChange={(event) => updateDraft("approval_date", event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Sample submitted
                    <input
                      type="date"
                      value={draft.sample_submitted_date}
                      onChange={(event) => updateDraft("sample_submitted_date", event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Deposit date
                    <input
                      type="date"
                      value={draft.deposit_date}
                      onChange={(event) => updateDraft("deposit_date", event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Contract value
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={draft.contract_value}
                      onChange={(event) => updateDraft("contract_value", event.target.value)}
                      placeholder="0.00"
                      className={`${fieldClass} tabular-nums`}
                    />
                  </label>
                  <div className="text-xs font-bold">
                    Resin / Chip PO
                    <div className="mt-1 flex min-h-9 items-center rounded-sm border border-slate-200 bg-slate-50 px-2 text-sm font-normal text-slate-700">
                      {[job.resin_po, job.chip_po].filter(Boolean).join(" / ") ||
                        "Not recorded"}
                    </div>
                  </div>
                  <label className="text-xs font-bold sm:col-span-2">
                    Remarks
                    <textarea
                      value={draft.remarks}
                      onChange={(event) => updateDraft("remarks", event.target.value)}
                      rows={4}
                      className="mt-1 w-full resize-y rounded-sm border border-slate-300 bg-white px-2 py-2 text-sm outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                </div>
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
                      if (mutationInFlightRef.current) return;
                      mutationInFlightRef.current = true;
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
                      } finally {
                        mutationInFlightRef.current = false;
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
                      if (mutationInFlightRef.current) return;
                      mutationInFlightRef.current = true;
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
                      } finally {
                        mutationInFlightRef.current = false;
                        setSaving(false);
                      }
                    }}
                    className="text-sm font-bold text-blue-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    Restore job
                  </button>
                </section>
              ) : null}
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
            <section className="mt-3">
              <PlanningPanel key={(planningPhases ?? []).filter((phase) => phase.job_id === job.id).map((phase) => `${phase.id}:${phase.updated_at}`).join("|")} job={job} compact initialPhaseId={initialFocus?.startsWith("planning:") ? initialFocus.slice("planning:".length) : undefined} onPhasesChanged={onPlanningPhasesChanged} onItemsChanged={onPlanningItemsChanged} onEditorOpenChanged={setPlanningEditorOpen} stagedSchedules={stagedPlanningSchedules} planningIssues={planningIssues.filter((issue) => issue.phase_ids.some((phaseId) => (planningPhases ?? []).some((phase) => phase.id === phaseId && phase.job_id === job.id)))} />
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
        {(activeSection === "details" || dirtyCount > 0) && (
          <div data-inspector-save-region className={`z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.12)] ${saveError ? "border-red-400 bg-red-50" : dirtyCount > 0 || scheduleIsStaged || scheduleIsIncomplete ? "border-amber-400 bg-amber-50" : saveMessage ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
            <div>
              <div className={`text-[10px] font-bold uppercase tracking-[0.12em] ${saveError ? "text-red-800" : dirtyCount > 0 || scheduleIsStaged || scheduleIsIncomplete ? "text-amber-800" : saveMessage ? "text-emerald-800" : "text-slate-500"}`}>
                {saving ? "Saving…" : saveError ? "Save failed" : dirtyCount > 0 ? `${dirtyCount} unsaved ${dirtyCount === 1 ? "field" : "fields"}` : saveMessage ? "Changes saved" : scheduleIsStaged ? "Schedule changes pending" : scheduleIsIncomplete ? "Schedule incomplete" : "No unsaved changes"}
              </div>
              {saveError ? <div role="alert" className="mt-0.5 max-w-sm text-xs font-semibold text-red-800">{saveError}</div> : scheduleIsStaged && (dirtyCount > 0 || saving) ? <div className="mt-0.5 max-w-sm text-xs font-semibold text-slate-700">Save job details first. Planned dates will remain staged.</div> : scheduleIsStaged && saveMessage ? <div role="status" className="mt-0.5 max-w-sm text-xs font-semibold text-slate-700">Job details saved. Schedule changes still require approval.</div> : scheduleIsStaged ? <div className="mt-0.5 max-w-sm text-xs font-semibold text-slate-700">Planned dates remain staged for the existing Save All approval workflow.</div> : scheduleIsIncomplete ? <div role="status" className="mt-0.5 max-w-sm text-xs font-semibold text-slate-700">Enter both planned dates to stage this schedule for Save All.</div> : saveMessage ? <div role="status" className="mt-0.5 max-w-sm text-xs font-semibold text-slate-700">{saveMessage}</div> : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {dirtyCount > 0 && <button type="button" onClick={discardDraft} disabled={saving} className="h-9 border border-slate-500 bg-white px-3 text-xs font-bold uppercase text-slate-800 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-700 disabled:opacity-50">Discard</button>}
              <button type="button" onClick={() => void saveDraft()} disabled={saving || dirtyCount === 0} className="h-9 border border-slate-950 bg-slate-900 px-3 text-xs font-bold uppercase text-white hover:bg-slate-950 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Saving…" : saveError && dirtyCount > 0 ? "Retry save" : "Save changes"}</button>
            </div>
          </div>
        )}
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
