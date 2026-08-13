export type ProductionDocumentFamily =
  | 'shop_work_order'
  | 'sample_work_order'
  | 'material_quantity_sheet'
  | 'purchase_order';

type DocumentCharacteristics = {
  text: string;
  fileName?: string;
};

function hasLegacyMaterialQuantityFilename(fileName: string) {
  // Legacy compatibility for existing MAT QTY exports that do not carry a
  // stable document-family heading in their embedded PDF text.
  return /\bmat(?:erial)?[\s_-]+qty\b/i.test(fileName);
}

export function detectProductionDocumentFamily({
  text,
  fileName = '',
}: DocumentCharacteristics): ProductionDocumentFamily | null {
  if (/\bsample\s+work\s+order\b/i.test(text)) return 'sample_work_order';
  if (/\bshop\s+(?:fabrication\s+)?work\s+order\b/i.test(text)) return 'shop_work_order';
  if (/\bmaterial\s+quantity(?:\s+sheet)?\b/i.test(text)) return 'material_quantity_sheet';
  if (hasLegacyMaterialQuantityFilename(fileName)) return 'material_quantity_sheet';
  const normalizedHeading = text.replace(/\s+/g, ' ');
  if (/\bTENARTEN\s+TERRAZZO(?:\s+LLC)?\b.{0,100}\bPURCHASE\s+ORDER\b/i.test(normalizedHeading)) return 'purchase_order';
  return null;
}
