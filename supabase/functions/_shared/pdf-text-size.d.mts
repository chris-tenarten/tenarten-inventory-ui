export type PdfTextSize = 'compact' | 'standard' | 'large';
export const PDF_TEXT_SIZES: readonly PdfTextSize[];
export function normalizePdfTextSize(value: unknown): PdfTextSize;
