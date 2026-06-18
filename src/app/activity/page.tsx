"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

type ActivityStatus = "needs_validation" | "confirmed";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatTransactionType(value: string | null) {
  if (value === "intake") return "Intake";
  if (value === "outtake") return "Outtake";
  if (value === "adjustment") return "Adjustment";
  return value || "Transaction";
}

function getDisplayVendor(row: TransactionRow) {
  if (row.catalog_source === "specialty") {
    return row.specialty_vendor_name?.trim() || row.vendor?.trim() || "—";
  }

  return row.vendor?.trim() || row.specialty_vendor_name?.trim() || "—";
}

function getSignedQuantity(row: TransactionRow) {
  const quantity = Number(row.quantity || 0);
  if (!Number.isFinite(quantity)) return "—";

  if (row.transaction_type === "outtake") {
    return `-${Math.abs(quantity)}`;
  }

  return String(quantity);
}

function getActivityStatus(row: TransactionRow): ActivityStatus {
  if (row.transaction_type === "intake" && !row.synced_to_inventory_at) {
    return "needs_validation";
  }

  return "confirmed";
}

function StatusBadge({ status }: { status: ActivityStatus }) {
  if (status === "needs_validation") {
    return (
      <span className="inline-flex rounded-full border border-amber-700/60 bg-amber-950/40 px-2.5 py-1 text-[11px] font-medium text-amber-300">
        Needs Validation
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-emerald-700/60 bg-emerald-950/40 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
      Confirmed
    </span>
  );
}

export default function ActivityPage() {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ActivityStatus>("all");

  const loadRows = useCallback(async () => {
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
      console.error("Failed to load activity log:", error);
      setLoadError(error.message || "Failed to load activity log.");
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data as TransactionRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const status = getActivityStatus(row);

      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }

      if (!q) return true;

      return `${formatTransactionType(row.transaction_type)} ${getDisplayVendor(row)} ${
        row.item_name || ""
      } ${row.size || ""} ${row.unit || ""} ${row.location || ""} ${
        row.notes || ""
      } ${row.earmarked_job_name || ""} ${row.earmark_notes || ""} ${status}`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, statusFilter]);

  const pendingCount = useMemo(
    () => rows.filter((row) => getActivityStatus(row) === "needs_validation").length,
    [rows],
  );

  const confirmedCount = useMemo(
    () => rows.filter((row) => getActivityStatus(row) === "confirmed").length,
    [rows],
  );

  return (
    <div className="min-h-[calc(100vh-73px)] bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#f7f0d0]">
              Activity Log
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-neutral-400">
              Review recent inventory entries and see whether each entry has been confirmed.
            </p>
          </div>

          <button
            type="button"
            onClick={loadRows}
            disabled={loading}
            className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:border-[#c8a43a] hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500">
              Total Entries
            </div>
            <div className="mt-2 text-2xl font-semibold text-[#f7f0d0]">
              {rows.length}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-800/60 bg-amber-950/20 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-amber-300">
              Needs Validation
            </div>
            <div className="mt-2 text-2xl font-semibold text-amber-200">
              {pendingCount}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-800/60 bg-emerald-950/20 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-emerald-300">
              Confirmed
            </div>
            <div className="mt-2 text-2xl font-semibold text-emerald-200">
              {confirmedCount}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label
                htmlFor="activity-search"
                className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-neutral-500"
              >
                Search
              </label>
              <input
                id="activity-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                placeholder="Search vendor, material, size, notes, job, or status"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  statusFilter === "all"
                    ? "border-[#c8a43a] bg-[#c8a43a] text-black"
                    : "border-neutral-700 bg-neutral-950 text-neutral-200 hover:border-neutral-600 hover:bg-neutral-900"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("needs_validation")}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  statusFilter === "needs_validation"
                    ? "border-amber-600 bg-amber-950/60 text-amber-200"
                    : "border-neutral-700 bg-neutral-950 text-neutral-200 hover:border-amber-700 hover:bg-neutral-900"
                }`}
              >
                Needs Validation
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("confirmed")}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  statusFilter === "confirmed"
                    ? "border-emerald-600 bg-emerald-950/60 text-emerald-200"
                    : "border-neutral-700 bg-neutral-950 text-neutral-200 hover:border-emerald-700 hover:bg-neutral-900"
                }`}
              >
                Confirmed
              </button>
            </div>
          </div>
        </div>

        {loadError && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
            {loadError}
          </div>
        )}

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
          {loading ? (
            <div className="text-sm text-neutral-400">Loading activity...</div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6 text-center text-sm text-neutral-400">
              No matching activity found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="border-b border-neutral-800 text-neutral-400">
                  <tr>
                    <th className="py-3 text-left font-medium">Date</th>
                    <th className="py-3 text-left font-medium">Type</th>
                    <th className="py-3 text-left font-medium">Vendor</th>
                    <th className="py-3 text-left font-medium">Material</th>
                    <th className="py-3 text-left font-medium">Size</th>
                    <th className="py-3 text-left font-medium">Qty</th>
                    <th className="py-3 text-left font-medium">Unit</th>
                    <th className="py-3 text-left font-medium">Location</th>
                    <th className="py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const status = getActivityStatus(row);

                    return (
                      <tr key={row.id} className="border-b border-neutral-900">
                        <td className="py-3 pr-4 align-top text-neutral-300">
                          {formatDateTime(row.created_at)}
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-300">
                            {formatTransactionType(row.transaction_type)}
                          </span>
                        </td>
                        <td className="py-3 pr-4 align-top text-neutral-300">
                          {getDisplayVendor(row)}
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <div className="font-medium text-white">
                            {row.item_name || "—"}
                          </div>
                          {row.notes?.trim() && (
                            <div className="mt-1 max-w-xs whitespace-pre-wrap text-xs text-neutral-500">
                              {row.notes}
                            </div>
                          )}
                          {row.is_earmarked && (
                            <div className="mt-2 rounded-lg border border-purple-800/60 bg-purple-950/30 px-2 py-1 text-xs text-purple-200">
                              Reserved for {row.earmarked_job_name || "job"}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4 align-top text-neutral-300">
                          {row.size || "—"}
                        </td>
                        <td className="py-3 pr-4 align-top font-medium text-[#f7f0d0]">
                          {getSignedQuantity(row)}
                        </td>
                        <td className="py-3 pr-4 align-top text-neutral-300">
                          {row.unit || "—"}
                        </td>
                        <td className="py-3 pr-4 align-top text-neutral-300">
                          {row.location || "—"}
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <StatusBadge status={status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
