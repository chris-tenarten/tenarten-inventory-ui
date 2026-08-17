export type ProductionDocumentFamily =
  | 'shop_work_order'
  | 'shop_drawing'
  | 'shop_ticket'
  | 'estimate'
  | 'blend_sheet'
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
  const normalizedHeading = text.replace(/\s+/g, ' ');
  const hasTenartenBranding = /\bTENARTEN\s+TERRAZZO(?:\s+CO\.?|\s+LLC)?\b/i.test(normalizedHeading);
  if (
    hasTenartenBranding &&
    /\bPROJECT\s*#/i.test(normalizedHeading) &&
    /\b(?:DWG\.?\s+DATE|TERR\.?\s+COLOR\s+PLATE)\b/i.test(normalizedHeading)
  ) return 'shop_drawing';
  if (
    /\bDESIGN\s+ARCH\.?\s*:/i.test(normalizedHeading) &&
    /\bCONTRACTOR\s*:/i.test(normalizedHeading) &&
    /\bPROJ\.?\s+TITLE\s*:/i.test(normalizedHeading) &&
    /\bJOB\s+NO\s*:/i.test(normalizedHeading) &&
    /\bSHEET\b/i.test(normalizedHeading)
  ) return 'shop_ticket';
  if (
    hasTenartenBranding &&
    /\bESTIMATE\b/i.test(normalizedHeading) &&
    /\bESTIMATE\s*#/i.test(normalizedHeading) &&
    /\bNAME\s*\/\s*ADDRESS\b/i.test(normalizedHeading)
  ) return 'estimate';
  if (
    hasTenartenBranding &&
    /\bJOB\s*#/i.test(normalizedHeading) &&
    /\bPLATE\s*#/i.test(normalizedHeading) &&
    /\bCHIP\s+BLEND\b/i.test(normalizedHeading)
  ) return 'blend_sheet';
  if (/\bmaterial\s+quantity(?:\s+sheet)?\b/i.test(text)) return 'material_quantity_sheet';
  if (hasLegacyMaterialQuantityFilename(fileName)) return 'material_quantity_sheet';
  if (/\bTENARTEN\s+TERRAZZO(?:\s+LLC)?\b.{0,100}\bPURCHASE\s+ORDER\b/i.test(normalizedHeading)) return 'purchase_order';
  return null;
}
