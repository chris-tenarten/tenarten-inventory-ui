'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type CatalogRow = {
  id: string;
  vendor: string;
  item_name: string;
  size: string;
  category: string;
  material_class: string;
  unit: string;
  source_file: string;
  notes: string;
  match_warning: string;
  appearance_notes: string;
  annotated_by: string;
  price: string | number;
  price_basis: string;
  updated_at?: string;
};

type CatalogRowV2 = {
  id: string;
  vendor_name: string;
  item_name: string;
  size?: string | null;
  category?: string | null;
  subcategory?: string | null;
  product_line?: string | null;
  component_type?: string | null;
  material_type?: string | null;
  packaging?: string | null;
  price?: string | number | null;
  price_unit?: string | null;
  quote_required?: boolean | null;
  notes?: string | null;
  source_url?: string | null;
};

type CatalogMode = 'standard' | 'specialty';

const PAGE_SIZE = 100;
const RECENT_ANNOTATIONS_LIMIT = 5;

const SOURCE_PDF_MAP: Record<string, string> = {
  arim: '/vendor-pdfs/arim-2024-price-list.pdf',
  southern: '/vendor-pdfs/southern-aggregates-2026-price-list.pdf',
  asg: '/vendor-pdfs/asg-retail-price-list-jan-2022.pdf',
  enviroglas: '/vendor-pdfs/enviroglas-price-list-april-2022.pdf',
  ccq: '/vendor-pdfs/ccq-price-list-2026.pdf',
  tm: '/vendor-pdfs/tm-terroxy-price-guide-2024.pdf',
  terroxy: '/vendor-pdfs/tm-terroxy-price-guide-2024.pdf',
};

function hasAnnotation(row: Partial<CatalogRow>) {
  return Boolean(
    row.notes?.trim() || row.match_warning?.trim() || row.appearance_notes?.trim()
  );
}

function formatAnnotationSummary(row: CatalogRow) {
  if (row.match_warning?.trim()) return row.match_warning.trim();
  if (row.notes?.trim()) return row.notes.trim();
  if (row.appearance_notes?.trim()) return row.appearance_notes.trim();
  return 'Annotated entry';
}

function formatPrice(price: string | number | null | undefined) {
  if (price === null || price === undefined || price === '') return '—';
  return String(price);
}

function buildVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 1) return [1];

  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);

  for (
    let page = Math.max(1, currentPage - 2);
    page <= Math.min(totalPages, currentPage + 2);
    page += 1
  ) {
    pages.add(page);
  }

  return Array.from(pages).sort((a, b) => a - b);
}

function normalizeSourceValue(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getSourcePdfUrl(row: Pick<CatalogRow, 'vendor' | 'source_file'>) {
  const sourceText = normalizeSourceValue(row.source_file);
  const vendorText = normalizeSourceValue(row.vendor);

  if (sourceText.includes('arim') || vendorText.includes('arim')) return SOURCE_PDF_MAP.arim;

  if (
    sourceText.includes('southern') ||
    sourceText.includes('aggregates') ||
    vendorText.includes('southern')
  ) {
    return SOURCE_PDF_MAP.southern;
  }

  if (
    sourceText.includes('asg') ||
    sourceText.includes('american specialty glass') ||
    vendorText.includes('asg')
  ) {
    return SOURCE_PDF_MAP.asg;
  }

  if (
    sourceText.includes('enviroglas') ||
    sourceText.includes('enviroglas products') ||
    vendorText.includes('enviroglas')
  ) {
    return SOURCE_PDF_MAP.enviroglas;
  }

  if (
    sourceText.includes('ccq') ||
    sourceText.includes('cactus canyon') ||
    vendorText.includes('ccq') ||
    vendorText.includes('cactus canyon')
  ) {
    return SOURCE_PDF_MAP.ccq;
  }

  if (
    sourceText.includes('tm supply') ||
    sourceText.includes('t m supply') ||
    sourceText.includes('terroxy') ||
    sourceText.includes('price guide') ||
    vendorText.includes('t&m') ||
    vendorText.includes('tm supply') ||
    vendorText.includes('terroxy')
  ) {
    return SOURCE_PDF_MAP.tm;
  }

  return null;
}

function mapV2ToCatalogRow(row: CatalogRowV2): CatalogRow {
  const resolvedPrice = row.quote_required
    ? 'Quote Required'
    : row.price !== null && row.price !== undefined && String(row.price).trim() !== ''
      ? `${row.price}${row.price_unit ? ` ${row.price_unit}` : ''}`
      : '';

  return {
    id: row.id,
    vendor: row.vendor_name || '',
    item_name: row.item_name || '',
    size: row.size || '',
    category: row.product_line || row.category || '',
    material_class: row.material_type || row.subcategory || '',
    unit: row.packaging || row.price_unit || '',
    source_file: row.source_url || '',
    notes: row.notes || '',
    match_warning: '',
    appearance_notes: '',
    annotated_by: '',
    price: resolvedPrice,
    price_basis: [row.component_type, row.subcategory, row.quote_required ? 'Quote Required' : '']
      .filter(Boolean)
      .join(' • '),
  };
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="border-b border-slate-200 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-medium text-slate-950">{value || '—'}</div>
    </div>
  );
}

