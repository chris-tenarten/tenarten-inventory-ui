/** Browser-local text only. One bounded envelope per authenticated owner/workflow. */
export const DRAFT_TTL = 30 * 24 * 60 * 60 * 1000;
export const MAX_DRAFTS = 40;
export const MAX_TEXT = 32000;
type Entry = { text: string; updated: number; revision: string };
type Entries = Record<string, Entry>;
export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export class TextDraft {
  text = '';
  private revision = '';
  private dirty = false;
  readonly key: string;
  constructor(readonly owner: string, readonly workflow: string, readonly record: string, private storage: () => DraftStorage | undefined = () => typeof window === 'undefined' ? undefined : window.localStorage) {
    this.key = `tenops:text-drafts:v1:${encodeURIComponent(owner)}:${encodeURIComponent(workflow)}`;
    const entry = this.read()[record];
    if (entry) { this.text = entry.text; this.revision = entry.revision; }
  }
  private read(): Entries {
    try {
      const raw: unknown = JSON.parse(this.storage()?.getItem(this.key) ?? '{}');
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
      return Object.fromEntries(Object.entries(raw).filter(([, v]) => v && typeof v.text === 'string' && v.text.length <= MAX_TEXT && typeof v.revision === 'string' && Number.isFinite(v.updated) && v.updated > Date.now() - DRAFT_TTL));
    } catch { return {}; }
  }
  set(text: string) { this.text = text; this.revision = crypto.randomUUID(); this.dirty = true; }
  snapshot() { return this.revision; }
  clearSent(revision: string) {
    if (this.revision !== revision) return false;
    const stored = this.read()[this.record];
    if (!this.dirty && stored && stored.revision !== revision) return false;
    this.set(''); this.flush(); return true;
  }
  flush() {
    if (!this.dirty || !this.owner || !this.record) return;
    try {
      const entries = this.read();
      delete entries[this.record];
      if (this.text.trim() && this.text.length <= MAX_TEXT) entries[this.record] = { text: this.text, updated: Date.now(), revision: this.revision };
      const bounded = Object.fromEntries(Object.entries(entries).sort((a,b) => b[1].updated - a[1].updated).slice(0, MAX_DRAFTS));
      const storage = this.storage();
      if (!storage) return;
      if (Object.keys(bounded).length) storage.setItem(this.key, JSON.stringify(bounded));
      else storage.removeItem(this.key);
      this.dirty = false;
    } catch { /* Quota/privacy restrictions must never interrupt composition or send. */ }
  }
}
