import { supabase } from '@/lib/supabase';
import { emptyProposalEstimateInputs, proposalEstimateDefaultAssumptions } from './estimate-defaults';
import type { ProposalEstimate, ProposalEstimateAssumptionOverrides, ProposalEstimateAssumptions, ProposalEstimateInputs, ProposalEstimateOutputs, ProposalEstimatingDefaults } from './estimate-types';
import type { Proposal, ProposalDimensionApplicability, ProposalLine } from './types';

export type BidProposalSummary = { id: string; estimateNumber: string; status: Proposal['status']; updatedAt: string };

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const rpcRecord = (value: unknown) => record(Array.isArray(value) ? value[0] : value);
const text = (value: unknown) => value == null ? '' : String(value);
const assumptions = (value: unknown): ProposalEstimateAssumptions => ({ ...proposalEstimateDefaultAssumptions, ...record(value) }) as ProposalEstimateAssumptions;
const estimateInputs = (value: unknown): ProposalEstimateInputs => {
  const candidate = record(value);
  return { ...emptyProposalEstimateInputs(), ...candidate, chipBlend: Array.isArray(candidate.chipBlend) ? candidate.chipBlend as ProposalEstimateInputs['chipBlend'] : [] };
};

function estimatingDefaults(value: unknown): ProposalEstimatingDefaults {
  const row = rpcRecord(value);
  return { id: text(row.id), version: Number(row.version ?? 0), calculationVersion: text(row.calculation_version ?? row.calculationVersion), assumptions: assumptions(row.assumptions), createdAt: text(row.created_at ?? row.createdAt), createdByName: text(row.created_by_name ?? row.createdByName) };
}

function estimate(value: unknown): ProposalEstimate | null {
  const row = rpcRecord(value);
  if (!row.proposal_id && !row.proposalId) return null;
  return {
    proposalId: text(row.proposal_id ?? row.proposalId),
    defaultsVersionId: text(row.defaults_version_id ?? row.defaultsVersionId),
    defaultsVersion: Number(row.defaults_version ?? row.defaultsVersion ?? 0),
    calculationVersion: text(row.calculation_version ?? row.calculationVersion),
    defaultAssumptions: assumptions(row.default_assumptions ?? row.defaultAssumptions),
    assumptionOverrides: record(row.assumption_overrides ?? row.assumptionOverrides) as ProposalEstimateAssumptionOverrides,
    effectiveAssumptions: assumptions(row.effective_assumptions ?? row.effectiveAssumptions),
    inputs: estimateInputs(row.inputs),
    outputs: record(row.outputs) as ProposalEstimateOutputs,
    createdAt: text(row.created_at ?? row.createdAt),
    updatedAt: text(row.updated_at ?? row.updatedAt),
  };
}

const line = (row: Record<string, unknown>): ProposalLine => ({
  id: text(row.id), lineType: text(row.line_type) as ProposalLine['lineType'], itemNumber: text(row.item_number), description: text(row.description), ref: text(row.ref), colorPlate: text(row.color_plate), quantity: text(row.quantity), unit: text(row.unit), length: text(row.length), width: text(row.width), heightThickness: text(row.height_thickness), cft: text(row.cft), lf: text(row.lf), estimatedWeight: text(row.estimated_weight), rate: text(row.rate), total: String(row.total ?? 0), sourceMetadata: record(row.source_metadata), displayOrder: Number(row.display_order ?? 0),
  geometryProfile: text(row.geometry_profile) as ProposalLine['geometryProfile'], dimensionApplicability: record(row.dimension_applicability) as ProposalDimensionApplicability, lengthInches: text(row.length_inches), widthInches: text(row.width_inches), riserHeightInches: text(row.riser_height_inches), thicknessInches: text(row.thickness_inches), cubicFeet: text(row.cubic_feet), linearFeet: text(row.linear_feet), estimatedWeightPounds: text(row.estimated_weight_pounds),
});

