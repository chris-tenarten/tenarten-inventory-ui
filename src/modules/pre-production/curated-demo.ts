// Presentation only. These immutable identities come from the approved
// scripts/fixtures/intake-demo-final/manifest.json. Never use for authorization,
// conversion, deletion, cleanup eligibility, or name-based classification.
const curatedDemoBidIds = new Set([
  'de000000-0000-4000-8000-000000000001',
  'de000000-0000-4000-8000-000000000002',
  'de000000-0000-4000-8000-000000000003',
  'de000000-0000-4000-8000-000000000004',
  'de000000-0000-4000-8000-000000000005',
  'de000000-0000-4000-8000-000000000006',
  'de000000-0000-4000-8000-000000000007',
  'de000000-0000-4000-8000-000000000008',
]);
export const isCuratedDemoBid = (id: string) => curatedDemoBidIds.has(id);