export default function CatalogPage() {
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);
  const [recentAnnotations, setRecentAnnotations] = useState<CatalogRow[]>([]);

  const [mode, setMode] = useState<CatalogMode>('standard');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selected, setSelected] = useState<CatalogRow | null>(null);

  const [notes, setNotes] = useState('');
  const [matchWarning, setMatchWarning] = useState('');
  const [appearanceNotes, setAppearanceNotes] = useState('');
  const [annotatedBy, setAnnotatedBy] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [loadError, setLoadError] = useState('');

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const visiblePages = useMemo(
    () => buildVisiblePages(currentPage, totalPages),
    [currentPage, totalPages]
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, mode]);

  useEffect(() => {
    setSelected(null);
    setNotes('');
    setMatchWarning('');
    setAppearanceNotes('');
    setAnnotatedBy('');
    setSaveMessage('');
  }, [mode]);

  useEffect(() => {
    async function loadCatalog() {
      setLoadError('');

      if (!debouncedSearch) {
        setCatalogRows([]);
        setTotalCount(0);
        return;
      }

      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const term = debouncedSearch.toLowerCase();

      if (mode === 'standard') {
        const { data, error, count } = await supabase
          .from('vendor_catalog')
          .select('*', { count: 'exact' })
          .or(
            `item_name.ilike.%${term}%,vendor.ilike.%${term}%,size.ilike.%${term}%,unit.ilike.%${term}%,category.ilike.%${term}%,material_class.ilike.%${term}%`
          )
          .order('vendor', { ascending: true })
          .order('item_name', { ascending: true })
          .range(from, to);

        if (error) {
          console.error('Failed to load catalog:', error);
          setLoadError(error.message);
          return;
        }

        setCatalogRows((data as CatalogRow[]) || []);
        setTotalCount(count || 0);
        return;
      }

      const { data, error, count } = await supabase
        .from('vendor_catalog_v2')
        .select('*', { count: 'exact' })
        .or(
          `item_name.ilike.%${term}%,vendor_name.ilike.%${term}%,size.ilike.%${term}%,category.ilike.%${term}%,subcategory.ilike.%${term}%,product_line.ilike.%${term}%,component_type.ilike.%${term}%,material_type.ilike.%${term}%,packaging.ilike.%${term}%`
        )
        .order('vendor_name', { ascending: true })
        .order('item_name', { ascending: true })
        .range(from, to);

      if (error) {
        console.error('Failed to load specialty catalog:', error);
        setLoadError(error.message);
        return;
      }

      setCatalogRows(((data as CatalogRowV2[]) || []).map(mapV2ToCatalogRow));
      setTotalCount(count || 0);
    }

    loadCatalog();
  }, [debouncedSearch, currentPage, mode]);

  useEffect(() => {
    async function loadRecentAnnotations() {
      const { data, error } = await supabase
        .from('vendor_catalog')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to load recent annotations:', error);
        return;
      }

      setRecentAnnotations(
        ((data as CatalogRow[]) || [])
          .filter((row) => hasAnnotation(row))
          .slice(0, RECENT_ANNOTATIONS_LIMIT)
      );
    }

    loadRecentAnnotations();
  }, []);

  function selectRow(row: CatalogRow) {
    setSelected(row);
    setNotes(row.notes || '');
    setMatchWarning(mode === 'standard' ? row.match_warning || '' : '');
    setAppearanceNotes(mode === 'standard' ? row.appearance_notes || '' : '');
    setAnnotatedBy(mode === 'standard' ? row.annotated_by || '' : '');
    setSaveMessage('');
  }

  async function refreshRecentAnnotations() {
    const { data, error } = await supabase
      .from('vendor_catalog')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Failed to refresh recent annotations:', error);
      return;
    }

    setRecentAnnotations(
      ((data as CatalogRow[]) || [])
        .filter((row) => hasAnnotation(row))
        .slice(0, RECENT_ANNOTATIONS_LIMIT)
    );
  }

  async function handleSaveAnnotation() {
    if (!selected || mode !== 'standard') return;

    setIsSaving(true);
    setSaveMessage('');

    const cleanedAnnotatedBy = annotatedBy.trim() || null;

    const { error } = await supabase
      .from('vendor_catalog')
      .update({
        notes,
        match_warning: matchWarning,
        appearance_notes: appearanceNotes,
        annotated_by: cleanedAnnotatedBy,
      })
      .eq('id', selected.id);

    if (error) {
      console.error('Failed to save annotation:', error);
      setSaveMessage(`Failed to save: ${error.message}`);
      setIsSaving(false);
      return;
    }

    const updatedRow: CatalogRow = {
      ...selected,
      notes,
      match_warning: matchWarning,
      appearance_notes: appearanceNotes,
      annotated_by: cleanedAnnotatedBy || '',
      updated_at: new Date().toISOString(),
    };

    setSelected(updatedRow);
    setCatalogRows((prev) => prev.map((row) => (row.id === selected.id ? updatedRow : row)));
    await refreshRecentAnnotations();

    setSaveMessage('Annotation saved.');
    setIsSaving(false);
  }

  async function handleDeleteAnnotation() {
    if (!selected || mode !== 'standard') return;

    const confirmed = window.confirm(`Delete all annotation fields for "${selected.item_name}"?`);
    if (!confirmed) return;

    setIsDeleting(true);
    setSaveMessage('');

    const { error } = await supabase
      .from('vendor_catalog')
      .update({
        notes: null,
        match_warning: null,
        appearance_notes: null,
        annotated_by: null,
      })
      .eq('id', selected.id);

    if (error) {
      console.error('Failed to delete annotation:', error);
      setSaveMessage(`Failed to delete: ${error.message}`);
      setIsDeleting(false);
      return;
    }

    const updatedRow: CatalogRow = {
      ...selected,
      notes: '',
      match_warning: '',
      appearance_notes: '',
      annotated_by: '',
      updated_at: new Date().toISOString(),
    };

    setSelected(updatedRow);
    setNotes('');
    setMatchWarning('');
    setAppearanceNotes('');
    setAnnotatedBy('');
    setCatalogRows((prev) => prev.map((row) => (row.id === selected.id ? updatedRow : row)));
    await refreshRecentAnnotations();

    setSaveMessage('Annotation deleted.');
    setIsDeleting(false);
  }

  function handlePageChange(nextPage: number) {
    setCurrentPage(Math.min(Math.max(1, nextPage), totalPages));
  }

  const showingFrom = debouncedSearch && totalCount > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = debouncedSearch && totalCount > 0 ? Math.min(currentPage * PAGE_SIZE, totalCount) : 0;
  const selectedPdfUrl = selected ? getSourcePdfUrl(selected) : null;

  const specialtyIsQuoteRequired =
    mode === 'specialty' &&
    selected &&
    typeof selected.price === 'string' &&
    selected.price.toLowerCase().includes('quote');

  return (
    <div className="min-h-[calc(100vh-73px)] bg-[#eef1f4] px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <div className="flex flex-col gap-3 border-b border-slate-400/70 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Vendor Reference
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Catalog</h1>
            <p className="mt-1 text-sm text-slate-600">
              Search materials, inspect vendor data, and keep mismatch notes without changing inventory counts.
            </p>
          </div>

          <div className="inline-flex w-fit border border-slate-400 bg-slate-200 p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setMode('standard')}
              className={`px-4 py-2 text-sm font-semibold transition ${
                mode === 'standard'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-white hover:text-slate-950'
              }`}
            >
              Standard Materials
            </button>
            <button
              type="button"
              onClick={() => setMode('specialty')}
              className={`border-l border-slate-400 px-4 py-2 text-sm font-semibold transition ${
                mode === 'specialty'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-white hover:text-slate-950'
              }`}
            >
              System / Specialty
            </button>
          </div>
        </div>

        <section className="border border-slate-400 bg-white shadow-sm">
          <div className="border-b border-slate-300 bg-[#f6f7f9] px-4 py-3">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <label
                  htmlFor="catalog-search"
                  className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                >
                  Search Catalog
                </label>
                <input
                  id="catalog-search"
                  className="h-11 w-full border border-slate-400 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  placeholder={
                    mode === 'standard'
                      ? 'Search material, vendor, size, unit, category, or class'
                      : 'Search specialty vendor, product line, component, or material type'
                  }
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSaveMessage('');
                  }}
                />
              </div>

              <div className="grid grid-cols-2 border border-slate-300 bg-white text-sm lg:min-w-[260px]">
                <div className="border-r border-slate-300 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Visible</div>
                  <div className="font-semibold text-slate-950">{catalogRows.length}</div>
                </div>
                <div className="px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Total</div>
                  <div className="font-semibold text-slate-950">{totalCount}</div>
                </div>
              </div>
            </div>
          </div>

          {loadError && (
            <div className="border-b border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              Failed to load catalog: {loadError}
            </div>
          )}

          <div className="grid min-h-[660px] lg:grid-cols-[minmax(0,1fr)_440px]">
            <div className="border-r border-slate-300">
              <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-4 py-2 text-xs text-slate-600">
                <span>
                  {debouncedSearch && totalCount > 0
                    ? `Showing ${showingFrom}-${showingTo} of ${totalCount}`
                    : 'Search to load vendor catalog rows'}
                </span>
                <span>{debouncedSearch ? `Page ${currentPage} of ${totalPages}` : mode === 'standard' ? 'Standard catalog' : 'Specialty catalog'}</span>
              </div>

              {search.trim() === '' ? (
                <div className="m-4 border border-dashed border-slate-400 bg-slate-50 p-8 text-sm text-slate-600">
                  Start typing to search the catalog. Results load on demand so the page stays fast while entering data.
                </div>
              ) : catalogRows.length === 0 ? (
                <div className="m-4 border border-dashed border-slate-400 bg-slate-50 p-8 text-sm text-slate-600">
                  No matching materials found.
                </div>
              ) : (
                <>
                  <div className="max-h-[610px] overflow-auto">
                    <table className="min-w-full border-collapse text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-[#dfe4ea] text-[10px] uppercase tracking-[0.14em] text-slate-600">
                        <tr className="border-b border-slate-400">
                          <th className="w-[22%] px-3 py-2 font-semibold">Vendor</th>
                          <th className="w-[30%] px-3 py-2 font-semibold">Material</th>
                          <th className="w-[13%] px-3 py-2 font-semibold">Size</th>
                          <th className="w-[13%] px-3 py-2 font-semibold">Unit</th>
                          <th className="w-[14%] px-3 py-2 font-semibold">Class</th>
                          <th className="w-[8%] px-3 py-2 text-right font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {catalogRows.map((row) => {
                          const isSelected = selected?.id === row.id;
                          const annotated = mode === 'standard' && hasAnnotation(row);
                          const quoteRequired =
                            mode === 'specialty' &&
                            typeof row.price === 'string' &&
                            row.price.toLowerCase().includes('quote');

                          return (
                            <tr
                              key={row.id}
                              onClick={() => selectRow(row)}
                              className={`cursor-pointer transition ${
                                isSelected
                                  ? 'bg-slate-800 text-white'
                                  : 'text-slate-800 hover:bg-slate-100'
                              }`}
                            >
                              <td className="px-3 py-2 align-top font-semibold">{row.vendor || '—'}</td>
                              <td className="px-3 py-2 align-top">
                                <div className="font-semibold">{row.item_name || '—'}</div>
                                {row.category && (
                                  <div className={isSelected ? 'mt-0.5 text-xs text-slate-200' : 'mt-0.5 text-xs text-slate-500'}>
                                    {row.category}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top">{row.size || '—'}</td>
                              <td className="px-3 py-2 align-top">{row.unit || '—'}</td>
                              <td className="px-3 py-2 align-top">{row.material_class || '—'}</td>
                              <td className="px-3 py-2 text-right align-top">
                                {annotated ? (
                                  <span className={isSelected ? 'font-semibold text-white' : 'font-semibold text-amber-700'}>
                                    Note
                                  </span>
                                ) : quoteRequired ? (
                                  <span className={isSelected ? 'font-semibold text-white' : 'font-semibold text-slate-700'}>
                                    Quote
                                  </span>
                                ) : (
                                  <span className={isSelected ? 'text-slate-300' : 'text-slate-400'}>—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-300 bg-[#f6f7f9] px-4 py-3">
                      <div className="text-xs font-medium text-slate-600">Result pages</div>
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="border border-slate-400 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Previous
                        </button>

                        {visiblePages.map((page, index) => {
                          const previousPage = visiblePages[index - 1];
                          const showEllipsis = previousPage && page - previousPage > 1;

                          return (
                            <div key={page} className="flex items-center gap-1">
                              {showEllipsis && <span className="px-1 text-xs text-slate-500">…</span>}
                              <button
                                type="button"
                                onClick={() => handlePageChange(page)}
                                className={`border px-3 py-1.5 text-xs font-semibold ${
                                  currentPage === page
                                    ? 'border-slate-800 bg-slate-800 text-white'
                                    : 'border-slate-400 bg-white text-slate-800 hover:bg-slate-100'
                                }`}
                              >
                                {page}
                              </button>
                            </div>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="border border-slate-400 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <aside className="bg-white">
              <div className="border-b border-slate-300 bg-slate-100 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">
                      {mode === 'standard' ? 'Material Detail / Notes' : 'Specialty Detail'}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {mode === 'standard' ? 'Annotations only. Stock is changed from Record Stock.' : 'Read-only vendor/system reference.'}
                    </p>
                  </div>
                  {selectedPdfUrl && (
                    <a
                      href={selectedPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border border-slate-500 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-800 hover:text-white"
                    >
                      Open PDF
                    </a>
                  )}
                </div>
              </div>

              {selected ? (
                <div className="max-h-[770px] overflow-y-auto px-4 py-3">
                  <div className="border border-slate-300 bg-slate-50 px-3 py-2">
                    <div className="text-lg font-semibold leading-tight text-slate-950">{selected.item_name}</div>
                    <div className="mt-1 text-sm font-medium text-slate-600">{selected.vendor}</div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-4 border border-slate-300 bg-white px-3 py-1">
                    <DetailField label="Size" value={selected.size} />
                    <DetailField label="Unit" value={selected.unit} />
                    <DetailField label="Category" value={selected.category} />
                    <DetailField label="Class" value={selected.material_class} />
                    <DetailField label="Price" value={formatPrice(selected.price)} />
                    <DetailField label="Basis" value={selected.price_basis} />
                    <div className="col-span-2">
                      <DetailField label={mode === 'standard' ? 'Source File' : 'Source'} value={selected.source_file} />
                    </div>
                  </div>

                  {mode === 'standard' ? (
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Annotated By
                        </label>
                        <input
                          className="h-10 w-full border border-slate-400 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                          value={annotatedBy}
                          onChange={(e) => setAnnotatedBy(e.target.value)}
                          placeholder="Name"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Notes
                        </label>
                        <textarea
                          className="w-full border border-slate-400 bg-white p-3 text-sm text-slate-950 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={4}
                          placeholder="General catalog note"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Match Warning
                        </label>
                        <textarea
                          className="w-full border border-slate-400 bg-white p-3 text-sm text-slate-950 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                          value={matchWarning}
                          onChange={(e) => setMatchWarning(e.target.value)}
                          rows={3}
                          placeholder="Example: size/vendor name does not match inventory naming"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Appearance Notes
                        </label>
                        <textarea
                          className="w-full border border-slate-400 bg-white p-3 text-sm text-slate-950 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                          value={appearanceNotes}
                          onChange={(e) => setAppearanceNotes(e.target.value)}
                          rows={3}
                          placeholder="Color, texture, aggregate appearance, or matching notes"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 border-t border-slate-300 pt-3">
                        <button
                          type="button"
                          className="bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={handleSaveAnnotation}
                          disabled={isSaving || isDeleting}
                        >
                          {isSaving ? 'Saving...' : 'Save Annotation'}
                        </button>
                        <button
                          type="button"
                          className="border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={handleDeleteAnnotation}
                          disabled={isSaving || isDeleting || !hasAnnotation(selected)}
                        >
                          {isDeleting ? 'Deleting...' : 'Delete Annotation'}
                        </button>
                        {saveMessage && <span className="text-sm font-medium text-slate-600">{saveMessage}</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div className="border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
                        Specialty catalog records are read-only here. Use them as references for systems, components, and quote-required materials.
                      </div>
                      <div className="border border-slate-300 bg-white p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Quote Status</div>
                        <div className="mt-1 text-sm font-semibold text-slate-950">
                          {specialtyIsQuoteRequired ? 'Quote Required' : 'Standard pricing available'}
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Reference Notes
                        </label>
                        <textarea
                          className="w-full border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 outline-none"
                          value={notes}
                          readOnly
                          rows={5}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="m-4 border border-dashed border-slate-400 bg-slate-50 p-6 text-sm text-slate-600">
                  Select a catalog row to inspect vendor details and notes.
                </div>
              )}
            </aside>
          </div>
        </section>

        <section className="border border-slate-400 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-300 bg-[#f6f7f9] px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Recent Annotations</h2>
            <span className="text-xs font-medium text-slate-500">Latest catalog notes and warnings</span>
          </div>

          {recentAnnotations.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-600">No annotated entries yet.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {recentAnnotations.map((row) => {
                const pdfUrl = getSourcePdfUrl(row);
                return (
                  <div key={row.id} className="grid gap-3 px-4 py-3 text-sm hover:bg-slate-50 lg:grid-cols-[1fr_auto] lg:items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('standard');
                        selectRow(row);
                      }}
                      className="min-w-0 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-950">{row.item_name}</span>
                        {row.match_warning?.trim() && (
                          <span className="border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800">Warning</span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.vendor} • {row.size || '—'}{row.annotated_by?.trim() ? ` • ${row.annotated_by}` : ''}
                      </div>
                      <div className="mt-1 truncate text-xs font-medium text-slate-700">{formatAnnotationSummary(row)}</div>
                    </button>

                    {pdfUrl && (
                      <a
                        href={pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-fit border border-slate-400 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-800 hover:text-white"
                      >
                        Open PDF
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