const proposal = (row: Record<string, unknown>, lines: ProposalLine[] = [], currentEstimate: ProposalEstimate | null = null): Proposal => ({
  id: text(row.id), jobId: row.job_id == null ? null : text(row.job_id), lineageId: text(row.lineage_id), priorProposalId: text(row.prior_proposal_id), estimateBase: text(row.estimate_base), versionMajor: Number(row.version_major), versionMinor: Number(row.version_minor), estimateNumber: text(row.estimate_number), status: text(row.status) as Proposal['status'], proposalDate: text(row.proposal_date),
  customerName: text(row.customer_name), customerAddress: text(row.customer_address), customerContact: text(row.customer_contact), customerStreet: text(row.customer_street), customerCity: text(row.customer_city), customerState: text(row.customer_state), customerPostalCode: text(row.customer_postal_code), customerContactName: text(row.customer_contact_name), customerOfficePhone: text(row.customer_office_phone), customerMobilePhone: text(row.customer_mobile_phone), customerEmail: text(row.customer_email),
  projectName: text(row.project_name), projectNumber: text(row.project_number), projectLocation: text(row.project_location), sideMark: text(row.side_mark), salesRep: text(row.sales_rep), terms: text(row.terms), validDays: text(row.valid_days ?? 30), requestedDelivery: text(row.requested_delivery), fob: text(row.fob), destinationZip: text(row.destination_zip), taxCounty: text(row.tax_county), freightEstimate: text(row.freight_estimate), preliminaryDrawingsAttached: Boolean(row.preliminary_drawings_attached), cratingIncluded: Boolean(row.crating_included), cutTicketsIncluded: Boolean(row.cut_tickets_included), fieldDimensioningExcluded: Boolean(row.field_dimensioning_excluded),
  submittedByName: text(row.submitted_by_name), submittedByPhone: text(row.submitted_by_phone), submittedByEmail: text(row.submitted_by_email), notes: text(row.notes), disclaimerSnapshot: text(row.disclaimer_snapshot), formulaSnapshot: text(row.formula_snapshot), fieldSources: record(row.proposal_field_sources) as Proposal['fieldSources'], taxEnabled: Boolean(row.tax_enabled), taxRate: text(row.tax_rate), subtotal: String(row.subtotal ?? 0), tax: String(row.tax ?? 0), total: String(row.total ?? 0), createdAt: text(row.created_at), updatedAt: text(row.updated_at), issuedAt: text(row.issued_at), creatorName: text(row.created_by_name), lines, estimate: currentEstimate,
});

export async function hasProposalAccess() { const { data, error } = await supabase.rpc('has_proposal_access'); return error ? false : data === true; }
export async function loadJobProposals(jobId: string) { const { data, error } = await supabase.from('proposals').select('*').eq('job_id', jobId).order('version_major', { ascending: false }).order('version_minor', { ascending: false }); if (error) throw error; return (data ?? []).map((row) => proposal(row)); }
export async function loadProposals() { const { data, error } = await supabase.from('proposals').select('*').order('created_at', { ascending: false }); if (error) throw error; return (data ?? []).map((row) => proposal(row)); }
export async function loadBidProposalSummaries(bidId: string) { const { data, error } = await supabase.from('bid_proposal_relationships').select('proposal:proposals!bid_proposal_relationships_proposal_id_fkey(id,estimate_number,status,updated_at)').eq('bid_id', bidId).order('linked_at', { ascending: false }); if (error) throw error; return (data ?? []).flatMap((row) => { const value = Array.isArray(row.proposal) ? row.proposal[0] : row.proposal; return value ? [{ id: text(value.id), estimateNumber: text(value.estimate_number), status: text(value.status) as Proposal['status'], updatedAt: text(value.updated_at) }] : []; }); }
export async function loadBidProposals(bidId: string) { const { data, error } = await supabase.from('bid_proposal_relationships').select('proposal:proposals!bid_proposal_relationships_proposal_id_fkey(*)').eq('bid_id', bidId).order('linked_at', { ascending: false }); if (error) throw error; return (data ?? []).flatMap((row) => { const value = Array.isArray(row.proposal) ? row.proposal[0] : row.proposal; return value ? [proposal(value as Record<string, unknown>)] : []; }); }
export async function loadLinkableProposals() { const [all, relationships] = await Promise.all([loadProposals(), supabase.from('bid_proposal_relationships').select('proposal_id')]); if (relationships.error) throw relationships.error; const linked = new Set((relationships.data ?? []).map((row) => text(row.proposal_id))); return all.filter((item) => item.jobId === null && !linked.has(item.id)); }

