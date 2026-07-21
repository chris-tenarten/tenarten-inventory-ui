export interface MaterialUsageLine {
  id?: string;

  materialType: string;
  manufacturer: string;
  materialName: string;

  quantity: number | null;
  unit: string;

  plate: string;
  notes: string;
}

export interface MaterialUsageReport {
  id?: string;

  jobId: string | null;
  unlistedJobName: string;

  jobNumberSnapshot?: string | null;
  jobNameSnapshot?: string | null;

  reportDate: string;

  workOrder: string;
  terrazzoType: string;
  notes: string;

  createdBy?: string | null;
  updatedBy?: string | null;

  createdAt?: string;
  updatedAt?: string;

  lines: MaterialUsageLine[];
}

export interface MaterialUsageReportSummary {
  id: string;

  reportDate: string;
  jobId: string | null;

  jobNumber: string | null;
  jobName: string | null;
  unlistedJobName: string;
  notes: string;

  workOrder: string;
  terrazzoType: string;

  updatedAt: string;
}

export interface MaterialUsageSuggestions {
  materialTypes: string[];
  manufacturers: string[];
  materialNames: string[];
  units: string[];
}

export const MATERIAL_TYPES = [
  "Resin",
  "Hardener",
  "Filler",
  "Chip Blend",
  "Miscellaneous",
] as const;

export type MaterialType = (typeof MATERIAL_TYPES)[number];
