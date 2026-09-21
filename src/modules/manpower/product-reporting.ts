import type { ManpowerEntry, ManpowerReference } from './types';

export const UNCATEGORIZED = '__uncategorized__';
export const entryHundredths = (entry: Pick<ManpowerEntry, 'am_hours' | 'pm_hours'>) =>
  Math.round(Number(entry.am_hours) * 100) + Math.round(Number(entry.pm_hours) * 100);
export const laborHours = (entries: Pick<ManpowerEntry, 'am_hours' | 'pm_hours'>[]) =>
  entries.reduce((sum, entry) => sum + entryHundredths(entry), 0) / 100;
export const productKey = (entry: Pick<ManpowerEntry, 'product_category_id'>) => entry.product_category_id ?? UNCATEGORIZED;
export function productLabel(id: string, categories: ManpowerReference[]) {
  if (id === UNCATEGORIZED) return 'Uncategorized';
  const category = categories.find((item) => item.id === id);
  return category ? `${category.display_name}${category.is_active ? '' : ' · Inactive'}` : 'Unavailable category';
}
export function validateProductSelection(value: string, categories: ManpowerReference[], original?: string | null) {
  if (original !== undefined && value === (original ?? '')) return '';
  if (!value) return 'Select an active Product Category.';
  return categories.some((item) => item.id === value && item.is_active) ? '' : 'Choose an active Product Category; this selection is no longer active.';
}
export type LaborBreakdown = { id: string; label: string; hours: number; children: { id: string; label: string; hours: number }[] };
export function summarizeProductLabor(entries: ManpowerEntry[], categories: ManpowerReference[], tasks: ManpowerReference[], orientation: 'task' | 'product'): LaborBreakdown[] {
  const parents = new Map<string, { label: string; units: number; children: Map<string, { label: string; units: number }> }>();
  for (const entry of entries) {
    const product = productKey(entry);
    const taskLabel = tasks.find((task) => task.id === entry.task_id)?.display_name ?? entry.task.display_name;
    const categoryLabel = productLabel(product, categories);
    const parentId = orientation === 'task' ? entry.task_id : product;
    const childId = orientation === 'task' ? product : entry.task_id;
    const parent = parents.get(parentId) ?? { label: orientation === 'task' ? taskLabel : categoryLabel, units: 0, children: new Map() };
    const child = parent.children.get(childId) ?? { label: orientation === 'task' ? categoryLabel : taskLabel, units: 0 };
    const units = entryHundredths(entry);
    parent.units += units; child.units += units;
    parent.children.set(childId, child); parents.set(parentId, parent);
  }
  return [...parents].map(([id, parent]) => ({ id, label: parent.label, hours: parent.units / 100,
    children: [...parent.children].map(([childId, child]) => ({ id: childId, label: child.label, hours: child.units / 100 })).sort((a, b) => b.hours - a.hours || a.label.localeCompare(b.label) || a.id.localeCompare(b.id)),
  })).sort((a, b) => b.hours - a.hours || a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
}
