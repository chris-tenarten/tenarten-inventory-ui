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

type ViewMode = 'append' | 'current';

export default function InventoryPage() {
    const [viewMode, setViewMode] = useState<ViewMode>('append');
    const [guidedMode, setGuidedMode] = useState(true);

    const [appendRows, setAppendRows] = useState<AppendBalanceRow[]>([]);
    const [currentRows, setCurrentRows] = useState<CurrentInventoryRow[]>([]);

    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        async function loadInventoryViews() {
            setLoading(true);

            const [appendResult, currentResult] = await Promise.all([
                supabase
                    .from('inventory_balances')
                    .select('*')
                    .order('vendor', { ascending: true })
                    .order('item_name', { ascending: true }),

                supabase
                    .from('inventory_items')
                    .select('*')
                    .order('vendor', { ascending: true })
                    .order('color', { ascending: true }),
            ]);

            setAppendRows((appendResult.data as AppendBalanceRow[]) || []);
            setCurrentRows((currentResult.data as CurrentInventoryRow[]) || []);
            setLoading(false);
        }

        loadInventoryViews();
    }, []);

    const filteredAppendRows = useMemo(() => {
        const q = search.toLowerCase();
        return appendRows.filter((row) =>
            `${row.vendor} ${row.item_name} ${row.size} ${row.unit}`
                .toLowerCase()
                .includes(q)
        );
    }, [appendRows, search]);

    const filteredCurrentRows = useMemo(() => {
        const q = search.toLowerCase();
        return currentRows.filter((row) =>
            `${row.vendor} ${row.category} ${row.color} ${row.size} ${row.location}`
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
                            Track material using append-only transactions + derived balances.
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
                            className={`rounded-full px-4 py-2 text-sm ${viewMode === 'append'
                                    ? 'bg-[#c8a43a] text-black'
                                    : 'text-neutral-300'
                                }`}
                        >
                            Append View
                        </button>

                        <button
                            onClick={() => setViewMode('current')}
                            className={`rounded-full px-4 py-2 text-sm ${viewMode === 'current'
                                    ? 'bg-[#c8a43a] text-black'
                                    : 'text-neutral-300'
                                }`}
                        >
                            Current Inventory
                        </button>
                    </div>
                </div>

                {/* GUIDED MODE - CONTEXTUAL */}
                {guidedMode && viewMode === 'append' && (
                    <div className="rounded border border-yellow-700 bg-yellow-950/30 p-4 text-sm">
                        <strong className="text-[#f7f0d0]">Append View (Source of Truth)</strong>
                        <p className="text-sm text-neutral-400">
                            This view is computed from transactions (append-only log).
                            <br /><br />
                            ⚠️ This is a working model — automatic syncing to the current inventory table is not implemented yet.
                            <br /><br />
                            For now, this is used to validate the new workflow before replacing the existing system.
                        </p>
                        <ul className="mt-2 list-disc pl-5 text-neutral-400 space-y-1">
                            <li>Every change = a new transaction (add, remove, adjust)</li>
                            <li>No overwriting values → prevents mistakes + preserves history</li>
                            <li>This is the “real” inventory state</li>
                        </ul>
                    </div>
                )}

                {guidedMode && viewMode === 'current' && (
                    <div className="rounded border border-blue-700 bg-blue-950/30 p-4 text-sm">
                        <strong className="text-[#f7f0d0]">Current Inventory (Legacy Table)</strong>
                        <p className="mt-2 text-neutral-300">
                            This is the existing manual inventory table.
                        </p>
                        <ul className="mt-2 list-disc pl-5 text-neutral-400 space-y-1">
                            <li>Values can be directly edited</li>
                            <li>Does NOT track history</li>
                            <li>Used today, but more error-prone</li>
                        </ul>
                    </div>
                )}

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
                                    <tr key={i} className="border-b border-neutral-900">
                                        <td className="py-2">{row.vendor}</td>
                                        <td className="py-2">{row.item_name}</td>
                                        <td className="py-2">{row.size}</td>
                                        <td className="py-2 text-green-400">{row.qty_on_hand}</td>
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