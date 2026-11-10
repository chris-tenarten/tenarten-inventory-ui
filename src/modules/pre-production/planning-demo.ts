/** Deterministic demonstration identities. No numbering, communications, documents or Jobs. */
export const INTAKE_DEMO_MARKER = 'TENOPS-INTAKE-PLANNING-DEMO-2026-09';
export const intakePlanningDemo = [
  { number: 1, project: 'Website Lead — Downtown Restaurant', customer: 'Restaurant Concept', start: null, end: null, status: 'active', deposit: null, notes: 'Source: Website Inquiry. Early qualification; approximate terrazzo floor and bar-base scope. GC/architect unknown. Estimate due date and projected manufacture dates unknown. Next action: TEST follow-up to establish scope. No committed Production capacity.' },
  { number: 2, project: 'Hotel Lobby Terrazzo', customer: 'Hotel Example', start: '2026-10-05', end: '2026-10-23', status: 'active', deposit: null, notes: 'TEST GC — Hotel Builder. Lobby Slabs and Cove Base; budget scope ready for estimating. Example proposal target: September 30 (notes only, not a structured Bid Due Date). Tentative October shop window.' },
  { number: 3, project: 'University Stair Package', customer: 'University Example', start: '2026-10-19', end: '2026-11-06', status: 'active', deposit: null, notes: 'TEST GC — Campus Builder. Stair treads, risers and landings. Samples / Color Plates contextual action is available; no Sample or Color Plate number is allocated by this fixture. Next action: prepare a TEST sample only after separate approval.' },
  { number: 4, project: 'Airport Concourse', customer: 'Airport Example', start: '2026-11-02', end: '2026-12-18', status: 'active', deposit: null, notes: 'TEST GC — Terminal Builder. Larger multi-area Slabs and Base opportunity. Long tentative manufacture window; no weighted probability or reserved capacity.' },
  { number: 5, project: 'Retail Cove Base Package', customer: 'Retail Example', start: '2026-10-26', end: '2026-10-30', status: 'active', deposit: null, notes: 'TEST GC — Retail Builder. Short Cove Base package, deliberately outside the Hotel window. Confirm measurements before estimate.' },
  { number: 6, project: 'Corporate HQ Slabs', customer: 'Office Example', start: '2026-11-09', end: '2026-11-27', status: 'active', deposit: null, notes: 'TEST GC — Office Builder. Slab-heavy scope; coordination dates remain tentative pending award and approved details.' },
  { number: 7, project: 'Mixed Terrazzo Package', customer: 'Mixed Package Example', start: '2026-11-16', end: '2026-12-04', status: 'active', deposit: null, notes: 'TEST GC — Mixed Builder. Slabs, Stairs and Cove Base. Deliberately overlaps Corporate HQ and Airport to illustrate potential versus committed load.' },
  { number: 8, project: 'Award / Ready-to-Convert Example', customer: 'Award Example', start: '2026-10-12', end: '2026-10-23', status: 'won', deposit: '2026-09-22', notes: 'TEST award and TEST deposit date only, not a real receipt. Ready to demonstrate explicit carry-forward or new dates. Do not convert this hosted demo without separate authorization. No Production Job is created by seeding.' },
].map(row => ({
  id: `de000000-0000-4000-8000-${String(row.number).padStart(12, '0')}`,
  project_name: `TEST — ${row.project}`, customer: `TEST CUSTOMER — ${row.customer}`,
  status: row.status as 'active' | 'won', deposit_received_date: row.deposit,
  projected_production_start: row.start, projected_production_end: row.end,
  contact_name: `TEST CONTACT — Example ${row.number}`,
  contact_email: `intake-demo-${row.number}@example.invalid`, contact_phone: `202-555-010${row.number}`,
  notes: `${INTAKE_DEMO_MARKER}\nDEMONSTRATION ONLY — not a real opportunity.\n${row.notes}`,
}));
