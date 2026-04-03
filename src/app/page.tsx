'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import {
  Search,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  DollarSign,
  Warehouse,
  FileText,
  Filter,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
} from 'lucide-react';

type CatalogRow = {
  vendor: string;
  item_name: string;
  size: string;
  category?: string;
  material_class?: string;
  unit?: string;
  source_file?: string;
  notes?: string;
  price?: string | number;
  price_basis?: string;
};

type ReqRow = {
  id: number;
  job: string;
  vendor: string;
  item: string;
  size: string;
  required: number;
  inStock: number;
  shortage: number;
  ready: 'Ready' | 'Not Ready';
};

const walkthroughSteps = [
  {
    title: 'Search the catalog first',
    text: 'Start with the material name, compare vendors, prices, and warnings before selecting a source.',
  },
  {
    title: 'Review vendor-specific warnings',
    text: 'Use notes and match warnings to avoid mixing visually different materials that share similar names.',
  },
  {
    title: 'Log intake or outtake',
    text: 'Record inventory movement here instead of editing database rows directly.',
  },
  {
    title: 'Validate job readiness in Monday',
    text: 'Keep Material Reqs in Monday, then rerun the inventory check after the inventory state changes.',
  },
];

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-[#2b2b2b] bg-[#111111] shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="border-b border-[#232323] px-5 py-4">
      <h2 className="text-lg font-semibold text-[#f5e7a1]">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-[#cfc7a1]">{description}</p>
      )}
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const base =
    'inline-flex rounded-full px-3 py-1 text-xs font-medium border';
  if (value === 'Ready') {
    return (
      <span className={`${base} border-[#24522c] bg-[#17361d] text-[#a7f3b3]`}>
        Ready
      </span>
    );
  }
  if (value === 'Not Ready') {
    return (
      <span className={`${base} border-[#73531f] bg-[#3b2c14] text-[#f5d48c]`}>
        Not Ready
      </span>
    );
  }
  return (
    <span className={`${base} border-[#343434] bg-[#1b1b1b] text-[#d6ccb1]`}>
      {value}
    </span>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
        active
          ? 'bg-[#c8a43a] text-black'
          : 'bg-[#171717] text-[#d8cfb0] hover:bg-[#202020]'
      }`}
    >
      {children}
    </button>
  );
}

function normalize(value: string) {
  return (value || '').trim().toLowerCase();
}

function formatPrice(value: string | number | undefined) {
  if (value === undefined || value === null || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `$${num.toFixed(2)}`;
}

export default function TenartenInventoryUi() {
  const [tab, setTab] = useState<'catalog' | 'transactions' | 'monday'>(
    'catalog'
  );
  const [walkthroughStep, setWalkthroughStep] = useState(0);

  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');

  const [txType, setTxType] = useState('intake');
  const [txVendor, setTxVendor] = useState('');
  const [txItem, setTxItem] = useState('');
  const [txSize, setTxSize] = useState('');
  const [txQuantity, setTxQuantity] = useState('');
  const [txUnit, setTxUnit] = useState('');
  const [txLocation, setTxLocation] = useState('');
  const [txNotes, setTxNotes] = useState('');

  const [annotationVendor, setAnnotationVendor] = useState('');
  const [annotationItem, setAnnotationItem] = useState('');
  const [annotationSize, setAnnotationSize] = useState('');
  const [matchWarning, setMatchWarning] = useState(
    'Do not mix across vendors without visual approval.'
  );
  const [appearanceNotes, setAppearanceNotes] = useState(
    'Use this area to capture hue shift, brightness, translucency, or lot-specific observations.'
  );
  const [subPolicy, setSubPolicy] = useState('Approval required');

  useEffect(() => {
    async function loadCsv() {
      const res = await fetch('/vendors_master.csv');
      const text = await res.text();

      Papa.parse<CatalogRow>(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const cleaned = results.data
            .filter((row) => row.vendor && row.item_name)
            .map((row) => ({
              ...row,
              vendor: row.vendor?.trim() || '',
              item_name: row.item_name?.trim() || '',
              size: row.size?.trim() || '',
              category: row.category?.trim() || '',
              material_class: row.material_class?.trim() || '',
              unit: row.unit?.trim() || '',
              source_file: row.source_file?.trim() || '',
              notes: row.notes?.trim() || '',
              price_basis: row.price_basis?.trim() || '',
            }));

          setCatalogRows(cleaned);

          if (cleaned.length > 0) {
            const first = cleaned[0];
            setTxVendor(first.vendor);
            setTxItem(first.item_name);
            setTxSize(first.size || '');
            setTxUnit(first.unit || '');
            setAnnotationVendor(first.vendor);
            setAnnotationItem(first.item_name);
            setAnnotationSize(first.size || '');
          }
        },
      });
    }

    loadCsv();
  }, []);

  const vendorOptions = useMemo(() => {
    return Array.from(new Set(catalogRows.map((r) => r.vendor))).sort();
  }, [catalogRows]);

  const itemOptions = useMemo(() => {
    return Array.from(new Set(catalogRows.map((r) => r.item_name))).sort();
  }, [catalogRows]);

  const filteredCatalog = useMemo(() => {
    return catalogRows.filter((row) => {
      const q = normalize(catalogSearch);
      const matchesSearch =
        !q ||
        normalize(`${row.item_name} ${row.vendor} ${row.size}`).includes(q);
      const matchesVendor =
        vendorFilter === 'all' || row.vendor === vendorFilter;
      return matchesSearch && matchesVendor;
    });
  }, [catalogRows, catalogSearch, vendorFilter]);

  const inventoryLots = useMemo(() => {
    const grouped = new Map<string, number>();

    for (const row of catalogRows.slice(0, 18)) {
      const key = `${row.vendor}__${row.item_name}__${row.size}`;
      grouped.set(key, (grouped.get(key) || 0) + 1);
    }

    return grouped.size;
  }, [catalogRows]);

  const flaggedCatalog = useMemo(() => {
    return filteredCatalog.filter((r) => r.notes || r.price_basis).length;
  }, [filteredCatalog]);

  const reqs: ReqRow[] = useMemo(() => {
    const sample = catalogRows.slice(0, 3);

    return sample.map((row, idx) => {
      const required = 10 + idx * 5;
      const inStock = idx === 0 ? 24 : idx === 1 ? 8 : 40;
      const shortage = Math.max(required - inStock, 0);

      return {
        id: idx + 1,
        job: `24-10${idx + 3}`,
        vendor: row.vendor,
        item: row.item_name,
        size: row.size || '',
        required,
        inStock,
        shortage,
        ready: shortage === 0 ? 'Ready' : 'Not Ready',
      };
    });
  }, [catalogRows]);

  const readyJobs = reqs.filter((r) => r.ready === 'Ready').length;

  const txVendorRows = useMemo(() => {
    return catalogRows.filter((r) => r.vendor === txVendor);
  }, [catalogRows, txVendor]);

  const txVendorItems = useMemo(() => {
    return Array.from(new Set(txVendorRows.map((r) => r.item_name))).sort();
  }, [txVendorRows]);

  const txItemRows = useMemo(() => {
    return txVendorRows.filter((r) => r.item_name === txItem);
  }, [txVendorRows, txItem]);

  const txSizeOptions = useMemo(() => {
    return Array.from(new Set(txItemRows.map((r) => r.size).filter(Boolean))).sort();
  }, [txItemRows]);

  const selectedAnnotationRow = useMemo(() => {
    return (
      catalogRows.find(
        (r) =>
          r.vendor === annotationVendor &&
          r.item_name === annotationItem &&
          (r.size || '') === (annotationSize || '')
      ) || null
    );
  }, [catalogRows, annotationVendor, annotationItem, annotationSize]);

  const annotationItems = useMemo(() => {
    return Array.from(
      new Set(
        catalogRows
          .filter((r) => r.vendor === annotationVendor)
          .map((r) => r.item_name)
      )
    ).sort();
  }, [catalogRows, annotationVendor]);

  const annotationSizes = useMemo(() => {
    return Array.from(
      new Set(
        catalogRows
          .filter(
            (r) =>
              r.vendor === annotationVendor && r.item_name === annotationItem
          )
          .map((r) => r.size)
          .filter(Boolean)
      )
    ).sort();
  }, [catalogRows, annotationVendor, annotationItem]);

  return (
    <div className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <img
              src="/logo.png"
              alt="Tenarten Terrazzo crest"
              className="h-24 w-24 object-contain"
            />
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-[#bda86a]">
                Tenarten Terrazzo
              </p>
              <h1 className="text-3xl font-semibold text-[#f7f0d0]">
                Inventory & Material Management
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-[#cfc7a1]">
                Catalog search, vendor-specific material notes, and inventory
                movement live here. Monday remains the operational surface for
                material requirements and production readiness.
              </p>
            </div>
          </div>

          <Card className="w-full max-w-md overflow-hidden">
            <div className="border-b border-[#232323] px-5 py-4">
              <p className="text-xs uppercase tracking-[0.25em] text-[#bda86a]">
                Guided walkthrough
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[#f5e7a1]">
                {walkthroughSteps[walkthroughStep].title}
              </h2>
              <p className="mt-2 text-sm text-[#cfc7a1]">
                {walkthroughSteps[walkthroughStep].text}
              </p>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2 text-xs text-[#d6ccb1]">
                {walkthroughSteps.map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-2.5 w-2.5 rounded-full ${
                      idx === walkthroughStep ? 'bg-[#c8a43a]' : 'bg-[#3a3a3a]'
                    }`}
                  />
                ))}
                <span className="ml-2">
                  Step {walkthroughStep + 1} of {walkthroughSteps.length}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setWalkthroughStep((s) => Math.max(0, s - 1))
                  }
                  className="inline-flex items-center rounded-2xl border border-[#343434] bg-[#171717] px-3 py-2 text-sm text-[#d8cfb0] hover:bg-[#202020]"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Prev
                </button>
                <button
                  onClick={() =>
                    setWalkthroughStep((s) =>
                      Math.min(walkthroughSteps.length - 1, s + 1)
                    )
                  }
                  className="inline-flex items-center rounded-2xl bg-[#c8a43a] px-3 py-2 text-sm font-medium text-black hover:bg-[#d6b24c]"
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </button>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <Package className="h-5 w-5 text-[#bda86a]" />
              <span className="text-2xl font-semibold text-[#f7f0d0]">
                {catalogRows.length}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium text-[#f1e7bc]">
              Catalog entries
            </p>
            <p className="text-xs text-[#cfc7a1]">
              Vendor-scoped material identities
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <Warehouse className="h-5 w-5 text-[#bda86a]" />
              <span className="text-2xl font-semibold text-[#f7f0d0]">
                {inventoryLots}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium text-[#f1e7bc]">
              Inventory lots
            </p>
            <p className="text-xs text-[#cfc7a1]">
              Current on-hand warehouse entries
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <FileText className="h-5 w-5 text-[#bda86a]" />
              <span className="text-2xl font-semibold text-[#f7f0d0]">
                {readyJobs}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium text-[#f1e7bc]">
              Ready material reqs
            </p>
            <p className="text-xs text-[#cfc7a1]">
              Visible in Monday after stock checks
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <AlertTriangle className="h-5 w-5 text-[#bda86a]" />
              <span className="text-2xl font-semibold text-[#f7f0d0]">
                {flaggedCatalog}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium text-[#f1e7bc]">
              Annotated warnings
            </p>
            <p className="text-xs text-[#cfc7a1]">
              Mismatch / substitution guidance
            </p>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2 rounded-3xl border border-[#2b2b2b] bg-[#0f0f0f] p-2">
          <TabButton active={tab === 'catalog'} onClick={() => setTab('catalog')}>
            Catalog
          </TabButton>
          <TabButton
            active={tab === 'transactions'}
            onClick={() => setTab('transactions')}
          >
            Transactions
          </TabButton>
          <TabButton active={tab === 'monday'} onClick={() => setTab('monday')}>
            Material Requirements
          </TabButton>
        </div>

        {tab === 'catalog' && (
          <Card>
            <CardHeader
              title="Catalog lookup"
              description="Search by product first, compare vendor-specific pricing, and review mismatch notes before sourcing or substitution."
            />
            <div className="space-y-4 p-5">
              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#a5935a]" />
                  <input
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Search item name, vendor, or size"
                    list="catalog-item-suggestions"
                    className="w-full rounded-2xl border border-[#3a3421] bg-[#0d0d0d] py-3 pl-10 pr-4 text-sm text-[#f7f0d0] outline-none placeholder:text-[#7e765e] focus:border-[#c8a43a]"
                  />
                  <datalist id="catalog-item-suggestions">
                    {itemOptions.slice(0, 300).map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </div>

                <select
                  value={vendorFilter}
                  onChange={(e) => setVendorFilter(e.target.value)}
                  className="rounded-2xl border border-[#3a3421] bg-[#0d0d0d] px-4 py-3 text-sm text-[#f7f0d0] outline-none focus:border-[#c8a43a]"
                >
                  <option value="all">All vendors</option>
                  {vendorOptions.map((vendor) => (
                    <option key={vendor} value={vendor}>
                      {vendor}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[#232323]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#171717] text-left text-[#d6ccb1]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Vendor</th>
                      <th className="px-4 py-3 font-medium">Item</th>
                      <th className="px-4 py-3 font-medium">Size</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium">Price Basis</th>
                      <th className="px-4 py-3 font-medium">Warning / Annotation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCatalog.slice(0, 150).map((row, idx) => (
                      <tr key={`${row.vendor}-${row.item_name}-${row.size}-${idx}`} className="border-t border-[#1f1f1f] align-top">
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full border border-[#4b442f] bg-[#16130c] px-3 py-1 text-xs text-[#f1e7bc]">
                            {row.vendor}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-[#f7f0d0]">
                          {row.item_name}
                        </td>
                        <td className="px-4 py-3 text-[#d6ccb1]">{row.size || '—'}</td>
                        <td className="px-4 py-3 text-[#d6ccb1]">
                          {formatPrice(row.price) || '—'}
                        </td>
                        <td className="px-4 py-3 text-[#cfc7a1]">
                          {row.price_basis || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {row.notes ? (
                            <p className="text-sm text-[#cfc7a1]">{row.notes}</p>
                          ) : (
                            <p className="text-sm text-[#7e765e]">
                              No annotation yet
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        )}

        {tab === 'transactions' && (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader
                title="Inventory transactions"
                description="Log intake, outtake, or adjustment events here instead of editing database rows directly."
              />
              <div className="space-y-4 p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[#f1e7bc]">
                      Transaction Type
                    </p>
                    <select
                      value={txType}
                      onChange={(e) => setTxType(e.target.value)}
                      className="w-full rounded-2xl border border-[#3a3421] bg-[#0d0d0d] px-4 py-3 text-sm text-[#f7f0d0] outline-none focus:border-[#c8a43a]"
                    >
                      <option value="intake">Intake</option>
                      <option value="outtake">Outtake</option>
                      <option value="adjustment">Adjustment</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[#f1e7bc]">Vendor</p>
                    <select
                      value={txVendor}
                      onChange={(e) => {
                        const vendor = e.target.value;
                        setTxVendor(vendor);

                        const firstForVendor = catalogRows.find(
                          (r) => r.vendor === vendor
                        );
                        if (firstForVendor) {
                          setTxItem(firstForVendor.item_name);
                          setTxSize(firstForVendor.size || '');
                          setTxUnit(firstForVendor.unit || '');
                        }
                      }}
                      className="w-full rounded-2xl border border-[#3a3421] bg-[#0d0d0d] px-4 py-3 text-sm text-[#f7f0d0] outline-none focus:border-[#c8a43a]"
                    >
                      {vendorOptions.map((vendor) => (
                        <option key={vendor} value={vendor}>
                          {vendor}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[#f1e7bc]">
                      Item Name
                    </p>
                    <input
                      value={txItem}
                      onChange={(e) => setTxItem(e.target.value)}
                      list="tx-item-suggestions"
                      className="w-full rounded-2xl border border-[#3a3421] bg-[#0d0d0d] px-4 py-3 text-sm text-[#f7f0d0] outline-none focus:border-[#c8a43a]"
                    />
                    <datalist id="tx-item-suggestions">
                      {txVendorItems.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[#f1e7bc]">Size</p>
                    <input
                      value={txSize}
                      onChange={(e) => setTxSize(e.target.value)}
                      list="tx-size-suggestions"
                      className="w-full rounded-2xl border border-[#3a3421] bg-[#0d0d0d] px-4 py-3 text-sm text-[#f7f0d0] outline-none focus:border-[#c8a43a]"
                    />
                    <datalist id="tx-size-suggestions">
                      {txSizeOptions.map((size) => (
                        <option key={size} value={size} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[#f1e7bc]">
                      Quantity
                    </p>
                    <input
                      value={txQuantity}
                      onChange={(e) => setTxQuantity(e.target.value)}
                      className="w-full rounded-2xl border border-[#3a3421] bg-[#0d0d0d] px-4 py-3 text-sm text-[#f7f0d0] outline-none focus:border-[#c8a43a]"
                      placeholder="e.g. 20"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[#f1e7bc]">Unit</p>
                    <input
                      value={txUnit}
                      onChange={(e) => setTxUnit(e.target.value)}
                      className="w-full rounded-2xl border border-[#3a3421] bg-[#0d0d0d] px-4 py-3 text-sm text-[#f7f0d0] outline-none focus:border-[#c8a43a]"
                      placeholder="lb / bag / pallet"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[#f1e7bc]">
                      Location
                    </p>
                    <input
                      value={txLocation}
                      onChange={(e) => setTxLocation(e.target.value)}
                      className="w-full rounded-2xl border border-[#3a3421] bg-[#0d0d0d] px-4 py-3 text-sm text-[#f7f0d0] outline-none focus:border-[#c8a43a]"
                      placeholder="Warehouse A"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#f1e7bc]">Notes</p>
                  <textarea
                    value={txNotes}
                    onChange={(e) => setTxNotes(e.target.value)}
                    className="min-h-[110px] w-full rounded-2xl border border-[#3a3421] bg-[#0d0d0d] px-4 py-3 text-sm text-[#f7f0d0] outline-none placeholder:text-[#7e765e] focus:border-[#c8a43a]"
                    placeholder="Optional context, visual match note, pallet note, or source details"
                  />
                </div>

                <div className="flex gap-2">
                  <button className="inline-flex items-center rounded-2xl bg-[#c8a43a] px-4 py-2 text-sm font-medium text-black hover:bg-[#d6b24c]">
                    {txType === 'intake' ? (
                      <ArrowDownToLine className="mr-2 h-4 w-4" />
                    ) : (
                      <ArrowUpFromLine className="mr-2 h-4 w-4" />
                    )}
                    Submit Transaction
                  </button>
                  <button
                    onClick={() => {
                      setTxQuantity('');
                      setTxLocation('');
                      setTxNotes('');
                    }}
                    className="rounded-2xl border border-[#343434] bg-[#171717] px-4 py-2 text-sm font-medium text-[#d8cfb0] hover:bg-[#202020]"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Material notes & warnings"
                description="Capture mismatch guidance without creating fake job or inventory rows."
              />
              <div className="space-y-3 p-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <select
                    value={annotationVendor}
                    onChange={(e) => {
                      const vendor = e.target.value;
                      setAnnotationVendor(vendor);
                      const first = catalogRows.find((r) => r.vendor === vendor);
                      if (first) {
                        setAnnotationItem(first.item_name);
                        setAnnotationSize(first.size || '');
                      }
                    }}
                    className="rounded-2xl border border-[#3a3421] bg-[#0d0d0d] px-4 py-3 text-sm text-[#f7f0d0] outline-none focus:border-[#c8a43a]"
                  >
                    {vendorOptions.map((vendor) => (
                      <option key={vendor} value={vendor}>
                        {vendor}
                      </option>
                    ))}
                  </select>

                  <input
                    value={annotationItem}
                    onChange={(e) => setAnnotationItem(e.target.value)}
                    list="annotation-item-suggestions"
                    className="rounded-2xl border border-[#3a3421] bg-[#0d0d0d] px-4 py-3 text-sm text-[#f7f0d0] outline-none focus:border-[#c8a43a]"
                  />
                  <datalist id="annotation-item-suggestions">
                    {annotationItems.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>

                  <input
                    value={annotationSize}
                    onChange={(e) => setAnnotationSize(e.target.value)}
                    list="annotation-size-suggestions"
                    className="rounded-2xl border border-[#3a3421] bg-[#0d0d0d] px-4 py-3 text-sm text-[#f7f0d0] outline-none focus:border-[#c8a43a]"
                  />
                  <datalist id="annotation-size-suggestions">
                    {annotationSizes.map((size) => (
                      <option key={size} value={size} />
                    ))}
                  </datalist>
                </div>

                <div className="rounded-2xl border border-[#232323] bg-[#0d0d0d] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[#cfc7a1]">
                        Selected catalog entry
                      </p>
                      <p className="font-medium text-[#f7f0d0]">
                        {selectedAnnotationRow
                          ? `${selectedAnnotationRow.vendor} / ${selectedAnnotationRow.item_name} / ${selectedAnnotationRow.size || '—'}`
                          : 'No entry selected'}
                      </p>
                    </div>
                    <DollarSign className="h-5 w-5 text-[#c8a43a]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#f1e7bc]">
                    Match Warning
                  </p>
                  <textarea
                    value={matchWarning}
                    onChange={(e) => setMatchWarning(e.target.value)}
                    className="min-h-[90px] w-full rounded-2xl border border-[#3a3421] bg-[#0d0d0d] px-4 py-3 text-sm text-[#f7f0d0] outline-none focus:border-[#c8a43a]"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#f1e7bc]">
                    Appearance Notes
                  </p>
                  <textarea
                    value={appearanceNotes}
                    onChange={(e) => setAppearanceNotes(e.target.value)}
                    className="min-h-[90px] w-full rounded-2xl border border-[#3a3421] bg-[#0d0d0d] px-4 py-3 text-sm text-[#f7f0d0] outline-none focus:border-[#c8a43a]"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#f1e7bc]">
                    Substitution Policy
                  </p>
                  <input
                    value={subPolicy}
                    onChange={(e) => setSubPolicy(e.target.value)}
                    className="w-full rounded-2xl border border-[#3a3421] bg-[#0d0d0d] px-4 py-3 text-sm text-[#f7f0d0] outline-none focus:border-[#c8a43a]"
                  />
                </div>

                <button className="w-full rounded-2xl bg-[#c8a43a] px-4 py-2 text-sm font-medium text-black hover:bg-[#d6b24c]">
                  Save Annotation
                </button>
              </div>
            </Card>
          </div>
        )}

        {tab === 'monday' && (
          <Card>
            <CardHeader
              title="Material requirements"
              description="Material requirements stay in Monday. This UI owns catalog search, annotations, and inventory write workflows."
            />
            <div className="p-5">
              <div className="overflow-x-auto rounded-2xl border border-[#232323]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#171717] text-left text-[#d6ccb1]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Job</th>
                      <th className="px-4 py-3 font-medium">Vendor</th>
                      <th className="px-4 py-3 font-medium">Item</th>
                      <th className="px-4 py-3 font-medium">Size</th>
                      <th className="px-4 py-3 font-medium">Required</th>
                      <th className="px-4 py-3 font-medium">In Stock</th>
                      <th className="px-4 py-3 font-medium">Shortage</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reqs.map((row) => (
                      <tr key={row.id} className="border-t border-[#1f1f1f]">
                        <td className="px-4 py-3 text-[#d6ccb1]">{row.job}</td>
                        <td className="px-4 py-3 text-[#d6ccb1]">
                          {row.vendor}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#f7f0d0]">
                          {row.item}
                        </td>
                        <td className="px-4 py-3 text-[#d6ccb1]">
                          {row.size}
                        </td>
                        <td className="px-4 py-3 text-[#d6ccb1]">
                          {row.required}
                        </td>
                        <td className="px-4 py-3 text-[#d6ccb1]">
                          {row.inStock}
                        </td>
                        <td className="px-4 py-3 text-[#d6ccb1]">
                          {row.shortage}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={row.ready} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Card className="border-dashed shadow-none">
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#f1e7bc]">
                      <Filter className="h-4 w-4 text-[#c8a43a]" />
                      Monday trigger
                    </div>
                    <p className="mt-2 text-sm text-[#cfc7a1]">
                      User sets Inventory Check Request = Check on the Material
                      Reqs row.
                    </p>
                  </div>
                </Card>

                <Card className="border-dashed shadow-none">
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#f1e7bc]">
                      <Warehouse className="h-4 w-4 text-[#c8a43a]" />
                      Shared backend
                    </div>
                    <p className="mt-2 text-sm text-[#cfc7a1]">
                      Edge function reads inventory state from Supabase and
                      writes stock results back into Monday.
                    </p>
                  </div>
                </Card>

                <Card className="border-dashed shadow-none">
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#f1e7bc]">
                      <AlertTriangle className="h-4 w-4 text-[#c8a43a]" />
                      Exception handling
                    </div>
                    <p className="mt-2 text-sm text-[#cfc7a1]">
                      If stock looks wrong or notes matter, users jump here to
                      inspect catalog warnings or post transactions.
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}