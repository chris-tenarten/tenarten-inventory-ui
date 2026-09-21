'use client';
import { useState } from 'react';
import type { ManpowerEntry, ManpowerReference } from './types';
import { laborHours, summarizeProductLabor } from './product-reporting';

export default function ProductLaborSummary({ entries, totalEntries, categories, tasks, jobScoped }: {
  entries: ManpowerEntry[]; totalEntries: ManpowerEntry[]; categories: ManpowerReference[]; tasks: ManpowerReference[]; jobScoped: boolean;
}) {
  const [orientation, setOrientation] = useState<'task' | 'product'>('task');
  const breakdown = summarizeProductLabor(entries, categories, tasks, orientation);
  return <section aria-label="Labor breakdown" className="min-w-0 rounded-sm border border-slate-200 bg-white p-3">
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3"><div><p className="text-xs font-bold text-slate-600">{jobScoped ? 'Total Job Hours' : 'Total Reported Hours'} · all products, all dates</p><p data-testid="labor-total" className="text-xl font-bold tabular-nums">{laborHours(totalEntries).toFixed(2)} h</p></div><div><p className="text-xs font-bold text-slate-600">Matching Hours · current filters</p><p data-testid="labor-matching" className="text-xl font-bold tabular-nums">{laborHours(entries).toFixed(2)} h</p></div><div className="flex gap-1" aria-label="Breakdown orientation">{(['task', 'product'] as const).map((value) => <button type="button" key={value} aria-pressed={orientation === value} onClick={() => setOrientation(value)} className={`rounded-sm border px-3 py-2 text-sm font-semibold ${orientation === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}>By {value === 'task' ? 'Task' : 'Product'}</button>)}</div></div>
    <p className="mt-2 text-xs text-slate-500">Includes original and Rework labor. Totals below reflect the current filters.</p>
    <div className="mt-3 max-h-80 overflow-y-auto">{breakdown.map((parent) => <details key={parent.id} className="border-t border-slate-200 py-2"><summary className="cursor-pointer text-sm font-semibold"><span>{parent.label}</span><span className="ml-3 tabular-nums">{parent.hours.toFixed(2)} h</span></summary><ul className="ml-5 mt-2 space-y-1 text-sm">{parent.children.map((child) => <li key={child.id} className="flex justify-between gap-3"><span>{child.label}</span><span className="shrink-0 tabular-nums">{child.hours.toFixed(2)} h</span></li>)}</ul></details>)}{!breakdown.length && <p className="text-sm text-slate-500">No labor matches these filters.</p>}</div>
  </section>;
}
