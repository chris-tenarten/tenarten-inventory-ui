"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 1000;
const SHOW_ADMIN_ACTIONS = false;
const ENTERED_BY_STORAGE_KEY = "tenarten_inventory_entered_by";

const CATEGORY_OPTIONS = ["marble", "glass", "resin", "filler", "misc"];
const UNIT_OPTIONS = ["bag", "lb", "pail", "box", "pallet", "each", "system"];
const PRESET_SIZE_OPTIONS = ["#0", "#1", "#2", "#3", "#3-5", "#4", "#5-7"];

type StockAction = "add" | "remove" | "audit";
type ReservationAction = "none" | "reserve" | "release";

type CatalogSuggestion = {
  id: string;
  source: "standard" | "specialty";
  vendor: string;
  item_name: string;
  size: string;
  unit: string;
  category?: string | null;
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
  if (action === "remove") return "Stock removed";
  return "Audit correction";
}

function getTransactionType(action: StockAction) {
  if (action === "remove") return "outtake";
  if (action === "audit") return "adjustment";
  return "intake";
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
  const [vendor, setVendor] = useState(inventoryVendorParam);
  const [material, setMaterial] = useState(inventoryItemParam);
  const [size, setSize] = useState(inventorySizeParam);
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [location, setLocation] = useState("");
  const [palletNumber, setPalletNumber] = useState("");
  const [enteredBy, setEnteredBy] = useState("");
  const [note, setNote] = useState("");

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

  function resetForm() {
    setAction("add");
    setVendor(inventoryVendorParam);
    setMaterial(inventoryItemParam);
    setSize(inventorySizeParam);
    setCategory("");
    setQuantity("");
    setUnit("");
    setLocation("");
    setPalletNumber("");
    setNote("");
    setReservationAction("none");
    setJobName("");
    setReservationNote("");
  }

  async function findExistingInventoryItem() {
    const { data, error } = await supabase
      .from("inventory_items")
      .select(
        "id, vendor, color, size, quantity, unit, category, location, pallet_number, notes, earmarked_for_job, earmarked_job, earmark_notes",
      )
      .eq("vendor", vendor.trim())
      .eq("color", material.trim())
      .eq("size", size.trim() || "");

    if (error) throw error;

    const rows = (data || []) as InventoryItemRow[];
    return (
      rows.find(
        (row) => normalize(row.location) === normalize(location) && normalize(row.pallet_number) === normalize(palletNumber),
      ) || null
    );
  }

  async function writeTransaction(params: {
    type: "intake" | "outtake" | "adjustment";
    qty: number;
    notes: string;
    syncedAt: string | null;
    nowIso: string;
    reservationLogNote: string | null;
  }) {
    const { error } = await supabase.from("inventory_transactions").insert({
      transaction_type: params.type,
      vendor: vendor.trim(),
      item_name: material.trim(),
      size: size.trim() || null,
      unit: unit.trim(),
      quantity: params.qty,
      location: location.trim() || null,
      notes: params.notes,
      catalog_source: exactCatalogMatch?.source === "specialty" ? "specialty" : "standard",
      catalog_row_id: null,
      specialty_vendor_name: exactCatalogMatch?.source === "specialty" ? vendor.trim() : null,
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
      synced_to_inventory_at: params.syncedAt,
    });

    if (error) throw error;
  }

  async function handleSubmit() {
    setSubmitMessage("");

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

    if (!enteredBy.trim()) {
      setSubmitMessage("Your Name is required.");
      return;
    }

    const parsedQty = toQuantity(quantity);
    if (parsedQty === null || parsedQty <= 0) {
      setSubmitMessage("Quantity must be a positive number.");
      return;
    }

    if (reservationAction === "reserve" && !jobName.trim()) {
      setSubmitMessage("Job Name is required when reserving material.");
      return;
    }

    setIsSubmitting(true);

    try {
      window.localStorage.setItem(ENTERED_BY_STORAGE_KEY, enteredBy.trim());

      const nowIso = new Date().toISOString();
      const actionLabel = getActionLabel(action);
      const transactionHeader = formatNamedNote(enteredBy, `${actionLabel}: ${parsedQty} ${unit.trim()} ${material.trim()}`);
      const movementNote = note.trim() ? formatNamedNote(enteredBy, note) : null;
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
      if (location.trim()) transactionNoteParts.push(`Location: ${location.trim()}`);
      if (palletNumber.trim()) transactionNoteParts.push(`Pallet: ${palletNumber.trim()}`);
      if (category.trim()) transactionNoteParts.push(`Category: ${category.trim()}`);

      if (reservationAction === "reserve") {
        transactionNoteParts.push(`Reserved for job: ${jobName.trim()}`);
        if (reservationLogNote) transactionNoteParts.push(reservationLogNote);
      }

      if (reservationAction === "release") {
        transactionNoteParts.push("Reservation released");
        if (reservationLogNote) transactionNoteParts.push(reservationLogNote);
      }

      if (action === "add") {
        await writeTransaction({
          type: "intake",
          qty: parsedQty,
          notes: transactionNoteParts.join("\n"),
          syncedAt: null,
          nowIso,
          reservationLogNote,
        });

        setSubmitMessage("Intake recorded for audit sync. Inventory was not updated yet.");
        resetForm();
        return;
      }

      const existing = await findExistingInventoryItem();
      const existingQty = Number(existing?.quantity ?? 0);

      if (action === "remove" && !existing) {
        setSubmitMessage("No matching inventory item exists to remove stock from.");
        return;
      }

      let nextQty = existingQty;
      if (action === "remove") nextQty = Math.max(0, existingQty - parsedQty);
      if (action === "audit") nextQty = parsedQty;

      const inventoryPayload = {
        vendor: vendor.trim(),
        color: material.trim(),
        size: size.trim() || "",
        quantity: nextQty,
        unit: unit.trim(),
        category: category.trim(),
        location: location.trim() || null,
        pallet_number: palletNumber.trim() || null,
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

      if (action === "audit") transactionNoteParts.push(`Audit corrected count to: ${parsedQty}`);

      await writeTransaction({
        type: getTransactionType(action) as "outtake" | "adjustment",
        qty: parsedQty,
        notes: transactionNoteParts.join("\n"),
        syncedAt: nowIso,
        nowIso,
        reservationLogNote,
      });

      setSubmitMessage(action === "remove" ? "Stock removed and history recorded." : "Audit correction applied.");
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
    <div className="min-h-[calc(100vh-73px)] bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#f7f0d0]">Add Inventory</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Record intakes for audit sync, remove stock, reserve material, or record an admin correction.
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Intakes do not become available inventory until they are synced from the admin Audit Log.
          </p>
        </div>

        {loadError && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
            Failed to load material suggestions: {loadError}
          </div>
        )}

        {hasInventoryContext && (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="text-sm font-semibold text-[#f7f0d0]">Opened from Inventory</div>
            <p className="mt-2 text-sm text-neutral-300">
              This form was prefilled for {inventoryVendorParam || "—"} • {inventoryItemParam || "—"} • {inventorySizeParam || "—"}.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-neutral-300">Action</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setAction("add");
                  setSubmitMessage("");
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  action === "add"
                    ? "bg-[#c8a43a] text-black"
                    : "border border-neutral-700 bg-black text-neutral-300 hover:bg-neutral-900"
                }`}
              >
                Intake
              </button>

              <button
                type="button"
                onClick={() => {
                  setAction("remove");
                  setSubmitMessage("");
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  action === "remove"
                    ? "bg-[#c8a43a] text-black"
                    : "border border-neutral-700 bg-black text-neutral-300 hover:bg-neutral-900"
                }`}
              >
                Outtake
              </button>

              {SHOW_ADMIN_ACTIONS && (
                <button
                  type="button"
                  onClick={() => {
                    setAction("audit");
                    setSubmitMessage("");
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    action === "audit"
                      ? "bg-[#c8a43a] text-black"
                      : "border border-neutral-700 bg-black text-neutral-300 hover:bg-neutral-900"
                  }`}
                >
                  Audit Correction
                </button>
              )}
            </div>
          </div>

          {action === "add" && (
            <div className="mb-6 rounded-2xl border border-amber-800/60 bg-amber-950/20 p-4 text-sm text-amber-100">
              Intakes are recorded in the Audit Log first. Inventory is updated after an admin sync confirms the material was received.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">Vendor</label>
              <input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                list="vendor-suggestions"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                placeholder="Type or select vendor"
                disabled={isLoadingCatalog}
              />
              <datalist id="vendor-suggestions">
                {vendorSuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">Material</label>
              <input
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                list="material-suggestions"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                placeholder="Type or select material"
              />
              <datalist id="material-suggestions">
                {materialSuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">Size</label>
              <input
                value={size}
                onChange={(e) => setSize(e.target.value)}
                list="size-suggestions"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                placeholder="#1 / #2 / custom"
              />
              <datalist id="size-suggestions">
                {sizeSuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
              >
                <option value="">Select category</option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">Quantity</label>
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                placeholder="e.g. 20"
                inputMode="decimal"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">Unit</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                list="unit-suggestions"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                placeholder="bag / pail / lb"
              />
              <datalist id="unit-suggestions">
                {UNIT_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">Location</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                placeholder="New Factory / Rack A"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">Pallet #</label>
              <input
                value={palletNumber}
                onChange={(e) => setPalletNumber(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">Your Name</label>
              <input
                value={enteredBy}
                onChange={(e) => setEnteredBy(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                placeholder="Chris / Gio / Marcos"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-neutral-300">Note</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                placeholder="Optional note. Timestamp and name are added automatically."
              />
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-neutral-800 bg-black/30 p-4">
            <div className="mb-3 text-sm font-semibold text-[#f7f0d0]">Reservation</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setReservationAction("none")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  reservationAction === "none"
                    ? "bg-[#c8a43a] text-black"
                    : "border border-neutral-700 bg-black text-neutral-300 hover:bg-neutral-900"
                }`}
              >
                No Reservation Change
              </button>
              <button
                type="button"
                onClick={() => setReservationAction("reserve")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  reservationAction === "reserve"
                    ? "bg-[#c8a43a] text-black"
                    : "border border-neutral-700 bg-black text-neutral-300 hover:bg-neutral-900"
                }`}
              >
                Reserve For Job
              </button>
              <button
                type="button"
                onClick={() => setReservationAction("release")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  reservationAction === "release"
                    ? "bg-[#c8a43a] text-black"
                    : "border border-neutral-700 bg-black text-neutral-300 hover:bg-neutral-900"
                }`}
              >
                Release Reservation
              </button>
            </div>

            {reservationAction !== "none" && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {reservationAction === "reserve" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-300">Job Name</label>
                    <input
                      value={jobName}
                      onChange={(e) => setJobName(e.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                      placeholder="Job name or number"
                    />
                  </div>
                )}

                <div className={reservationAction === "reserve" ? "" : "md:col-span-2"}>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    {reservationAction === "release" ? "Release Note" : "Reservation Note"}
                  </label>
                  <input
                    value={reservationNote}
                    onChange={(e) => setReservationNote(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                    placeholder="Optional"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || isLoadingCatalog}
              className="rounded-xl bg-[#c8a43a] px-4 py-2.5 font-medium text-black transition hover:bg-[#d6b24a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : action === "add" ? "Record Intake" : action === "remove" ? "Record Outtake" : "Apply Correction"}
            </button>
            <button
              onClick={resetForm}
              className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2.5 font-medium text-white transition hover:border-neutral-600 hover:bg-neutral-900"
            >
              Reset
            </button>
          </div>

          {submitMessage && <div className="mt-3 text-sm text-neutral-300">{submitMessage}</div>}
        </div>
      </div>
    </div>
  );
}
