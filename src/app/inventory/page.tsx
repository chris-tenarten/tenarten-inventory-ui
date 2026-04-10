'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type AppendBalanceRow = {
    vendor: string;
    item_name: string;
    size: string;
    unit: string;
    qty_on_hand: number;
    last_transaction_at: string | null;

    // 🔥 injected from catalog
    notes?: string;
    match_warning?: string;
};

type CurrentInventoryRow = {
    id: string;
    category: string | null;
    color: string | null;
    size: string | null;
    quantity: number | null;
    vendor: string | null;
    location: string | null;
    pallet_number: string | null;
    match_confidence: number | string | null;
};

type CatalogRow = {
    vendor: string;
    item_name: string;
    size: string;
    notes: string | null;
    match_warning: string | null;
};

type ViewMode = 'append' | 'current';

export default function InventoryPage() {
    const [viewMode, setViewMode] = useState<ViewMode>('append');
    const [guidedMode, setGuidedMode] = useState(true);

    const [appendRows, setAppendRows] = useState<AppendBalanceRow[]>([]);
    const [currentRows, setCurrentRows] = useState<CurrentInventoryRow[]>([]);
    const [catalogMap, setCatalogMap] = useState<Record<string, CatalogRow>>({});

    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // 🔥 LOAD EVERYTHING
    useEffect(() => {
        async function loadData() {
            setLoading(true);

            const [appendResult, currentResult, catalogResult] = await Promise.all([
                supabase
                    .from('inventory_balances')
                    .select('*'),

                supabase
                    .from('inventory_items')
                    .select('*'),

                supabase
                    .from('vendor_catalog')
                    .select('vendor, item_name, size, notes, match_warning'),
            ]);

            const catalogData = (catalogResult.data as CatalogRow[]) || [];

            // 🔥 build lookup map
            const map: Record<string, CatalogRow> = {};
            for (const row of catalogData) {
                const key = `${row.vendor}|${row.item_name}|${row.size}`;
                map[key] = row;
            }

            // 🔥 merge annotations into append rows
            const enrichedAppend = ((appendResult.data as AppendBalanceRow[]) || []).map(row => {
                const key = `${row.vendor}|${row.item_name}|${row.size}`;
                const catalogMatch = map[key];

                return {
                    ...row,
                    notes: catalogMatch?.notes || undefined,
                    match_warning: catalogMatch?.match_warning || undefined,
                };
            });

            setCatalogMap(map);
            setAppendRows(enrichedAppend);
            setCurrentRows((currentResult.data as CurrentInventoryRow[]) || []);
            setLoading(false);
        }

        loadData();
    }, []);

    // 🔍 FILTERING
    const filteredAppendRows = useMemo(() => {
        const q = search.toLowerCase();
        return appendRows.filter((row) =>
            `${row.vendor} ${row.item_name} ${row.size}`
                .toLowerCase()
                .includes(q)
        );
    }, [appendRows, search]);

    const filteredCurrentRows = useMemo(() => {
        const q = search.toLowerCase();
        return currentRows.filter((row) =>
            `${row.vendor} ${row.category} ${row.color} ${row.size}`
                .toLowerCase()
                .includes(q)
        );
    }, [currentRows, search]);

    return (
        <div className="min-h-[calc(100vh-73px)] bg-black p-6 text-white">
            <div className="mx-auto max-w-7xl space-y-6">

                {/* HEADER */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold text-[#f7f0d0]">Inventory</h1>
                        <p className="text-sm text-neutral-400">
                            Source materials with real-time risk signals.
                        </p>
                    </div>

                    <button
                        onClick={() => setGuidedMode(!guidedMode)}
                        className="rounded border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-900"
                    >
                        {guidedMode ? 'Hide Help' : 'Guided Mode'}
                    </button>
                </div>

                {/* VIEW TOGGLE */}
                <div className="flex items-center gap-3">
                    <div className="inline-flex rounded-full border border-neutral-800 bg-neutral-950 p-1">
                        <button
                            onClick={() => setViewMode('append')}
                            className={`rounded-full px-4 py-2 text-sm ${
                                viewMode === 'append'
                                    ? 'bg-[#c8a43a] text-black'
                                    : 'text-neutral-300'
                            }`}
                        >
                            Append View
                        </button>

                        <button
                            onClick={() => setViewMode('current')}
                            className={`rounded-full px-4 py-2 text-sm ${
                                viewMode === 'current'
                                    ? 'bg-[#c8a43a] text-black'
                                    : 'text-neutral-300'
                            }`}
                        >
                            Current Inventory
                        </button>
                    </div>
                </div>

                {/* SEARCH */}
                <input
                    className="w-full rounded border border-neutral-700 bg-neutral-900 p-3"
                    placeholder="Search inventory..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />

                {/* TABLE */}
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
                    {loading ? (
                        <div>Loading...</div>
                    ) : viewMode === 'append' ? (
                        <table className="w-full text-sm">
                            <thead className="text-neutral-400 border-b border-neutral-800">
                                <tr>
                                    <th className="py-2 text-left">Vendor</th>
                                    <th className="py-2 text-left">Item</th>
                                    <th className="py-2 text-left">Size</th>
                                    <th className="py-2 text-left">Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAppendRows.map((row, i) => (
                                    <tr
                                        key={i}
                                        className={`border-b border-neutral-900 ${
                                            row.match_warning ? 'bg-red-950/20' : ''
                                        }`}
                                    >
                                        <td className="py-2">{row.vendor}</td>

                                        <td className="py-2">
                                            <div className="flex flex-col">
                                                <span>{row.item_name}</span>

                                                {row.match_warning && (
                                                    <span className="text-xs text-red-400">
                                                        ⚠ {row.match_warning}
                                                    </span>
                                                )}

                                                {row.notes && (
                                                    <span className="text-xs text-yellow-400">
                                                        📝 annotated
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="py-2">{row.size}</td>

                                        <td className="py-2 text-green-400">
                                            {row.qty_on_hand}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="text-neutral-400 border-b border-neutral-800">
                                <tr>
                                    <th className="py-2 text-left">Vendor</th>
                                    <th className="py-2 text-left">Color</th>
                                    <th className="py-2 text-left">Size</th>
                                    <th className="py-2 text-left">Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCurrentRows.map((row) => (
                                    <tr key={row.id} className="border-b border-neutral-900">
                                        <td className="py-2">{row.vendor}</td>
                                        <td className="py-2">{row.color}</td>
                                        <td className="py-2">{row.size}</td>
                                        <td className="py-2">{row.quantity}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

            </div>
        </div>
    );
}