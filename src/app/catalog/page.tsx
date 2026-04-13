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

const PAGE_SIZE = 100;
const RECENT_ANNOTATIONS_LIMIT = 5;

/**
 * Put your PDFs in public/vendor-pdfs/ with these filenames,
 * or change the paths below to match your setup.
 */
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
    row.notes?.trim() ||
      row.match_warning?.trim() ||
      row.appearance_notes?.trim()
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

  if (
    sourceText.includes('arim') ||
    vendorText.includes('arim')
  ) {
    return SOURCE_PDF_MAP.arim;
  }

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

export default function CatalogPage() {
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);
  const [recentAnnotations, setRecentAnnotations] = useState<CatalogRow[]>([]);

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
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

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
    }

    loadCatalog();
  }, [debouncedSearch, currentPage]);

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

      const recent = ((data as CatalogRow[]) || [])
        .filter((row) => hasAnnotation(row))
        .slice(0, RECENT_ANNOTATIONS_LIMIT);

      setRecentAnnotations(recent);
    }

    loadRecentAnnotations();
  }, []);

  function selectRow(row: CatalogRow) {
    setSelected(row);
    setNotes(row.notes || '');
    setMatchWarning(row.match_warning || '');
    setAppearanceNotes(row.appearance_notes || '');
    setAnnotatedBy(row.annotated_by || '');
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

    const recent = ((data as CatalogRow[]) || [])
      .filter((row) => hasAnnotation(row))
      .slice(0, RECENT_ANNOTATIONS_LIMIT);

    setRecentAnnotations(recent);
  }

  async function handleSaveAnnotation() {
    if (!selected) return;

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
    setCatalogRows((prev) =>
      prev.map((row) => (row.id === selected.id ? updatedRow : row))
    );

    await refreshRecentAnnotations();

    setSaveMessage('Annotation saved.');
    setIsSaving(false);
  }

  async function handleDeleteAnnotation() {
    if (!selected) return;

    const confirmed = window.confirm(
      `Delete all annotation fields for "${selected.item_name}"?`
    );

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

    setCatalogRows((prev) =>
      prev.map((row) => (row.id === selected.id ? updatedRow : row))
    );

    await refreshRecentAnnotations();

    setSaveMessage('Annotation deleted.');
    setIsDeleting(false);
  }

  function handlePageChange(nextPage: number) {
    const safePage = Math.min(Math.max(1, nextPage), totalPages);
    setCurrentPage(safePage);
  }

  const showingFrom =
    debouncedSearch && totalCount > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const showingTo =
    debouncedSearch && totalCount > 0
      ? Math.min(currentPage * PAGE_SIZE, totalCount)
      : 0;

  return (
    <div className="min-h-[calc(100vh-73px)] bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#f7f0d0]">
            Catalog
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Search vendor materials, review details, and save mismatch annotations.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
          <label
            htmlFor="catalog-search"
            className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-neutral-500"
          >
            Search
          </label>
          <input
            id="catalog-search"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
            placeholder="Search material, vendor, size, unit, or category"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSaveMessage('');
            }}
          />
        </div>

        {loadError && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
            Failed to load catalog: {loadError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-white">Results</h2>

              {search.trim() !== '' && debouncedSearch !== '' && (
                <div className="text-right text-xs text-neutral-500">
                  <div>
                    Showing {showingFrom}-{showingTo} of {totalCount}
                  </div>
                  <div>
                    Page {currentPage} of {totalPages}
                  </div>
                </div>
              )}
            </div>

            {search.trim() === '' ? (
              <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/60 p-6 text-sm text-neutral-500">
                Start typing to search the catalog.
              </div>
            ) : catalogRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/60 p-6 text-sm text-neutral-500">
                No matching materials found.
              </div>
            ) : (
              <>
                <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                  {catalogRows.map((row) => {
                    const isSelected = selected?.id === row.id;
                    const annotated = hasAnnotation(row);
                    const pdfUrl = getSourcePdfUrl(row);

                    return (
                      <div
                        key={row.id}
                        className={`rounded-xl border transition ${
                          isSelected
                            ? 'border-[#c8a43a] bg-neutral-900 shadow-[inset_0_0_0_1px_rgba(200,164,58,0.35)]'
                            : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700 hover:bg-neutral-900'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 p-3">
                          <button
                            type="button"
                            onClick={() => selectRow(row)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="truncate font-medium text-white">
                                  {row.item_name}
                                </div>
                                <div className="mt-1 text-sm text-neutral-400">
                                  {row.vendor} • {row.size || '—'} • {row.unit || '—'}
                                </div>
                                {row.source_file?.trim() && (
                                  <div className="mt-1 truncate text-xs text-neutral-500">
                                    Source: {row.source_file}
                                  </div>
                                )}
                              </div>

                              {annotated && (
                                <span className="shrink-0 rounded-full border border-yellow-700/60 bg-yellow-950/40 px-2 py-1 text-[11px] font-medium text-yellow-300">
                                  Annotated
                                </span>
                              )}
                            </div>

                            {row.match_warning?.trim() && (
                              <div className="mt-2 text-xs text-red-400">
                                {row.match_warning}
                              </div>
                            )}
                          </button>

                          {pdfUrl ? (
                            <a
                              href={pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800"
                              title="Open source PDF"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Open PDF
                            </a>
                          ) : (
                            <span className="shrink-0 rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-xs text-neutral-500">
                              No PDF
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 pt-4">
                    <div className="text-xs text-neutral-500">
                      Jump between result pages
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-medium text-white transition hover:border-neutral-600 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>

                      {visiblePages.map((page, index) => {
                        const prevPage = visiblePages[index - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;

                        return (
                          <div key={page} className="flex items-center gap-2">
                            {showEllipsis && (
                              <span className="px-1 text-xs text-neutral-500">…</span>
                            )}

                            <button
                              type="button"
                              onClick={() => handlePageChange(page)}
                              className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                                currentPage === page
                                  ? 'border-[#c8a43a] bg-[#c8a43a] text-black'
                                  : 'border-neutral-700 bg-neutral-900 text-white hover:border-neutral-600 hover:bg-neutral-800'
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
                        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-medium text-white transition hover:border-neutral-600 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">
                Details & Annotation
              </h2>

              {selected && getSourcePdfUrl(selected) && (
                <a
                  href={getSourcePdfUrl(selected)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800"
                >
                  Open Source PDF
                </a>
              )}
            </div>

            {selected ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Vendor
                    </div>
                    <div>{selected.vendor}</div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Item
                    </div>
                    <div>{selected.item_name}</div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Size
                    </div>
                    <div>{selected.size || '—'}</div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Unit
                    </div>
                    <div>{selected.unit || '—'}</div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Category
                    </div>
                    <div>{selected.category || '—'}</div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Material Class
                    </div>
                    <div>{selected.material_class || '—'}</div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Price
                    </div>
                    <div>{formatPrice(selected.price)}</div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Price Basis
                    </div>
                    <div>{selected.price_basis || '—'}</div>
                  </div>

                  <div className="col-span-2">
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Source File
                    </div>
                    <div className="break-all text-neutral-300">
                      {selected.source_file || '—'}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    Annotated By
                  </label>
                  <input
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                    value={annotatedBy}
                    onChange={(e) => setAnnotatedBy(e.target.value)}
                    placeholder="Name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    Notes
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    Match Warning
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                    value={matchWarning}
                    onChange={(e) => setMatchWarning(e.target.value)}
                    rows={3}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    Appearance Notes
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-white outline-none transition focus:border-[#c8a43a] focus:ring-1 focus:ring-[#c8a43a]"
                    value={appearanceNotes}
                    onChange={(e) => setAppearanceNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className="rounded-xl bg-[#c8a43a] px-4 py-2.5 font-medium text-black transition hover:bg-[#d6b24a] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleSaveAnnotation}
                    disabled={isSaving || isDeleting}
                  >
                    {isSaving ? 'Saving...' : 'Save Annotation'}
                  </button>

                  <button
                    className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-2.5 font-medium text-red-200 transition hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleDeleteAnnotation}
                    disabled={isSaving || isDeleting || !hasAnnotation(selected)}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Annotation'}
                  </button>

                  {saveMessage && (
                    <div className="text-sm text-neutral-300">{saveMessage}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/60 p-6 text-sm text-neutral-500">
                Select a material to view details.
              </div>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Recent Annotations
            </h2>
            <span className="text-xs text-neutral-500">
              Latest catalog notes and warnings
            </span>
          </div>

          {recentAnnotations.length === 0 ? (
            <div className="text-sm text-neutral-500">No annotated entries yet.</div>
          ) : (
            <div className="divide-y divide-neutral-800">
              {recentAnnotations.map((row) => {
                const pdfUrl = getSourcePdfUrl(row);

                return (
                  <div
                    key={row.id}
                    className="flex items-start justify-between gap-4 py-3"
                  >
                    <button
                      type="button"
                      onClick={() => selectRow(row)}
                      className="min-w-0 flex-1 text-left transition hover:bg-neutral-900/50"
                    >
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-white">
                          {row.item_name}
                        </div>
                        <span className="rounded-full border border-yellow-700/60 bg-yellow-950/40 px-2 py-1 text-[11px] font-medium text-yellow-300">
                          Annotated
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {row.vendor} • {row.size || '—'}
                        {row.annotated_by?.trim() ? ` • ${row.annotated_by}` : ''}
                      </div>
                      <div className="mt-1 truncate text-xs text-neutral-400">
                        {formatAnnotationSummary(row)}
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      {row.match_warning?.trim() && (
                        <span className="rounded-full border border-red-800/70 bg-red-950/40 px-2 py-1 text-[11px] text-red-300">
                          Warning
                        </span>
                      )}

                      {pdfUrl && (
                        <a
                          href={pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open PDF
                        </a>
                      )}
                    </div>
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