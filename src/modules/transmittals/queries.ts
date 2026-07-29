import { supabase } from "@/lib/supabase";
import type { JobTransmittalRecord } from "./types";

export async function loadJobTransmittals(jobId: string): Promise<JobTransmittalRecord[]> {
  const { data, error } = await supabase.rpc("list_job_transmittals", {
    p_job_id: jobId,
  });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    jobId: String(row.job_id),
    transmittalNumber: String(row.transmittal_number),
    documentDate: String(row.document_date),
    recipientName: String(row.recipient_name ?? ""),
    generatedBy: String(row.generated_by ?? ""),
    documentStatus: row.document_status as JobTransmittalRecord["documentStatus"],
    documentError: String(row.error_summary ?? ""),
    generationAttempts: Number(row.generation_attempts ?? 0),
    recoverable: Boolean(row.recoverable),
    generatedAt: String(row.generated_at ?? ""),
    issuedAt: String(row.issued_at),
  }));
}
