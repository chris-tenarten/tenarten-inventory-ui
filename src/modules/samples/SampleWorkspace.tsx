"use client";

import {displayProfileRatio} from '../../../supabase/functions/_shared/ratio-display.mjs';
import { BusinessButton, BusinessSelect, BusinessInput, BusinessTextarea } from '@/components/BusinessWriteControls';

import {sampleVendorPackageWarning} from './vendor-authority';
import {applyResinIdentity,synchronizeResin,resinConflict} from './resin-identity';
import Help from './ContextHelp';
import {preferredColorPlate,colorPlateWarning,colorPlateConflict} from './color-plate-identifier';
import './sample-workspace.css';
import SampleResinSystemSelector from './SampleResinSystemSelector';
import {BATCH_FIRST_VERSION,batchFirstQuantities} from "./formulation";
import { projectSampleBatch, formatBatchQuantity } from "./batch-projection";

import CatalogSearchResults from "@/modules/purchasing/CatalogSearchResults";
import {
  Copy,
  FileText,
  FlaskConical,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DocumentViewer from "@/components/documents/DocumentViewer";
import { useAuth } from "@/lib/auth";
import { loadBids } from "@/modules/pre-production/queries";
import type { Bid } from "@/modules/pre-production/types";
import {
  loadProductionJobOptions,
  type ProductionJobOption,
} from "@/modules/production/job-options";
import { sampleCatalogEligible, searchSampleCatalog } from "./catalog";
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
  sampleRowsForDisplay,
  type SampleBlendRow,
  type SampleRecord,
} from "./types";
import { clearSampleCatalogSelection, sampleBlendCatalogAutofill } from "./material-autofill";
import {
  adminPermanentlyDeleteSampleDraft,
  createSampleWithFormulation,
  suggestSampleColorPlateNumber,
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
import OperationalProfilesSettings from './OperationalProfilesSettings';
import SampleFormulationConfigurator from "./SampleFormulationConfigurator";
import ProductionBatchOutput from "./ProductionBatchOutput";
import SampleVersionHistory from "./SampleVersionHistory";
import SampleFormulationTutorial, {
  type SampleTutorialStep,
} from "./SampleFormulationTutorial";
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
  calculateSampleFormulation,
  normalizeSupportedSampleRatio,
  SAMPLE_FORMULATION_CALCULATION_VERSION,
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
  const [documentsOpen,setDocumentsOpen]=useState(false);
  function jumpTo(id:string){const element=document.getElementById(id);element?.scrollIntoView({behavior:'smooth',block:'start'});element?.focus({preventScroll:true});}
  const [sampleHistoryExpanded,setSampleHistoryExpanded]=useState(false);
  const [expandedRows,setExpandedRows]=useState<Record<string,boolean>>({});
  const [draftBaseline, setDraftBaseline] = useState("");
  const [quantityViewState, setQuantityViewState] = useState<{record: string | null; view: "batch" | "working"}>({record:null,view:"batch"});
  const quantityView = quantityViewState.record === (draft?.id ?? null) ? quantityViewState.view : "batch";
  const batchFirst = draft?.formulation.calculationVersion === BATCH_FIRST_VERSION;
  const shopProjection = draft && batchFirst ? batchFirstQuantities(draft.formulation,draft.blendRows) : null;
  function changeBatchFiller(value: string | null) {
    setDraft(current => current ? {...current,formulation:{...current.formulation,batchFillerOverrideLb:value},
      blendRows:current.blendRows.map(row=>row.componentRole==='other'?row:{...row,quantity:'',quantityProvenance:'calculated',calculationBasis:row.componentRole==='aggregate'?'target_total':null})} : current);
    setMessage('Batch formulation updated. Shop quantities reset; review preparation quantities before use.');
  }

  const batch = useMemo(() => draft ? projectSampleBatch(draft.formulation,draft.blendRows) : null,[draft]);
  const [closePrompt, setClosePrompt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<SampleTutorialStep>("finished-pieces");
  const [catalogRow, setCatalogRow] = useState<number | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogSelectionWarnings, setCatalogSelectionWarnings] = useState<Record<string, { role: SampleBlendRow["componentRole"]; itemId: string }>>({});
  const [catalogSearchError, setCatalogSearchError] = useState("");
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
  const draftIdentity = draft?.id || (draft ? "unsaved" : "");
  useEffect(() => {
    setTutorialActive(false);
    setTutorialStep("finished-pieces");
  }, [draftIdentity]);
  const changeTutorialStep = (next: SampleTutorialStep) => {
    if (next === "finished-pieces" || next === "production-pour") {
      const toggle = document.querySelector<HTMLButtonElement>('[data-sample-tutorial="calculation-settings-toggle"]');
      if (toggle?.getAttribute("aria-expanded") !== "true") toggle?.click();
    }
    setTutorialStep(next);
  };
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
      .then(async (items) => {
        if(initialContext.open==='new'){
          const formulation=await loadSampleFormulationDefault();
          const local=applyResinIdentity(newLocalSample({preparedBy:auth.profile?.displayName??'',formulation}),formulation);
          setQuantityViewState({record:null,view:'working'});
          local.colorPlateNumber=await suggestSampleColorPlateNumber();local.colorPlateNumberSource='automatic';
          setDraft(local);setDraftBaseline(JSON.stringify(local));return;
        }
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
  }, [initialContext.open, reload, showOperationError, auth.profile?.displayName]);
  const catalogRole = catalogRow === null ? undefined : draft?.blendRows[catalogRow]?.componentRole;
  const catalogSearchKey = JSON.stringify([catalogRow, catalogRole, catalogQuery]);
  const [catalogResultKey, setCatalogResultKey] = useState("");
  useEffect(() => {
    const query = catalogQuery.trim();
    setCatalogResults([]);
    setCatalogSearchError("");
    if (catalogRow === null || !catalogRole || ['resin','hardener'].includes(catalogRole)) {
      setCatalogSearching(false);
      return;
    }
    let active = true;
    setCatalogSearching(true);
    const timer = window.setTimeout(() => {
      void searchSampleCatalog(query, catalogRole)
        .then((results) => {
          if (active) setCatalogResults(results);
        })
        .catch((caught) => {
          if (active) setCatalogSearchError(caught instanceof Error ? caught.message : "Catalog search is incomplete. Retry your search.");
        })
        .finally(() => {
          if (active) { setCatalogSearching(false); setCatalogResultKey(catalogSearchKey); }
        });
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [catalogQuery, catalogRow, catalogRole, catalogSearchKey]);
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
    setDraft((current) => {
      if (!current) return current;
      const role=changes.componentRole??current.blendRows[index]?.componentRole;
      const provenance=changes.quantityProvenance;
      const directFillerEdit=role==='filler'&&changes.quantity!==undefined;
      return {...current,blendRows:current.blendRows.map((row,rowIndex)=>rowIndex===index?{...row,...changes}:row),formulation:{...current.formulation,...(role==='filler'&&(provenance||directFillerEdit)?{fillerProvenance:provenance==='calculated'?'profile_default':'manual',chipDensityProvenance:current.formulation.chipDensityProvenance==='increased_filler_adjustment'?'manual':current.formulation.chipDensityProvenance,adjustment:null}:{}),...(role==='resin'&&provenance?{resinProvenance:provenance==='manual'?'manual':'profile_default'}:{})}};
    });
    setMessage("");
  }
  function patchResinSupplier(value: string) {
    // Sourcing is independent of the captured Resin System, including legacy drafts.
    patch("resinSupplier", value);
  }
  async function create() {
    setBusy("create");
    setError("");
    try {
      const formulation = await loadSampleFormulationDefault();
      const bid = bids.find((item) => item.id === initialContext.bid);
      const initial = newLocalSample({
        preparedBy: auth.profile?.displayName ?? "",
        bidId: bid?.id,
        projectName: bid?.projectName,
        customerName: bid?.customer,
        formulation,
      });
      const local=applyResinIdentity(initial,formulation);
      local.colorPlateNumber=await suggestSampleColorPlateNumber();local.colorPlateNumberSource='automatic';
      setQuantityViewState({record:null,view:"working"});
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
        "Existing Sample linked to this Bid. Generated documents were not changed.",
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
    if(!source.id&&!source.formulation.profile)throw new Error('Select a Resin System to establish Batch quantities before saving.');
    if(resinConflict(source))throw new Error('Resolve the Resin Color / # and Resin row difference before saving.');
    const original=samples.find(item=>item.id===source.id)?.colorPlateNumber??'';
    if(source.colorPlateNumber!==original&&(source.id||source.colorPlateNumberSource!=='automatic')){
      const normalized=preferredColorPlate(source.colorPlateNumber);
      const conflict=colorPlateConflict(samples,source.id,normalized);
      if(conflict&&!window.confirm(`Another Sample uses ${conflict.colorPlateNumber}. These identifiers may refer to the same Color Plate. Save this Sample with that identifier anyway?`))throw new Error('Save cancelled. Review the Color Plate identifier.');
      if(colorPlateWarning(normalized)&&!window.confirm('This does not match the usual Color Plate format. Save as entered?'))throw new Error('Save cancelled. Review the Color Plate identifier.');
      source={...source,colorPlateNumber:normalized};
    }
    let saved=source;
    if(!source.id){
      const created=await createSampleWithFormulation(source);
      saved={...source,id:created.id,colorPlateNumber:created.color_plate_number,colorPlateNumberSource:undefined};
      // Creation has committed. Ancillary refresh failures must not create a second Sample.
      setDraft(saved);setDraftBaseline(JSON.stringify(saved));
    }else await saveSample(saved);
    await recordMySampleRecentValues(saved);
    const next=await reload();
    const authoritative=next.find(item=>item.id===saved.id);
    if(!authoritative)throw new Error('Saved Sample could not be reloaded.');
    setDraft(authoritative);setDraftBaseline(JSON.stringify(authoritative));setRecentValues({});
    return authoritative;
  }

  async function save() {
    if (!draft) return;
    setBusy("save");
    setError("");
    try {
      const saved=await persistDraft(draft);
      setMessage(!draft.id&&draft.colorPlateNumberSource==='automatic'?`Sample saved as ${saved.colorPlateNumber}.`:'Sample saved.');
    } catch (caught) {
      showOperationError(caught, "save-draft");
    } finally {
      setBusy("");
    }
  }
  const [blendDirty,setBlendDirty]=useState(false);
  const productionRef=useRef<{open:()=>void}>(null);
  function requestClose() {
    if(blendDirty&&!window.confirm("Discard unsaved Blend planning changes?"))return;
    setBlendDirty(false);
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
        "Permanently delete this Sample draft without generated documents?\n\nIts material rows and saved working versions will also be removed. This cannot be undone.",
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
      "ADMIN PERMANENT DELETION\n\nThis permanently removes the Sample, saved checkpoints, generated documents, and stored Sample PDFs. This cannot be undone.\n\nType DELETE SAMPLE AND DOCUMENTS to continue.",
    );
    if (confirmation !== "DELETE SAMPLE AND DOCUMENTS") return;
    setBusy("delete-issued");
    setError("");
    try {
      await permanentlyDeleteIssuedSample(draft.id);
      if (preview?.url.startsWith("blob:")) URL.revokeObjectURL(preview.url);
      setPreview(null);
      await reload();
      setDraft(null);
      setMessage(
        "Sample and its generated documents were permanently deleted.",
      );
    } catch (caught) {
      showOperationError(caught, "delete-issued");
    } finally {
      setBusy("");
    }
  }
  async function issue() {
    if (!draft) return;
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
        "Sample Work Order not generated — changes could not be saved.",
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
      setMessage("Sample Work Order generated.");
    } catch (caught) {
      showOperationError(
        caught,
        "issued-pdf",
        "Document captured, but its PDF could not be opened. Use Retry PDF in Generated Documents; do not generate another document to retry.",
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
        filename: `${draft.colorPlateNumber || "Sample-Work-Order"}-Document-${issueNumber}.pdf`,
      });
      setMessage(`Document ${issueNumber} PDF ready.`);
    } catch (caught) {
      showOperationError(caught, "issued-pdf");
    } finally {
      setBusy("");
    }
  }
  function selectCatalog(item: PurchasingCatalogSuggestion) {
    if (catalogRow === null || !draft) return;
    const current = draft.blendRows[catalogRow];
    if (catalogResultKey !== catalogSearchKey) return;
    setCatalogSelectionWarnings((warnings) => {
      const next = { ...warnings };
      if (sampleCatalogEligible(item, current.componentRole)) delete next[current.id];
      else next[current.id] = { role: current.componentRole, itemId: item.id };
      return next;
    });
    patchRow(catalogRow, sampleBlendCatalogAutofill(current, item));
    setCatalogRow(null);
    setCatalogResults([]);
    setCatalogQuery("");
  }
  const linkedBid = draft ? bids.find((bid) => bid.id === draft.bidId) : null;
  const formulationResult = draft
    ? calculateSampleFormulation(draft.formulation, draft.blendRows)
    : null;
  const displayRows = draft ? sampleRowsForDisplay(draft.blendRows) : [];
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
          <BusinessButton
            type="button"
            disabled={Boolean(busy) || Boolean(draft)}
            onClick={() => void create()}
            className="inline-flex h-10 items-center gap-2 border border-blue-900 bg-blue-900 px-4 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            New Sample
          </BusinessButton>
        </div>
        <OperationalProfilesSettings/>
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
                      <BusinessSelect
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
                      </BusinessSelect>
                    </label>
                    <BusinessButton
                      type="button"
                      disabled={!linkSelection || Boolean(busy)}
                      onClick={() => void linkExisting()}
                      className="h-10 border border-slate-400 px-3 text-sm font-bold disabled:opacity-40"
                    >
                      {busy === "link" ? "Linking…" : "Link Sample"}
                    </BusinessButton>
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
                            {sample.issuedDocuments.length} generated
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
                {draft.formulation.calculationVersion === SAMPLE_FORMULATION_CALCULATION_VERSION && (
                  <button
                    type="button"
                    aria-label="Start Sample formulation tutorial"
                    aria-pressed={tutorialActive}
                    onClick={() => {
                      changeTutorialStep("finished-pieces");
                      setTutorialActive(true);
                    }}
                    className="inline-flex h-11 items-center border border-blue-800 bg-white px-3 text-xs font-bold text-blue-900 focus-visible:ring-2 focus-visible:ring-blue-700 sm:h-9"
                  >
                    Guide me
                  </button>
                )}
                <BusinessButton
                  type="button"
                  disabled={Boolean(busy) || !draft.id}
                  onClick={() => void duplicate()}
                  className="inline-flex h-11 items-center gap-2 border border-slate-400 bg-white px-3 text-xs font-bold disabled:opacity-40 sm:h-9"
                >
                  <Copy className="h-4 w-4" />
                  Duplicate
                </BusinessButton>
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
            <div aria-label="Sample actions" className="border border-slate-300 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <BusinessButton
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void save()}
                  className="h-10 border border-slate-400 px-4 text-sm font-bold"
                >
                  {busy === "save" ? "Saving…" : draft.id ? "Save Changes" : "Save Sample"}
                </BusinessButton>
                <BusinessButton
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void issue()}
                  className="h-10 border border-blue-900 bg-blue-900 px-4 text-sm font-bold text-white"
                >
                  {busy === "issue" ? "Generating…" : "Generate Sample Work Order"}
                </BusinessButton>
                {auth.can('production_blend.manage')&&<button type="button" disabled={Boolean(busy)} onClick={()=>productionRef.current?.open()} className="min-h-10 border-l border-slate-300 pl-4 pr-2 text-sm font-bold text-blue-900 disabled:opacity-40">Plan Production Blend →</button>}
              </div>
            </div>
            <div id="formulation-setup" tabIndex={-1} className="scroll-mt-28 space-y-3">
            <section className="border border-slate-300 bg-white p-4"><h2 className="mb-3 text-lg font-bold">Formulation setup</h2>              <SampleResinSystemSelector initialSelection={!draft.id} state={draft.formulation} rows={draft.blendRows} onChange={formulation=>{
                setDraft(applyResinIdentity({...draft,blendRows:draft.blendRows.map(row=>row.componentRole==='other'?row:{...row,quantity:'',quantityProvenance:'calculated',calculationBasis:row.componentRole==='aggregate'?'target_total':null})},formulation));
                setMessage('Resin System applied. Batch Filler and shop quantities reset to this profile; materials and percentages are preserved.');
              }}/>
