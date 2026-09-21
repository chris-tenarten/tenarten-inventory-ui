'use client';

import { useState } from 'react';
import { UNCATEGORIZED, type LaborBreakdown } from './product-reporting';

export default function ProductLaborDistribution({ breakdown, scope }: { breakdown: LaborBreakdown[]; scope: string }) {
  const [showAll, setShowAll] = useState(false);
  const products = breakdown.filter((item) => item.id !== UNCATEGORIZED);
  const categorized = products.reduce((sum, item) => sum + Math.round(item.hours * 100), 0) / 100;
  const uncategorized = breakdown.find((item) => item.id === UNCATEGORIZED)?.hours ?? 0;
  const visible = showAll ? products : products.slice(0, 5);

  return <section aria-label="Product Category distribution" className="min-w-0">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-xs font-bold text-slate-800">Product Category labor</h3>
      <span className="text-xs text-slate-500">{scope}</span>
    </div>
    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
      <span>Categorized <strong className="tabular-nums" data-testid="categorized-hours">{categorized.toFixed(2)} h</strong></span>
      <span className="text-slate-600">Uncategorized <strong className="tabular-nums" data-testid="uncategorized-hours">{uncategorized.toFixed(2)} h</strong></span>
    </div>
    <p className="mt-1 text-xs text-slate-500">Percentages use categorized hours only. Uncategorized includes historical labor and is excluded from the distribution.</p>
    {categorized > 0 ? <div className="mt-2 divide-y divide-slate-100">
      {visible.map((product) => <details key={product.id} className="py-2">
        <summary className="cursor-pointer text-xs">
          <span className="font-semibold">{product.label}</span>
          <span className="ml-3 inline-block tabular-nums">{product.hours.toFixed(2)} h · {(product.hours / categorized * 100).toFixed(1)}%</span>
        </summary>
        <div aria-hidden="true" className="mt-1 h-1 bg-slate-100"><div className="h-full bg-blue-600" style={{ width: `${product.hours / categorized * 100}%` }} /></div>
        <ul className="ml-4 mt-2 space-y-1 text-xs text-slate-600">{product.children.map((task) => <li key={task.id} className="flex justify-between gap-3"><span>{task.label}</span><span className="shrink-0 tabular-nums">{task.hours.toFixed(2)} h</span></li>)}</ul>
      </details>)}
      {products.length > 5 && <button type="button" onClick={() => setShowAll(!showAll)} className="py-2 text-xs font-semibold text-blue-800">{showAll ? 'Show fewer products' : `Show all ${products.length} products`}</button>}
    </div> : <p className="mt-2 text-xs text-slate-500">No categorized labor in this scope.</p>}
  </section>;
}
