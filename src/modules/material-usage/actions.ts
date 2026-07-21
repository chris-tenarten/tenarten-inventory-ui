import { supabase } from '@/lib/supabase';

import {
  MaterialUsageReport,
  MaterialUsageReportSummary,
  MaterialUsageSuggestions,
} from './types';

function cleanDistinctValues(
  values: Array<string | null | undefined>,
): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((first, second) => first.localeCompare(second));
}

export async function getMaterialUsageReports(): Promise<
  MaterialUsageReportSummary[]
> {
  const { data, error } = await supabase
    .from('material_usage_reports')
    .select(`
      id,
      report_date,
      work_order,
      terrazzo_type,
      updated_at,
      job_id,
      job_number_snapshot,
      job_name_snapshot
    `)
    .order('report_date', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    reportDate: row.report_date,
    jobId: row.job_id,
    jobNumber: row.job_number_snapshot,
    jobName: row.job_name_snapshot,
    workOrder: row.work_order ?? '',
    terrazzoType: row.terrazzo_type ?? '',
    updatedAt: row.updated_at,
  }));
}

export async function getMaterialUsageReport(
  id: string,
): Promise<MaterialUsageReport> {
  const { data, error } = await supabase
    .from('material_usage_reports')
    .select(`
      *,
      material_usage_lines(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    throw error;
  }

  const sortedLines = [
    ...(data.material_usage_lines ?? []),
  ].sort(
    (first, second) =>
      (first.sort_order ?? 0) -
      (second.sort_order ?? 0),
  );

  return {
    id: data.id,

    jobId: data.job_id,
    unlistedJobName: data.unlisted_job_name ?? '',

    jobNumberSnapshot: data.job_number_snapshot,
    jobNameSnapshot: data.job_name_snapshot,

    reportDate: data.report_date,

    workOrder: data.work_order ?? '',
    terrazzoType: data.terrazzo_type ?? '',
    notes: data.notes ?? '',

    createdBy: data.created_by,
    updatedBy: data.updated_by,

    createdAt: data.created_at,
    updatedAt: data.updated_at,

    lines: sortedLines.map((line) => ({
      id: line.id,

      materialType: line.material_type ?? '',
      manufacturer: line.manufacturer ?? '',
      materialName: line.material_name ?? '',

      quantity:
        line.quantity === null ||
        line.quantity === undefined
          ? null
          : Number(line.quantity),

      unit: line.unit ?? '',
      plate: line.plate ?? '',
      notes: line.notes ?? '',
    })),
  };
}

export async function saveMaterialUsageReport(
  report: MaterialUsageReport,
  editor: string,
): Promise<string> {
  const { data, error } = await supabase.rpc(
    'save_material_usage_report',
    {
      p_report: {
        id: report.id ?? null,
        job_id: report.jobId,
        job_number_snapshot: report.jobNumberSnapshot ?? null,
        job_name_snapshot: report.jobNameSnapshot ?? null,
        unlisted_job_name:
          report.unlistedJobName.trim(),
        report_date: report.reportDate,
        work_order: report.workOrder.trim(),
        terrazzo_type:
          report.terrazzoType.trim(),
        notes: report.notes.trim(),
      },

      p_lines: report.lines.map((line) => ({
        material_type: line.materialType.trim(),
        manufacturer: line.manufacturer.trim(),
        material_name: line.materialName.trim(),
        quantity: line.quantity,
        unit: line.unit.trim(),
        plate:
          line.materialType.trim().toLocaleLowerCase() === 'chip blend'
            ? line.plate.trim()
            : '',
        notes: line.notes.trim(),
      })),

      p_editor: editor,
    },
  );

  if (error) {
    throw error;
  }

  if (typeof data !== 'string') {
    throw new Error(
      'The save operation did not return a report ID.',
    );
  }

  return data;
}

export async function deleteMaterialUsageReport(
  id: string,
  editor: string,
): Promise<void> {
  const { error } = await supabase.rpc(
    'delete_material_usage_report',
    {
      p_report_id: id,
      p_editor: editor,
    },
  );

  if (error) {
    throw error;
  }
}

export async function getMaterialUsageSuggestions(): Promise<
  MaterialUsageSuggestions
> {
  const { data, error } = await supabase
    .from('material_usage_lines')
    .select(`
      material_type,
      manufacturer,
      material_name,
      unit
    `);

  if (error) {
    throw error;
  }

  const rows = data ?? [];

  return {
    materialTypes: cleanDistinctValues(
      rows.map((row) => row.material_type),
    ),

    manufacturers: cleanDistinctValues(
      rows.map((row) => row.manufacturer),
    ),

    materialNames: cleanDistinctValues(
      rows.map((row) => row.material_name),
    ),

    units: cleanDistinctValues(
      rows.map((row) => row.unit),
    ),
  };
}