</section>
            </div>
            <div id="sample-context" tabIndex={-1} className="space-y-4">
            <section className="border border-slate-300 bg-white p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide">
                Sample context
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className={label}>
                  Color Plate / Formula #<Help label="Color Plate number">Formula # on the historical Sample Work Order; Plate # on downstream Production documents. Typical format: T26-258-A. Recognizable missing separators can be normalized; unusual identifiers can be saved after review.</Help>
                  <BusinessInput
                    aria-label="Color Plate / Formula #"
                    value={draft.colorPlateNumber}
                    onChange={(e) => {const value=e.target.value;setDraft(current=>current?{...current,colorPlateNumber:value,...(!current.id&&preferredColorPlate(value)!==preferredColorPlate(current.colorPlateNumber)?{colorPlateNumberSource:'manual' as const}:{})}:current);}}
                    onBlur={()=>{if(draft.colorPlateNumber!==(samples.find(s=>s.id===draft.id)?.colorPlateNumber??''))patch("colorPlateNumber",preferredColorPlate(draft.colorPlateNumber));}}
                    placeholder="T26-123-A"
                    className={field}
                  />
                {!draft.id&&draft.colorPlateNumberSource==='automatic'&&<span className="mt-1 block text-xs font-normal text-slate-500">Suggested by TenOps · editable · assigned when saved</span>}
                {colorPlateWarning(draft.colorPlateNumber)&&<span className="mt-1 block font-normal text-amber-800">{colorPlateWarning(draft.colorPlateNumber)}</span>}
                  {(draft.id||draft.colorPlateNumberSource!=='automatic')&&colorPlateConflict(samples,draft.id,draft.colorPlateNumber)&&<span className="block font-normal text-amber-800">Another Sample uses an equivalent Color Plate identifier. Review before saving.</span>}
                </label>
                <label className={label}>
                  Date Initiated
                  <BusinessInput
                    type="date"
                    value={draft.requestedDate}
                    onChange={(e) => patch("requestedDate", e.target.value)}
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
                  Prepared By
                  <BusinessInput
                    value={draft.preparedBy}
                    onChange={(e) => patch("preparedBy", e.target.value)}
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
                  label="Customer"
                  value={draft.customerName}
                  fieldKey={sampleRecentFieldKeys.customerName}
                  suggestions={recentValues.customer_name ?? []}
                  onLoad={loadRecent}
                  onChange={(value) => patch("customerName", value)}
                  className={field}
                />
                <SampleRecentValueInput
                  label="Finish"
                  value={draft.finishRequested}
                  fieldKey={sampleRecentFieldKeys.finishRequested}
                  suggestions={recentValues.finish_requested ?? []}
                  onLoad={loadRecent}
                  onChange={(value) => patch("finishRequested", value)}
                  className={field}
                />
                <label className={label}>
                  Approved Date
                  <BusinessInput
                    type="date"
                    value={draft.approvedDate}
                    onChange={(e) => patch("approvedDate", e.target.value)}
                    className={field}
                  />
                </label>
                <label className={`${label} sm:col-span-2`}>
                  Bid context
                  <BusinessSelect
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
                  </BusinessSelect>
                </label>
                <label className={`${label} sm:col-span-2`}>
                  Production Job context
                  <BusinessSelect
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
                  </BusinessSelect>
                </label>
              </div>
              {linkedBid && (
                <p className="mt-3 text-xs text-slate-500">
                  Linked to Bid: {linkedBid.customer} · {linkedBid.projectName}
                </p>
              )}
              <label className={`${label} mt-4 block`}>
                Notes
                <BusinessTextarea
                  value={draft.notes}
                  onChange={(e) => patch("notes", e.target.value)}
                  rows={4}
                  className={area}
                />
              </label>
            </section>
            {(draft.sampleName||draft.sampleSize||draft.sampleQuantity)&&<details className="text-xs text-slate-500"><summary className="cursor-pointer py-2">Legacy context</summary><p className="mb-2">Retained historical metadata. Physical dimensions and piece count are set in Sample Plate.</p><dl className="grid gap-1 sm:grid-cols-3">{draft.sampleName&&<div><dt>Historical name</dt><dd>{draft.sampleName}</dd></div>}{draft.sampleSize&&<div><dt>Historical size</dt><dd>{draft.sampleSize}</dd></div>}{draft.sampleQuantity&&<div><dt>Historical quantity</dt><dd>{draft.sampleQuantity}</dd></div>}</dl></details>}
            {draft.moreNotes&&<details className="text-xs text-slate-600"><summary className="cursor-pointer py-2">Historical additional notes</summary><p className="mb-2">Retained with this Sample and included in generated documents. Use Notes above for new instructions.</p><p className="whitespace-pre-wrap">{draft.moreNotes}</p></details>}
            </div>
            <div id="formulation-materials" className="space-y-3">
            <section className="border border-slate-300 bg-white p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide">
                Materials and setup
              </h2>
              <p className="mt-2 text-sm text-slate-600">Resin System: {displayProfileRatio(draft.formulation.profile?.name)||"Not selected"}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                <label className={label}>Resin Supplier
                  <PurchasingVendorNameInput
                    id="sample-resin-supplier"
                    ariaLabel="Resin Supplier"
                    value={draft.resinSupplier}
                    vendors={vendors}
                    onChange={patchResinSupplier}
                    className={field}
                  />
                </label>
                <SampleRecentValueInput
                  label="Resin Color and #"
                  value={draft.resinColorNumber}
                  fieldKey={sampleRecentFieldKeys.resinColorNumber}
                  suggestions={recentValues.resin_color_number ?? []}
                  onLoad={loadRecent}
                  onChange={(value) => setDraft(current=>current?synchronizeResin(current,"setup",value):current)}
                  className={field}
                />
              </div>
            </section>
            {resinConflict(draft)&&<div role="alert" className="border border-amber-400 bg-amber-50 p-3 text-sm">Resin Color / # and the Resin row contain different descriptions. Choose which value to keep in both fields before saving.<div className="mt-2 flex flex-wrap gap-2"><button type="button" className="min-h-11 border px-3" onClick={()=>setDraft(synchronizeResin(draft,'setup',draft.resinColorNumber,true))}>Use Resin Color / # for both</button><button type="button" className="min-h-11 border px-3" onClick={()=>setDraft(synchronizeResin(draft,'row',draft.blendRows.find(r=>r.componentRole==='resin')?.color??'',true))}>Use Resin row for both</button></div></div>}
            </div>
            <section id="batch-formulation" tabIndex={-1} data-compact={true} data-sample-tutorial="aggregate-section" className="border border-slate-300 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 w-full">
                  <h2 className="text-sm font-bold uppercase tracking-wide">
                    Batch Formulation
                  </h2>
                  <dl data-testid="canonical-batch-summary" className="my-3 grid grid-cols-2 gap-3 border-y border-slate-200 py-3 sm:grid-cols-4">
                    <div><dt className="text-xs text-slate-500">Chip Mix</dt><dd className="font-bold">{batch?.target==null?'Not captured':`${formatBatchQuantity(batch.target,'lb')} lb`}</dd></div>
                    {(['filler','resin','hardener'] as const).map(role=>{
                      const projection=batch?.rows[draft.blendRows.findIndex(row=>row.componentRole===role)];
                      const quantity=shopProjection?shopProjection.canonical[role]:projection?.quantity;
                      const unit=role==='filler'?'lb':'gal';
                      return <div key={role}><dt className="text-xs capitalize text-slate-500">{role}</dt><dd className="font-bold">{quantity==null?'Not captured':`${formatBatchQuantity(quantity,unit)} ${unit==='gal'?'US gal':unit}`}</dd></div>;
                    })}
                  </dl>
                  <h3 className="text-xs font-bold uppercase tracking-wide">Chip Blend</h3>
                  <p className="mt-1 whitespace-normal break-words text-xs text-slate-500">
                    Set the aggregate percentages. The blend must total 100%.
                  </p>
                  <p
                    className={`mt-2 text-sm font-bold ${formulationResult?.percentageReconciles ? "text-emerald-700" : "text-amber-700"}`}
                  >
                    {batch?.target!=null?`100% = ${formatBatchQuantity(batch.target,'lb')} lb Chip Mix`:'Select a Resin System to establish Batch quantities.'}

                  </p>
                </div>
              </div>
              {<div className="blend-column-headings mt-3 text-xs font-bold text-slate-600"><span>%</span><span>Color / Material</span><span>Size</span><span>Type</span><span>Vendor</span><span>Batch Qty<Help label="Batch Qty">Calculated from this material’s percentage × current Chip Mix per Batch.</Help></span><span>Actions</span></div>}
              {!draft.formulation.profile&&!draft.id?<p className="my-3 text-sm text-amber-800">Select a Resin System above before authoring Batch quantities.</p>:<div className="blend-rows mt-1 space-y-1">
                {!displayRows.some(({row})=>row.componentRole==='aggregate') && (
                  <BusinessButton type="button" onClick={() => patch("blendRows", [...draft.blendRows, blankSampleBlendRow(draft.blendRows.length)])} className="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-dashed border-slate-400 bg-white px-3 text-sm font-bold sm:w-auto"><Plus className="h-4 w-4" />Add Aggregate</BusinessButton>
                )}
                {displayRows.map(({row,sourceIndex:index},displayIndex) => (
                  <div key={row.id} className="space-y-3">
                  <article
                    data-sample-material-row={row.id}
                    data-role={row.componentRole}
                    data-details={Boolean(expandedRows[row.id])}
                    data-sample-tutorial={row.componentRole === "filler" ? "filler" : row.componentRole === "resin" || row.componentRole === "hardener" ? "resin-hardener" : undefined}
                    className="blend-row border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="blend-row-heading flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">
                        {row.componentRole === "aggregate"
                          ? `Aggregate ${displayIndex + 1}`
                          : row.componentRole === "filler"
                            ? "Filler"
                          : row.componentRole === "resin"
                            ? "Resin"
                            : row.componentRole === "hardener"
                              ? "Hardener"
                              : "Filler / Other"}
                        {row.catalogItemId
                          ? " · Catalog-assisted"
                          : " · Manual"}
                        {row.catalogItemId && catalogSelectionWarnings[row.id]?.itemId === row.catalogItemId && catalogSelectionWarnings[row.id]?.role === row.componentRole && <span className="ml-2 font-normal text-amber-700">Not classified for {row.componentRole.replace(/^./, (letter) => letter.toUpperCase())}. Selected manually; compatibility is not established.</span>}
                      </span>
                      <div className="blend-row-actions flex items-center gap-1"><button type="button" aria-label={`More details for ${row.componentRole} ${displayIndex+1}`} aria-expanded={Boolean(expandedRows[row.id])} onClick={()=>setExpandedRows(current=>({...current,[row.id]:!current[row.id]}))} className="min-h-9 px-2 text-xs text-blue-900 underline">Details</button>
                      <BusinessButton
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
                        aria-label={`Remove material row ${displayIndex + 1}`}
                        className="h-11 w-11 border border-slate-300 bg-white text-red-700 disabled:opacity-30"
                      >
                        <Trash2 className="mx-auto h-4 w-4" />
                      </BusinessButton></div>
                    </div>
                    <div className="blend-row-fields mt-2 grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(7rem,0.85fr)_minmax(4.5rem,0.45fr)_minmax(10rem,1.35fr)_minmax(6rem,0.65fr)_minmax(7rem,0.8fr)_minmax(11rem,1.3fr)_minmax(9rem,1fr)]">
                      <label className={`${label} blend-role`}>
                        Formula Role
                        <BusinessSelect
                          aria-label="Formula Role"
                          value={row.componentRole}
                          onChange={(event) => {
                            const componentRole = event.target
                              .value as SampleBlendRow["componentRole"];
                            patchRow(index, {
                              ...clearSampleCatalogSelection(row),
                              ...(row.catalogItemId ? { color: "" } : {}),
                              componentRole,
                              calculationBasis:
                                componentRole === "aggregate"
                                  ? "target_total"
                                  : null,
                              quantityProvenance:
                                componentRole === "aggregate" ||
                                componentRole === "resin" ||
                                componentRole === "hardener"
                                  ? "calculated"
                                  : "manual",
                              unit:
                                componentRole === "resin" ||
                                componentRole === "hardener"
                                  ? "fl oz"
                                  : "oz",
                            });
                            setCatalogRow(index);
                            setCatalogQuery(row.catalogItemId ? "" : row.color);
                          }}
                          className={field}
                        >
                          <option value="aggregate">Aggregate</option>
                          <option value="filler">Filler</option>
                          <option value="resin">Resin</option>
                          <option value="hardener">Hardener</option>
                          <option value="other">Other</option>
                        </BusinessSelect>
                      </label>
                      {row.componentRole === "aggregate" && (
                        <label className={`${label} text-left blend-percent`}>
                          <span className="blend-field-label">%</span>
                          <BusinessInput
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
                      {row.componentRole !== "aggregate" && (
                        <span aria-hidden="true" className="hidden xl:block" />
                      )}
                      <label
                        className={`${label} relative text-left blend-color`}
                      >
                        <span className="blend-field-label">Color</span>
                        <div className="relative">
                          <BusinessInput
                            role={row.componentRole==='resin'||row.componentRole==='hardener'?undefined:"combobox"}
                            aria-autocomplete={row.componentRole==='resin'||row.componentRole==='hardener'?undefined:"list"}
                            aria-expanded={catalogRow === index}
                            aria-controls={`sample-catalog-results-${row.id}`}
                            value={row.color}
                            onFocus={() => {
                              if(['resin','hardener'].includes(row.componentRole))return;
                              setCatalogRow(index);
                              setCatalogQuery("");
                            }}
                            onClick={()=>{if(!['resin','hardener'].includes(row.componentRole)&&catalogRow!==index){setCatalogRow(index);setCatalogQuery('');}}}
                            onBlur={(event) => {
                              if (event.relatedTarget instanceof Element && event.relatedTarget.closest("article") === event.currentTarget.closest("article")) return;
                              setCatalogRow((current) => current === index ? null : current);
                            }}
                            onChange={(e) => {
                              if(row.componentRole==='resin'){setDraft(current=>current?synchronizeResin(current,'row',e.target.value):current);return;}
                              if(row.componentRole==='hardener'){patchRow(index,{...clearSampleCatalogSelection(row),color:e.target.value});return;}
                              patchRow(index, { ...clearSampleCatalogSelection(row), color: e.target.value });
                              setCatalogRow(index);
                              setCatalogQuery(e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setCatalogRow(null);
                            }}
                            placeholder={['resin','hardener'].includes(row.componentRole)?'Material description':'Type or search Catalog'}
                            className={`${field} pr-8`}
                          />
                          {!['resin','hardener'].includes(row.componentRole)&&<Search
                            aria-hidden="true"
                            className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                          />}
                        </div>
                        {catalogRow === index && !['resin','hardener'].includes(row.componentRole) && (
                          <div
                            id={catalogResults.length ? undefined : `sample-catalog-results-${row.id}`}
                            className="absolute left-0 right-0 z-30 mt-1 border border-slate-300 bg-white text-left shadow-xl"
                          >
                            {catalogSearching || catalogResultKey !== catalogSearchKey ? (
                              <p className="px-3 py-3 text-xs text-slate-500">
                                Searching Catalog…
                              </p>
                            ) : catalogSearchError ? (
                              <p role="alert" className="px-3 py-3 text-xs text-red-700">{catalogSearchError}</p>
                            ) : catalogResults.length ? (
                              <>
                                {!catalogResults.some((item) => sampleCatalogEligible(item, row.componentRole)) && <p className="px-3 py-2 text-xs text-slate-500">No role-matching results.</p>}
                                <CatalogSearchResults key={catalogSearchKey} items={catalogResults} onSelect={selectCatalog} listbox listboxId={`sample-catalog-results-${row.id}`}
                                  resultGroup={(item) => sampleCatalogEligible(item, row.componentRole) ? "Role-matching results" : "Other Catalog matches"}
                                  resultNote={(item) => sampleCatalogEligible(item, row.componentRole) ? "" : `Not classified for ${row.componentRole.replace(/^./, (letter) => letter.toUpperCase())}. Compatibility is not established.`} />
                              </>
                            ) : (
                              <p className="px-3 py-3 text-xs text-slate-500">
                                No Catalog match. Keep the authored Color as a
                                manual value.
                              </p>
                            )}
                          </div>
                        )}
                      </label>
                      <label className={`${label} text-left blend-size`}>
                        <span className="blend-field-label">Size</span>
                        <BusinessInput
                          value={row.size}
                          onChange={(e) =>
                            patchRow(index, { size: e.target.value })
                          }
                          className={field}
                        />
                      </label>
                      <label className={`${label} text-left blend-type`}>
                        <span className="blend-field-label">Type</span>
                        <BusinessInput
                          value={row.materialType}
                          onChange={(e) =>
                            patchRow(index, { materialType: e.target.value })
                          }
                          className={field}
                        />
                      </label>
                      <div className={`${label} text-left blend-quantity`}>
                        {row.componentRole==='filler' && shopProjection?.resolvedBatch.enabled ? <>
                          <label className="relative block"><span className="blend-field-label">Current formulation Filler (lb)</span><span aria-hidden="true" className="pointer-events-none absolute right-2 top-2 text-xs text-slate-500">lb</span>
                            <BusinessInput aria-label="Batch Filler (lb)" type="number" min="0" step="0.000001" value={draft.formulation.batchFillerOverrideLb ?? String(shopProjection.resolvedBatch.baselineFiller ?? '')} onChange={e=>changeBatchFiller(e.target.value)} className={field}/>
                          </label>
                          <p className="mt-2 text-xs font-normal">Profile default: {shopProjection.resolvedBatch.baselineFiller} lb · {shopProjection.resolvedBatch.modified ? 'Modified' : 'Profile default'}</p>
                          <p className="mt-1 text-xs font-normal">Profile Chip Mix: {shopProjection.resolvedBatch.baselineChip} lb · Current Chip Mix: {shopProjection.resolvedBatch.target ?? '—'} lb</p>
                          {!shopProjection.resolvedBatch.valid && <p role="alert" className="text-xs text-red-700">Enter a nonnegative Filler quantity that leaves a positive Chip Mix.</p>}
                          {draft.formulation.batchFillerOverrideLb != null && <BusinessButton type="button" className="mt-2 min-h-10 border px-2 text-xs" onClick={()=>changeBatchFiller(null)}>Restore Profile Default</BusinessButton>}
                        </> : <span className="blend-field-label">Batch quantity</span>}
                        <output aria-label={`${row.componentRole} Batch quantity`} title={batch?.rows[index]?.quantity===null?undefined:String(batch?.rows[index]?.quantity)} className="mt-1 block border border-slate-300 bg-slate-100 px-3 py-3 text-base font-bold">
                          {formatBatchQuantity(batch?.rows[index]?.quantity??null,batch?.rows[index]?.unit??'')} {batch?.rows[index]?.unit}
                        </output>
                        <p className="blend-provenance mt-2 text-xs font-normal text-slate-600">{batch?.rows[index]?.note}</p>
                        {row.quantityProvenance==='manual' && <p className="text-xs font-normal">Edit quantity in Sample Plate view.</p>}
                      </div>
                      <label className={`${label} text-left blend-vendor`}>
                        <span className="blend-field-label">Vendor</span>
                        <PurchasingVendorNameInput
                          id={`sample-material-vendor-${row.id}`}
                          value={row.vendor}
                          vendors={vendors}
                          onChange={(value) =>
                            patchRow(index, { vendor: value })
                          }
                          className={field}
                        />
                        {sampleVendorPackageWarning(row)&&<p role="status" className="mt-1 text-xs font-normal text-amber-800">{sampleVendorPackageWarning(row)}</p>}
                      </label>
                    </div>
                    {expandedRows[row.id]&&<div className="blend-row-details text-xs text-slate-600"><p>{row.catalogItemId?`Catalog-assisted · ${row.catalogSource??'Catalog'}`:'Manual material entry'}</p>{row.catalogSnapshot.package_context!=null&&<p>Captured package: {(() => {const value=row.catalogSnapshot.package_context as {amount?:string;unit?:string;container?:string};return [value.amount,value.unit,value.container].filter(Boolean).join(' · ')||'See selected catalog material';})()}</p>}</div>}
                  </article>
                  {row.componentRole === "aggregate" && displayRows[displayIndex+1]?.row.componentRole !== "aggregate" && (
                    <div><p className="my-2 text-right text-sm font-bold">Total: {batch?.totalPercent??0}% · {formatBatchQuantity(batch?.subtotalLb??null,'lb')} lb</p><BusinessButton
                      type="button"
                      onClick={() => patch("blendRows", [...draft.blendRows, blankSampleBlendRow(draft.blendRows.length)])}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-dashed border-slate-400 bg-white px-3 text-sm font-bold sm:w-auto"
                    >
                      <Plus className="h-4 w-4" />
                      Add Aggregate
                    </BusinessButton></div>
                  )}
                  </div>
                ))}
              </div>}
            </section>
            <div id="sample-plate" tabIndex={-1} className="scroll-mt-28 space-y-3">
            <h2 className="text-lg font-bold">Sample Plate</h2><p className="text-sm text-slate-600">Scale the Batch formulation down for the Working Pour and finished pieces.</p>
            {draft.formulation.profile||draft.id?<SampleFormulationConfigurator
              state={draft.formulation}
              rows={draft.blendRows}
              resinSupplier={draft.resinSupplier}
              onChange={(formulation) => {
                const changed = batchFirst && ['length','width','thicknessIn','dimensionUnit','profile'].some(key=>JSON.stringify(formulation[key as keyof typeof formulation])!==JSON.stringify(draft.formulation[key as keyof typeof formulation]));
                if(changed) {setDraft({...draft,formulation,blendRows:draft.blendRows.map(row=>row.quantityProvenance==='manual'?{...row,quantity:'',quantityProvenance:row.componentRole==='other'?'manual':'calculated'}:row)});setMessage('Shop overrides reset for the new Working Pour or profile. Review preparation quantities before use.');}
                else patch("formulation", formulation);
              }}
              onApplyAdjustment={(formulation,targetFillerOz)=>setDraft(current=>current?{...current,formulation,blendRows:current.blendRows.map(row=>row.componentRole==='filler'?{...row,quantity:targetFillerOz,quantityProvenance:'manual'}:row)}:current)}
            />:<p className="text-sm text-amber-800">Select a Resin System to establish Batch quantities.</p>}
            {(draft.formulation.profile||draft.id)&&<section className="border border-slate-300 bg-white p-4">
              <p className="text-sm font-bold">View quantities as</p>
              <div role="group" aria-label="View quantities as" className="mt-2 inline-flex gap-1">
                {([['batch','Batch'],['working','Sample Plate']] as const).map(([view,title])=><button key={view} type="button" aria-pressed={quantityView===view} onClick={()=>setQuantityViewState({record:draft.id,view})} className={`min-h-11 border px-4 text-sm font-bold ${quantityView===view?'bg-blue-900 text-white':'bg-white text-slate-800'}`}>{title}</button>)}
              </div>
              {quantityView==='batch' && batch && <div className="mt-4" data-testid="batch-summary">
                <p className="text-xl font-bold">Batch chip target: {batch.target===null?'not captured':`${formatBatchQuantity(batch.target,'lb')} lb = 100%`}</p>
                <p className="mt-1 text-sm">{displayProfileRatio(draft.formulation.profile?.name)} · Operator-authored percentages define this chip blend.</p>
                <p className="mt-2 font-bold">{batch.complete?'TOTAL':'Calculated chip subtotal'}: {batch.totalPercent}% · {formatBatchQuantity(batch.subtotalLb,'lb')} lb</p>
                {batch.fraction!==null && <p className="text-sm">Working Pour fraction of Batch: {formatBatchQuantity(batch.fraction,'gal')}</p>}
                {batch.issues.map(issue=><p role="status" className="mt-1 text-sm text-amber-800" key={issue}>{issue}</p>)}
                <p className="mt-2 text-xs text-slate-600">{batchFirst ? "Canonical Batch quantities define Production. Working Pour and shop preparation quantities are downstream." : "Filler, Resin and Hardener are projected from this formulation. These equivalents do not prescribe whole-package rounding."}</p>
              </div>}
            </section>}
            {(draft.formulation.profile||draft.id)&&<div className="space-y-2">{displayRows.map(({row,sourceIndex:index})=><div key={row.id} className="grid gap-3 border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"><div className="text-sm"><strong className="capitalize">{row.componentRole}</strong><p>{row.color||'Material not selected'}</p></div>{quantityView==='batch'?<output className="font-bold">{formatBatchQuantity(batch?.rows[index]?.quantity??null,batch?.rows[index]?.unit??'')} {batch?.rows[index]?.unit}</output>:<>                      <div className={`${label} text-left`}>
                        <span>{batchFirst ? "Shop preparation quantity" : "Quantity"}</span>
                        <div className="relative mt-1">
                          <BusinessInput
                            aria-label={`${row.componentRole} quantity`}
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
                            className={`${field} mt-0 pr-14 ${row.quantityProvenance === "calculated" ? "bg-slate-100" : row.componentRole === "aggregate" || row.componentRole === "hardener" ? "border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/20" : "border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-950/20"}`}
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                            {row.componentRole === "resin" || row.componentRole === "hardener"
                              ? "fl oz"
                              : "oz"}
                          </span>
                        </div>
                        {batchFirst && <p className="mt-2 text-xs font-normal text-slate-600">Exact Working projection: {shopProjection?.rows[index]?.exact == null ? 'unavailable — canonical Batch requirement unresolved' : `${formatBatchQuantity(shopProjection.rows[index].exact,'oz')} ${row.componentRole==='resin'||row.componentRole==='hardener'?'fl oz':'oz'}`}. {shopProjection?.rows[index]?.source}.</p>}
                        <div className="mt-2 flex min-h-5 flex-wrap items-center gap-1.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${row.quantityProvenance === "calculated" ? "bg-slate-200 text-slate-700" : row.componentRole === "aggregate" || row.componentRole === "hardener" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>
                            {row.quantityProvenance === "manual"
                              ? row.componentRole === "aggregate" || row.componentRole === "hardener"
                                ? "Modified"
                                : "Authored"
                              : row.componentRole === "filler" || row.componentRole === "resin"
                                ? draft.formulation[row.componentRole === "filler" ? "fillerProvenance" : "resinProvenance"] === "restored"
                                  ? "Restored"
                                  : "Profile Default"
                                : "Calculated"}
                          </span>
                        </div>
                        <p className="mt-1 min-h-8 text-[11px] font-normal leading-4 text-slate-500">
                          {batchFirst && row.componentRole !== "aggregate" ? "Shop preparation only. Canonical Batch quantities remain unchanged." : row.componentRole === "aggregate"
                            ? row.quantityProvenance === "manual"
                              ? "Overrides the calculated Aggregate quantity"
                              : `${row.percentage || "0"}% × ${formulationResult?.availableChipMixOz || "0"} oz Chip Mix`
                            : row.componentRole === "filler"
                              ? row.quantityProvenance === "manual"
                                ? "Entered for this Sample"
                                : "Profile default"
                              : row.componentRole === "resin"
                                ? row.quantityProvenance === "manual"
                                  ? "Entered for this Sample"
                                  : "Profile-derived from production volume"
                                : row.componentRole === "hardener"
                                  ? row.quantityProvenance === "manual"
                                    ? "Overrides the calculated Hardener quantity"
                                    : `Calculated from ${normalizeSupportedSampleRatio(draft.formulation.resinParts,draft.formulation.hardenerParts)??`${draft.formulation.resinParts}:${draft.formulation.hardenerParts}`}`
                                  : "Entered for this Sample"}
                        </p>
                        {(row.componentRole === "aggregate" || row.componentRole === "filler" || row.componentRole === "resin" || row.componentRole === "hardener") && !(batchFirst && row.componentRole === "hardener") && (
                          <BusinessButton
                            type="button"
                            onClick={() => patchRow(index, {
                              quantityProvenance: row.quantityProvenance === "calculated" ? "manual" : "calculated",
                              calculationBasis: row.componentRole === "aggregate" && row.quantityProvenance === "manual" ? "target_total" : null,
                              quantity: row.quantityProvenance === "calculated" ? (formulationResult?.rows[index]?.calculatedQuantity || "") : row.quantity,
                              unit: row.componentRole === "resin" || row.componentRole === "hardener" ? "fl oz" : "oz",
                            })}
                            className="mt-1 inline-flex min-h-11 items-center justify-center rounded-sm border border-slate-300 bg-white px-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-700"
                          >
                            {row.quantityProvenance === "calculated"
                              ? "Enter manually"
                              : row.componentRole === "filler" || row.componentRole === "resin"
                                ? "Use profile default"
                                : "Use calculated value"}
                          </BusinessButton>
                        )}
                        {row.componentRole === "other" && row.quantityProvenance === "manual" && (
                          <label className="mt-2 block">
                            Unit
                            <PurchasingChoiceWithCustom
                              value={row.unit}
                              options={purchasingQuantityUnits}
                              onChange={(value) => patchRow(index, { unit: value })}
                              className={field}
                            />
                          </label>
                        )}
                      </div>
</>}</div>)}</div>}
            </div>
            <div id="production-planning" tabIndex={-1} className="scroll-mt-28">
            <ProductionBatchOutput mode="planner" onDocuments={()=>{setDocumentsOpen(true);jumpTo('sample-documents');}} onSample={()=>jumpTo('formulation-setup')} ref={productionRef} key={`batch-output:${draft.id}`} sample={draft} onDirtyChange={setBlendDirty} onSave={() => persistDraft(draft)} onPreview={(url,filename)=>setPreview({url,filename})}/>
            </div>
            <details id="sample-documents" tabIndex={-1} className="scroll-mt-28 space-y-3 border bg-white p-4" open={documentsOpen} onToggle={e=>setDocumentsOpen(e.currentTarget.open)}><summary className="cursor-pointer text-lg font-bold">Documents / History</summary>
            {documentsOpen&&draft.id&&<ProductionBatchOutput mode="documents" sample={draft} onDocuments={()=>{}} onSample={()=>jumpTo('formulation-setup')} onSave={()=>persistDraft(draft)} onPreview={(url,filename)=>setPreview({url,filename})}/>}
            <h2 className="font-bold">Recent Documents · Sample Work Order</h2>
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
                Sample Work Orders
              </h2>
              {draft.issuedDocuments.length>1&&<button type="button" className="min-h-11 text-sm font-bold underline" aria-expanded={sampleHistoryExpanded} onClick={()=>setSampleHistoryExpanded(!sampleHistoryExpanded)}>{sampleHistoryExpanded?'Show recent only':`Show all Sample Work Orders (${draft.issuedDocuments.length})`}</button>}
              {draft.issuedDocuments.length ? (
                <div className="mt-3 space-y-2">
                  {[...draft.issuedDocuments].sort((a,b)=>b.issuedAt.localeCompare(a.issuedAt)).slice(0,sampleHistoryExpanded?undefined:1).map((document) => (
                    <div
                      key={document.id}
                      className="flex flex-wrap items-center gap-3 border border-slate-200 p-3"
                    >
                      <FileText className="h-5 w-5 text-slate-500" />
                      <span className="min-w-0 flex-1 text-sm">
                        <strong>{document.displayIdentity||'Sample Work Order'} · {new Date(document.generatedAt || document.issuedAt).toLocaleString()}</strong>
                        <span className="block text-xs text-slate-500">
                          {new Date(document.generatedAt || document.issuedAt).toLocaleString()}{document.generationStatus !== "generated" ? " · " : ""}
                          {document.generationStatus === 'generated' ? '' : document.generationStatus === 'generating' || busy === `generate:${document.id}` ? 'Generating…' : document.generationStatus === 'failed' ? 'PDF unavailable — retry' : 'PDF delivery incomplete — retry'}
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
                                  filename: `${draft.colorPlateNumber || "Sample-Work-Order"}-Document-${document.issueNumber}.pdf`,
                                }),
                              )
                              .catch((caught) =>
                                showOperationError(caught, "issued-pdf"),
                              )
                          }
                          className="h-9 border border-slate-300 px-3 text-xs font-bold"
                        >
                          View
                        </button>
                      ) : (
                        <BusinessButton
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
                            : "Retry PDF"}
                        </BusinessButton>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  No generated Sample Work Orders yet.
                </p>
              )}
            </section>
            </details>
            <footer className="flex flex-wrap items-center gap-3 border border-slate-300 bg-white p-3">
              {draft.issuedDocuments.length ? (
                auth.profile?.role === "admin" ? (
                  <BusinessButton
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void deleteIssued()}
                    className="inline-flex h-10 items-center gap-2 border border-red-500 bg-red-50 px-4 text-sm font-bold text-red-800 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                    {busy === "delete-issued"
                      ? "Permanently deleting…"
                      : "Delete Sample and Generated Documents"}
                  </BusinessButton>
                ) : (
                  <span className="text-xs text-slate-500">
                    Generated Sample documents are protected from deletion.
                  </span>
                )
              ) : draft.id ? (
                <BusinessButton
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void deleteDraft()}
                  className="inline-flex h-10 items-center gap-2 border border-red-300 px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                  {busy === "delete" ? "Deleting…" : "Delete Draft"}
                </BusinessButton>
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
      {tutorialActive && draft?.formulation.calculationVersion === SAMPLE_FORMULATION_CALCULATION_VERSION && (
        <SampleFormulationTutorial
          step={tutorialStep}
          onStepChange={changeTutorialStep}
          onExit={() => setTutorialActive(false)}
          onShowAdvanced={() => {
            const toggle = document.querySelector<HTMLButtonElement>('[data-sample-tutorial="calculation-settings-toggle"]');
            if (toggle?.getAttribute("aria-expanded") !== "true") toggle?.click();
            window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-sample-tutorial="advanced-settings"]')?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
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
              <BusinessButton
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void saveAndClose()}
                className="min-h-11 bg-blue-900 px-4 text-sm font-bold text-white"
              >
                {busy === "save-close" ? "Saving…" : "Save Draft"}
              </BusinessButton>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
