export const LABOR_PAGE_SIZE = 500;

type Page<T> = { data: T[] | null; error: { message: string } | null; count: number | null };

/** Every caller supplies a unique final order (id) and an exact count.
 * Never publish a partial report if a page fails or membership changes mid-read. */
export async function loadCompleteLabor<T>(fetchPage: (from: number, to: number) => PromiseLike<Page<T>>): Promise<T[]> {
  const rows: T[] = [];
  const seenIds = new Set<string>();
  let expected: number | null = null;
  for (let from = 0; ; from += LABOR_PAGE_SIZE) {
    const page = await fetchPage(from, from + LABOR_PAGE_SIZE - 1);
    if (page.error) throw new Error(page.error.message);
    if (page.count === null) throw new Error('Unable to verify the complete labor count. Refresh and retry.');
    expected ??= page.count;
    if (page.count !== expected) throw new Error('Labor changed while loading. Refresh to load a complete report.');
    for (const row of page.data ?? []) {
      if (row && typeof row === 'object' && 'id' in row && typeof row.id === 'string') {
        if (seenIds.has(row.id)) throw new Error('Labor changed while loading. Refresh to load a complete report.');
        seenIds.add(row.id);
      }
    }
    rows.push(...(page.data ?? []));
    if (rows.length === expected) return rows;
    if (!page.data || page.data.length !== LABOR_PAGE_SIZE || rows.length > expected) {
      throw new Error('Labor loading was incomplete. Refresh and retry.');
    }
  }
}
