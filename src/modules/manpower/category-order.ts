import type { ManpowerReference } from './types';

export function activeCategories(categories: ManpowerReference[]) {
  return categories.filter(c => c.is_active).sort((a, b) => a.sort_order - b.sort_order || a.display_name.localeCompare(b.display_name) || a.id.localeCompare(b.id));
}

// UUIDs remain identities; active display positions are disposable, contiguous ranks.
export function normalizeCategories(categories: ManpowerReference[], activeIds = activeCategories(categories).map(c => c.id)) {
  const active = categories.filter(c => c.is_active);
  if (new Set(activeIds).size !== active.length || activeIds.length !== active.length || active.some(c => !activeIds.includes(c.id))) throw new Error('The active category list changed. Refresh and try again.');
  return categories.map(c => c.is_active ? { ...c, sort_order: activeIds.indexOf(c.id) + 1 } : c);
}
