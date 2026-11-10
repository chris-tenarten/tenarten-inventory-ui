import type { ProductionJobOption } from '../production/job-options';
import type { MaterialUsageLine, MaterialUsageReport } from './types';

export type ColorPlateDecision =
  | 'keep_report'
  | 'use_production'
  | 'conflict';

export function isChipBlendMaterialType(materialType: string): boolean {
  return materialType.trim().toLocaleLowerCase() === 'chip blend';
}

export function getSharedChipBlendColorPlate(
  lines: MaterialUsageLine[],
): string {
  return lines.find(
    (line) => isChipBlendMaterialType(line.materialType) && line.plate.trim(),
  )?.plate.trim() ?? '';
}

export function colorPlatesMatch(first: string, second: string): boolean {
  return first.trim().toLocaleLowerCase() === second.trim().toLocaleLowerCase();
}

export function resolveColorPlateDecision(
  reportColorPlate: string,
  productionColorPlate: string,
): ColorPlateDecision {
  const reportValue = reportColorPlate.trim();
  const productionValue = productionColorPlate.trim();

  if (!productionValue) return 'keep_report';
  if (!reportValue) return 'use_production';
  return colorPlatesMatch(reportValue, productionValue)
    ? 'keep_report'
    : 'conflict';
}

export function applySharedChipBlendColorPlate(
  lines: MaterialUsageLine[],
  colorPlate: string,
): MaterialUsageLine[] {
  return lines.map((line) => ({
    ...line,
    plate: isChipBlendMaterialType(line.materialType) ? colorPlate : '',
  }));
}

export function canonicalJobAssociationPatch(
  job: ProductionJobOption,
): Pick<
  MaterialUsageReport,
  | 'jobId'
  | 'unlistedJobName'
  | 'jobNumberSnapshot'
  | 'jobNameSnapshot'
  | 'workOrder'
> {
  return {
    jobId: job.id,
    unlistedJobName: '',
    jobNumberSnapshot: job.job_number?.trim() || null,
    jobNameSnapshot: job.name?.trim() || null,
    workOrder: job.work_order_number?.trim() || '',
  };
}

export function applyCanonicalJobSelection(
  report: MaterialUsageReport,
  job: ProductionJobOption,
  colorPlate: string,
): MaterialUsageReport {
  return {
    ...report,
    ...canonicalJobAssociationPatch(job),
    lines: applySharedChipBlendColorPlate(report.lines, colorPlate),
  };
}
