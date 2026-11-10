export type AuthorizedJobReference = { id: string; name: string };
export type JobReferenceRecord = { id: string; name: string | null };

/** One visible account/conversation owns this cache; it is never persisted. */
export class JobReferenceResolver {
  private generation = 0;
  private reads = new Map<string, Promise<AuthorizedJobReference | null>>();

  constructor(
    private readonly load: (jobId: string) => Promise<JobReferenceRecord | null>,
    private readonly canRead: boolean,
    private readonly visible: (jobId: string) => boolean,
  ) {}

  read(jobId: string): Promise<AuthorizedJobReference | null> {
    if (!this.canRead || !this.visible(jobId)) return Promise.resolve(null);
    const pending = this.reads.get(jobId);
    if (pending) return pending;
    const generation = this.generation;
    const result = Promise.resolve().then(() => this.load(jobId)).then(record => {
      if (generation !== this.generation || !record || record.id.toLowerCase() !== jobId || !this.visible(record.id)) return null;
      return { id: jobId, name: record.name?.trim() || 'Production Job' };
    }).catch(() => null);
    this.reads.set(jobId, result);
    return result;
  }

  reset() {
    this.generation++;
    this.reads.clear();
  }
}
