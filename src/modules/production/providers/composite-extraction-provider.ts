import type { ExtractedJobField, ExtractedJobMetadata, JobMetadataExtractionProvider } from '../job-import-provider';
import { detectProductionDocumentFamily, type ProductionDocumentFamily } from './document-family-detector';
import { extractGenericIdentifiers, extractGenericPlateNumbers } from './generic-identifier-parser';
import { parseMaterialQuantitySheet } from './material-quantity-parser';
import { parsePurchaseOrder } from './purchase-order-parser';
import { extractEmbeddedPdfText } from './pdf-text';
import type { ExtractedCandidate, ParsedFields } from './parser-utils';
import { parseSampleWorkOrder } from './sample-work-order-parser';
import { parseShopFabricationWorkOrder } from './shop-fabrication-parser';

const fields: ExtractedJobField[] = [
  'jobNumber', 'jobName', 'customer', 'estimateNumber', 'workOrderNumber', 'plateNumber', 'productType',
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

const confidenceRank = { medium: 1, high: 2 } as const;
const familyRank: Record<ProductionDocumentFamily | 'unsupported', number> = {
  shop_work_order: 0,
  sample_work_order: 1,
  material_quantity_sheet: 2,
  purchase_order: 3,
  unsupported: 4,
};

function normalizeCandidateValue(field: ExtractedJobField, value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return field === 'requestedDelivery' ? normalized : normalized.toLocaleLowerCase();
}

function appendParsedCandidates(
  candidates: ExtractedCandidate[],
  parsed: ParsedFields,
  context: Pick<ExtractedCandidate, 'sourceFile' | 'family' | 'sourceKind' | 'fileIndex'>,
) {
  for (const field of fields) {
    const candidate = parsed[field];
    if (!candidate?.value.trim()) continue;
    candidates.push({
      field,
      value: candidate.value.trim(),
      normalizedValue: normalizeCandidateValue(field, candidate.value),
      confidence: candidate.confidence,
      ...context,
      sequence: candidates.length,
    });
  }
}

function reconcileScalar(candidates: ExtractedCandidate[]) {
  const groups = new Map<string, ExtractedCandidate[]>();
  for (const candidate of candidates) {
    const group = groups.get(candidate.normalizedValue) ?? [];
    group.push(candidate);
    groups.set(candidate.normalizedValue, group);
  }
  return [...groups.values()].sort((first, second) => {
    const firstConfidence = Math.max(...first.map((candidate) => confidenceRank[candidate.confidence]));
    const secondConfidence = Math.max(...second.map((candidate) => confidenceRank[candidate.confidence]));
    const firstFamilyEvidence = first.some((candidate) => candidate.sourceKind === 'family_parser') ? 1 : 0;
    const secondFamilyEvidence = second.some((candidate) => candidate.sourceKind === 'family_parser') ? 1 : 0;
    const firstFamilyRank = Math.min(...first.map((candidate) => familyRank[candidate.family as ProductionDocumentFamily | 'unsupported']));
    const secondFamilyRank = Math.min(...second.map((candidate) => familyRank[candidate.family as ProductionDocumentFamily | 'unsupported']));
    const firstSequence = Math.min(...first.map((candidate) => candidate.sequence));
    const secondSequence = Math.min(...second.map((candidate) => candidate.sequence));
    const firstSources = new Set(first.map((candidate) => candidate.fileIndex)).size;
    const secondSources = new Set(second.map((candidate) => candidate.fileIndex)).size;
    return secondConfidence - firstConfidence
      || secondSources - firstSources
      || secondFamilyEvidence - firstFamilyEvidence
      || firstFamilyRank - secondFamilyRank
      || firstSequence - secondSequence;
  })[0]?.sort((first, second) =>
    confidenceRank[second.confidence] - confidenceRank[first.confidence]
    || Number(second.sourceKind === 'family_parser') - Number(first.sourceKind === 'family_parser')
    || familyRank[first.family as ProductionDocumentFamily | 'unsupported'] - familyRank[second.family as ProductionDocumentFamily | 'unsupported']
    || first.fileIndex - second.fileIndex
    || first.sequence - second.sequence
  )[0];
}

function reconcileCandidates(candidates: ExtractedCandidate[]) {
  const result = blankMetadata();
  for (const field of fields) {
    const fieldCandidates = candidates.filter((candidate) => candidate.field === field);
    if (field === 'plateNumber') {
      const distinct = new Map<string, ExtractedCandidate>();
      for (const candidate of fieldCandidates) {
        if (!distinct.has(candidate.normalizedValue)) distinct.set(candidate.normalizedValue, candidate);
      }
      const plates = [...distinct.values()];
      if (plates.length) {
        result.plateNumber = plates.map((candidate) => candidate.value).join(', ');
        result.confidence.plateNumber = plates.some((candidate) => candidate.confidence === 'high') ? 'high' : 'medium';
      }
      continue;
    }
    const winner = reconcileScalar(fieldCandidates);
    if (winner) {
      result[field] = winner.value;
      result.confidence[field] = winner.confidence;
    }
  }
  return result;
}

export function extractMetadataFromTextDocuments(documents: Array<{ name: string; text: string }>): ExtractedJobMetadata {
  const candidates: ExtractedCandidate[] = [];
  const detected = documents.map((document, fileIndex) => ({
    ...document,
    fileIndex,
    family: detectProductionDocumentFamily({ text: document.text, fileName: document.name }),
  }));
  // Family priority preserves the established deterministic template precedence.
  for (const family of ['shop_work_order', 'sample_work_order', 'material_quantity_sheet', 'purchase_order'] as const) {
    for (const document of detected) {
      if (document.family === family) appendParsedCandidates(candidates, parsers[family](document.text), {
        sourceFile: document.name,
        family,
        sourceKind: 'family_parser',
        fileIndex: document.fileIndex,
      });
    }
  }
  // Generic labeled evidence applies to every readable PDF, including unsupported families.
  for (const document of detected) {
    const family = document.family ?? 'unsupported';
    const generic = extractGenericIdentifiers(document.text);
    delete generic.plateNumber;
    appendParsedCandidates(candidates, generic, {
      sourceFile: document.name,
      family,
      sourceKind: 'generic',
      fileIndex: document.fileIndex,
    });
    for (const plateNumber of extractGenericPlateNumbers(document.text)) {
      appendParsedCandidates(candidates, { plateNumber: { value: plateNumber, confidence: 'medium' } }, {
        sourceFile: document.name,
        family,
        sourceKind: 'generic',
        fileIndex: document.fileIndex,
      });
    }
  }
  return reconcileCandidates(candidates);
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
