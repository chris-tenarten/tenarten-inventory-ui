/** Portable Job identity. Display names, filters and credentials never enter the URL. */
export const PRODUCTION_JOB_QUERY_KEY = 'open-production-job';
const jobIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requestedProductionJob(search: string): { present: boolean; jobId: string | null } {
  const values = new URLSearchParams(search).getAll(PRODUCTION_JOB_QUERY_KEY);
  return {
    present: values.length > 0,
    jobId: values.length === 1 && jobIdPattern.test(values[0]) ? values[0].toLowerCase() : null,
  };
}

export function productionJobPath(jobId: string): string {
  if (!jobIdPattern.test(jobId)) throw new Error('Invalid Production Job reference.');
  return `/?${PRODUCTION_JOB_QUERY_KEY}=${encodeURIComponent(jobId.toLowerCase())}`;
}

export function productionJobUrl(jobId: string, origin: string): string {
  return new URL(productionJobPath(jobId), new URL(origin).origin).href;
}

export type ProductionJobLinkPart = { text: string; href?: string; jobId?: string };

/** Recognize only the canonical local contract, never labels or arbitrary links. */
export function canonicalProductionJobReference(value: string, origin: string): { jobId: string; href: string } | null {
  try {
    const url = new URL(value);
    const target = requestedProductionJob(url.search);
    if (url.origin !== new URL(origin).origin || url.username || url.password || url.pathname !== '/' || url.hash ||
      [...url.searchParams].length !== 1 || !target.jobId) return null;
    return { jobId: target.jobId, href: productionJobUrl(target.jobId, origin) };
  } catch {
    return null;
  }
}

/** Parse identities once for every Messaging presentation; leave other text intact. */
export function splitProductionJobLinks(body: string, origin: string): ProductionJobLinkPart[] {
  const parts: ProductionJobLinkPart[] = [];
  let cursor = 0;
  for (const match of body.matchAll(/https?:\/\/[^\s<>"']+/g)) {
    const text = match[0].replace(/[.,;:!?)\]}]+$/, '');
    const reference = canonicalProductionJobReference(text, origin);
    if (!reference) continue;
    if (match.index! > cursor) parts.push({ text: body.slice(cursor, match.index) });
    parts.push({ text, ...reference });
    cursor = match.index! + text.length;
  }
  if (cursor < body.length) parts.push({ text: body.slice(cursor) });
  return parts;
}

/** Small conversation/reply summaries never enrich or trust a referenced name. */
export function productionJobMessagePreview(body: string, origin: string): string {
  return splitProductionJobLinks(body, origin).map(part => part.jobId ? 'Production Job' : part.text).join('');
}