export async function loadProposalEstimate(proposalId: string) {
  const { data, error } = await supabase.from('proposal_estimates').select('*,defaults:proposal_estimating_default_versions!proposal_estimates_defaults_version_id_fkey(version)').eq('proposal_id', proposalId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const defaults = Array.isArray(data.defaults) ? data.defaults[0] : data.defaults;
  return estimate({ ...data, defaults_version: defaults?.version });
}

export async function loadProposal(id: string) {
  const [{ data, error }, { data: rows, error: lineError }, currentEstimate] = await Promise.all([supabase.from('proposals').select('*').eq('id', id).single(), supabase.from('proposal_lines').select('*').eq('proposal_id', id).order('display_order'), loadProposalEstimate(id)]);
  if (error) throw error;
  if (lineError) throw lineError;
  return proposal(data, (rows ?? []).map((row) => line(row)), currentEstimate);
}

export async function createProposal(jobId: string) { const { data, error } = await supabase.rpc('create_job_proposal', { p_job_id: jobId }); if (error) throw error; return text(data); }
export async function createGenericProposal() { const { data, error } = await supabase.rpc('create_proposal'); if (error) throw error; return text(data); }
export async function createBidProposal(bidId: string) { const { data, error } = await supabase.rpc('create_bid_proposal', { p_bid_id: bidId }); if (error) throw error; return text(data); }
export async function linkProposalToBid(bidId: string, proposalId: string) { const { error } = await supabase.rpc('link_proposal_to_bid', { p_bid_id: bidId, p_proposal_id: proposalId }); if (error) throw error; }

export async function ensureProposalEstimate(proposalId: string) { const { data, error } = await supabase.rpc('ensure_proposal_estimate', { p_proposal_id: proposalId }); if (error) throw error; const mapped = estimate(data); if (!mapped) throw new Error('Estimate was not initialized.'); return mapped; }
export async function saveProposalEstimateDraft(proposalId: string, value: ProposalEstimateInputs, overrides: ProposalEstimateAssumptionOverrides) { const { data, error } = await supabase.rpc('save_proposal_estimate_draft', { p_proposal_id: proposalId, p_inputs: value, p_overrides: overrides }); if (error) throw error; const mapped = estimate(data); if (!mapped) throw new Error('Estimate was not saved.'); return mapped; }
export async function loadProposalEstimatingDefaults() { const { data, error } = await supabase.rpc('get_current_proposal_estimating_defaults'); if (error) throw error; return estimatingDefaults(data); }
export async function saveProposalEstimatingDefaults(value: ProposalEstimateAssumptions, expectedVersion: number, changeNote = '') { const { data, error } = await supabase.rpc('save_proposal_estimating_defaults', { p_defaults: value, p_expected_version: expectedVersion, p_note: changeNote.trim() || null }); if (error) throw error; return estimatingDefaults(data); }

export async function saveProposal(value: Proposal) {
  if (!value.estimate) throw new Error('The internal Estimate must be initialized before this Proposal can be saved.');
  const lines = value.lines.map((item) => ({ line_type: item.lineType, item_number: item.itemNumber, description: item.description, ref: item.ref, color_plate: item.colorPlate, quantity: item.quantity, unit: item.unit, length: item.length, width: item.width, height_thickness: item.heightThickness, cft: item.cft, lf: item.lf, estimated_weight: item.estimatedWeight, rate: item.rate, total: item.total, source_metadata: item.sourceMetadata, geometry_profile: item.geometryProfile || null, dimension_applicability: item.dimensionApplicability ?? {}, length_inches: item.lengthInches || null, width_inches: item.widthInches || null, riser_height_inches: item.riserHeightInches || null, thickness_inches: item.thicknessInches || null, cubic_feet: item.cubicFeet || null, linear_feet: item.linearFeet || null, estimated_weight_pounds: item.estimatedWeightPounds || null }));
  const currentFields: Record<string, unknown> = { projectName: value.projectName, projectLocation: value.projectLocation, projectNumber: value.projectNumber, customerName: value.customerName };
  const fieldSources = Object.fromEntries(Object.entries(value.fieldSources).filter(([key, evidence]) => currentFields[key] === evidence.value));
  const proposalPayload = {
    id: value.id, proposal_date: value.proposalDate,
    customer_name: value.customerName, customer_address: value.customerAddress, customer_contact: value.customerContact,
    customer_street: value.customerStreet ?? '', customer_city: value.customerCity ?? '', customer_state: value.customerState ?? '', customer_postal_code: value.customerPostalCode ?? '',
    customer_contact_name: value.customerContactName ?? '', customer_office_phone: value.customerOfficePhone ?? '', customer_mobile_phone: value.customerMobilePhone ?? '', customer_email: value.customerEmail ?? '',
    project_name: value.projectName, project_number: value.projectNumber, project_location: value.projectLocation,
    side_mark: value.sideMark, sales_rep: value.salesRep, terms: value.terms, valid_days: value.validDays,
    requested_delivery: value.requestedDelivery, fob: value.fob, destination_zip: value.destinationZip,
    tax_county: value.taxCounty, submitted_by_name: value.submittedByName, submitted_by_phone: value.submittedByPhone, submitted_by_email: value.submittedByEmail,
    notes: value.notes, disclaimer_snapshot: value.disclaimerSnapshot, formula_snapshot: value.formulaSnapshot,
    proposal_field_sources: fieldSources, tax_enabled: value.taxEnabled, tax_rate: value.taxRate,
    freight_estimate: value.freightEstimate, preliminary_drawings_attached: value.preliminaryDrawingsAttached,
    crating_included: value.cratingIncluded, cut_tickets_included: value.cutTicketsIncluded,
    field_dimensioning_excluded: value.fieldDimensioningExcluded,
  };
  const { error } = await supabase.rpc('save_proposal_v2_draft', {
    p_proposal: proposalPayload,
    p_lines: lines,
    p_estimate_inputs: value.estimate.inputs,
    p_estimate_overrides: value.estimate.assumptionOverrides,
  });
  if (error) throw error;
}

export async function issueProposal(id: string) { const { error } = await supabase.rpc('issue_proposal', { p_proposal_id: id }); if (error) throw error; }
export async function createProposalRevision(id: string) { const { data, error } = await supabase.rpc('create_proposal_revision', { p_proposal_id: id }); if (error) throw error; return text(data); }
async function functionError(error: unknown): Promise<never> { if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) { const body = await error.context.clone().json().catch(() => ({})) as { error?: string }; if (body.error) throw new Error(body.error); } throw error; }
export async function previewProposal(value: Proposal) { const { data, error } = await supabase.functions.invoke('generate-proposal-pdf', { body: { action: 'preview', snapshot: { ...value, lines: value.lines } } }); if (error) await functionError(error); if (data instanceof Blob) return data; if (data instanceof ArrayBuffer) return new Blob([data], { type: 'application/pdf' }); throw new Error('Proposal preview returned an invalid PDF.'); }
export async function generateProposalPdf(id: string) { const { data, error } = await supabase.functions.invoke('generate-proposal-pdf', { body: { action: 'generate', proposalId: id } }); if (error) await functionError(error); if (!data?.url) throw new Error(String(data?.error || 'Proposal PDF was not generated.')); return String(data.url); }
export async function getProposalPdfUrl(id: string) { const { data, error } = await supabase.functions.invoke('generate-proposal-pdf', { body: { action: 'open', proposalId: id } }); if (error) await functionError(error); if (!data?.url) throw new Error(String(data?.error || 'Proposal PDF is unavailable.')); return String(data.url); }
export async function deleteIssuedProposal(id: string) { const { data, error } = await supabase.functions.invoke('generate-proposal-pdf', { body: { action: 'delete', proposalId: id } }); if (error) await functionError(error); if (data?.deleted !== true) throw new Error(String(data?.error || 'Proposal was not deleted.')); }
export async function deleteDraftProposal(id: string) { const { error } = await supabase.rpc('delete_proposal_draft', { p_proposal_id: id }); if (error) throw error; }
