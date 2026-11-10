// Presentation-only synthetic development identities. Never use for authorization,
// conversion, deletion, cleanup eligibility, or name-based classification.
const curatedDemoBidIds = new Set([
  '00000000-0000-4000-8000-000000000801',
  '00000000-0000-4000-8000-000000000802',
  '00000000-0000-4000-8000-000000000803',
  '00000000-0000-4000-8000-000000000804',
  '00000000-0000-4000-8000-000000000805',
  '00000000-0000-4000-8000-000000000806',
  '00000000-0000-4000-8000-000000000807',
  '00000000-0000-4000-8000-000000000808',
]);
export const isCuratedDemoBid = (id: string) => curatedDemoBidIds.has(id);
