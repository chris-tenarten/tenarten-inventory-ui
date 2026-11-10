/** A local opt-in alone must never turn a Production export into TenDev. */
export function resolveDevBranding({ requested, nodeEnv, pagesUrl } = {}) {
  if (requested !== 'true') return false;
  if (pagesUrl) {
    try {
      const url = new URL(pagesUrl);
      return url.protocol === 'https:' && (url.hostname === 'tendev.pages.dev' || url.hostname.endsWith('.tendev.pages.dev'));
    } catch { return false; }
  }
  return nodeEnv === 'development';
}
