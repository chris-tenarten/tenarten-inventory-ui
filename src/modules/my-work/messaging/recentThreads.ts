import type { InboxMessage } from '../inbox';
export type RecentThread = { messages: InboxMessage[]; hasOlder: boolean };
/** Private memory only: one owner, five peers, at most forty rows per peer. */
export class RecentThreads {
  private owner = '';
  private entries = new Map<string, RecentThread>();
  reset(owner: string) { if (owner !== this.owner) { this.entries.clear(); this.owner = owner; } }
  clear() { this.entries.clear(); this.owner = ''; }
  get(owner: string, peer: string) {
    if (!owner || owner !== this.owner) return undefined;
    const entry = this.entries.get(peer);
    if (entry) { this.entries.delete(peer); this.entries.set(peer, entry); }
    return entry;
  }
  remove(peer: string) { this.entries.delete(peer); }
  put(owner: string, peer: string, messages: InboxMessage[], hasOlder: boolean) {
    if (!owner || owner !== this.owner || !peer) return;
    if (messages.some(row => !((row.senderUserId === owner && row.recipientUserId === peer)
      || (row.senderUserId === peer && row.recipientUserId === owner)))) return;
    this.entries.delete(peer);
    this.entries.set(peer, { messages: messages.slice(-40), hasOlder: hasOlder || messages.length > 40 });
    while (this.entries.size > 5) this.entries.delete(this.entries.keys().next().value!);
  }
}
