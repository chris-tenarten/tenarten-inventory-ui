"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 1000;
const SHOW_ADMIN_ACTIONS = false;
const ENTERED_BY_STORAGE_KEY = "tenarten_inventory_entered_by";

const CATEGORY_OPTIONS = ["marble", "glass", "resin", "filler", "misc"];
const UNIT_OPTIONS = ["bag", "lb", "pail", "box", "pallet", "each", "system"];
const PRESET_SIZE_OPTIONS = ["#0", "#1", "#2", "#3", "#3-5", "#4", "#4-6", "#5-7"];

type StockAction = "add" | "remove" | "audit";
type ReservationAction = "none" | "reserve" | "release";
type EntryMode = "single" | "multi";

type CatalogSuggestion = {
  id: string;
  source: "standard" | "specialty";
  vendor: string;
  item_name: string;
  size: string;
  unit: string;
  category?: string | null;
};

type StockEntry = {
  vendor: string;
  material: string;
  size: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  palletNumber: string;
  note: string;
};

type LineItemDraft = {
  id: string;
  vendor: string;
  material: string;
  size: string;
  category: string;
  quantity: string;
  unit: string;
  location: string;
  palletNumber: string;
  note: string;
};

type InventoryItemRow = {
  id: number;
  vendor: string | null;
  color: string | null;
  size: string | null;
  quantity: number | string | null;
  unit: string | null;
  category: string | null;
  location: string | null;
  pallet_number: string | null;
  notes: string | null;
  earmarked_for_job: boolean | null;
  earmarked_job: string | null;
  earmark_notes: string | null;
};

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function toQuantity(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function appendNote(existing: string | null | undefined, next: string | null | undefined) {
  if (!next?.trim()) return existing || null;
  if (!existing?.trim()) return next.trim();
  return `${existing.trim()}\n\n${next.trim()}`;
}

function formatNamedNote(enteredBy: string, note: string) {
  const name = enteredBy.trim() || "Unknown";
  const body = note.trim();
  const timestamp = new Date().toLocaleString();
  if (!body) return `[${timestamp}] ${name}`;
  return `[${timestamp}] ${name}: ${body}`;
}

function getActionLabel(action: StockAction) {
  if (action === "add") return "Intake recorded";
  if (action === "remove") return "Outtake recorded";
  return "Exact count correction";
}

function getTransactionType(action: StockAction) {
  if (action === "remove") return "outtake";
  if (action === "audit") return "adjustment";
  return "intake";
}

function newLineItem(defaults?: Partial<LineItemDraft>): LineItemDraft {
  return {
    id: crypto.randomUUID(),
    vendor: defaults?.vendor || "",
    material: defaults?.material || "",
    size: defaults?.size || "",
    category: defaults?.category || "",
    quantity: defaults?.quantity || "",
    unit: defaults?.unit || "bag",
    location: defaults?.location || "Denton",
    palletNumber: defaults?.palletNumber || "",
    note: defaults?.note || "",
  };
}

function draftToEntry(draft: LineItemDraft): { entry?: StockEntry; error?: string } {
  const parsedQty = toQuantity(draft.quantity);

  if (!draft.vendor.trim()) return { error: "Vendor is required." };
  if (!draft.material.trim()) return { error: "Material is required." };
  if (!draft.category.trim()) return { error: "Category is required." };
  if (!CATEGORY_OPTIONS.includes(draft.category.trim())) return { error: "Choose a valid category." };
  if (!draft.unit.trim()) return { error: "Unit is required." };
  if (parsedQty === null || parsedQty <= 0) return { error: "Quantity must be a positive number." };

  return {
    entry: {
      vendor: draft.vendor.trim(),
      material: draft.material.trim(),
      size: draft.size.trim(),
      category: draft.category.trim(),
      quantity: parsedQty,
      unit: draft.unit.trim(),
      location: draft.location.trim(),
      palletNumber: draft.palletNumber.trim(),
      note: draft.note.trim(),
    },
  };
}

export default function TransactionsPage() {
  const searchParams = useSearchParams();

  const inventoryVendorParam = searchParams.get("vendor")?.trim() || "";
  const inventoryItemParam = searchParams.get("item_name")?.trim() || "";
  const inventorySizeParam = searchParams.get("size")?.trim() || "";
  const hasInventoryContext = Boolean(inventoryVendorParam || inventoryItemParam || inventorySizeParam);

  const [catalogRows, setCatalogRows] = useState<CatalogSuggestion[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [action, setAction] = useState<StockAction>("add");
  const [entryMode, setEntryMode] = useState<EntryMode>("single");

  const [vendor, setVendor] = useState(inventoryVendorParam);
  const [material, setMaterial] = useState(inventoryItemParam);
  const [size, setSize] = useState(inventorySizeParam);
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("bag");
  const [location, setLocation] = useState("Denton");
  const [palletNumber, setPalletNumber] = useState("");
  const [enteredBy, setEnteredBy] = useState("");
  const [note, setNote] = useState("");

  const [lineItems, setLineItems] = useState<LineItemDraft[]>([
    newLineItem({ vendor: inventoryVendorParam, material: inventoryItemParam, size: inventorySizeParam }),
  ]);

  const [reservationAction, setReservationAction] = useState<ReservationAction>("none");
  const [jobName, setJobName] = useState("");
  const [reservationNote, setReservationNote] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  useEffect(() => {
    setEnteredBy(window.localStorage.getItem(ENTERED_BY_STORAGE_KEY) || "");
  }, []);

  useEffect(() => {
    async function loadCatalogs() {
      setIsLoadingCatalog(true);
      setLoadError("");
      const allRows: CatalogSuggestion[] = [];

      let standardFrom = 0;
      while (true) {
        const { data, error } = await supabase
          .from("vendor_catalog")
          .select("id, vendor, item_name, size, unit")
          .order("vendor", { ascending: true })
          .order("item_name", { ascending: true })
          .range(standardFrom, standardFrom + PAGE_SIZE - 1);

        if (error) {
          setLoadError(error.message);
          setIsLoadingCatalog(false);
          return;
        }

        allRows.push(
          ...((data || []).map((row) => ({
            id: String(row.id),
            source: "standard" as const,
            vendor: row.vendor || "",
            item_name: row.item_name || "",
            size: row.size || "",
            unit: row.unit || "",
            category: null,
          })) as CatalogSuggestion[]),
        );

        if (!data || data.length < PAGE_SIZE) break;
        standardFrom += PAGE_SIZE;
      }

      let specialtyFrom = 0;
      while (true) {
        const { data, error } = await supabase
          .from("vendor_catalog_v2")
          .select("id, vendor_name, item_name, size, packaging, price_unit, material_type")
          .order("vendor_name", { ascending: true })
          .order("item_name", { ascending: true })
          .range(specialtyFrom, specialtyFrom + PAGE_SIZE - 1);

        if (error) {
          setLoadError(error.message);
          setIsLoadingCatalog(false);
          return;
        }

        allRows.push(
          ...((data || []).map((row) => ({
            id: String(row.id),
            source: "specialty" as const,
            vendor: row.vendor_name || "",
            item_name: row.item_name || "",
            size: row.size || "",
            unit: row.packaging || row.price_unit || "",
            category: row.material_type || null,
          })) as CatalogSuggestion[]),
        );

        if (!data || data.length < PAGE_SIZE) break;
        specialtyFrom += PAGE_SIZE;
      }

      setCatalogRows(allRows);
      setIsLoadingCatalog(false);
    }

    loadCatalogs();
  }, []);

  const vendorSuggestions = useMemo(() => uniqueSorted(catalogRows.map((row) => row.vendor)), [catalogRows]);
  const allMaterialSuggestions = useMemo(
    () => uniqueSorted(catalogRows.map((row) => row.item_name)).slice(0, 500),
    [catalogRows],
  );

  const vendorFilteredRows = useMemo(() => {
    if (!vendor.trim()) return catalogRows;
    return catalogRows.filter((row) => normalize(row.vendor) === normalize(vendor));
  }, [catalogRows, vendor]);

  const materialSuggestions = useMemo(
    () => uniqueSorted(vendorFilteredRows.map((row) => row.item_name)).slice(0, 300),
    [vendorFilteredRows],
  );

  const sizeSuggestions = useMemo(() => {
    const materialNorm = normalize(material);
    const catalogSizes = vendorFilteredRows
      .filter((row) => normalize(row.item_name) === materialNorm)
      .map((row) => row.size);
    return uniqueSorted([...catalogSizes, ...PRESET_SIZE_OPTIONS]).slice(0, 300);
  }, [vendorFilteredRows, material]);

  const exactCatalogMatch = useMemo(() => {
    if (!vendor.trim() || !material.trim()) return null;
    return (
      catalogRows.find(
        (row) =>
          normalize(row.vendor) === normalize(vendor) &&
          normalize(row.item_name) === normalize(material) &&
          normalize(row.size) === normalize(size),
      ) || null
    );
  }, [catalogRows, vendor, material, size]);

  useEffect(() => {
    if (!exactCatalogMatch) return;
    if (exactCatalogMatch.unit) setUnit((current) => current.trim() || exactCatalogMatch.unit);
    const suggestedCategory = normalize(exactCatalogMatch.category || "");
    if (CATEGORY_OPTIONS.includes(suggestedCategory)) setCategory((current) => current || suggestedCategory);
  }, [exactCatalogMatch]);

  const lineValidation = useMemo(() => lineItems.map((line) => draftToEntry(line)), [lineItems]);
  const validLineCount = useMemo(() => lineValidation.filter((line) => line.entry).length, [lineValidation]);
  const lineErrorCount = useMemo(() => lineValidation.filter((line) => line.error).length, [lineValidation]);

  function resetForm() {
    setAction("add");
    setVendor(inventoryVendorParam);
    setMaterial(inventoryItemParam);
    setSize(inventorySizeParam);
    setCategory("");
    setQuantity("");
    setUnit("bag");
    setLocation("Denton");
    setPalletNumber("");
    setNote("");
    setLineItems([newLineItem({ vendor: inventoryVendorParam, material: inventoryItemParam, size: inventorySizeParam })]);
    setReservationAction("none");
    setJobName("");
    setReservationNote("");
  }

  function updateLineItem(id: string, updates: Partial<LineItemDraft>) {
    setLineItems((current) => current.map((line) => (line.id === id ? { ...line, ...updates } : line)));
  }

  function addLineItem() {
    const last = lineItems[lineItems.length - 1];
    setLineItems((current) => [
      ...current,
      newLineItem({
        vendor: last?.vendor || vendor,
        category: last?.category || category,
        unit: last?.unit || unit || "bag",
        location: last?.location || location || "Denton",
      }),
    ]);
  }

  function removeLineItem(id: string) {
    setLineItems((current) => (current.length <= 1 ? current : current.filter((line) => line.id !== id)));
  }

  async function findExistingInventoryItem(entry: StockEntry) {
    const { data, error } = await supabase
      .from("inventory_items")
      .select(
        "id, vendor, color, size, quantity, unit, category, location, pallet_number, notes, earmarked_for_job, earmarked_job, earmark_notes",
      )
      .eq("vendor", entry.vendor.trim())
      .eq("color", entry.material.trim())
      .eq("size", entry.size.trim() || "");

    if (error) throw error;
    const rows = (data || []) as InventoryItemRow[];
    return (
      rows.find(
        (row) =>
          normalize(row.location) === normalize(entry.location) &&
          normalize(row.pallet_number) === normalize(entry.palletNumber),
      ) || null
    );
  }

  function findCatalogMatchForEntry(entry: StockEntry) {
    return (
      catalogRows.find(
        (row) =>
          normalize(row.vendor) === normalize(entry.vendor) &&
          normalize(row.item_name) === normalize(entry.material) &&
          normalize(row.size) === normalize(entry.size),
      ) || null
    );
  }

  async function writeTransaction(
    entry: StockEntry,
    params: {
      type: "intake" | "outtake" | "adjustment";
      qty: number;
      notes: string;
      nowIso: string;
      reservationLogNote: string | null;
    },
  ) {
    const catalogMatch = findCatalogMatchForEntry(entry);

    const { error } = await supabase.from("inventory_transactions").insert({
      transaction_type: params.type,
      vendor: entry.vendor.trim(),
      item_name: entry.material.trim(),
      size: entry.size.trim() || null,
      unit: entry.unit.trim(),
      quantity: params.qty,
      location: entry.location.trim() || null,
      notes: params.notes,
      catalog_source: catalogMatch?.source === "specialty" ? "specialty" : "standard",
      catalog_row_id: null,
      specialty_vendor_name: catalogMatch?.source === "specialty" ? entry.vendor.trim() : null,
      specialty_product_line: null,
      specialty_component_type: null,
      mix_number: null,
      custom_mix_label: null,
      is_earmarked: reservationAction === "reserve",
      earmarked_job_name: reservationAction === "reserve" ? jobName.trim() : null,
      earmarked_job_id: null,
      earmarked_at: reservationAction === "reserve" ? params.nowIso : null,
      earmark_released_at: reservationAction === "release" ? params.nowIso : null,
      earmark_notes: params.reservationLogNote,
      synced_to_inventory_at: params.nowIso,
    });

    if (error) throw error;
  }

  function getCurrentEntry(): StockEntry | null {
    const parsedQty = toQuantity(quantity);
    if (parsedQty === null) return null;
    return {
      vendor: vendor.trim(),
      material: material.trim(),
      size: size.trim(),
      category: category.trim(),
      quantity: parsedQty,
      unit: unit.trim(),
      location: location.trim(),
      palletNumber: palletNumber.trim(),
      note: note.trim(),
    };
  }

  async function processStockEntry(entry: StockEntry, nowIso: string) {
    const existing = await findExistingInventoryItem(entry);
    const existingQty = Number(existing?.quantity ?? 0);

    if (action === "remove" && !existing) {
      throw new Error(`No matching inventory item exists for ${entry.material} ${entry.size || ""}.`);
    }

    let nextQty = existingQty;
    if (action === "add") nextQty = existingQty + entry.quantity;
    if (action === "remove") nextQty = Math.max(0, existingQty - entry.quantity);
    if (action === "audit") nextQty = entry.quantity;

    const actionLabel = getActionLabel(action);
    const transactionHeader = formatNamedNote(
      enteredBy,
      `${actionLabel}: ${entry.quantity} ${entry.unit.trim()} ${entry.material.trim()}`,
    );
    const movementNote = entry.note.trim() ? formatNamedNote(enteredBy, entry.note) : null;

    const reservationLogNote = (() => {
      if (reservationAction === "none") return null;
      if (reservationAction === "release") {
        const releaseText = reservationNote.trim()
          ? `Reservation released. ${reservationNote.trim()}`
          : "Reservation released.";
        return formatNamedNote(enteredBy, releaseText);
      }
      const reserveText = reservationNote.trim()
        ? `Reserved for job ${jobName.trim()}. ${reservationNote.trim()}`
        : `Reserved for job ${jobName.trim()}.`;
      return formatNamedNote(enteredBy, reserveText);
    })();

    const transactionNoteParts = [transactionHeader];
    if (movementNote) transactionNoteParts.push(movementNote);
    if (entry.location.trim()) transactionNoteParts.push(`Location: ${entry.location.trim()}`);
    if (entry.palletNumber.trim()) transactionNoteParts.push(`Pallet: ${entry.palletNumber.trim()}`);
    if (entry.category.trim()) transactionNoteParts.push(`Category: ${entry.category.trim()}`);

    if (reservationAction === "reserve") {
      transactionNoteParts.push(`Reserved for job: ${jobName.trim()}`);
      if (reservationLogNote) transactionNoteParts.push(reservationLogNote);
    }
    if (reservationAction === "release") {
      transactionNoteParts.push("Reservation released");
      if (reservationLogNote) transactionNoteParts.push(reservationLogNote);
    }
    if (action === "audit") transactionNoteParts.push(`Exact count set to: ${entry.quantity}`);

    const inventoryPayload = {
      vendor: entry.vendor.trim(),
      color: entry.material.trim(),
      size: entry.size.trim() || "",
      quantity: nextQty,
      unit: entry.unit.trim(),
      category: entry.category.trim(),
      location: entry.location.trim() || null,
      pallet_number: entry.palletNumber.trim() || null,
      notes: appendNote(existing?.notes, movementNote),
      updated_at: nowIso,
      ...(action === "audit" ? { last_counted_at: nowIso, last_counted_by: enteredBy.trim() } : {}),
      ...(reservationAction === "reserve"
        ? {
            earmarked_for_job: true,
            earmarked_job: jobName.trim(),
            earmark_notes: appendNote(existing?.earmark_notes, reservationLogNote),
          }
        : {}),
      ...(reservationAction === "release"
        ? {
            earmarked_for_job: false,
            earmarked_job: null,
            earmark_notes: appendNote(existing?.earmark_notes, reservationLogNote),
          }
        : {}),
    };

    if (existing) {
      const { error } = await supabase.from("inventory_items").update(inventoryPayload).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("inventory_items").insert({ ...inventoryPayload, created_at: nowIso });
      if (error) throw error;
    }

    await writeTransaction(entry, {
      type: getTransactionType(action) as "intake" | "outtake" | "adjustment",
      qty: entry.quantity,
      notes: transactionNoteParts.join("\n"),
      nowIso,
      reservationLogNote,
    });
  }

  async function handleSubmit() {
    setSubmitMessage("");

    if (!enteredBy.trim()) {
      setSubmitMessage("Your Name is required.");
      return;
    }

    if (reservationAction === "reserve" && !jobName.trim()) {
      setSubmitMessage("Job Name is required when reserving material.");
      return;
    }

    let entries: StockEntry[] = [];

    if (entryMode === "multi") {
      const results = lineItems.map((line) => draftToEntry(line));
      const firstErrorIndex = results.findIndex((result) => result.error);
      if (firstErrorIndex >= 0) {
        setSubmitMessage(`Fix line ${firstErrorIndex + 1}: ${results[firstErrorIndex].error}`);
        return;
      }
      entries = results.map((result) => result.entry).filter((entry): entry is StockEntry => Boolean(entry));
      if (!entries.length) {
        setSubmitMessage("Add at least one line item.");
        return;
      }
    } else {
      if (!vendor.trim() || !material.trim() || !quantity.trim()) {
        setSubmitMessage("Vendor, material, and quantity are required.");
        return;
      }
      if (!category.trim()) {
        setSubmitMessage("Category is required.");
        return;
      }
      if (!CATEGORY_OPTIONS.includes(category)) {
        setSubmitMessage("Choose a valid category.");
        return;
      }
      if (!unit.trim()) {
        setSubmitMessage("Unit is required.");
        return;
      }
      const currentEntry = getCurrentEntry();
      if (!currentEntry || currentEntry.quantity <= 0) {
        setSubmitMessage("Quantity must be a positive number.");
        return;
      }
      entries = [currentEntry];
    }

    setIsSubmitting(true);

    try {
      window.localStorage.setItem(ENTERED_BY_STORAGE_KEY, enteredBy.trim());
      const nowIso = new Date().toISOString();

      for (const entry of entries) {
        await processStockEntry(entry, nowIso);
      }

      setSubmitMessage(
        entries.length > 1
          ? `${entries.length} line items saved. Inventory updated.`
          : action === "add"
            ? "Intake recorded. Inventory updated."
            : action === "remove"
              ? "Outtake recorded. Inventory updated."
              : "Exact count correction recorded.",
      );

      resetForm();
    } catch (error) {
      console.error("Failed to update inventory:", JSON.stringify(error, null, 2), error);
      const message =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message)
          : "Failed to update inventory.";
      setSubmitMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-73px)] bg-[#eef1f4] px-3 py-3 text-slate-950 sm:px-5 sm:py-5">
      <div className="mx-auto max-w-7xl border border-slate-400 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
        {loadError && (
          <div className="border-b border-red-300 bg-red-50 px-5 py-3 text-sm font-semibold text-red-800">
            Failed to load material suggestions: {loadError}
          </div>
        )}

        {hasInventoryContext && (
          <div className="border-b border-slate-300 bg-slate-100 px-5 py-3 text-sm text-slate-700">
            <span className="font-bold uppercase tracking-[0.14em] text-slate-600">Opened from Inventory</span>{" "}
            <span className="ml-2 text-slate-950">
              {inventoryVendorParam || "—"} / {inventoryItemParam || "—"} / {inventorySizeParam || "—"}
            </span>
          </div>
        )}

        <div className="grid gap-0 lg:grid-cols-[1fr_300px]">
          <div className="border-slate-300 lg:border-r">
            <div className="border-b border-slate-300 bg-[#f6f7f9] px-4 py-4 sm:px-5">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">Action</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    setAction("add");
                    setSubmitMessage("");
                  }}
                  className={`min-h-[68px] border px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.12em] transition ${
                    action === "add"
                      ? "tenops-selected-surface"
                      : "border-slate-400 bg-white text-slate-800 hover:border-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <span className="block text-lg normal-case tracking-normal">Intake</span>
                  <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.16em] opacity-80">
                    Add stock to inventory
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAction("remove");
                    setSubmitMessage("");
                  }}
                  className={`min-h-[68px] border px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.12em] transition ${
                    action === "remove"
                      ? "tenops-selected-surface"
                      : "border-slate-400 bg-white text-slate-800 hover:border-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <span className="block text-lg normal-case tracking-normal">Outtake</span>
                  <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.16em] opacity-80">
                    Remove stock from inventory
                  </span>
                </button>

                {SHOW_ADMIN_ACTIONS && (
                  <button
                    type="button"
                    onClick={() => {
                      setAction("audit");
                      setEntryMode("single");
                      setSubmitMessage("");
                    }}
                    className={`min-h-[68px] border px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.12em] transition ${
                      action === "audit"
                        ? "tenops-selected-surface"
                        : "border-slate-400 bg-white text-slate-800 hover:border-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <span className="block text-lg normal-case tracking-normal">Set Exact Count</span>
                    <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.16em] opacity-80">
                      Create correction transaction
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="border-b border-slate-300 bg-white px-4 py-3 sm:px-5">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">Line Items</div>
              <div className="grid max-w-md grid-cols-2 border border-slate-400 bg-white text-sm font-bold uppercase tracking-[0.12em]">
                {(["single", "multi"] as EntryMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setEntryMode(mode);
                      if (mode === "multi" && action === "audit") setAction("add");
                      setSubmitMessage("");
                    }}
                    className={`border-r border-slate-300 px-4 py-2.5 last:border-r-0 ${
                      entryMode === mode
                        ? "tenops-selected-surface"
                        : "bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {mode === "single" ? "Single" : "Multiple"}
                  </button>
                ))}
              </div>
            </div>

            {entryMode === "multi" ? (
              <div>
                <div className="flex items-center justify-between border-b border-slate-300 bg-[#dfe4ea] px-5 py-2">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-700">
                    Transaction Lines
                  </div>
                  <div className="text-xs font-bold text-slate-600">
                    {validLineCount} ready{lineErrorCount > 0 ? ` / ${lineErrorCount} needs review` : ""}
                  </div>
                </div>

                <div className="divide-y divide-slate-300 bg-slate-200">
                  {lineItems.map((line, index) => {
                    const validation = lineValidation[index];
                    return (
                      <div key={line.id} className="bg-white p-3 sm:p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
                              Line {index + 1}
                            </div>
                            {validation?.error && (
                              <div className="mt-1 text-xs font-bold text-red-700">{validation.error}</div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeLineItem(line.id)}
                            disabled={lineItems.length <= 1}
                            className="border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-red-700 transition hover:border-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-12">
                          <div className="md:col-span-2">
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                              Vendor
                            </label>
                            <input
                              value={line.vendor}
                              onChange={(e) => updateLineItem(line.id, { vendor: e.target.value })}
                              list="vendor-suggestions"
                              className="w-full border border-slate-400 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                              placeholder="Vendor"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                              Material
                            </label>
                            <input
                              value={line.material}
                              onChange={(e) => updateLineItem(line.id, { material: e.target.value })}
                              list="all-material-suggestions"
                              className="w-full border border-slate-400 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                              placeholder="Material"
                            />
                          </div>

                          <div className="md:col-span-1">
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                              Size
                            </label>
                            <input
                              value={line.size}
                              onChange={(e) => updateLineItem(line.id, { size: e.target.value })}
                              list="size-suggestions"
                              className="w-full border border-slate-400 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                              placeholder="#1"
                            />
                          </div>

                          <div className="md:col-span-1">
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                              Qty
                            </label>
                            <input
                              value={line.quantity}
                              onChange={(e) => updateLineItem(line.id, { quantity: e.target.value })}
                              inputMode="decimal"
                              className="w-full border border-slate-400 bg-white px-3 py-2 text-sm font-bold text-slate-950 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                              placeholder="20"
                            />
                          </div>

                          <div className="md:col-span-1">
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                              Unit
                            </label>
                            <input
                              value={line.unit}
                              onChange={(e) => updateLineItem(line.id, { unit: e.target.value })}
                              list="unit-suggestions"
                              className="w-full border border-slate-400 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                              placeholder="bag"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                              Category
                            </label>
                            <select
                              value={line.category}
                              onChange={(e) => updateLineItem(line.id, { category: e.target.value })}
                              className="w-full border border-slate-400 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                            >
                              <option value="">Select</option>
                              {CATEGORY_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="md:col-span-2">
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                              Location
                            </label>
                            <input
                              value={line.location}
                              onChange={(e) => updateLineItem(line.id, { location: e.target.value })}
                              className="w-full border border-slate-400 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                              placeholder="Denton"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                              Pallet
                            </label>
                            <input
                              value={line.palletNumber}
                              onChange={(e) => updateLineItem(line.id, { palletNumber: e.target.value })}
                              className="w-full border border-slate-400 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                              placeholder="Optional"
                            />
                          </div>

                          <div className="md:col-span-10">
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                              Note
                            </label>
                            <input
                              value={line.note}
                              onChange={(e) => updateLineItem(line.id, { note: e.target.value })}
                              className="w-full border border-slate-400 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                              placeholder="Optional line note"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-slate-300 bg-[#f6f7f9] px-4 py-3">
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="border border-slate-400 bg-white px-4 py-2.5 text-sm font-bold uppercase tracking-[0.12em] text-slate-800 transition hover:border-slate-900 hover:bg-slate-100"
                  >
                    + Add Line Item
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="border-b border-slate-300 bg-[#dfe4ea] px-5 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-700">
                  Material
                </div>

                <div className="grid gap-px bg-slate-300 sm:grid-cols-2">
                  <div className="bg-white p-3 sm:p-4">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Vendor</label>
                    <input
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                      list="vendor-suggestions"
                      className="w-full border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                      placeholder="Type or select vendor"
                      disabled={isLoadingCatalog}
                    />
                    <datalist id="vendor-suggestions">
                      {vendorSuggestions.map((suggestion) => (
                        <option key={suggestion} value={suggestion} />
                      ))}
                    </datalist>
                    <datalist id="all-material-suggestions">
                      {allMaterialSuggestions.map((suggestion) => (
                        <option key={suggestion} value={suggestion} />
                      ))}
                    </datalist>
                  </div>

                  <div className="bg-white p-3 sm:p-4">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Material</label>
                    <input
                      value={material}
                      onChange={(e) => setMaterial(e.target.value)}
                      list="material-suggestions"
                      className="w-full border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                      placeholder="Type or select material"
                    />
                    <datalist id="material-suggestions">
                      {materialSuggestions.map((suggestion) => (
                        <option key={suggestion} value={suggestion} />
                      ))}
                    </datalist>
                  </div>

                  <div className="bg-white p-3 sm:p-4">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Size</label>
                    <input
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      list="size-suggestions"
                      className="w-full border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                      placeholder="#1 / #2 / custom"
                    />
                    <datalist id="size-suggestions">
                      {sizeSuggestions.map((suggestion) => (
                        <option key={suggestion} value={suggestion} />
                      ))}
                    </datalist>
                  </div>

                  <div className="bg-white p-3 sm:p-4">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                    >
                      <option value="">Select category</option>
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border-b border-t border-slate-300 bg-[#dfe4ea] px-5 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-700">
                  Movement
                </div>

                <div className="grid gap-px bg-slate-300 sm:grid-cols-2">
                  <div className="bg-white p-3 sm:p-4">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Quantity</label>
                    <input
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                      placeholder="e.g. 20"
                      inputMode="decimal"
                    />
                  </div>

                  <div className="bg-white p-3 sm:p-4">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Unit</label>
                    <input
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      list="unit-suggestions"
                      className="w-full border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                      placeholder="bag / pail / lb"
                    />
                    <datalist id="unit-suggestions">
                      {UNIT_OPTIONS.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </div>

                  <div className="bg-white p-3 sm:p-4">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Location</label>
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                      placeholder="Denton / Rack A"
                    />
                  </div>

                  <div className="bg-white p-3 sm:p-4">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Pallet</label>
                    <input
                      value={palletNumber}
                      onChange={(e) => setPalletNumber(e.target.value)}
                      className="w-full border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                      placeholder="Optional"
                    />
                  </div>

                  <div className="bg-white p-3 sm:p-4">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Your Name</label>
                    <input
                      value={enteredBy}
                      onChange={(e) => setEnteredBy(e.target.value)}
                      className="w-full border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                      placeholder="Chris / Gio / Marcos"
                    />
                  </div>

                  <div className="bg-white p-3 sm:p-4 md:col-span-2">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Note</label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      className="w-full border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                      placeholder="Optional note. Timestamp and name are added automatically."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="bg-[#f6f7f9]">
            <div className="border-b border-slate-300 bg-[#dfe4ea] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-700">
              Reservation
            </div>

            <div className="space-y-4 p-4">
              {entryMode === "multi" && (
                <div className="border border-slate-300 bg-white p-3 text-xs leading-5 text-slate-600">
                  Reservation settings apply to every line item in this transaction.
                </div>
              )}

              <div className="grid grid-cols-3 border border-slate-400 bg-white">
                {(["none", "reserve", "release"] as ReservationAction[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setReservationAction(option)}
                    className={`border-r border-slate-300 px-2 py-2 text-xs font-bold uppercase tracking-[0.12em] last:border-r-0 ${
                      reservationAction === option ? "tenops-selected-surface" : "bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {option === "none" ? "None" : option}
                  </button>
                ))}
              </div>

              {reservationAction !== "none" && (
                <div className="space-y-4 border border-slate-300 bg-white p-3">
                  {reservationAction === "reserve" && (
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Job Name</label>
                      <input
                        value={jobName}
                        onChange={(e) => setJobName(e.target.value)}
                        className="w-full border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                        placeholder="Job name or number"
                      />
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                      {reservationAction === "release" ? "Release Note" : "Reservation Note"}
                    </label>
                    <input
                      value={reservationNote}
                      onChange={(e) => setReservationNote(e.target.value)}
                      className="w-full border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                      placeholder="Optional"
                    />
                  </div>
                </div>
              )}

              {entryMode === "multi" && (
                <div className="border border-slate-300 bg-white p-3 text-xs leading-5 text-slate-600">
                  <div className="font-bold uppercase tracking-[0.14em] text-slate-600">Operator</div>
                  <input
                    value={enteredBy}
                    onChange={(e) => setEnteredBy(e.target.value)}
                    className="mt-2 w-full border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                    placeholder="Chris / Gio / Marcos"
                  />
                </div>
              )}

              <div className="border border-slate-300 bg-white p-3 text-xs leading-5 text-slate-600">
                Corrections should be entered as a new movement, not by editing old Activity records. This keeps the inventory trail honest.
              </div>
            </div>
          </aside>
        </div>

        <div className="sticky bottom-0 z-20 flex flex-col gap-3 border-t border-slate-300 bg-[#f6f7f9]/95 px-4 py-3 backdrop-blur sm:static sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
          <div className="text-sm text-slate-700">
            {submitMessage ? (
              <span className="font-semibold text-slate-950">{submitMessage}</span>
            ) : entryMode === "multi" ? (
              <span>
                {lineItems.length} line item{lineItems.length === 1 ? "" : "s"} ready for review.
              </span>
            ) : (
              <span>Ready to save movement.</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={resetForm}
              className="w-full border border-slate-400 bg-white px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] text-slate-800 transition hover:border-slate-900 hover:bg-slate-100 sm:w-auto sm:py-2.5"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || isLoadingCatalog}
              className="w-full border border-slate-950 bg-slate-900 px-5 py-3 text-sm font-bold uppercase tracking-[0.12em] text-white transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:py-2.5"
            >
              {isSubmitting
                ? "Saving..."
                : entryMode === "multi"
                  ? `Save ${lineItems.length} Line${lineItems.length === 1 ? "" : "s"}`
                  : action === "add"
                    ? "Record Intake"
                    : action === "remove"
                      ? "Record Outtake"
                      : "Set Exact Count"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
