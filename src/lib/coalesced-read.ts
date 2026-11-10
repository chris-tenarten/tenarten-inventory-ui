/** Component-owned read coordination. Never a module/global or persistent cache. */
export class InvalidatedRead extends Error {
  constructor() { super('Read owner changed.'); }
}

export class CoalescedRead<T> {
  private epoch = 0;
  private revision = 0;
  private pending: Promise<T> | null = null;
  private cached: { value: T; at: number } | null = null;
  private listeners = new Set<(value: T) => void>();

  constructor(private readonly fetchValue: () => Promise<T>, private readonly maxAgeMs = 0) {}

  subscribe(listener: (value: T) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Invalidations never use a time-based cooldown. Events during a read require
   * one trailing read; all waiters receive only the final current generation. */
  refresh(): Promise<T> {
    this.invalidate();
    return this.read();
  }

  invalidate() {
    this.revision++;
    this.cached = null;
  }

  read(): Promise<T> {
    if (this.pending) return this.pending;
    if (this.cached && Date.now() - this.cached.at < this.maxAgeMs) return Promise.resolve(this.cached.value);
    const epoch = this.epoch;
    const run = async (): Promise<T> => {
      // Equivalent requests in one event turn share the first snapshot.
      await Promise.resolve();
      for (;;) {
        if (epoch !== this.epoch) throw new InvalidatedRead();
        const revision = this.revision;
        let value: T;
        try { value = await this.fetchValue(); }
        catch (error) {
          if (epoch !== this.epoch) throw new InvalidatedRead();
          if (revision !== this.revision) continue;
          this.cached = null;
          throw error;
        }
        if (epoch !== this.epoch) throw new InvalidatedRead();
        if (revision !== this.revision) continue;
        this.cached = { value, at: Date.now() };
        for (const listener of this.listeners) listener(value);
        return value;
      }
    };
    const pending = run().finally(() => { if (this.pending === pending) this.pending = null; });
    this.pending = pending;
    return pending;
  }

  /** Cleanup invalidates both fulfilled reuse and late results, including errors.
   * A StrictMode effect replay may start a fresh read on this same instance. */
  reset() {
    this.epoch++;
    this.revision++;
    this.pending = null;
    this.cached = null;
  }
}
