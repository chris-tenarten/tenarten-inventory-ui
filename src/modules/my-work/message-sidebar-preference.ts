/** Display preference only; never a conversation selector or open-dialog state.
 * Match the existing text-draft convention: browser-local and owner-namespaced. */
const KEY_PREFIX = 'tenops.messaging.sidebar-enabled.v1:';
export const messageSidebarPreferenceKey = (ownerId: string) => KEY_PREFIX + encodeURIComponent(ownerId);

export function readMessageSidebarPreference(ownerId: string): boolean {
  if (!ownerId || typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(messageSidebarPreferenceKey(ownerId)) === 'true'; }
  catch { return false; }
}

export function saveMessageSidebarPreference(ownerId: string, enabled: boolean): void {
  if (!ownerId || typeof window === 'undefined') return;
  try { window.localStorage.setItem(messageSidebarPreferenceKey(ownerId), String(enabled)); }
  catch { /* Restricted storage must not interrupt the current display choice. */ }
}
