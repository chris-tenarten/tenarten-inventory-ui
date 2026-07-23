"use client";

import { Download, FileText, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import DocumentViewer from "@/components/documents/DocumentViewer";
import { JobTag } from "@/modules/production/components/JobTag";
import {
  formatProductionJobOptionWithStatus,
  loadProductionJobOptions,
  openProductionJob,
  type ProductionJobOption,
} from "@/modules/production/job-options";
import CatalogItemEditor from "./CatalogItemEditor";
import PendingReceivalsReviewDialog from "./PendingReceivalsReviewDialog";
import {
  calculatePurchaseOrderTotals,
  centsToMoney,
  lineTotalCents,
} from "./calculations";
import {
  samePurchasingVendor,
  searchPurchasingCatalog,
} from "./catalog";
import { getApplicableCatalogPrice } from "./catalog-pricing";
import { createChipLine } from "./defaults";
import {
  deletePurchaseOrderDraft,
  createPendingReceivalsFromPurchaseOrder,
  generatePurchaseOrderDraftPdf,
  generatePurchaseOrderPdf,
  getPurchaseOrderPdfPreviewUrl,
  issuePurchaseOrder,
  savePurchaseOrderDraft,
} from "./mutations";
import { getHistoricalPriceSuggestions } from "./pricing";
import { loadPurchaseOrderDocument, loadPurchaseOrderPendingReceivalProjection, loadVendors } from "./queries";
import type {
  PendingReceivalProposalLine,
  PriceSuggestion,
  PurchaseOrderDocument as PurchaseOrderPdfDocument,
  PurchaseOrderDraft,
  PurchaseOrderPendingReceivalProjection,
  PurchaseOrderLine,
  PurchasingCatalogSuggestion,
  VendorOption,
} from "./types";
import { validatePurchaseOrderDraft } from "./validation";

const field = "mt-1 h-10 w-full border border-slate-300 bg-white px-3 text-sm";
const label = "text-xs font-bold uppercase tracking-[0.08em] text-slate-600";

function LineEditor({
  line,
  index,
  vendorName,
  vendorId,
  vendors,
  onChange,
  onRemove,
  onDuplicate,
}: {
  line: PurchaseOrderLine;
  index: number;
  vendorName: string;
  vendorId: string;
  vendors: VendorOption[];
  onChange(line: PurchaseOrderLine): void;
  onRemove(): void;
  onDuplicate(): void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PurchasingCatalogSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [reference, setReference] =
    useState<PurchasingCatalogSuggestion | null>(null);
  const [priceSuggestions, setPriceSuggestions] = useState<PriceSuggestion[]>(
    [],
  );
  const [priceHistoryState, setPriceHistoryState] = useState<
    "idle" | "loading" | "empty" | "error"
  >("idle");
  const [catalogEditor, setCatalogEditor] = useState<
    "create" | "update" | "bulk" | "truckload" | null
  >(null);
  const searchRequest = useRef(0);
  const details = line.details;
  const set = (key: keyof typeof details, value: string) => {
    const changesCatalogIdentity = [
      "vendorSkuSnapshot",
      "materialNameSnapshot",
      "chipSize",
      "packageQuantity",
      "packageMeasure",
      "containerType",
    ].includes(key);
    if (changesCatalogIdentity) {
      setReference(null);
      setPriceSuggestions([]);
      setPriceHistoryState("idle");
    }
    onChange({
      ...line,
      details: {
        ...details,
        ...(changesCatalogIdentity
          ? { catalogSource: "", catalogItemId: "" }
          : {}),
        [key]: value,
      },
    });
  };
  useEffect(() => {
    const request = ++searchRequest.current;
    const timer = setTimeout(() => {
      if (query.trim().length < 2) {
        setResults([]);
        setSearchError("");
        return;
      }
      setSearching(true);
      setSearchError("");
      searchPurchasingCatalog(query, vendorName)
        .then((items) => {
          if (request === searchRequest.current) setResults(items);
        })
        .catch((error) => {
          if (request === searchRequest.current)
            setSearchError(
              error instanceof Error ? error.message : "Catalog search failed.",
            );
        })
        .finally(() => {
          if (request === searchRequest.current) setSearching(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, vendorName]);
  const select = (item: PurchasingCatalogSuggestion) => {
    const suggestion = getApplicableCatalogPrice(
      item,
      details.quantityOrdered,
      details.orderUnit,
    );
    onChange({
      ...line,
      details: {
        ...details,
        catalogSource: item.source,
        catalogItemId: item.id,
        vendorSkuSnapshot: item.vendorSku,
        materialNameSnapshot: item.materialName,
        chipSize: item.chipSize || details.chipSize,
        packageQuantity: item.packageQuantity || details.packageQuantity,
        packageMeasure: item.packageMeasure || details.packageMeasure,
        containerType: item.containerType || details.containerType,
        unitPrice: suggestion.price || details.unitPrice,
        priceBasis: item.priceBasis || details.priceBasis,
      },
    });
    setReference(item);
    setPriceSuggestions([]);
    setPriceHistoryState("idle");
    setQuery("");
    setResults([]);
    setCatalogEditor(null);
  };
  const loadPrices = async () => {
    setPriceHistoryState("loading");
    try {
      const suggestions = await getHistoricalPriceSuggestions(vendorName, details);
      setPriceSuggestions(suggestions);
      setPriceHistoryState(suggestions.length ? "idle" : "empty");
    } catch {
      setPriceSuggestions([]);
      setPriceHistoryState("error");
    }
  };
  const activeReference =
    reference && samePurchasingVendor(reference.vendor, vendorName)
      ? reference
      : null;
  const applicable = activeReference
    ? getApplicableCatalogPrice(
        activeReference,
        details.quantityOrdered,
        details.orderUnit,
      )
    : null;
  const canMaintainReference =
    Boolean(vendorId) &&
    Boolean(activeReference);
  const total = lineTotalCents(details.quantityOrdered, details.unitPrice);
  return (
    <section className="rounded-sm border border-slate-300 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="text-xs font-bold uppercase">Chip Line {index + 1}</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDuplicate}
            className="text-xs font-bold text-blue-700"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-bold text-red-700"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="m-3 border border-blue-200 bg-blue-50/60 p-3">
        <label className={label}>Search Catalog</label>
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full border border-slate-300 bg-white pl-9 pr-3 text-sm"
            placeholder="Search by material, SKU, vendor, or size..."
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Search to populate this line from the catalog.
        </p>
        {searching && <div className="mt-2 text-xs">Searching…</div>}
        {searchError && (
          <div role="alert" className="mt-2 text-xs font-bold text-red-700">
            {searchError}
          </div>
        )}
        {query.trim().length >= 2 && !searching && (
          <div className="mt-2 overflow-hidden border border-slate-200 bg-white">
            {results.map((item) => (
              <button
                key={`${item.source}-${item.id}`}
                type="button"
                onClick={() => select(item)}
                className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-slate-50"
              >
                <b>{item.materialName}</b> · {item.chipSize || "No size"}
                <span className="block text-slate-500">
                  {item.vendor}
                  {item.vendorSku ? ` · ${item.vendorSku}` : ""}
                  {item.referencePrice ? ` · $${item.referencePrice}` : ""}
                </span>
              </button>
            ))}
            {results.length === 0 && (
              <div className="p-3 text-xs text-slate-500">
                No matching catalog items. You can continue with freeform
                fields.
              </div>
            )}
            <button
              type="button"
              onClick={() => setCatalogEditor("create")}
              className="w-full bg-slate-50 px-3 py-2 text-left text-xs font-bold text-blue-700"
            >
              + Create Vendor Catalog Item
            </button>
          </div>
        )}
      </div>
      {catalogEditor && (
        <CatalogItemEditor
          vendors={vendors}
          defaultVendorId={vendorId}
          existing={
            catalogEditor !== "create" && activeReference
              ? activeReference
              : undefined
          }
          suggestedMode={catalogEditor === "truckload" ? "truckload" : catalogEditor === "bulk" ? "bulk" : applicable?.mode}
          proposedPrice={details.unitPrice}
          onCancel={() => setCatalogEditor(null)}
          onSaved={select}
        />
      )}
      <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={label}>
          Material
          <input
            value={details.materialNameSnapshot}
            onChange={(e) => set("materialNameSnapshot", e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Vendor SKU
          <input
            value={details.vendorSkuSnapshot}
            onChange={(e) => set("vendorSkuSnapshot", e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Chip Size
          <input
            value={details.chipSize}
            onChange={(e) => set("chipSize", e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Moisture
          <select
            value={details.moistureCondition}
            onChange={(e) => set("moistureCondition", e.target.value)}
            className={field}
          >
            <option value="">Not specified</option>
            <option value="dry">Dry</option>
            <option value="damp">Damp</option>
            <option value="wet">Wet</option>
          </select>
        </label>
        <label className={label}>
          Amount Per Container
          <input
            inputMode="decimal"
            value={details.packageQuantity}
            onChange={(e) => set("packageQuantity", e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Measure
          <input
            value={details.packageMeasure}
            onChange={(e) => set("packageMeasure", e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Container Type
          <input
            value={details.containerType}
            onChange={(e) => set("containerType", e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Quantity Ordered
          <input
            inputMode="decimal"
            value={details.quantityOrdered}
            onChange={(e) => set("quantityOrdered", e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Order Unit
          <input
            value={details.orderUnit}
            onChange={(e) => set("orderUnit", e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Unit Price
          <input
            inputMode="decimal"
            value={details.unitPrice}
            onChange={(e) => set("unitPrice", e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Price Basis
          <input
            value={details.priceBasis}
            onChange={(e) => set("priceBasis", e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Line Total
          <input
            readOnly
            value={total === null ? "—" : `$${centsToMoney(total)}`}
            className={`${field} bg-slate-50`}
          />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Line Notes
          <input
            value={details.notes}
            onChange={(e) => set("notes", e.target.value)}
            className={field}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-3 py-2 text-xs">
        {activeReference && (
          <>
            <span>
              {applicable?.mode === "truckload" ? "Truckload" : applicable?.mode === "bulk" ? "Bulk" : "Individual"} catalog
              suggestion:{" "}
              <b>
                {applicable?.price
                  ? `$${applicable.price}`
                  : applicable?.mode === "individual"
                    ? "No saved price"
                    : "Call for pricing"}
              </b>{" "}
              {activeReference.priceBasis}
            </span>
            {applicable?.price && (
              <button
                type="button"
                onClick={() => set("unitPrice", applicable.price)}
                className="font-bold text-blue-700"
              >
                Use Price
              </button>
            )}
            {canMaintainReference && (
              <>
                <button
                  type="button"
                  onClick={() => setCatalogEditor("update")}
                  className="font-bold text-blue-700"
                >
                  {activeReference.source === "standard"
                    ? "Save as Individual Catalog Price"
                    : applicable?.mode === "truckload"
                      ? "Update Truckload Pricing"
                    : applicable?.mode === "bulk"
                      ? "Update Bulk Pricing"
                      : "Update Individual Catalog Price"}
                </button>
                {applicable?.mode !== "bulk" && !activeReference.bulkMinimumQuantity && (
                  <button
                    type="button"
                    onClick={() => setCatalogEditor("bulk")}
                    className="font-bold text-blue-700"
                  >
                    Configure Bulk Pricing
                  </button>
                )}
                {applicable?.mode !== "truckload" && !activeReference.truckloadMinimumQuantity && (
                  <button
                    type="button"
                    onClick={() => setCatalogEditor("truckload")}
                    className="font-bold text-blue-700"
                  >
                    Configure Truckload Pricing
                  </button>
                )}
              </>
            )}
          </>
        )}
        <button
          type="button"
          onClick={() => void loadPrices()}
          className="font-bold text-blue-700"
        >
          {priceHistoryState === "loading" ? "Loading Historical Prices…" : "View Historical Prices"}
        </button>
        {priceHistoryState === "empty" && (
          <span className="text-slate-500">No issued PO price history was found for this Vendor and material.</span>
        )}
        {priceHistoryState === "error" && (
          <span role="alert" className="font-bold text-red-700">Historical prices could not be loaded. Try again.</span>
        )}
        {priceSuggestions.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => set("unitPrice", item.amount)}
            className="border border-slate-300 px-2 py-1"
          >
            {item.label}: ${item.amount}
          </button>
        ))}
      </div>
    </section>
  );
}

export function PurchaseOrderEditor({
  initial,
  onClose,
  onSaved,
  onDeleted,
  onIssued,
}: {
  initial: PurchaseOrderDraft;
  onClose(): void;
  onSaved(id: string): void;
  onDeleted(id: string): void;
  onIssued(id: string): void;
}) {
  const [draft, setDraft] = useState(initial);
  const [jobs, setJobs] = useState<ProductionJobOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [pdfDocument, setPdfDocument] = useState<PurchaseOrderPdfDocument | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pendingReceivalProjection, setPendingReceivalProjection] =
    useState<PurchaseOrderPendingReceivalProjection | null>(null);
  const [pendingReceivalReviewOpen, setPendingReceivalReviewOpen] = useState(false);
  const [pendingReceivalLoading, setPendingReceivalLoading] = useState(false);
  const [pendingReceivalSaving, setPendingReceivalSaving] = useState(false);
  const original = useRef(JSON.stringify(initial));
  const issuanceInFlight = useRef(false);
  const dirty = JSON.stringify(draft) !== original.current;
  const readOnly = draft.status === "issued";
  const refreshPdfDocument = async (issuanceId = draft.issuanceId) => {
    if (!issuanceId) return null;
    const document = await loadPurchaseOrderDocument(issuanceId);
    setPdfDocument(document);
    return document;
  };
  const refreshPendingReceivalProjection = async (issuanceId = draft.issuanceId) => {
    if (!issuanceId) return null;
    const projection = await loadPurchaseOrderPendingReceivalProjection(issuanceId);
    setPendingReceivalProjection(projection);
    return projection;
  };
  useEffect(() => {
    if (!readOnly || !draft.issuanceId) return;
    refreshPdfDocument().catch((error) => setErrors([
      error instanceof Error ? error.message : "Unable to load permanent PDF status.",
    ]));
  // refresh only when the immutable issuance changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, draft.issuanceId]);
  useEffect(() => {
    if (!readOnly || !draft.issuanceId || pdfDocument?.status !== "generated") return;
    refreshPendingReceivalProjection().catch((error) => setErrors([
      error instanceof Error ? error.message : "Unable to load Pending Receival status.",
    ]));
  // refresh only after this immutable issuance has a generated document
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, draft.issuanceId, pdfDocument?.status]);
  useEffect(() => {
    Promise.all([
      loadProductionJobOptions({ includeArchived: false }),
      loadVendors(),
    ])
      .then(([jobRows, vendorRows]) => {
        setJobs(jobRows);
        setVendors(vendorRows);
      })
      .catch((error) =>
        setErrors([
          error instanceof Error
            ? error.message
            : "Unable to load editor options.",
        ]),
      );
  }, []);
  const totals = useMemo(
    () =>
      calculatePurchaseOrderTotals(
        draft.lines.map((line) => ({
          quantityOrdered: line.details.quantityOrdered,
          unitPrice: line.details.unitPrice,
        })),
        draft.discountPercent,
        draft.taxPercent,
        draft.freight,
      ),
    [draft],
  );
  const setHeader = <K extends keyof PurchaseOrderDraft>(
    key: K,
    value: PurchaseOrderDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  const selectHeaderJob = (id: string) => {
    const job = jobs.find((item) => item.id === id);
    setDraft((current) => ({
      ...current,
      productionJobId: id,
      jobNumberSnapshot: job?.job_number || "",
      jobNameSnapshot: job?.name || "",
      requestedDate:
        current.requestedDate || job?.requested_delivery_date || "",
      lines: current.lines.map((line) => ({
        ...line,
        details: {
          ...line.details,
          productionJobId: line.details.productionJobId || id,
        },
      })),
    }));
  };
  const selectVendor = (name: string) => {
    const option = vendors.find(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );
    setDraft((current) => {
      const vendorChanged =
        current.vendorNameSnapshot.trim().toLowerCase() !==
        name.trim().toLowerCase();
      return {
        ...current,
        vendorId: option?.id || "",
        vendorNameSnapshot: name,
        vendorAddressSnapshot:
          option?.address || current.vendorAddressSnapshot,
        vendorContactSnapshot: option?.contact || "",
        paymentTermsSnapshot:
          option?.paymentTerms || current.paymentTermsSnapshot,
        lines: vendorChanged
          ? current.lines.map((line) => ({
              ...line,
              details: {
                ...line.details,
                catalogSource: "",
                catalogItemId: "",
              },
            }))
          : current.lines,
      };
    });
  };
  const selectContact = (id: string) => {
    const vendor = vendors.find((item) => item.id === draft.vendorId);
    const contact = vendor?.contacts.find((item) => item.id === id);
    if (contact)
      setHeader(
        "vendorContactSnapshot",
        [contact.contactName, contact.role, contact.email, contact.phone]
          .filter(Boolean)
          .join(" · "),
      );
  };
  const requestClose = () => {
    if (dirty && !window.confirm("Discard unsaved Purchase Order changes?"))
      return;
    onClose();
  };
  const save = async () => {
    if (readOnly) return;
    const found = validatePurchaseOrderDraft(draft);
    if (found.length) {
      setErrors(found);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      const id = await savePurchaseOrderDraft(draft);
      onSaved(id);
    } catch (error) {
      setErrors([
        error instanceof Error
          ? error.message
          : "Unable to save Purchase Order draft.",
      ]);
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!draft.id) return;
    const identity = [
      draft.poNumber && `PO ${draft.poNumber}`,
      draft.vendorNameSnapshot,
      draft.jobNameSnapshot,
      draft.orderDate,
    ]
      .filter(Boolean)
      .join(" · ");
    if (
      !window.confirm(
        `Delete this saved draft?\n\n${identity}\n\nThis removes its draft lines and cannot be undone.`,
      )
    )
      return;
    setDeleting(true);
    setErrors([]);
    try {
      await deletePurchaseOrderDraft(
        draft.id,
        draft.createdBy || draft.updatedBy || "AI",
      );
      onDeleted(draft.id);
    } catch (error) {
      setErrors([
        error instanceof Error
          ? error.message
          : "Unable to delete Purchase Order draft.",
      ]);
      setDeleting(false);
    }
  };
  const generatePdf = async (issuanceId = draft.issuanceId) => {
    if (!issuanceId || pdfLoading) return false;
    setPdfLoading(true);
    setPdfDocument((current) => current ? {
      ...current,
      status:"generating",
      generationStartedAt:new Date().toISOString(),
      lastError:"",
    } : current);
    setErrors([]);
    try {
      await generatePurchaseOrderPdf(issuanceId, draft.createdBy || draft.issuedBy || "AI");
      await refreshPdfDocument(issuanceId);
      setMessage("Permanent Purchase Order PDF generated from the immutable issuance snapshot.");
      return true;
    } catch (error) {
      await refreshPdfDocument(issuanceId).catch(() => null);
      setErrors([
        `The Purchase Order remains Issued, but its permanent PDF could not be generated: ${
          error instanceof Error ? error.message : "Unknown PDF generation error."
        }`,
      ]);
      return false;
    } finally {
      setPdfLoading(false);
    }
  };
  const openGeneratedPdf = async () => {
    if (!draft.issuanceId || pdfLoading) return;
    setPdfLoading(true);
    setErrors([]);
    try {
      setPdfUrl(await getPurchaseOrderPdfPreviewUrl(draft.issuanceId));
      setPreview(true);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to open the permanent PDF."]);
    } finally {
      setPdfLoading(false);
    }
  };
  const openDraftPdf = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    setErrors([]);
    try {
      const blob = await generatePurchaseOrderDraftPdf(draft);
      setPdfUrl(URL.createObjectURL(blob));
      setPreview(true);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to preview the Draft PDF."]);
    } finally {
      setPdfLoading(false);
    }
  };
  const openPendingReceivalReview = async () => {
    if (!draft.issuanceId || pendingReceivalLoading) return;
    setPendingReceivalLoading(true);
    setErrors([]);
    try {
      await refreshPendingReceivalProjection(draft.issuanceId);
      setPendingReceivalReviewOpen(true);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to prepare Pending Receivals."]);
    } finally {
      setPendingReceivalLoading(false);
    }
  };
  const createPendingReceivals = async (lines: PendingReceivalProposalLine[]) => {
    if (!draft.issuanceId || pendingReceivalSaving) return;
    setPendingReceivalSaving(true);
    setErrors([]);
    setMessage("");
    try {
      const results = await createPendingReceivalsFromPurchaseOrder(
        draft.issuanceId,
        lines,
        draft.createdBy || draft.issuedBy || "AI",
      );
      const createdCount = results.filter(result => result.creationStatus === "created").length;
      await refreshPendingReceivalProjection(draft.issuanceId);
      setPendingReceivalReviewOpen(false);
      setMessage(
        createdCount > 0
          ? `${createdCount} Pending Receival${createdCount === 1 ? "" : "s"} created from PO ${draft.poNumber}.`
          : "These Purchase Order lines already have Pending Receivals.",
      );
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to create Pending Receivals. No rows were created."]);
    } finally {
      setPendingReceivalSaving(false);
    }
  };
  const issue = async () => {
    if (!draft.id || readOnly || issuanceInFlight.current) return;
    if (dirty) {
      setErrors(["Save your latest changes before issuing this Purchase Order."]);
      return;
    }
    if (!draft.poNumber.trim()) {
      setErrors(["Enter and save a unique Purchase Order number before issuing."]);
      return;
    }
    if (!draft.vendorId) {
      setErrors(["Select a configured Vendor before issuing."]);
      return;
    }
    if (!draft.createdBy.trim()) {
      setErrors(["PO Originated By is required before issuing."]);
      return;
    }
    if (
      !window.confirm(
        "Issue this Purchase Order?\n\nThis will freeze the current PO as an issued record. Editing issued Purchase Orders is not supported yet.",
      )
    )
      return;
    issuanceInFlight.current = true;
    setIssuing(true);
    setErrors([]);
    setMessage("");
    try {
      const result = await issuePurchaseOrder(
        draft.id,
        draft.createdBy,
        draft.updatedAt,
      );
      const next = {
        ...draft,
        status: "issued" as const,
        issuedAt: result.issuedAt,
        issuedBy: result.issuedBy,
        issuanceId: result.issuanceId,
        snapshotHash: result.snapshotHash,
      };
      setDraft(next);
      original.current = JSON.stringify(next);
      setPdfDocument({
        id:"", issuanceId:result.issuanceId, status:"pending", snapshotHash:result.snapshotHash,
        storageBucket:"purchase-order-documents", storagePath:"", documentVersion:"po-pdf-v2",
        templateName:draft.documentTemplate || "tenops", templateVersion:1,
        generationStartedAt:"", generatedAt:"", failedAt:"", lastError:"", attemptCount:0,
      });
      setMessage("Purchase Order issued successfully. Generating its permanent PDF…");
      onIssued(draft.id);
      await generatePdf(result.issuanceId);
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : typeof error === "object" &&
              error !== null &&
              "message" in error &&
              typeof error.message === "string"
            ? error.message
            : "Unable to issue Purchase Order.";
      setErrors([
        /changed since|stale|updated/i.test(detail)
          ? "This draft changed after you opened it. Reload and review the latest changes before issuing."
          : detail,
      ]);
    } finally {
      issuanceInFlight.current = false;
      setIssuing(false);
    }
  };
  const pendingReceivalCreatedCount =
    pendingReceivalProjection?.lines.filter(line => line.alreadyCreated).length ?? 0;
  const pendingReceivalRemainingCount =
    pendingReceivalProjection?.lines.filter(line => line.eligible && !line.alreadyCreated).length ?? 0;
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/40 p-2">
      <div className="mx-auto min-h-full max-w-[1500px] bg-[#eef1f4] shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-white p-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-500">
              Chip Purchase Order · {readOnly ? "Issued" : "Draft"}
            </div>
            <h2 className="text-xl font-bold">
              {draft.id ? "Edit Purchase Order" : "New Purchase Order"}
            </h2>
            <div className="mt-1 text-sm text-slate-600">
              {draft.poNumber ? (
                <b>{draft.poNumber}</b>
              ) : (
                "Purchase Order number not assigned"
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => readOnly ? void openGeneratedPdf() : void openDraftPdf()}
              disabled={pdfLoading || (readOnly && pdfDocument?.status !== "generated")}
              className="h-9 border border-blue-700 bg-white px-3 text-sm font-bold text-blue-800"
            >
              {readOnly ? "View Issued PDF" : "Preview Draft PDF"}
            </button>
            <button
              type="button"
              onClick={requestClose}
              className="h-9 border border-slate-400 bg-white px-3 text-sm font-bold"
            >
              Close
            </button>
          </div>
        </header>
        {errors.length > 0 && (
          <div
            role="alert"
            className="border-b border-red-300 bg-red-50 p-3 text-sm text-red-800"
          >
            {errors.map((error) => (
              <div key={error}>{error}</div>
            ))}
          </div>
        )}
        {message && (
          <div role="status" className="border-b border-emerald-300 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
            {message}
          </div>
        )}
        <div className="grid gap-4 p-3 lg:grid-cols-[1fr_320px]">
          <main className="space-y-3">
            <fieldset disabled={readOnly} className="space-y-3 disabled:opacity-80">
            <section className="grid gap-3 rounded-sm border border-slate-300 bg-white p-3 md:grid-cols-[260px_1fr]">
              <label className={label}>
                Document Template
                <select
                  value={draft.documentTemplate || "tenops"}
                  onChange={(event) => setHeader("documentTemplate", event.target.value as PurchaseOrderDraft["documentTemplate"])}
                  className={field}
                >
                  <option value="tenops">TenOps</option>
                  <option value="classic">Classic</option>
                </select>
              </label>
              <div className="self-end pb-2 text-sm text-slate-600">
                {draft.documentTemplate === "classic"
                  ? "Classic — Based on the original company Purchase Order."
                  : "TenOps — Current streamlined TenOps layout."}
              </div>
            </section>
            <section className="grid gap-3 rounded-sm border border-slate-300 bg-white p-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className={label}>
                  Job Reference / Link Production Job
                </label>
                <select
                  value={draft.productionJobId}
                  onChange={(e) => selectHeaderJob(e.target.value)}
                  className={field}
                >
                  <option value="">General / multiple jobs</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {formatProductionJobOptionWithStatus(job)}
                    </option>
                  ))}
                </select>
                {draft.productionJobId && (
                  <JobTag
                    className="mt-2"
                    label={`${draft.jobNumberSnapshot ? `${draft.jobNumberSnapshot} — ` : ""}${draft.jobNameSnapshot || "Production Job"}`}
                    onClick={() => openProductionJob(draft.productionJobId)}
                  />
                )}
              </div>
              <div>
                <label className={label}>Job Number</label>
                <input
                  value={draft.jobNumberSnapshot}
                  readOnly
                  className={`${field} bg-slate-50`}
                  placeholder="From linked job"
                />
              </div>
              <div>
                <label className={label}>Purchase Order Number</label>
                <input
                  value={draft.poNumber}
                  readOnly
                  className={`${field} bg-slate-50`}
                  placeholder="Assigned when saved"
                />
              </div>
              <div>
                <label className={label}>Vendor</label>
                <input
                  list="po-vendor-options"
                  value={draft.vendorNameSnapshot}
                  onChange={(e) => selectVendor(e.target.value)}
                  className={field}
                />
                <datalist id="po-vendor-options">
                  {vendors.map((v) => (
                    <option key={v.id} value={v.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className={label}>PO Date</label>
                <input
                  type="date"
                  value={draft.orderDate}
                  onChange={(e) => setHeader("orderDate", e.target.value)}
                  className={field}
                />
              </div>
              <div>
                <label className={label}>Date Requested</label>
                <input
                  type="date"
                  value={draft.requestedDate}
                  onChange={(e) => setHeader("requestedDate", e.target.value)}
                  className={field}
                />
              </div>
              <div>
                <label className={label}>PO Originated By</label>
                <input
                  value={draft.createdBy}
                  onChange={(e) => setHeader("createdBy", e.target.value)}
                  className={field}
                />
              </div>
              <div className="md:col-span-2">
                <label className={label}>Vendor Address</label>
                <textarea
                  value={draft.vendorAddressSnapshot}
                  onChange={(e) =>
                    setHeader("vendorAddressSnapshot", e.target.value)
                  }
                  rows={3}
                  className="mt-1 w-full border border-slate-300 p-2 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className={label}>Vendor Contact</label>
                {draft.vendorId && !draft.vendorContactSnapshot.trim() && (
                  <select
                    defaultValue=""
                    onChange={(e) => selectContact(e.target.value)}
                    className={field}
                  >
                    <option value="">Select configured contact…</option>
                    {vendors
                      .find((v) => v.id === draft.vendorId)
                      ?.contacts.filter((c) => c.isActive)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.contactName}
                          {c.role ? ` — ${c.role}` : ""}
                        </option>
                      ))}
                  </select>
                )}
                <input
                  value={draft.vendorContactSnapshot}
                  onChange={(e) =>
                    setHeader("vendorContactSnapshot", e.target.value)
                  }
                  className={field}
                  placeholder="Editable contact snapshot"
                />
              </div>
              <div className="md:col-span-2">
                <label className={label}>Ship To</label>
                <textarea
                  value={draft.shipToSnapshot}
                  onChange={(e) => setHeader("shipToSnapshot", e.target.value)}
                  rows={2}
                  className="mt-1 w-full border border-slate-300 p-2 text-sm"
                />
              </div>
              <div>
                <label className={label}>Payment Terms</label>
                <input
                  value={draft.paymentTermsSnapshot}
                  onChange={(e) =>
                    setHeader("paymentTermsSnapshot", e.target.value)
                  }
                  className={field}
                />
              </div>
              <div>
                <label className={label}>Authorized By</label>
                <textarea
                  value={draft.authorizedBySnapshot}
                  onChange={(e) =>
                    setHeader("authorizedBySnapshot", e.target.value)
                  }
                  rows={2}
                  className="mt-1 w-full border border-slate-300 p-2 text-sm"
                />
              </div>
            </section>
            {draft.lines.map((line, index) => (
              <LineEditor
                key={line.id || index}
                line={line}
                index={index}
                vendorName={draft.vendorNameSnapshot}
                vendorId={draft.vendorId}
                vendors={vendors}
                onChange={(next) =>
                  setDraft((current) => ({
                    ...current,
                    lines: current.lines.map((candidate, i) =>
                      i === index ? next : candidate,
                    ),
                  }))
                }
                onRemove={() =>
                  setDraft((current) => ({
                    ...current,
                    lines: current.lines
                      .filter((_, i) => i !== index)
                      .map((item, i) => ({ ...item, lineNumber: i + 1 })),
                  }))
                }
                onDuplicate={() =>
                  setDraft((current) => ({
                    ...current,
                    lines: [
                      ...current.lines.slice(0, index + 1),
                      { ...line, id: undefined, details: { ...line.details } },
                      ...current.lines.slice(index + 1),
                    ].map((item, i) => ({ ...item, lineNumber: i + 1 })),
                  }))
                }
              />
            ))}
            <button
              type="button"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  lines: [
                    ...current.lines,
                    createChipLine(current.lines.length + 1),
                  ],
                }))
              }
              className="h-9 border border-slate-400 bg-white px-4 text-sm font-bold"
            >
              + Add Chip Line
            </button>
            </fieldset>
          </main>
          <aside className="space-y-3">
            {readOnly && (
              <section className="border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
                <div className="font-bold">Issued Purchase Order</div>
                <div className="mt-1">Issued by {draft.issuedBy || "recorded actor"}{draft.issuedAt ? ` on ${new Date(draft.issuedAt).toLocaleString()}` : ""}</div>
                {draft.snapshotHash && <div className="mt-2 break-all font-mono text-[10px] text-emerald-800">Snapshot {draft.snapshotHash}</div>}
              </section>
            )}
            <fieldset disabled={readOnly} className="space-y-3 disabled:opacity-80">
            <section className="rounded-sm border border-slate-300 bg-white p-3">
              <h3 className="text-sm font-bold">Purchase Order Summary</h3>
              <dl className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-sm">
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd className="font-bold">
                    ${centsToMoney(totals.subtotal)}
                  </dd>
                </div>
                <label className={label}>
                  Discount %
                  <input
                    value={draft.discountPercent}
                    onChange={(e) =>
                      setHeader("discountPercent", e.target.value)
                    }
                    className={field}
                  />
                </label>
                <label className={label}>
                  Sales Tax %
                  <input
                    value={draft.taxPercent}
                    onChange={(e) => setHeader("taxPercent", e.target.value)}
                    className={field}
                  />
                </label>
                <label className={label}>
                  Freight
                  <input
                    value={draft.freight}
                    onChange={(e) => setHeader("freight", e.target.value)}
                    className={field}
                  />
                </label>
                <div className="flex justify-between border-t border-slate-300 pt-3 text-base font-bold">
                  <dt>Total</dt>
                  <dd>
                    {totals.total === null
                      ? "Invalid"
                      : `$${centsToMoney(totals.total)}`}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="rounded-sm border border-slate-300 bg-white p-3">
              <label className={label}>
                Additional Notes &amp; Special Conditions
                <textarea
                  value={draft.commercialNotes}
                  onChange={(e) => setHeader("commercialNotes", e.target.value)}
                  rows={4}
                  className="mt-1 w-full border border-slate-300 p-2 text-sm"
                />
              </label>
              <label className={`${label} mt-3 block`}>
                Internal Notes · Not printed
                <textarea
                  value={draft.internalNotes}
                  onChange={(e) => setHeader("internalNotes", e.target.value)}
                  rows={4}
                  className="mt-1 w-full border border-slate-300 p-2 text-sm"
                />
              </label>
            </section>
            </fieldset>
            {!readOnly && <button
              type="button"
              onClick={() => void save()}
              disabled={saving || deleting || issuing}
              className="h-11 w-full bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? "Saving Draft…" : "Save Draft"}
            </button>}
            {draft.id && !readOnly && (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={saving || deleting || issuing}
                className="h-10 w-full border border-red-400 bg-white px-4 text-sm font-bold text-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting Draft…" : "Delete Saved Draft"}
              </button>
            )}
            {draft.id && !readOnly && (
              <button
                type="button"
                onClick={() => void issue()}
                disabled={saving || deleting || issuing || dirty}
                className="h-11 w-full border border-blue-800 bg-blue-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                title={dirty ? "Save your latest changes before issuing." : undefined}
              >
                {issuing ? "Issuing Purchase Order…" : "Issue Purchase Order"}
              </button>
            )}
            {readOnly && (
              <section className="rounded-sm border border-slate-300 bg-white p-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-600" />
                  <div className="text-xs font-bold uppercase tracking-[0.08em] text-slate-700">
                    Permanent PDF
                  </div>
                  <span className={`ml-auto border px-2 py-1 text-[10px] font-bold uppercase ${
                    pdfDocument?.status === "generated"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : pdfDocument?.status === "failed"
                        ? "border-red-300 bg-red-50 text-red-800"
                        : "border-amber-300 bg-amber-50 text-amber-800"
                  }`}>
                    {pdfDocument?.status || "Pending"}
                  </span>
                </div>
                {pdfDocument?.generatedAt && (
                  <div className="mt-2 text-xs text-slate-500">
                    Generated {new Date(pdfDocument.generatedAt).toLocaleString()}
                  </div>
                )}
                {pdfDocument?.lastError && (
                  <div role="alert" className="mt-2 text-xs font-bold text-red-700">
                    {pdfDocument.lastError}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  {pdfDocument?.status === "generated" ? (
                    <button type="button" disabled={pdfLoading} onClick={() => void openGeneratedPdf()} className="inline-flex h-9 flex-1 items-center justify-center gap-2 border border-blue-700 bg-blue-700 px-3 text-xs font-bold text-white disabled:opacity-50">
                      <Download className="h-4 w-4" />Open / Download
                    </button>
                  ) : (
                    <button type="button" disabled={pdfLoading} onClick={() => void generatePdf()} className="inline-flex h-9 flex-1 items-center justify-center gap-2 border border-blue-700 bg-blue-700 px-3 text-xs font-bold text-white disabled:opacity-50">
                      <RefreshCw className={`h-4 w-4 ${pdfLoading ? "animate-spin" : ""}`} />
                      {pdfDocument?.status === "failed" ? "Retry PDF Generation" : "Generate PDF"}
                    </button>
                  )}
                </div>
              </section>
            )}
            {readOnly && pdfDocument?.status === "generated" && (
              <section className="rounded-sm border border-slate-300 bg-white p-3">
                <div className="text-xs font-bold uppercase tracking-[0.08em] text-slate-700">
                  Pending Receivals
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  {pendingReceivalProjection
                    ? pendingReceivalRemainingCount > 0
                      ? `${pendingReceivalRemainingCount} eligible line${pendingReceivalRemainingCount === 1 ? "" : "s"} remaining.`
                      : pendingReceivalCreatedCount > 0
                        ? "Pending Receivals have been created for every eligible line."
                        : "This PO has no eligible material lines."
                    : "Checking Purchase Order lines…"}
                </div>
                <div className="mt-3 grid gap-2">
                  {(pendingReceivalRemainingCount > 0 || !pendingReceivalProjection) && (
                    <button
                      type="button"
                      disabled={pendingReceivalLoading}
                      onClick={() => void openPendingReceivalReview()}
                      className="h-9 border border-blue-800 bg-blue-700 px-3 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {pendingReceivalLoading
                        ? "Loading…"
                        : pendingReceivalCreatedCount > 0
                          ? "Create Remaining Lines"
                          : "Create Pending Receivals"}
                    </button>
                  )}
                  {pendingReceivalCreatedCount > 0 && (
                    <a
                      href="/inventory#pending-receivals"
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-9 items-center justify-center border border-slate-400 bg-white px-3 text-xs font-bold text-slate-800"
                    >
                      View Pending Receivals
                    </a>
                  )}
                </div>
              </section>
            )}
            <p className="text-xs text-slate-500">
              {readOnly
                ? "This issued record, its PDF source snapshot, and its PO-to-receival provenance are immutable."
                : "Saving does not issue a PO, create a PDF, or create Pending Receivals."}
            </p>
          </aside>
        </div>
      </div>
      {preview && (
        <DocumentViewer
          title={readOnly ? "Issued Purchase Order" : "Purchase Order Preview"}
          filename={`${draft.poNumber || "UNNUMBERED"}-${readOnly ? "ISSUED" : "DRAFT"}.pdf`}
          metadata={readOnly ? "Immutable issued Purchase Order" : "Current editor values · not issued"}
          url={pdfUrl}
          mimeType="application/pdf"
          onClose={() => {
            if (!readOnly && pdfUrl.startsWith("blob:")) URL.revokeObjectURL(pdfUrl);
            setPreview(false);
            setPdfUrl("");
          }}
        />
      )}
      {pendingReceivalReviewOpen && pendingReceivalProjection && (
        <PendingReceivalsReviewDialog
          initial={pendingReceivalProjection}
          saving={pendingReceivalSaving}
          onClose={() => setPendingReceivalReviewOpen(false)}
          onCreate={createPendingReceivals}
        />
      )}
    </div>
  );
}
