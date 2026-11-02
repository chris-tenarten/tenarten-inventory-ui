/** Explicit synthetic presentation fixture. Never selected from employee text. */
import type {AutomationGap, CapabilityRequestAdapter} from './model';

export const capabilityRequestPreviewGap: AutomationGap = {
  kind: 'automation-gap',
  id: 'presentation-preview-only',
  assistanceProvided: true,
  requestedCapability: 'Prepare a proposed Production schedule from my instructions',
  employeeObjective: 'Move the example job to next week for review',
  existingWorkflow: 'Production → Timeline → Review changes',
};

export const capabilityRequestPreviewAdapter: CapabilityRequestAdapter = {
  availability: 'preview',
  async submit() { return {kind: 'preview'}; },
};
