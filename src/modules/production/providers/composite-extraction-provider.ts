import type { ExtractedJobField, ExtractedJobMetadata, JobMetadataExtractionProvider } from '../job-import-provider';
import { detectProductionDocumentFamily, type ProductionDocumentFamily } from './document-family-detector';
import { extractGenericIdentifiers } from './generic-identifier-parser';
import { parseMaterialQuantitySheet } from './material-quantity-parser';
import { parsePurchaseOrder } from './purchase-order-parser';
import { extractEmbeddedPdfText } from './pdf-text';
import { mergeParsed, type ParsedFields } from './parser-utils';
import { parseSampleWorkOrder } from './sample-work-order-parser';
import { parseShopFabricationWorkOrder } from './shop-fabrication-parser';

const fields: ExtractedJobField[] = [
  'jobNumber', 'jobName', 'customer', 'workOrderNumber', 'plateNumber', 'productType',
  'resin', 'thickness', 'pieces', 'requestedDelivery', 'location',
];

const blankMetadata = (): ExtractedJobMetadata => {
  const values = Object.fromEntries(fields.map((field) => [field, ''])) as Record<ExtractedJobField, string>;
  const confidence = Object.fromEntries(fields.map((field) => [field, 'missing'])) as ExtractedJobMetadata['confidence'];
  return { ...values, confidence };
};

type TemplateParser = (text: string) => ParsedFields;
const parsers: Record<ProductionDocumentFamily, TemplateParser> = {
  shop_work_order: parseShopFabricationWorkOrder,
  sample_work_order: parseSampleWorkOrder,
  material_quantity_sheet: parseMaterialQuantitySheet,
  purchase_order: parsePurchaseOrder,
};

export function extractMetadataFromTextDocuments(documents: Array<{ name: string; text: string }>): ExtractedJobMetadata {
  const result = blankMetadata();
  const detected = documents.map((document) => ({
    ...document,
    family: detectProductionDocumentFamily({ text: document.text, fileName: document.name }),
  }));
  // Family priority preserves the established canonical merge behavior.
  for (const family of ['shop_work_order', 'sample_work_order', 'material_quantity_sheet', 'purchase_order'] as const) {
    for (const document of detected) {
      if (document.family === family) mergeParsed(result, parsers[family](document.text));
    }
  }
  // Generic identifiers are a lower-confidence safety net and only fill fields
  // that all recognized document parsers left missing.
  for (const document of detected) {
    if (document.family) mergeParsed(result, extractGenericIdentifiers(document.text));
  }
  return result;
}

export const compositeExtractionProvider: JobMetadataExtractionProvider = {
  async extractJobMetadata(files) {
    const documents: Array<{ name: string; text: string }> = [];
    for (const file of files) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) continue;
      try {
        const text = await extractEmbeddedPdfText(file);
        documents.push({ name: file.name, text });
      } catch (error) {
        console.warn(`Unable to read embedded text from ${file.name}. The file will remain available for manual review.`, error);
      }
    }
    return extractMetadataFromTextDocuments(documents);
  },
};
