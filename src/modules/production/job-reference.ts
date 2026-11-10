export type ProductionJobReference = {
  id: string;
  name: string | null;
  job_number: string | null;
};

export function getProductionJobReferenceLabel(
  job: Pick<ProductionJobReference, 'name' | 'job_number'>,
): string {
  return job.name?.trim() || job.job_number?.trim() || 'Production Job';
}

export function formatProductionJobSelectorLabel(
  job: Pick<ProductionJobReference, 'name' | 'job_number'>,
): string {
  const name = job.name?.trim();
  const jobNumber = job.job_number?.trim();

  if (jobNumber && name) return `${jobNumber} — ${name}`;
  return name || jobNumber || 'Unnamed Production Job';
}
