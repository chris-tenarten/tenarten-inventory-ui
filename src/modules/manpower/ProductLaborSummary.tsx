'use client';

import { useState, type ReactNode } from 'react';
import type { ManpowerEntry, ManpowerReference } from './types';
import { laborHours, summarizeProductLabor } from './product-reporting';
import ProductLaborDistribution from './ProductLaborDistribution';

export default function ProductLaborSummary({ entries, totalEntries, categories, tasks, children }: {
  entries: ManpowerEntry[]; totalEntries: ManpowerEntry[]; categories: ManpowerReference[]; tasks: ManpowerReference[]; children: ReactNode;
}) {
  const [orientation, setOrientation] = useState<'task' | 'product'>('product');
  const breakdown = summarizeProductLabor(entries, categories, tasks, orientation);
  return <section aria-label="Job labor summary" className="min-w-0 rounded-sm border border-slate-200 bg-white p-3">
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      <span>Total Job labor <strong data-testid="labor-total" className="tabular-nums">{laborHours(totalEntries).toFixed(2)} h</strong></span>
      <span className="text-slate-600">Matching filters <strong data-testid="labor-matching" className="tabular-nums">{laborHours(entries).toFixed(2)} h</strong></span>
    </div>
    <p className="mt-1 text-xs text-slate-500">All dates · includes original and Rework labor. Job total always includes all products and Uncategorized.</p>
    <details className="mt-2">
      <summary className="cursor-pointer text-xs font-semibold text-blue-800">Product / Task breakdown</summary>
      <div className="mt-3 space-y-3">
        {children}
        <div className="flex gap-1" aria-label="Breakdown orientation">{(['product', 'task'] as const).map((value) => <button type="button" key={value} aria-pressed={orientation === value} onClick={() => setOrientation(value)} className={`rounded-sm border px-3 py-1.5 text-xs font-semibold ${orientation === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}>By {value === 'task' ? 'Task' : 'Product'}</button>)}</div>
        {orientation === 'product' ? <ProductLaborDistribution breakdown={breakdown} scope="This Job · current filters · all dates" /> : <div className="max-h-80 overflow-y-auto">
          <p className="mb-2 text-xs text-slate-500">This Job · current filters · all dates. Expand a Task to see its Products and Uncategorized labor.</p>
          {breakdown.map((parent) => <details key={parent.id} className="border-t border-slate-200 py-2"><summary className="cursor-pointer text-xs font-semibold"><span>{parent.label}</span><span className="ml-3 tabular-nums">{parent.hours.toFixed(2)} h</span></summary><ul className="ml-5 mt-2 space-y-1 text-xs">{parent.children.map((child) => <li key={child.id} className="flex justify-between gap-3"><span>{child.label}</span><span className="shrink-0 tabular-nums">{child.hours.toFixed(2)} h</span></li>)}</ul></details>)}
          {!breakdown.length && <p className="text-xs text-slate-500">No labor matches these filters.</p>}
        </div>}
      </div>
    </details>
  </section>;
}
