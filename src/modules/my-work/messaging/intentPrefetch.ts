import type { InboxMessage } from '../inbox';
import { RecentThreads } from './recentThreads';

/** At most one speculative page in flight. No subscriptions, read receipts or bytes. */
export class IntentPrefetch {
  private owner = '';
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private flight?: { owner: string; peer: string; generation: number; retain: boolean; promise: Promise<InboxMessage[]> };
  constructor(private cache: RecentThreads, private load: (peer: string) => Promise<InboxMessage[]>) {}
  reset(owner: string) {
    if (owner === this.owner) return;
    this.cancel(); this.owner = owner; this.generation++;
  }
  cancel() {
    clearTimeout(this.timer);
    if (this.flight) this.flight.retain = false;
  }
  intent(owner: string, peer: string) {
    this.cancel();
    if (!owner || owner !== this.owner || !peer || this.cache.get(owner, peer) || this.flight) return;
    const generation = this.generation;
    this.timer = setTimeout(() => {
      if (owner !== this.owner || generation !== this.generation) return;
      const flight = { owner, peer, generation, retain: true, promise: this.load(peer) };
      this.flight = flight;
      void flight.promise.then(rows => {
        if (flight.retain && owner === this.owner && generation === this.generation && rows.length) {
          // Canonical RPC enforces authorization; cache additionally verifies participants.
          this.cache.put(owner, peer, rows, rows.length === 40);
        }
      }).catch(() => { /* Intent failure is silent; selection retries normally. */ }).finally(() => {
        if (this.flight === flight) this.flight = undefined;
      });
    }, 100);
  }
  take(owner: string, peer: string) {
    const flight = this.flight;
    return flight && flight.owner === owner && flight.peer === peer && flight.generation === this.generation
      ? flight.promise : undefined;
  }
}
