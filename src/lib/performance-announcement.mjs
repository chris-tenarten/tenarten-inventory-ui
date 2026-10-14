// Set only at the approved Production activation. Local review never changes this.
export const PERFORMANCE_ACTIVATED_AT = '2026-10-14T23:07:00.000Z';
export const PERFORMANCE_RELEASE = 'operational-performance-2026-10';
export const ANNOUNCEMENT_DURATION = 7 * 24 * 60 * 60 * 1000;

export function announcementWindow(activatedAt, now) {
  const start = typeof activatedAt === 'string' ? Date.parse(activatedAt) : NaN;
  return Number.isFinite(start) && now >= start && now < start + ANNOUNCEMENT_DURATION;
}

export function localAnnouncementPreview(hostname, search) {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return null;
  const value = new URLSearchParams(search).get('performancePreview');
  if (!['active', 'expired', 'before'].includes(value)) return null;
  // Frozen virtual time: neither persisted nor tied to an actual release clock.
  const start = '2030-01-01T00:00:00Z';
  const now = Date.parse(start) + (value === 'expired' ? ANNOUNCEMENT_DURATION : value === 'before' ? -1 : 0);
  return { visible: announcementWindow(start, now), value };
}
