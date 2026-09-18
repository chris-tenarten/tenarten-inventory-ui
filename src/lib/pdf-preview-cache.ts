export function pdfPreviewInputKey(value: unknown): string {
  return JSON.stringify(value);
}

export class SessionPdfPreviewCache {
  private readonly entries = new Map<string, Blob>();

  constructor(private readonly limit = 4) {}

  get(key: string): Blob | undefined {
    const blob = this.entries.get(key);
    if (!blob) return undefined;
    this.entries.delete(key);
    this.entries.set(key, blob);
    return blob;
  }

  set(key: string, blob: Blob): void {
    this.entries.delete(key);
    this.entries.set(key, blob);
    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
