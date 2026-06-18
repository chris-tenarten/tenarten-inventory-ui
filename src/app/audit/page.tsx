"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const ACCESS_STORAGE_KEY = "tenarten_internal_access";

type TransactionRow = {
  id: string;
  created_at: string | null;
  transaction_type: string | null;
  vendor: string | null;
  specialty_vendor_name: string | null;
  item_name: string | null;
  size: string | null;
  unit: string | null;
  quantity: number | string | null;
  location: string | null;
  notes: string | null;
  catalog_source: string | null;
  is_earmarked: boolean | null;
  earmarked_job_name: string | null;
  earmark_notes: string | null;
  synced_to_inventory_at: string | null;
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

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function appendNote(existing: string | null | undefined, next: string | null | undefined) {
  if (!next?.trim()) return existing || null;
  if (!existing?.trim()) return next.trim();
  return `${existing.trim()}\n\n${next.trim()}`;
}

function getDisplayVendor(row: TransactionRow) {
  if (row.catalog_source === "specialty") {
    return row.specialty_vendor_name?.trim() || row.vendor?.trim() || "";
  }
  return row.vendor?.trim() || row.specialty_vendor_name?.trim() || "";
}

function parseNoteValue(notes: string | null | undefined, label: string) {
  if (!notes) return "";
  const regex = new RegExp(`^${label}:\\s*(.+)$`, "im");
  const match = notes.match(regex);
  return match?.[1]?.trim() || "";
}

function getTxStatus(row: TransactionRow) {
  if (row.transaction_type === "intake") {
    return row.synced_to_inventory_at ? "Synced" : "Pending Sync";
  }

  if (row.transaction_type === "outtake") return "Applied";
  if (row.transaction_type === "adjustment") return "Applied";
  return row.synced_to_inventory_at ? "Applied" : "Pending Review";
}

function getStatusClass(status: string) {
  if (status === "Pending Sync") return "border-amber-700/60 bg-amber-950/40 text-amber-300";
  if (status === "Synced") return "border-emerald-700/60 bg-emerald-950/40 text-emerald-300";
  return "border-blue-700/60 bg-blue-950/40 text-blue-300";
}

export default function AuditPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    setIsAdmin(window.localStorage.getItem(ACCESS_STORAGE_KEY) === "granted");
    setIsReady(true);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    const { data, error } = await supabase
      .from("inventory_transactions")
      .select(
        "id, created_at, transaction_type, vendor, specialty_vendor_name, item_name, size, unit, quantity, location, notes, catalog_source, is_earmarked, earmarked_job_name, earmark_notes, synced_to_inventory_at",
      )
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      console.error("Failed to load audit log:", error);
      setLoadError(error.message || "Failed to load audit log.");
      setLoading(false);
      return;
    }

    setRows((data || []) as TransactionRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isReady || !isAdmin) return;
    loadData();
  }, [isReady, isAdmin, loadData]);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((row) =>
      `${row.transaction_type || ""} ${getDisplayVendor(row)} ${row.item_name || ""} ${row.size || ""} ${row.unit || ""} ${
        row.quantity || ""
      } ${row.location || ""} ${row.notes || ""} ${row.earmarked_job_name || ""} ${getTxStatus(row)}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, search]);

  async function findExistingInventoryItem(row: TransactionRow, parsedPallet: string) {
    const vendor = getDisplayVendor(row);
    const material = row.item_name?.trim() || "";
    const size = row.size?.trim() || "";
    const location = row.location?.trim() || "";

    const { data, error } = await supabase
      .from("inventory_items")
      .select(
        "id, vendor, color, size, quantity, unit, category, location, pallet_number, notes, earmarked_for_job, earmarked_job, earmark_notes",
      )
      .eq("vendor", vendor)
      .eq("color", material)
      .eq("size", size);

    if (error) throw error;

    const candidates = (data || []) as InventoryItemRow[];
    return (
      candidates.find(
        (candidate) =>
          normalize(candidate.location) === normalize(location) &&
          normalize(candidate.pallet_number) === normalize(parsedPallet),
      ) || null
    );
  }

  async function syncIntake(row: TransactionRow) {
    if (row.transaction_type !== "intake") return;
    if (row.synced_to_inventory_at) return;

    const confirmed = window.confirm(
      `Sync this intake to Inventory?\n\n${getDisplayVendor(row)} / ${row.item_name || "—"} / ${row.size || "—"}\nQty: ${row.quantity || "—"} ${row.unit || ""}`,
    );

    if (!confirmed) return;

    setSyncingId(row.id);
    setSyncMessage("");

    try {
      const vendor = getDisplayVendor(row);
      const material = row.item_name?.trim() || "";
      const size = row.size?.trim() || "";
      const quantity = Math.abs(Number(row.quantity || 0));
      const unit = row.unit?.trim() || null;
      const category = parseNoteValue(row.notes, "Category") || null;
      const pallet = parseNoteValue(row.notes, "Pallet") || "";
      const nowIso = new Date().toISOString();

      if (!vendor || !material || !quantity) {
        setSyncMessage("This intake is missing vendor, material, or quantity and cannot be synced.");
        return;
      }

      const existing = await findExistingInventoryItem(row, pallet);
      const nextQty = Number(existing?.quantity || 0) + quantity;
      const nextNotes = appendNote(existing?.notes, row.notes);
      const nextEarmarkNotes = appendNote(existing?.earmark_notes, row.earmark_notes);

      if (existing) {
        const { error } = await supabase
          .from("inventory_items")
          .update({
            quantity: nextQty,
            unit: unit || existing.unit,
            category: category || existing.category,
            location: row.location?.trim() || existing.location,
            pallet_number: pallet || existing.pallet_number,
            notes: nextNotes,
            updated_at: nowIso,
            ...(row.is_earmarked
              ? {
                  earmarked_for_job: true,
                  earmarked_job: row.earmarked_job_name || existing.earmarked_job,
                  earmark_notes: nextEarmarkNotes,
                }
              : {}),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory_items").insert({
          vendor,
          color: material,
          size,
          quantity,
          unit,
          category,
          location: row.location?.trim() || null,
          pallet_number: pallet || null,
          notes: row.notes || null,
          created_at: nowIso,
          updated_at: nowIso,
          earmarked_for_job: Boolean(row.is_earmarked),
          earmarked_job: row.is_earmarked ? row.earmarked_job_name || null : null,
          earmark_notes: row.is_earmarked ? row.earmark_notes || null : null,
        });

        if (error) throw error;
      }

      const { error: markSyncedError } = await supabase
        .from("inventory_transactions")
        .update({ synced_to_inventory_at: nowIso })
        .eq("id", row.id);

      if (markSyncedError) throw markSyncedError;

      setSyncMessage("Intake synced to Inventory.");
      await loadData();
    } catch (error) {
      console.error("Failed to sync intake:", JSON.stringify(error, null, 2), error);
      const message =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message)
          : "Failed to sync intake.";
      setSyncMessage(message);
    } finally {
      setSyncingId(null);
    }
  }

  if (isReady && !isAdmin) {
    return (
      <div className="min-h-[calc(100vh-73px)] bg-black px-6 py-12 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-800 bg-neutral-950 p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[#c8a43a]">Admin Only</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#f7f0d0]">Audit Log</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-400">
            The Audit Log is only available when Internal Access is enabled.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-73px)] bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#f7f0d0]">Audit Log</h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Review inventory transactions. Pending intakes can be synced into Inventory after material is confirmed received.
          </p>
        </div>

        {syncMessage && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-300">{syncMessage}</div>
        )}

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
          <label htmlFor="audit-search" className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
            Search
          </label>
          <input
            id="audit-search"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
            placeholder="Search transaction type, vendor, material, status, notes, or job"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loadError && <div className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">{loadError}</div>}

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
          {loading ? (
            <div className="text-sm text-neutral-400">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="border-b border-neutral-800 text-neutral-400">
                  <tr>
                    <th className="py-3 text-left font-medium">Type</th>
                    <th className="py-3 text-left font-medium">Vendor</th>
                    <th className="py-3 text-left font-medium">Material</th>
                    <th className="py-3 text-left font-medium">Size</th>
                    <th className="py-3 text-left font-medium">Qty</th>
                    <th className="py-3 text-left font-medium">Location</th>
                    <th className="py-3 text-left font-medium">Date</th>
                    <th className="py-3 text-left font-medium">Status</th>
                    <th className="w-[150px] py-3 text-left font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const status = getTxStatus(row);
                    const canSync = row.transaction_type === "intake" && !row.synced_to_inventory_at;

                    return (
                      <tr key={row.id} className="border-b border-neutral-900">
                        <td className="py-3 align-top capitalize">{row.transaction_type || "—"}</td>
                        <td className="py-3 align-top">{getDisplayVendor(row) || "—"}</td>
                        <td className="py-3 align-top font-medium text-white">
                          <div>{row.item_name || "—"}</div>
                          {row.notes?.trim() && (
                            <div className="mt-1 max-w-sm whitespace-pre-wrap text-xs font-normal text-neutral-500">{row.notes}</div>
                          )}
                          {row.earmarked_job_name?.trim() && (
                            <div className="mt-2 text-xs text-purple-300">Reserved for {row.earmarked_job_name}</div>
                          )}
                        </td>
                        <td className="py-3 align-top">{row.size || "—"}</td>
                        <td className="py-3 align-top">
                          {row.quantity ?? "—"} {row.unit || ""}
                        </td>
                        <td className="py-3 align-top">{row.location || "—"}</td>
                        <td className="py-3 align-top text-neutral-400">{formatDateTime(row.created_at)}</td>
                        <td className="py-3 align-top">
                          <span className={`rounded-full border px-2 py-1 text-[11px] font-medium ${getStatusClass(status)}`}>{status}</span>
                        </td>
                        <td className="w-[150px] py-3 align-top">
                          {canSync ? (
                            <button
                              type="button"
                              onClick={() => syncIntake(row)}
                              disabled={syncingId === row.id}
                              className="rounded-md border border-[#c8a43a] bg-[#c8a43a] px-3 py-2 text-xs font-medium text-black transition hover:bg-[#d6b24a] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {syncingId === row.id ? "Syncing..." : "Sync Intake"}
                            </button>
                          ) : (
                            <span className="text-xs text-neutral-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-sm text-neutral-500">
                        No audit log rows found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
