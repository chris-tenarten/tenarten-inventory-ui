"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type InventoryRow = {
  id: string | number;
  vendor: string | null;
  color: string | null;
  size: string | null;
  category: string | null;
  quantity: number | string | null;
  unit: string | null;
  location: string | null;
  pallet_number: string | null;
  notes: string | null;
  earmarked_for_job: boolean | null;
  earmarked_job: string | null;
  earmark_notes: string | null;
  updated_at?: string | null;
  last_counted_at?: string | null;
  last_counted_by?: string | null;
};

type CatalogAnnotationRow = {
  id?: string;
  vendor: string;
  item_name: string;
  size: string;
  notes: string | null;
  match_warning: string | null;
  appearance_notes?: string | null;
  annotated_by?: string | null;
  updated_at?: string | null;
};

type AdjustmentType = "add" | "remove" | "set_exact";

const LAST_ENTERED_BY_KEY = "tenarten_last_entered_by";
const ADMIN_STORAGE_KEY = "tenarten_admin_access";

function normalizeSearch(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function hasAnnotation(row: Partial<CatalogAnnotationRow>) {
  return Boolean(
    row.notes?.trim() ||
      row.match_warning?.trim() ||
      row.appearance_notes?.trim(),
  );
}

function formatQuantity(value: number | string | null) {
  if (value === null || typeof value === "undefined") return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return parsed.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatNamedNote(name: string, note: string) {
  const timestamp = new Date().toLocaleString();
  return `[${timestamp}] ${name.trim()}: ${note.trim()}`;
}

function appendNote(existing: string | null | undefined, noteEntry: string) {
  const current = existing?.trim();
  if (!current) return noteEntry;
  return `${current}\n\n${noteEntry}`;
}

function buildTransactionNote({
  enteredBy,
  reason,
  location,
  palletNumber,
  category,
}: {
  enteredBy: string;
  reason: string;
  location: string;
  palletNumber: string;
  category: string;
}) {
  const details = [
    reason.trim(),
    location.trim() ? `Location: ${location.trim()}` : "",
    palletNumber.trim() ? `Pallet: ${palletNumber.trim()}` : "",
    category.trim() ? `Category: ${category.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (!details) return null;
  return formatNamedNote(enteredBy, details);
}

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [recentAnnotations, setRecentAnnotations] = useState<
    CatalogAnnotationRow[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [showGuidance, setShowGuidance] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [editLocation, setEditLocation] = useState("");
  const [editPalletNumber, setEditPalletNumber] = useState("");
  const [editEnteredBy, setEditEnteredBy] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editReserved, setEditReserved] = useState(false);
  const [editEarmarkJob, setEditEarmarkJob] = useState("");
  const [editEarmarkNotes, setEditEarmarkNotes] = useState("");
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState("");

  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("remove");
  const [adjustmentQty, setAdjustmentQty] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [isApplyingAdjustment, setIsApplyingAdjustment] = useState(false);
  const [adjustmentMessage, setAdjustmentMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    const [inventoryResult, catalogResult] = await Promise.all([
      supabase
        .from("inventory_items")
        .select(
          "id, vendor, color, size, category, quantity, unit, location, pallet_number, notes, earmarked_for_job, earmarked_job, earmark_notes, updated_at, last_counted_at, last_counted_by",
        )
        .order("vendor", { ascending: true })
        .order("color", { ascending: true })
        .order("size", { ascending: true }),

      supabase
        .from("vendor_catalog")
        .select(
          "id, vendor, item_name, size, notes, match_warning, appearance_notes, annotated_by, updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(100),
    ]);

    if (inventoryResult.error || catalogResult.error) {
      const firstError = inventoryResult.error || catalogResult.error;
      console.error("Failed to load inventory:", firstError);
      setLoadError(firstError?.message || "Failed to load inventory.");
      setLoading(false);
      return;
    }

    setRows((inventoryResult.data as InventoryRow[]) || []);
    setRecentAnnotations(
      (((catalogResult.data as CatalogAnnotationRow[]) || []).filter(
        hasAnnotation,
      ) || []).slice(0, 6),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setEditEnteredBy(window.localStorage.getItem(LAST_ENTERED_BY_KEY) || "");
    setIsAdmin(window.localStorage.getItem(ADMIN_STORAGE_KEY) === "granted");
  }, []);

  const filteredRows = useMemo(() => {
    const q = normalizeSearch(search.trim());

    if (!q) return rows;

    return rows.filter((row) =>
      [
        row.vendor,
        row.color,
        row.size,
        row.category,
        row.quantity,
        row.unit,
        row.location,
        row.pallet_number,
        row.notes,
        row.earmarked_job,
        row.earmark_notes,
        row.last_counted_by,
      ]
        .map(normalizeSearch)
        .join(" ")
        .includes(q),
    );
  }, [rows, search]);

  const reservedCount = useMemo(
    () => rows.filter((row) => row.earmarked_for_job).length,
    [rows],
  );

  const totalQuantity = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const value = Number(row.quantity || 0);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0),
    [rows],
  );

  function getSelectedRow() {
    if (!selectedRowId) return null;
    return rows.find((row) => String(row.id) === selectedRowId) || null;
  }

  function openRow(row: InventoryRow) {
    const rowId = String(row.id);

    if (selectedRowId === rowId) {
      setSelectedRowId(null);
      setDetailsMessage("");
      setAdjustmentMessage("");
      return;
    }

    setSelectedRowId(rowId);
    setEditLocation(row.location || "");
    setEditPalletNumber(row.pallet_number || "");
    setEditNote("");
    setEditReserved(Boolean(row.earmarked_for_job));
    setEditEarmarkJob(row.earmarked_job || "");
    setEditEarmarkNotes(row.earmark_notes || "");
    setAdjustmentType("remove");
    setAdjustmentQty("");
    setAdjustmentReason("");
    setDetailsMessage("");
    setAdjustmentMessage("");
  }

  async function handleSaveDetails() {
    const row = getSelectedRow();
    if (!row) return;

    const enteredBy = editEnteredBy.trim();
    const note = editNote.trim();
    const earmarkNotes = editEarmarkNotes.trim();
    const earmarkJob = editEarmarkJob.trim();

    if ((note || earmarkNotes) && !enteredBy) {
      setDetailsMessage("Your name is required when adding a note.");
      return;
    }

    if (editReserved && !earmarkJob) {
      setDetailsMessage("Job name is required when material is reserved.");
      return;
    }

    if (enteredBy && typeof window !== "undefined") {
      window.localStorage.setItem(LAST_ENTERED_BY_KEY, enteredBy);
    }

    setIsSavingDetails(true);
    setDetailsMessage("");

    const nextNotes = note
      ? appendNote(row.notes, formatNamedNote(enteredBy, note))
      : row.notes || null;

    const nextEarmarkNotes = editReserved
      ? earmarkNotes
        ? appendNote(row.earmark_notes, formatNamedNote(enteredBy, earmarkNotes))
        : row.earmark_notes || null
      : null;

    const payload = {
      location: editLocation.trim() || null,
      pallet_number: editPalletNumber.trim() || null,
      notes: nextNotes,
      earmarked_for_job: editReserved,
      earmarked_job: editReserved ? earmarkJob : null,
      earmark_notes: nextEarmarkNotes,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("inventory_items")
      .update(payload)
      .eq("id", row.id);

    if (error) {
      console.error("Failed to save inventory details:", error);
      setDetailsMessage(error.message || "Failed to save inventory details.");
      setIsSavingDetails(false);
      return;
    }

    setRows((prev) =>
      prev.map((current) =>
        String(current.id) === String(row.id)
          ? {
              ...current,
              ...payload,
            }
          : current,
      ),
    );

    setEditNote("");
    setDetailsMessage("Changes saved.");
    setIsSavingDetails(false);
  }

  async function handleApplyAdjustment() {
    const row = getSelectedRow();
    if (!row) return;

    const qty = Number(adjustmentQty);
    const currentQty = Number(row.quantity || 0);
    const enteredBy = editEnteredBy.trim();
    const reason = adjustmentReason.trim();

    if (!enteredBy) {
      setAdjustmentMessage("Your name is required.");
      return;
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      setAdjustmentMessage("Quantity must be a positive number.");
      return;
    }

    if (adjustmentType === "set_exact" && !isAdmin) {
      setAdjustmentMessage("Set exact count is admin-only.");
      return;
    }

    if (enteredBy && typeof window !== "undefined") {
      window.localStorage.setItem(LAST_ENTERED_BY_KEY, enteredBy);
    }

    const vendor = row.vendor?.trim() || "";
    const itemName = row.color?.trim() || "";

    if (!vendor || !itemName) {
      setAdjustmentMessage("Vendor and material are required for adjustments.");
      return;
    }

    let nextQty = currentQty;
    let transactionType = "outtake";
    let syncedToInventoryAt: string | null = new Date().toISOString();

    if (adjustmentType === "add") {
      nextQty = currentQty;
      transactionType = "intake";
      syncedToInventoryAt = null;
    }

    if (adjustmentType === "remove") {
      nextQty = Math.max(0, currentQty - qty);
      transactionType = "outtake";
      syncedToInventoryAt = new Date().toISOString();
    }

    if (adjustmentType === "set_exact") {
      nextQty = qty;
      transactionType = "adjustment";
      syncedToInventoryAt = new Date().toISOString();
    }

    setIsApplyingAdjustment(true);
    setAdjustmentMessage("");

    try {
      if (adjustmentType !== "add") {
        const { error: updateError } = await supabase
          .from("inventory_items")
          .update({
            quantity: nextQty,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        if (updateError) {
          console.error("Failed to update quantity:", updateError);
          setAdjustmentMessage(updateError.message || "Failed to update quantity.");
          setIsApplyingAdjustment(false);
          return;
        }
      }

      const txNote = buildTransactionNote({
        enteredBy,
        reason:
          reason ||
          (adjustmentType === "add"
            ? "Inline stock addition submitted for validation."
            : adjustmentType === "remove"
              ? "Inline stock removal."
              : "Inline exact-count correction."),
        location: editLocation,
        palletNumber: editPalletNumber,
        category: row.category || "",
      });

      const { error: txError } = await supabase
        .from("inventory_transactions")
        .insert({
          transaction_type: transactionType,
          vendor,
          item_name: itemName,
          size: row.size || null,
          unit: row.unit || null,
          quantity: qty,
          location: editLocation.trim() || row.location || null,
          notes: txNote,
          catalog_source: "standard",
          catalog_row_id: null,
          mix_number: null,
          custom_mix_label: null,
          specialty_vendor_name: null,
          specialty_product_line: null,
          specialty_component_type: null,
          is_earmarked: Boolean(row.earmarked_for_job),
          earmarked_job_name: row.earmarked_job || null,
          earmarked_job_id: null,
          earmarked_at: null,
          earmark_released_at: null,
          earmark_notes: row.earmark_notes || null,
          synced_to_inventory_at: syncedToInventoryAt,
        });

      if (txError) {
        console.error("Failed to record transaction:", txError);
        setAdjustmentMessage(
          txError.message ||
            "Quantity may have changed, but failed to record transaction.",
        );
        setIsApplyingAdjustment(false);
        return;
      }

      if (adjustmentType !== "add") {
        setRows((prev) =>
          prev.map((current) =>
            String(current.id) === String(row.id)
              ? {
                  ...current,
                  quantity: nextQty,
                  updated_at: new Date().toISOString(),
                }
              : current,
          ),
        );
      }

      setAdjustmentQty("");
      setAdjustmentReason("");
      setAdjustmentMessage(
        adjustmentType === "add"
          ? "Stock addition submitted. It will appear in Activity Log as Needs Validation."
          : "Adjustment applied and transaction recorded.",
      );
    } finally {
      setIsApplyingAdjustment(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-89px)] bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#bda86a]">
              Current Stock
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#f7f0d0]">
              Inventory
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-neutral-400">
              Confirmed material currently available in inventory. Pending intakes appear in Activity Log until validated.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/transactions"
              className="rounded-xl border border-[#c8a43a]/60 bg-[#c8a43a]/10 px-4 py-2.5 text-sm font-semibold text-[#f0d98a] transition hover:bg-[#c8a43a]/20"
            >
              + Add Inventory
            </Link>

            <button
              type="button"
              onClick={() => setShowGuidance((prev) => !prev)}
              className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-900"
            >
              {showGuidance ? "Hide Guidance" : "Show Guidance"}
            </button>
          </div>
        </div>

        {showGuidance && (
          <div className="rounded-2xl border border-blue-800/60 bg-blue-950/20 p-4">
            <div className="text-sm font-semibold text-[#f7f0d0]">
              Inventory Guidance
            </div>
            <p className="mt-2 text-sm text-neutral-300">
              Inventory only shows confirmed stock. Click a row to update location, pallet, notes, or reservation details. Quantity changes are recorded through transactions.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500">
              Inventory Rows
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {rows.length.toLocaleString()}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500">
              Total Quantity
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {formatQuantity(totalQuantity)}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500">
              Reserved Rows
            </div>
            <div className="mt-2 text-2xl font-semibold text-purple-300">
              {reservedCount.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
          <label
            htmlFor="inventory-search"
            className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-neutral-500"
          >
            Search
          </label>
          <input
            id="inventory-search"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
            placeholder="Search vendor, material, size, category, location, pallet, reservation, or notes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {loadError && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
            {loadError}
          </div>
        )}

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-neutral-400">
              Loading inventory...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="border-b border-neutral-800 text-neutral-400">
                  <tr>
                    <th className="py-3 text-left font-medium">Vendor</th>
                    <th className="py-3 text-left font-medium">Material</th>
                    <th className="py-3 text-left font-medium">Size</th>
                    <th className="py-3 text-left font-medium">Category</th>
                    <th className="py-3 text-left font-medium">Location</th>
                    <th className="py-3 text-left font-medium">Pallet</th>
                    <th className="py-3 text-left font-medium">Qty</th>
                    <th className="py-3 text-left font-medium">Reservation</th>
                    <th className="w-[120px] py-3 text-left font-medium">
                      Edit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const isSelected = selectedRowId === String(row.id);

                    return (
                      <Fragment key={row.id}>
                        <tr
                          onClick={() => openRow(row)}
                          className={`cursor-pointer border-b border-neutral-900 transition hover:bg-neutral-900/50 ${
                            isSelected ? "bg-neutral-900/60" : ""
                          }`}
                        >
                          <td className="py-3 align-top text-neutral-200">
                            {row.vendor || "—"}
                          </td>
                          <td className="py-3 align-top">
                            <div className="font-medium text-white">
                              {row.color || "—"}
                            </div>
                            {row.notes?.trim() && (
                              <div className="mt-1 max-w-[320px] whitespace-pre-wrap text-xs text-neutral-500">
                                {row.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3 align-top text-neutral-300">
                            {row.size || "—"}
                          </td>
                          <td className="py-3 align-top">
                            {row.category ? (
                              <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300">
                                {row.category}
                              </span>
                            ) : (
                              <span className="text-neutral-600">—</span>
                            )}
                          </td>
                          <td className="py-3 align-top text-neutral-300">
                            {row.location || "—"}
                          </td>
                          <td className="py-3 align-top text-neutral-300">
                            {row.pallet_number || "—"}
                          </td>
                          <td className="py-3 align-top font-semibold text-green-300">
                            {formatQuantity(row.quantity)} {row.unit || ""}
                          </td>
                          <td className="py-3 align-top">
                            {row.earmarked_for_job ? (
                              <div className="space-y-1">
                                <span className="inline-flex rounded-full border border-purple-700/60 bg-purple-950/40 px-2 py-1 text-[11px] font-medium text-purple-300">
                                  Reserved
                                </span>
                                <div className="text-xs text-neutral-300">
                                  {row.earmarked_job || "Unnamed job"}
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-neutral-500">
                                General pool
                              </span>
                            )}
                          </td>
                          <td className="w-[120px] py-3 align-top">
                            <span className="text-xs text-[#c8a43a]">
                              {isSelected ? "Hide" : "Edit row"}
                            </span>
                          </td>
                        </tr>

                        {isSelected && (
                          <tr className="border-b border-neutral-900 bg-black/40">
                            <td colSpan={9} className="p-0">
                              <div className="m-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
                                <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                                  <div>
                                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                                      <div>
                                        <div className="text-base font-semibold text-[#f7f0d0]">
                                          Edit Inventory Details
                                        </div>
                                        <div className="mt-1 text-sm text-neutral-400">
                                          {row.vendor || "—"} • {row.color || "—"} • {row.size || "—"}
                                        </div>
                                      </div>

                                      <div className="rounded-xl border border-neutral-800 bg-black/40 px-3 py-2 text-sm">
                                        <span className="text-neutral-500">Current Qty:</span>{" "}
                                        <span className="font-semibold text-green-300">
                                          {formatQuantity(row.quantity)} {row.unit || ""}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                      <div>
                                        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                                          Location
                                        </label>
                                        <input
                                          value={editLocation}
                                          onChange={(event) => setEditLocation(event.target.value)}
                                          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                                          placeholder="e.g. Denton / Backstock / Aisle 2"
                                        />
                                      </div>

                                      <div>
                                        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                                          Pallet #
                                        </label>
                                        <input
                                          value={editPalletNumber}
                                          onChange={(event) => setEditPalletNumber(event.target.value)}
                                          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                                          placeholder="e.g. P-014"
                                        />
                                      </div>

                                      <div>
                                        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                                          Your Name
                                        </label>
                                        <input
                                          value={editEnteredBy}
                                          onChange={(event) => setEditEnteredBy(event.target.value)}
                                          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                                          placeholder="e.g. Chris"
                                        />
                                      </div>

                                      <div className="flex items-end">
                                        <label className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-neutral-800 bg-black/30 px-4 py-3 text-sm text-neutral-200">
                                          <input
                                            type="checkbox"
                                            checked={editReserved}
                                            onChange={(event) => setEditReserved(event.target.checked)}
                                            className="h-4 w-4 accent-[#c8a43a]"
                                          />
                                          Reserved for job
                                        </label>
                                      </div>

                                      {editReserved && (
                                        <>
                                          <div>
                                            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                                              Job Name
                                            </label>
                                            <input
                                              value={editEarmarkJob}
                                              onChange={(event) => setEditEarmarkJob(event.target.value)}
                                              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                                              placeholder="e.g. Bank of America Lobby"
                                            />
                                          </div>

                                          <div>
                                            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                                              Reservation Note
                                            </label>
                                            <input
                                              value={editEarmarkNotes}
                                              onChange={(event) => setEditEarmarkNotes(event.target.value)}
                                              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                                              placeholder="Optional note to append"
                                            />
                                          </div>
                                        </>
                                      )}

                                      <div className="md:col-span-2">
                                        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                                          Add Note
                                        </label>
                                        <textarea
                                          value={editNote}
                                          onChange={(event) => setEditNote(event.target.value)}
                                          rows={3}
                                          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                                          placeholder="Append a timestamped note to this inventory row"
                                        />
                                      </div>
                                    </div>

                                    {detailsMessage && (
                                      <div className="mt-3 rounded-xl border border-neutral-800 bg-black/40 p-3 text-sm text-neutral-300">
                                        {detailsMessage}
                                      </div>
                                    )}

                                    <div className="mt-4 flex flex-wrap gap-3">
                                      <button
                                        type="button"
                                        onClick={handleSaveDetails}
                                        disabled={isSavingDetails}
                                        className="rounded-xl border border-[#c8a43a] bg-[#c8a43a] px-4 py-2.5 text-sm font-medium text-black transition hover:bg-[#d6b24a] disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {isSavingDetails ? "Saving..." : "Save Details"}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => openRow(row)}
                                        className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-900"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-neutral-800 bg-black/30 p-4">
                                    <div className="text-sm font-semibold text-[#f7f0d0]">
                                      Quantity Adjustment
                                    </div>
                                    <p className="mt-1 text-xs text-neutral-500">
                                      Quantity changes are recorded as transactions. Add stock requires validation before it appears in Inventory.
                                    </p>

                                    <div className="mt-4 grid gap-3">
                                      <div className="inline-flex rounded-xl border border-neutral-800 bg-neutral-950 p-1">
                                        {(["add", "remove"] as AdjustmentType[]).map((type) => (
                                          <button
                                            key={type}
                                            type="button"
                                            onClick={() => setAdjustmentType(type)}
                                            className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition ${
                                              adjustmentType === type
                                                ? "bg-[#c8a43a] text-black"
                                                : "text-neutral-300 hover:bg-neutral-900"
                                            }`}
                                          >
                                            {type}
                                          </button>
                                        ))}

                                        {isAdmin && (
                                          <button
                                            type="button"
                                            onClick={() => setAdjustmentType("set_exact")}
                                            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                                              adjustmentType === "set_exact"
                                                ? "bg-purple-700 text-white"
                                                : "text-purple-200 hover:bg-purple-950/50"
                                            }`}
                                          >
                                            Set Exact
                                          </button>
                                        )}
                                      </div>

                                      <div>
                                        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                                          Quantity
                                        </label>
                                        <input
                                          value={adjustmentQty}
                                          onChange={(event) => setAdjustmentQty(event.target.value)}
                                          inputMode="decimal"
                                          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                                          placeholder="e.g. 5"
                                        />
                                      </div>

                                      <div>
                                        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                                          Reason / Note
                                        </label>
                                        <textarea
                                          value={adjustmentReason}
                                          onChange={(event) => setAdjustmentReason(event.target.value)}
                                          rows={3}
                                          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                                          placeholder="e.g. Used for Job 25-017"
                                        />
                                      </div>
                                    </div>

                                    {adjustmentMessage && (
                                      <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-300">
                                        {adjustmentMessage}
                                      </div>
                                    )}

                                    <button
                                      type="button"
                                      onClick={handleApplyAdjustment}
                                      disabled={isApplyingAdjustment}
                                      className="mt-4 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:border-[#c8a43a] hover:text-[#f7f0d0] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {isApplyingAdjustment
                                        ? "Applying..."
                                        : adjustmentType === "add"
                                          ? "Submit Add Stock"
                                          : adjustmentType === "remove"
                                            ? "Apply Remove Stock"
                                            : "Set Exact Count"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}

                  {filteredRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-10 text-center text-sm text-neutral-500"
                      >
                        No matching inventory rows found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Recent Catalog Notes
            </h2>
            <span className="text-xs text-neutral-500">
              Reference notes from the catalog
            </span>
          </div>

          {recentAnnotations.length === 0 ? (
            <div className="text-sm text-neutral-500">
              No recent catalog notes found.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recentAnnotations.map((row, index) => (
                <div
                  key={`${row.vendor}-${row.item_name}-${row.size}-${index}`}
                  className="rounded-xl border border-neutral-800 bg-black/30 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white">
                        {row.item_name}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {row.vendor} • {row.size || "—"}
                        {row.annotated_by?.trim()
                          ? ` • ${row.annotated_by}`
                          : ""}
                      </div>
                    </div>

                    <span className="rounded-full border border-yellow-700/60 bg-yellow-950/40 px-2 py-1 text-[11px] font-medium text-yellow-300">
                      Note
                    </span>
                  </div>

                  {row.match_warning?.trim() && (
                    <div className="mt-3">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-300">
                        Warning
                      </div>
                      <div className="text-xs leading-5 text-red-200">
                        {row.match_warning}
                      </div>
                    </div>
                  )}

                  {row.notes?.trim() && (
                    <div className="mt-3">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                        Notes
                      </div>
                      <div className="text-xs leading-5 text-neutral-300">
                        {row.notes}
                      </div>
                    </div>
                  )}

                  {row.appearance_notes?.trim() && (
                    <div className="mt-3">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                        Appearance
                      </div>
                      <div className="text-xs leading-5 text-neutral-400">
                        {row.appearance_notes}
                      </div>
                    </div>
                  )}

                  {row.updated_at && (
                    <div className="mt-3 text-[11px] text-neutral-600">
                      Updated {formatDate(row.updated_at)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
