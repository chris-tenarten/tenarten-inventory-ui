"use client";

import {
  Copy,
  FileText,
  FlaskConical,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import DocumentViewer from "@/components/documents/DocumentViewer";
import { useAuth } from "@/lib/auth";
import { loadBids } from "@/modules/pre-production/queries";
import type { Bid } from "@/modules/pre-production/types";
import {
  loadProductionJobOptions,
  type ProductionJobOption,
} from "@/modules/production/job-options";
import { searchPurchasingCatalog } from "@/modules/purchasing/catalog";
import {
  PurchasingChoiceWithCustom,
  PurchasingVendorNameInput,
  purchasingQuantityUnits,
} from "@/modules/purchasing/material-controls";
import { loadVendors } from "@/modules/purchasing/queries";
import type {
  PurchasingCatalogSuggestion,
  VendorOption,
} from "@/modules/purchasing/types";
import {
  blankSampleBlendRow,
  newLocalSample,
  type SampleBlendRow,
  type SampleRecord,
} from "./types";
import { sampleBlendCatalogAutofill } from "./material-autofill";
import {
  adminPermanentlyDeleteSampleDraft,
  createSample,
  duplicateSample,
  generateSamplePdf,
  issueSample,
  linkSampleToBid,
  loadSampleFormulationDefault,
  loadSamples,
  openSamplePdf,
  permanentlyDeleteIssuedSample,
  permanentlyDeleteSampleDraft,
  saveSample,
} from "./queries";
import SampleRecentValueInput from "./SampleRecentValueInput";
import SampleFormulationConfigurator from "./SampleFormulationConfigurator";
import SampleVersionHistory from "./SampleVersionHistory";
import {
  loadMySampleRecentValues,
  recordMySampleRecentValues,
  sampleRecentFieldKeys,
  type SampleRecentFieldKey,
} from "./recent-values";
import {
  formatSampleError,
  logSampleError,
  translateSampleError,
  validateSampleForOutput,
  type SampleOperation,
} from "./sample-errors";
import {
  sampleFormulationPreview,
  sampleLibraryContext,
  sampleLibraryMetadata,
  sampleLibraryStatus,
  sampleLibraryTitle,
} from "./library-row";
import {
  applySupplierRatioDefault,
  calculateSampleFormulation,
} from "./formulation";

const field =
  "mt-1 h-12 w-full min-w-0 rounded-sm border border-slate-300 bg-white px-3 text-base outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100 sm:h-9 sm:px-2 sm:text-sm";
const area =
  "mt-1 w-full min-w-0 rounded-sm border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100 sm:px-2 sm:py-2 sm:text-sm";
const label = "text-xs font-bold text-slate-700";

export default function SampleWorkspace() {
  const auth = useAuth();
  const [samples, setSamples] = useState<SampleRecord[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [jobs, setJobs] = useState<ProductionJobOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [linkSelection, setLinkSelection] = useState("");
  const [draft, setDraft] = useState<SampleRecord | null>(null);
  const [draftBaseline, setDraftBaseline] = useState("");
  const [closePrompt, setClosePrompt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [catalogRow, setCatalogRow] = useState<number | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<
    PurchasingCatalogSuggestion[]
  >([]);
  const [catalogSearching, setCatalogSearching] = useState(false);
  const [preview, setPreview] = useState<{
    url: string;
    filename: string;
  } | null>(null);
  const [recentValues, setRecentValues] = useState<
    Partial<Record<SampleRecentFieldKey, string[]>>
  >({});
  const [recentLoading, setRecentLoading] = useState<Set<SampleRecentFieldKey>>(
    () => new Set(),
  );
  const initialContext = useMemo(() => {
    if (typeof window === "undefined") return { bid: "", open: "" };
    const params = new URLSearchParams(window.location.search);
    return { bid: params.get("bid") ?? "", open: params.get("open") ?? "" };
  }, []);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const nextSamples = await loadSamples();
      setSamples(nextSamples);
      return nextSamples;
    } finally {
      setLoading(false);
    }
  }, []);
  const showOperationError = useCallback(
    (caught: unknown, operation: SampleOperation, prefix = "") => {
      const translated = translateSampleError(caught, operation);
      logSampleError(translated);
      setError(
        prefix
          ? `${prefix} ${translated.message} ${translated.guidance} ${translated.safeState}${translated.retrySafe ? " Retrying is safe." : ""}`
          : formatSampleError(translated),
      );
    },
    [],
  );
  useEffect(() => {
    void reload()
      .then((items) => {
        const target = items.find((item) => item.id === initialContext.open);
        if (target) {
          setDraft(target);
          setDraftBaseline(JSON.stringify(target));
        }
      })
      .catch((caught) => showOperationError(caught, "load"));
    void Promise.all([
      loadBids(),
      loadProductionJobOptions({ includeArchived: true }),
      loadVendors(),
    ])
      .then(([nextBids, nextJobs, nextVendors]) => {
        setBids(nextBids);
        setJobs(nextJobs);
        setVendors(nextVendors);
      })
      .catch((caught) => showOperationError(caught, "load"));
  }, [initialContext.open, reload, showOperationError]);
  useEffect(() => {
    const query = catalogQuery.trim();
    if (catalogRow === null || query.length < 2) {
      setCatalogResults([]);
      setCatalogSearching(false);
      return;
    }
    let active = true;
    setCatalogSearching(true);
    const timer = window.setTimeout(() => {
      void searchPurchasingCatalog(query)
        .then((results) => {
          if (active) setCatalogResults(results);
        })
        .catch((caught) => {
          if (active) showOperationError(caught, "catalog");
        })
        .finally(() => {
          if (active) setCatalogSearching(false);
        });
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [catalogQuery, catalogRow, showOperationError]);
  function patch<K extends keyof SampleRecord>(key: K, value: SampleRecord[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setMessage("");
  }
  const loadRecent = useCallback(
    (fieldKey: SampleRecentFieldKey) => {
      if (recentValues[fieldKey] || recentLoading.has(fieldKey)) return;
      setRecentLoading((current) => new Set(current).add(fieldKey));
      void loadMySampleRecentValues(fieldKey)
        .then((values) =>
          setRecentValues((current) => ({ ...current, [fieldKey]: values })),
        )
        .catch(() =>
          setRecentValues((current) => ({ ...current, [fieldKey]: [] })),
        )
        .finally(() =>
          setRecentLoading((current) => {
            const next = new Set(current);
            next.delete(fieldKey);
            return next;
          }),
        );
    },
    [recentLoading, recentValues],
  );
  function patchRow(index: number, changes: Partial<SampleBlendRow>) {
    if (!draft) return;
    patch(
      "blendRows",
      draft.blendRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...changes } : row,
      ),
    );
  }
  function patchResinSupplier(value: string) {
    setDraft((current) =>
      current
        ? {
            ...current,
            resinSupplier: value,
            formulation:
              current.formulation.ratioProvenance === "manual"
                ? current.formulation
                : applySupplierRatioDefault(current.formulation, value),
          }
        : current,
    );
    setMessage("");
  }
  async function create() {
    setBusy("create");
    setError("");
    try {
      const formulation = await loadSampleFormulationDefault();
      const bid = bids.find((item) => item.id === initialContext.bid);
      const local = newLocalSample({
        preparedBy: auth.profile?.displayName ?? "",
        bidId: bid?.id,
        projectName: bid?.projectName,
        customerName: bid?.customer,
        formulation,
      });
      setDraft(local);
      setDraftBaseline(JSON.stringify(local));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to open a new Sample.",
      );
    } finally {
      setBusy("");
    }
  }
  async function linkExisting() {
    if (!initialContext.bid || !linkSelection) return;
    setBusy("link");
    setError("");
    try {
      await linkSampleToBid(initialContext.bid, linkSelection);
      const next = await reload();
      setDraft(next.find((item) => item.id === linkSelection) ?? null);
      setLinkSelection("");
      setMessage(
        "Existing Sample linked to this Bid. Issued history was not changed.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to link Sample.",
      );
    } finally {
      setBusy("");
    }
  }
  async function persistDraft(source: SampleRecord) {
    let saved = source;
    let createdId = "";
    try {
      if (!source.id) {
        createdId = await createSample(source.bidId, source.jobId);
        saved = { ...source, id: createdId };
      }
      await saveSample(saved);
      await recordMySampleRecentValues(saved);
      const next = await reload();
      const authoritative = next.find((item) => item.id === saved.id);
      if (!authoritative)
        throw new Error("Saved Sample could not be reloaded.");
      setDraft(authoritative);
      setDraftBaseline(JSON.stringify(authoritative));
      setRecentValues({});
      return authoritative;
    } catch (caught) {
      if (createdId)
        await permanentlyDeleteSampleDraft(createdId).catch(() => undefined);
      throw caught;
    }
  }
  async function save() {
    if (!draft) return;
    setBusy("save");
    setError("");
    try {
      await persistDraft(draft);
      setMessage("Sample saved.");
    } catch (caught) {
      showOperationError(caught, "save-draft");
    } finally {
      setBusy("");
    }
  }
  function requestClose() {
    if (!draft) return;
    if (JSON.stringify(draft) === draftBaseline) {
      setDraft(null);
      return;
    }
    setClosePrompt(true);
  }
  async function saveAndClose() {
    if (!draft) return;
    setBusy("save-close");
    setError("");
    try {
      await persistDraft(draft);
      setClosePrompt(false);
      setDraft(null);
      setMessage("Sample saved.");
    } catch (caught) {
      setClosePrompt(false);
      showOperationError(caught, "save-draft");
    } finally {
      setBusy("");
    }
  }
  async function duplicate() {
    if (!draft) return;
    setBusy("duplicate");
    setError("");
    try {
      const id = await duplicateSample(draft.id);
      const next = await reload();
      setDraft(next.find((item) => item.id === id) ?? null);
      setMessage(
        "Created a new Sample draft. Color Plate and approval were intentionally left blank.",
      );
    } catch (caught) {
      showOperationError(caught, "duplicate");
    } finally {
      setBusy("");
    }
  }
  async function deleteDraft() {
    if (
      !draft ||
      draft.issuedDocuments.length ||
      !window.confirm(
        "Permanently delete this unissued Sample draft?\n\nIts material rows and saved working versions will also be removed. This cannot be undone.",
      )
    )
      return;
    setBusy("delete");
    setError("");
    try {
      await (auth.profile?.role === "admin"
        ? adminPermanentlyDeleteSampleDraft(draft.id)
        : permanentlyDeleteSampleDraft(draft.id));
      await reload();
      setDraft(null);
      setMessage("Sample draft permanently deleted.");
    } catch (caught) {
      showOperationError(caught, "delete-draft");
    } finally {
      setBusy("");
    }
  }
  async function deleteIssued() {
    if (
      !draft ||
      !draft.issuedDocuments.length ||
      auth.profile?.role !== "admin"
    )
      return;
    const confirmation = window.prompt(
      "ADMIN PERMANENT DELETION\n\nThis permanently removes the Sample, working versions, issued history, and stored Sample PDFs. This cannot be undone.\n\nType DELETE ISSUED SAMPLE to continue.",
    );
    if (confirmation !== "DELETE ISSUED SAMPLE") return;
    setBusy("delete-issued");
    setError("");
    try {
      await permanentlyDeleteIssuedSample(draft.id);
      if (preview?.url.startsWith("blob:")) URL.revokeObjectURL(preview.url);
      setPreview(null);
      await reload();
      setDraft(null);
      setMessage(
        "Issued Sample and its owned documents were permanently deleted.",
      );
    } catch (caught) {
      showOperationError(caught, "delete-issued");
    } finally {
      setBusy("");
    }
  }
  async function issue() {
    if (
      !draft ||
      !window.confirm(
        "Issue the current Sample Work Order?\n\nThis creates an immutable historical snapshot. The Sample may later gain context without changing this issued form.",
      )
    )
      return;
    setBusy("issue");
    setError("");
    const readiness = validateSampleForOutput(draft, "formal-issue");
    if (readiness) {
      logSampleError(readiness);
      setError(formatSampleError(readiness));
      setBusy("");
      return;
    }
    let saved: SampleRecord;
    try {
      saved = await persistDraft(draft);
    } catch (caught) {
      showOperationError(
        caught,
        "save-draft",
        "Sample not issued — Draft could not be saved.",
      );
      setBusy("");
      return;
    }
    let documentId = "";
    try {
      documentId = await issueSample(saved.id);
    } catch (caught) {
      showOperationError(caught, "formal-issue");
      setBusy("");
      return;
    }
    try {
      const url = await generateSamplePdf(documentId);
      const next = await reload();
      const current = next.find((item) => item.id === saved.id) ?? null;
      setDraft(current);
      setRecentValues({});
      setPreview({
        url,
        filename: `${draft.colorPlateNumber || "Sample-Work-Order"}.pdf`,
      });
      setMessage("Sample Work Order issued and generated.");
    } catch (caught) {
      showOperationError(
        caught,
        "issued-pdf",
        "Sample issued, but its PDF could not be generated. The issued snapshot is safe. Use Generate PDF to retry.",
      );
      await reload()
        .then((next) =>
          setDraft(next.find((item) => item.id === saved.id) ?? null),
        )
        .catch((reloadError) =>
          logSampleError(translateSampleError(reloadError, "load")),
        );
    } finally {
      setBusy("");
    }
  }
  async function regenerate(documentId: string, issueNumber: number) {
    if (!draft) return;
    setBusy(`generate:${documentId}`);
    setError("");
    try {
      const url = await generateSamplePdf(documentId);
      const next = await reload();
      setDraft(next.find((item) => item.id === draft.id) ?? null);
      setPreview({
        url,
        filename: `${draft.colorPlateNumber || "Sample-Work-Order"}-Issue-${issueNumber}.pdf`,
      });
      setMessage(`Issue ${issueNumber} PDF generated.`);
    } catch (caught) {
      showOperationError(caught, "issued-pdf");
    } finally {
      setBusy("");
    }
  }
  function selectCatalog(item: PurchasingCatalogSuggestion) {
    if (catalogRow === null || !draft) return;
    const current = draft.blendRows[catalogRow];
    patchRow(catalogRow, sampleBlendCatalogAutofill(current, item));
    setCatalogRow(null);
    setCatalogResults([]);
    setCatalogQuery("");
  }
  const linkedBid = draft ? bids.find((bid) => bid.id === draft.bidId) : null;
  const formulationResult = draft
    ? calculateSampleFormulation(draft.formulation, draft.blendRows)
    : null;
  const visibleSamples = initialContext.bid
    ? samples.filter((sample) => sample.bidId === initialContext.bid)
    : samples;
  const linkableSamples = initialContext.bid
    ? samples.filter((sample) => !sample.bidId)
    : [];
  return (
    <main className="min-h-[calc(100vh-73px)] bg-[#eef1f4] px-3 py-5 text-slate-950 sm:px-5">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Pre-Production tools
            </div>
            <h1 className="mt-1 text-3xl font-bold">
              Sample Formula Workspace
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Build, save, and compare working formulas without requiring a
              Production Job.
            </p>
          </div>
          <button
            type="button"
            disabled={Boolean(busy) || Boolean(draft)}
            onClick={() => void create()}
            className="inline-flex h-10 items-center gap-2 border border-blue-900 bg-blue-900 px-4 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            New Sample
          </button>
        </div>
        {error && (
          <div
            role="alert"
            className="mt-4 border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
          >
            {error}
          </div>
        )}
        {message && (
          <div
            role="status"
            className="mt-4 border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
          >
            {message}
          </div>
        )}
        {!draft ? (
          <>
            {initialContext.bid ? (
              <section className="mt-5 border border-slate-300 bg-white p-4">
                <h2 className="text-sm font-bold uppercase tracking-wide">
                  Bid-context Samples
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Create a new canonical Sample with this Bid’s Customer and
                  Project, or link an existing standalone Sample.
                </p>
                {linkableSamples.length ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className={`${label} min-w-0 flex-1`}>
                      Existing standalone Sample
                      <select
                        value={linkSelection}
                        onChange={(event) =>
                          setLinkSelection(event.target.value)
                        }
                        className={field}
                      >
                        <option value="">Select Sample</option>
                        {linkableSamples.map((sample) => (
                          <option key={sample.id} value={sample.id}>
                            {sampleLibraryTitle(sample)}
                            {sampleLibraryContext(sample)
                              ? ` · ${sampleLibraryContext(sample)}`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={!linkSelection || Boolean(busy)}
                      onClick={() => void linkExisting()}
                      className="h-10 border border-slate-400 px-3 text-sm font-bold disabled:opacity-40"
                    >
                      {busy === "link" ? "Linking…" : "Link Sample"}
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}
            <section className="mt-5 border border-slate-300 bg-white">
              <div className="border-b border-slate-300 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wide">
                {initialContext.bid
                  ? "Samples linked to this Bid"
                  : "Sample Draft Library"}
              </div>
              {loading ? (
                <p className="p-5 text-sm text-slate-500">Loading…</p>
              ) : visibleSamples.length ? (
                visibleSamples.map((sample) => {
                  const context = sampleLibraryContext(sample);
                  return (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => {
                        setDraft(sample);
                        setDraftBaseline(JSON.stringify(sample));
                      }}
                      className="flex min-h-20 w-full items-start gap-3 border-b border-slate-200 px-4 py-3 text-left last:border-0 hover:bg-slate-50"
                    >
                      <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">
                          {sampleLibraryTitle(sample)}
                        </span>
                        {context && (
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {context}
                          </span>
                        )}
                        <span className="mt-1 block truncate text-xs font-medium text-slate-700">
                          {sampleFormulationPreview(sample)}
                        </span>
                        <span className="mt-1 block truncate text-[11px] text-slate-500">
                          {sampleLibraryMetadata(sample)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-xs font-semibold text-slate-600">
                        {sampleLibraryStatus(sample)}
                        {sample.issuedDocuments.length > 0 && (
                          <span className="mt-1 block text-[10px] font-normal text-slate-400">
                            {sample.issuedDocuments.length} issued
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="p-8 text-center text-sm text-slate-500">
                  {initialContext.bid
                    ? "No Samples linked to this Bid yet."
                    : "No Samples yet."}
                </p>
              )}
            </section>
          </>
        ) : (
          <div data-sample-editor className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {draft.id ? "Current Draft" : "New Sample · not saved yet"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={Boolean(busy) || !draft.id}
                  onClick={() => void duplicate()}
                  className="inline-flex h-11 items-center gap-2 border border-slate-400 bg-white px-3 text-xs font-bold disabled:opacity-40 sm:h-9"
                >
                  <Copy className="h-4 w-4" />
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={requestClose}
                  className="inline-flex h-11 items-center gap-2 border border-slate-400 bg-white px-3 text-xs font-bold sm:h-9"
                >
                  <X className="h-4 w-4" />
                  Close
                </button>
              </div>
            </div>
            <section className="border border-slate-300 bg-white p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide">
                Sample context
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className={label}>
                  Sample Name{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                  <input
                    value={draft.sampleName}
                    maxLength={200}
                    onChange={(e) => patch("sampleName", e.target.value)}
                    placeholder="Blue terrazzo trial"
                    className={field}
                  />
                </label>
                <SampleRecentValueInput
                  label="Requested By"
                  value={draft.requestedBy}
                  fieldKey={sampleRecentFieldKeys.requestedBy}
                  suggestions={recentValues.requested_by ?? []}
                  onLoad={loadRecent}
                  onChange={(value) => patch("requestedBy", value)}
                  className={field}
                />
                <label className={label}>
                  Date Requested
                  <input
                    type="date"
                    value={draft.requestedDate}
                    onChange={(e) => patch("requestedDate", e.target.value)}
                    className={field}
                  />
                </label>
                <label className={label}>
                  Prepared By
                  <input
                    value={draft.preparedBy}
                    onChange={(e) => patch("preparedBy", e.target.value)}
                    className={field}
                  />
                </label>
                <label className={label}>
                  Approved Date
                  <input
                    type="date"
                    value={draft.approvedDate}
                    onChange={(e) => patch("approvedDate", e.target.value)}
                    className={field}
                  />
                </label>
                <SampleRecentValueInput
                  label="Project Name"
                  value={draft.projectName}
                  fieldKey={sampleRecentFieldKeys.projectName}
                  suggestions={recentValues.project_name ?? []}
                  onLoad={loadRecent}
                  onChange={(value) => patch("projectName", value)}
                  className={field}
                />
                <SampleRecentValueInput
                  label="Customer Name"
                  value={draft.customerName}
                  fieldKey={sampleRecentFieldKeys.customerName}
                  suggestions={recentValues.customer_name ?? []}
                  onLoad={loadRecent}
                  onChange={(value) => patch("customerName", value)}
                  className={field}
                />
                <label className={label}>
                  Color Plate #
                  <input
                    value={draft.colorPlateNumber}
                    onChange={(e) =>
                      patch("colorPlateNumber", e.target.value.toUpperCase())
                    }
                    placeholder="T26-123A"
                    className={field}
                  />
                </label>
                <SampleRecentValueInput
                  label="Finish Requested"
                  value={draft.finishRequested}
                  fieldKey={sampleRecentFieldKeys.finishRequested}
                  suggestions={recentValues.finish_requested ?? []}
                  onLoad={loadRecent}
                  onChange={(value) => patch("finishRequested", value)}
                  className={field}
                />
                <SampleRecentValueInput
                  label="Sample Size"
                  value={draft.sampleSize}
                  fieldKey={sampleRecentFieldKeys.sampleSize}
                  suggestions={recentValues.sample_size ?? []}
                  onLoad={loadRecent}
                  onChange={(value) => patch("sampleSize", value)}
                  className={field}
                />
                <SampleRecentValueInput
                  label="Sample Quantity"
                  value={draft.sampleQuantity}
                  fieldKey={sampleRecentFieldKeys.sampleQuantity}
                  suggestions={recentValues.sample_quantity ?? []}
                  onLoad={loadRecent}
                  onChange={(value) => patch("sampleQuantity", value)}
                  className={field}
                />
                <label className={label}>
                  Bid context
                  <select
                    value={draft.bidId}
                    onChange={(e) => patch("bidId", e.target.value)}
                    className={field}
                  >
                    <option value="">Standalone / no Bid</option>
                    {bids.map((bid) => (
                      <option key={bid.id} value={bid.id}>
                        {bid.customer} · {bid.projectName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={label}>
                  Production Job context
                  <select
                    value={draft.jobId}
                    onChange={(e) => patch("jobId", e.target.value)}
                    className={field}
                  >
                    <option value="">No Production Job</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.job_number ? `${job.job_number} · ` : ""}
                        {job.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {linkedBid && (
                <p className="mt-3 text-xs text-slate-500">
                  Linked to Bid: {linkedBid.customer} · {linkedBid.projectName}
                </p>
              )}
              <label className={`${label} mt-4 block`}>
                Notes
                <textarea
                  value={draft.notes}
                  onChange={(e) => patch("notes", e.target.value)}
                  rows={4}
                  className={area}
                />
              </label>
            </section>
            <SampleFormulationConfigurator
              state={draft.formulation}
              rows={draft.blendRows}
              resinSupplier={draft.resinSupplier}
              onChange={(formulation) => patch("formulation", formulation)}
            />
            <section className="border border-slate-300 bg-white p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide">
                Materials and setup
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <SampleRecentValueInput
                  label="Filler"
                  value={draft.filler}
                  fieldKey={sampleRecentFieldKeys.filler}
                  suggestions={recentValues.filler ?? []}
                  onLoad={loadRecent}
                  onChange={(value) => patch("filler", value)}
                  className={field}
                />
                <SampleRecentValueInput
                  label="Sealer"
                  value={draft.sealer}
                  fieldKey={sampleRecentFieldKeys.sealer}
                  suggestions={recentValues.sealer ?? []}
                  onLoad={loadRecent}
                  onChange={(value) => patch("sealer", value)}
                  className={field}
                />
                <SampleRecentValueInput
                  label="Resin Supplier"
                  value={draft.resinSupplier}
                  fieldKey={sampleRecentFieldKeys.resinSupplier}
                  suggestions={recentValues.resin_supplier ?? []}
                  onLoad={loadRecent}
                  onChange={patchResinSupplier}
                  className={field}
                />
                <SampleRecentValueInput
                  label="Resin Color and #"
                  value={draft.resinColorNumber}
                  fieldKey={sampleRecentFieldKeys.resinColorNumber}
                  suggestions={recentValues.resin_color_number ?? []}
                  onLoad={loadRecent}
                  onChange={(value) => patch("resinColorNumber", value)}
                  className={field}
                />
              </div>
            </section>
            <section className="border border-slate-300 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide">
                    Chip Mix
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Aggregate percentages divide the available Chip Mix. Formula quantities are shown in ounces.
                  </p>
                  <p
                    className={`mt-2 text-sm font-bold ${formulationResult?.percentageReconciles ? "text-emerald-700" : "text-amber-700"}`}
                  >
                    Total {formulationResult?.percentageTotal || "0"}% ·{" "}
                    {formulationResult?.availableChipMixOz || "0"} oz Chip Mix
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    patch("blendRows", [
                      ...draft.blendRows,
                      blankSampleBlendRow(draft.blendRows.length),
                    ])
                  }
                  className="inline-flex h-11 items-center gap-1 border border-slate-400 px-3 text-xs font-bold"
                >
                  <Plus className="h-4 w-4" />
                  Add Material
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {draft.blendRows.map((row, index) => (
                  <article
                    key={row.id}
                    className="border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">
                        {row.componentRole === "aggregate"
                          ? "Aggregate"
                          : row.componentRole === "resin"
                            ? "Resin"
                            : row.componentRole === "hardener"
                              ? "Hardener"
                              : "Filler / Other"}{" "}
                        · row {index + 1}
                        {row.catalogItemId
                          ? " · Catalog-assisted"
                          : " · Manual"}
                      </span>
                      <button
                        type="button"
                        disabled={draft.blendRows.length === 1}
                        onClick={() =>
                          patch(
                            "blendRows",
                            draft.blendRows
                              .filter((_, candidate) => candidate !== index)
                              .map((item, order) => ({
                                ...item,
                                displayOrder: order,
                              })),
                          )
                        }
                        aria-label={`Remove material row ${index + 1}`}
                        className="h-11 w-11 border border-slate-300 bg-white text-red-700 disabled:opacity-30"
                      >
                        <Trash2 className="mx-auto h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <label className={label}>
                        Formula Role
                        <select
                          value={row.componentRole}
                          onChange={(event) => {
                            const componentRole = event.target
                              .value as SampleBlendRow["componentRole"];
                            patchRow(index, {
                              componentRole,
                              calculationBasis:
                                componentRole === "aggregate"
                                  ? "target_total"
                                  : null,
                              quantityProvenance:
                                componentRole === "aggregate" ||
                                componentRole === "hardener"
                                  ? "calculated"
                                  : "manual",
                            });
                          }}
                          className={field}
                        >
                          <option value="aggregate">Aggregate</option>
                          <option value="resin">Resin</option>
                          <option value="hardener">Hardener</option>
                          <option value="other">Filler / Other</option>
                        </select>
                      </label>
                      {row.componentRole === "aggregate" && (
                        <label className={`${label} text-left sm:text-center`}>
                          %
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.001"
                            value={row.percentage}
                            onChange={(e) =>
                              patchRow(index, { percentage: e.target.value })
                            }
                            className={field}
                          />
                        </label>
                      )}
                      <label
                        className={`${label} relative text-left sm:text-center`}
                      >
                        Color
                        <div className="relative">
                          <input
                            role="combobox"
                            aria-autocomplete="list"
                            aria-expanded={catalogRow === index}
                            aria-controls={`sample-catalog-results-${row.id}`}
                            value={row.color}
                            onFocus={() => {
                              setCatalogRow(index);
                              setCatalogQuery(row.color);
                            }}
                            onBlur={() =>
                              window.setTimeout(
                                () =>
                                  setCatalogRow((current) =>
                                    current === index ? null : current,
                                  ),
                                100,
                              )
                            }
                            onChange={(e) => {
                              patchRow(index, { color: e.target.value });
                              setCatalogRow(index);
                              setCatalogQuery(e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setCatalogRow(null);
                            }}
                            placeholder="Type or search Catalog"
                            className={`${field} pr-8`}
                          />
                          <Search
                            aria-hidden="true"
                            className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                          />
                        </div>
                        {catalogRow === index && (
                          <div
                            id={`sample-catalog-results-${row.id}`}
                            role="listbox"
                            className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto border border-slate-300 bg-white text-left shadow-xl"
                          >
                            {catalogSearching ? (
                              <p className="px-3 py-3 text-xs text-slate-500">
                                Searching Catalog…
                              </p>
                            ) : catalogQuery.trim().length < 2 ? (
                              <p className="px-3 py-3 text-xs text-slate-500">
                                Type at least two characters, or continue with
                                manual entry.
                              </p>
                            ) : catalogResults.length ? (
                              catalogResults.map((item) => (
                                <button
                                  key={`${item.source}:${item.id}`}
                                  type="button"
                                  role="option"
                                  aria-selected="false"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => selectCatalog(item)}
                                  className="block w-full border-b border-slate-200 px-3 py-2 text-left last:border-0 hover:bg-slate-50"
                                >
                                  <strong className="block text-sm">
                                    {item.materialName}
                                  </strong>
                                  <span className="text-xs font-normal text-slate-500">
                                    {[
                                      item.vendor,
                                      item.chipSize,
                                      item.materialType,
                                      item.vendorSku,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <p className="px-3 py-3 text-xs text-slate-500">
                                No Catalog match. Keep the authored Color as a
                                manual value.
                              </p>
                            )}
                          </div>
                        )}
                      </label>
                      <label className={`${label} text-left sm:text-center`}>
                        Size
                        <input
                          value={row.size}
                          onChange={(e) =>
                            patchRow(index, { size: e.target.value })
                          }
                          className={field}
                        />
                      </label>
                      <label className={`${label} text-left sm:text-center`}>
                        Type
                        <input
                          value={row.materialType}
                          onChange={(e) =>
                            patchRow(index, { materialType: e.target.value })
                          }
                          className={field}
                        />
                      </label>
                      <label className={`${label} text-left sm:text-center`}>
                        {row.quantityProvenance === "calculated"
                          ? "Calculated Weight"
                          : "Quantity"}
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          readOnly={row.quantityProvenance === "calculated"}
                          value={
                            row.quantityProvenance === "calculated"
                              ? formulationResult?.rows[index]
                                  ?.calculatedQuantity || ""
                              : row.quantity
                          }
                          onChange={(e) =>
                            patchRow(index, { quantity: e.target.value })
                          }
                          className={`${field} ${row.quantityProvenance === "calculated" ? "bg-slate-100" : ""}`}
                        />
                        <span className="mt-1 block text-[11px] font-normal text-slate-500">
                          {row.componentRole === "aggregate"
                            ? "oz · % of available Chip Mix"
                            : row.componentRole === "hardener"
                              ? `From ${draft.formulation.resinParts}:${draft.formulation.hardenerParts} Resin ratio`
                              : "Authored amount"}
                        </span>
                      </label>
                      {row.quantityProvenance === "manual" && (
                          <label
                            className={`${label} text-left sm:text-center`}
                          >
                            Unit
                            <PurchasingChoiceWithCustom
                              value={row.unit}
                              options={purchasingQuantityUnits}
                              onChange={(value) =>
                                patchRow(index, { unit: value })
                              }
                              className={field}
                            />
                          </label>
                        )}
                      {(row.componentRole === "aggregate" || row.componentRole === "hardener") && (
                        <button type="button" onClick={()=>patchRow(index,{quantityProvenance:row.quantityProvenance==='calculated'?'manual':'calculated',calculationBasis:row.componentRole==='aggregate'&&row.quantityProvenance==='manual'?'target_total':null,quantity:row.quantityProvenance==='calculated'?(formulationResult?.rows[index]?.calculatedQuantity||''):row.quantity,unit:'oz'})} className="min-h-10 self-end border border-slate-300 bg-white px-2 text-xs font-bold">
                          {row.quantityProvenance==='calculated'?'Enter manually':'Use calculated'}
                        </button>
                      )}
                      <label className={`${label} text-left sm:text-center`}>
                        Vendor
                        <PurchasingVendorNameInput
                          id={`sample-material-vendor-${row.id}`}
                          value={row.vendor}
                          vendors={vendors}
                          onChange={(value) =>
                            patchRow(index, { vendor: value })
                          }
                          className={field}
                        />
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <label
              className={`${label} block border border-slate-300 bg-white p-4`}
            >
              More Notes
              <textarea
                value={draft.moreNotes}
                onChange={(e) => patch("moreNotes", e.target.value)}
                rows={6}
                className={area}
              />
            </label>
            <SampleVersionHistory
              sample={draft}
              onSave={() => persistDraft(draft)}
              onReload={async (sampleId) => {
                const next = await reload();
                const current =
                  next.find((item) => item.id === sampleId) ?? null;
                setDraft(current);
                if (current) setDraftBaseline(JSON.stringify(current));
              }}
              onPreview={(url, filename) => setPreview({ url, filename })}
            />
            <section className="border border-slate-300 bg-white p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide">
                Issued Sample Work Orders
              </h2>
              {draft.issuedDocuments.length ? (
                <div className="mt-3 space-y-2">
                  {draft.issuedDocuments.map((document) => (
                    <div
                      key={document.id}
                      className="flex flex-wrap items-center gap-3 border border-slate-200 p-3"
                    >
                      <FileText className="h-5 w-5 text-slate-500" />
                      <span className="min-w-0 flex-1 text-sm">
                        <strong>Issue {document.issueNumber}</strong>
                        <span className="block text-xs text-slate-500">
                          {new Date(document.issuedAt).toLocaleString()} ·{" "}
                          {document.generationStatus}
                        </span>
                      </span>
                      {document.generationStatus === "generated" ? (
                        <button
                          type="button"
                          onClick={() =>
                            void openSamplePdf(document.id)
                              .then((url) =>
                                setPreview({
                                  url,
                                  filename: `${draft.colorPlateNumber || "Sample-Work-Order"}-Issue-${document.issueNumber}.pdf`,
                                }),
                              )
                              .catch((caught) =>
                                showOperationError(caught, "issued-pdf"),
                              )
                          }
                          className="h-9 border border-slate-300 px-3 text-xs font-bold"
                        >
                          Open PDF
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            Boolean(busy) ||
                            document.generationStatus === "generating"
                          }
                          onClick={() =>
                            void regenerate(document.id, document.issueNumber)
                          }
                          className="h-9 border border-slate-300 px-3 text-xs font-bold disabled:opacity-40"
                        >
                          {busy === `generate:${document.id}` ||
                          document.generationStatus === "generating"
                            ? "Generating…"
                            : "Generate PDF"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  No issued forms yet. Preview does not create history.
                </p>
              )}
            </section>
            <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border border-slate-300 bg-white p-3">
              {draft.issuedDocuments.length ? (
                auth.profile?.role === "admin" ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void deleteIssued()}
                    className="inline-flex h-10 items-center gap-2 border border-red-500 bg-red-50 px-4 text-sm font-bold text-red-800 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                    {busy === "delete-issued"
                      ? "Permanently deleting…"
                      : "Permanently Delete Issued Sample"}
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">
                    Issued Sample history is protected from deletion.
                  </span>
                )
              ) : draft.id ? (
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void deleteDraft()}
                  className="inline-flex h-10 items-center gap-2 border border-red-300 px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                  {busy === "delete" ? "Deleting…" : "Delete Draft"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(null);
                    setMessage("Unsaved Sample discarded.");
                  }}
                  className="inline-flex h-10 items-center gap-2 border border-slate-300 px-4 text-sm font-bold text-slate-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Discard
                </button>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void save()}
                  className="h-10 border border-slate-400 px-4 text-sm font-bold"
                >
                  {busy === "save" ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void issue()}
                  className="h-10 border border-blue-900 bg-white px-4 text-sm font-bold text-blue-950"
                >
                  {busy === "issue" ? "Issuing…" : "Formal Issue"}
                </button>
              </div>
            </footer>
          </div>
        )}
      </div>
      {preview && (
        <DocumentViewer
          title="Tenarten Sample Work Order"
          filename={preview.filename}
          mimeType="application/pdf"
          url={preview.url}
          onClose={() => {
            if (preview.url.startsWith("blob:"))
              URL.revokeObjectURL(preview.url);
            setPreview(null);
          }}
        />
      )}
      {closePrompt && draft && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sample-close-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="w-full max-w-md border border-slate-300 bg-white p-5 shadow-xl">
            <h2 id="sample-close-title" className="text-lg font-bold">
              Save this Sample?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              You have unsaved formula changes. Save them, discard them, or keep
              editing.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setClosePrompt(false)}
                className="min-h-11 border border-slate-300 px-4 text-sm font-bold"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setClosePrompt(false);
                  setDraft(null);
                  setMessage("Unsaved changes discarded.");
                }}
                className="min-h-11 border border-red-300 px-4 text-sm font-bold text-red-700"
              >
                Discard
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void saveAndClose()}
                className="min-h-11 bg-blue-900 px-4 text-sm font-bold text-white"
              >
                {busy === "save-close" ? "Saving…" : "Save Draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
