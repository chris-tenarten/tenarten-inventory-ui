"use client";

import { Fragment, useState } from "react";
import type { PurchasingCatalogSuggestion } from "./types";

const pageSize = 50;

/** All matches remain available; only one small page mounts at a time. */
export default function CatalogSearchResults({ items, onSelect, listbox = false, listboxId, resultGroup, resultNote }: {
  items: PurchasingCatalogSuggestion[];
  onSelect(item: PurchasingCatalogSuggestion): void;
  listbox?: boolean;
  listboxId?: string;
  resultGroup?(item: PurchasingCatalogSuggestion): string;
  resultNote?(item: PurchasingCatalogSuggestion): string;
}) {
  const [page, setPage] = useState(0);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(items.length / pageSize) - 1));
  const start = currentPage * pageSize;
  return <>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <span role="status">{start + 1}–{Math.min(start + pageSize, items.length)} of {items.length} Catalog matches</span>
      {items.length > pageSize && <div className="flex gap-3">
        <button type="button" disabled={currentPage === 0} onMouseDown={(event) => event.preventDefault()} onClick={() => setPage(currentPage - 1)} className="font-semibold text-blue-700 disabled:text-slate-400">Previous results</button>
        <button type="button" disabled={start + pageSize >= items.length} onMouseDown={(event) => event.preventDefault()} onClick={() => setPage(currentPage + 1)} className="font-semibold text-blue-700 disabled:text-slate-400">Next results</button>
      </div>}
    </div>
    <div key={currentPage} id={listboxId} role={listbox ? "listbox" : undefined} aria-label={listbox ? "Catalog matches" : undefined} className="max-h-64 overflow-y-auto">
      {items.slice(start, start + pageSize).map((item, index, pageItems) => <Fragment key={`${item.source}:${item.id}`}>
        {resultGroup && (index === 0 || resultGroup(pageItems[index - 1]) !== resultGroup(item)) && <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{resultGroup(item)}</div>}
        <button type="button"
        role={listbox ? "option" : undefined} aria-selected={listbox ? false : undefined}
        onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(item)}
        className="block w-full border-b border-slate-200 px-3 py-2 break-words text-left text-xs hover:bg-slate-50"
      >
        {resultNote?.(item) && <span className="block text-xs font-medium text-amber-700">{resultNote(item)}</span>}
        <strong className="block text-sm">{item.materialName}</strong>
        <span className="block text-slate-600">{[item.source === "specialty" ? "Specialty" : "Regular", item.quoteRequired ? "Quote required" : "", item.vendor, item.vendorSku, item.chipSize, item.materialType, item.componentType, [item.packageQuantity, item.packageMeasure, item.containerType].filter(Boolean).join(" "), !listbox && !item.quoteRequired && item.referencePrice ? `$${item.referencePrice}` : ""].filter(Boolean).join(" · ")}</span>
      </button></Fragment>)}
    </div>
  </>;
}
