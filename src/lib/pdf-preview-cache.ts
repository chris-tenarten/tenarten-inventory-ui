export function pdfPreviewInputKey(value: unknown): string {
  return JSON.stringify(value);
}

type SampleWorkingPreviewInput = {
  requestedBy: string;
  requestedDate: string;
  projectName: string;
  preparedBy: string;
  customerName: string;
  jobNumber: string;
  colorPlateNumber: string;
  finishRequested: string;
  sampleSize: string;
  sampleQuantity: string;
  notes: string;
  filler: string;
  sealer: string;
  resinSupplier: string;
  resinColorNumber: string;
  moreNotes: string;
  approvedDate: string;
  formulation: unknown;
  blendRows: Array<{
    percentage: string;
    color: string;
    size: string;
    materialType: string;
    quantity: string;
    calculatedQuantity: string;
    quantityProvenance: string;
    unit: string;
    vendor: string;
  }>;
};

/** Mirrors the fields consumed by buildSamplePdfModel for a current Working Sheet. */
export function sampleWorkingPreviewInputKey(sample: SampleWorkingPreviewInput): string {
  return pdfPreviewInputKey({
    requestedBy: sample.requestedBy,
    requestedDate: sample.requestedDate,
    projectName: sample.projectName,
    preparedBy: sample.preparedBy,
    customerName: sample.customerName,
    jobNumber: sample.jobNumber,
    colorPlateNumber: sample.colorPlateNumber,
    finishRequested: sample.finishRequested,
    sampleSize: sample.sampleSize,
    sampleQuantity: sample.sampleQuantity,
    notes: sample.notes,
    filler: sample.filler,
    sealer: sample.sealer,
    resinSupplier: sample.resinSupplier,
    resinColorNumber: sample.resinColorNumber,
    moreNotes: sample.moreNotes,
    approvedDate: sample.approvedDate,
    formulation: sample.formulation,
    blendRows: sample.blendRows.map((row) => ({
      percentage: row.percentage,
      color: row.color,
      size: row.size,
      materialType: row.materialType,
      quantity: row.quantity,
      calculatedQuantity: row.calculatedQuantity,
      quantityProvenance: row.quantityProvenance,
      unit: row.unit,
      vendor: row.vendor,
    })),
    renderContext: "working",
  });
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
