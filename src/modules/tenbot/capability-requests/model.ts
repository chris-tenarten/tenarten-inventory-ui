/** Presentation seam only. The backend owns classification and authorization. */
export type AutomationGap = {
  kind: 'automation-gap';
  id: string;
  assistanceProvided: true;
  requestedCapability: string;
  employeeObjective: string;
  existingWorkflow?: string;
};

export type CapabilitySignal = AutomationGap | {
  kind: 'ordinary-question' | 'permission-error' | 'temporary-failure' | 'unsupported-information';
  id: string;
};

export type CapabilityRequestDraft = {
  requestedCapability: string;
  existingWorkflow?: string;
  employeeObjective: string;
  additionalContext: string;
};

export type SubmissionResult = { kind: 'persisted'; id: string } | { kind: 'preview' };

export type CapabilityRequestAdapter = {
  availability: 'connected' | 'preview' | 'unavailable';
  submit: (draft: CapabilityRequestDraft, gap: AutomationGap) => Promise<SubmissionResult>;
};

export const unavailableCapabilityRequestAdapter: CapabilityRequestAdapter = {
  availability: 'unavailable',
  async submit() { throw new Error('Suggestions are not connected yet. Nothing was submitted.'); },
};

export function canOfferCapabilityRequest(value: unknown): value is AutomationGap {
  if (!value || typeof value !== 'object') return false;
  const signal = value as Record<string, unknown>;
  return signal.kind === 'automation-gap' && signal.assistanceProvided === true
    && typeof signal.id === 'string' && signal.id.trim().length > 0 && signal.id.length <= 200
    && [signal.requestedCapability, signal.employeeObjective]
      .every(field => typeof field === 'string' && field.trim().length > 0 && field.length <= 1200)
    && (signal.existingWorkflow === undefined || typeof signal.existingWorkflow === 'string' && signal.existingWorkflow.length <= 1200);
}

export function capabilityDraftFromGap(gap: AutomationGap): CapabilityRequestDraft {
  return {
    requestedCapability: gap.requestedCapability,
    ...(gap.existingWorkflow ? {existingWorkflow: gap.existingWorkflow} : {}),
    employeeObjective: gap.employeeObjective,
    additionalContext: '',
  };
}

export function validCapabilityDraft(draft: CapabilityRequestDraft): boolean {
  return [draft.requestedCapability, draft.employeeObjective]
    .every(value => typeof value === 'string' && value.trim().length > 0 && value.length <= 1200)
    && (draft.existingWorkflow === undefined || typeof draft.existingWorkflow === 'string' && draft.existingWorkflow.length <= 1200)
    && typeof draft.additionalContext === 'string' && draft.additionalContext.length <= 1200;
}

/** An absent/invalid receipt can never become a successful submission message. */
export function isPersistedSubmission(value: unknown): value is { kind: 'persisted'; id: string } {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  return result.kind === 'persisted' && typeof result.id === 'string' && result.id.trim().length > 0;
}
