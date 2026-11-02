/** Deterministic presentation-contract checks. No API, database, model or storage calls. */
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CapabilityRequestProvider, CapabilityRequestSlot} from '../src/modules/tenbot/capability-requests/CapabilityRequestSlot';
import {
  canOfferCapabilityRequest, capabilityDraftFromGap, isPersistedSubmission,
  unavailableCapabilityRequestAdapter, validCapabilityDraft,
} from '../src/modules/tenbot/capability-requests/model';
import {
  capabilityRequestPreviewGap as gap, capabilityRequestPreviewAdapter as preview,
} from '../src/modules/tenbot/capability-requests/presentation-fixture';

assert(canOfferCapabilityRequest(gap));
for (const kind of ['ordinary-question', 'permission-error', 'temporary-failure', 'unsupported-information']) {
  assert(!canOfferCapabilityRequest({...gap, kind}), `${kind} must not offer a request`);
}
assert(!canOfferCapabilityRequest({suggestionAllowed: true}), 'legacy suggestion flag is not a classifier');
assert(!canOfferCapabilityRequest({...gap, assistanceProvided: false}), 'useful assistance must come first');
assert(!canOfferCapabilityRequest({...gap, assistanceProvided: undefined}));
for (const field of ['id', 'requestedCapability', 'employeeObjective']) {
  for (const value of ['', '   ', 5, null, undefined]) {
    assert(!canOfferCapabilityRequest({...gap, [field]: value}), `${field} must be a nonblank string`);
  }
}
for (const field of ['requestedCapability', 'employeeObjective', 'existingWorkflow']) {
  assert(!canOfferCapabilityRequest({...gap, [field]: 'x'.repeat(1201)}), `${field} must remain bounded`);
}
assert(!canOfferCapabilityRequest({...gap, id: 'x'.repeat(201)}));
assert(canOfferCapabilityRequest({...gap, existingWorkflow: undefined}), 'workflow identification is optional');
assert(!canOfferCapabilityRequest(null));

const draft = capabilityDraftFromGap(gap);
assert.deepEqual(Object.keys(draft).sort(), ['additionalContext', 'employeeObjective', 'existingWorkflow', 'requestedCapability']);
assert(!('requester' in draft), 'requester identity belongs to the server');
assert(!('conversation' in draft), 'the transcript is never projected into a request');
assert(!('id' in draft), 'gap binding stays separate from the reviewed fields');
assert(validCapabilityDraft(draft));
for (const field of ['requestedCapability', 'employeeObjective']) {
  assert(!validCapabilityDraft({...draft, [field]: '   '}));
  assert(!validCapabilityDraft({...draft, [field]: 'x'.repeat(1201)}));
}
assert(validCapabilityDraft({...draft, existingWorkflow: undefined}));
assert(validCapabilityDraft({...draft, additionalContext: 'x'.repeat(1200)}));
assert(!validCapabilityDraft({...draft, additionalContext: 'x'.repeat(1201)}));
assert(!validCapabilityDraft({...draft, existingWorkflow: 'x'.repeat(1201)}));

assert.equal(preview.availability, 'preview');
assert.deepEqual(await preview.submit(draft, gap), {kind: 'preview'});
for (const value of [null, undefined, {}, {kind: 'preview'}, {kind: 'persisted'}, {kind: 'persisted', id: ''}, {kind: 'persisted', id: '  '}, {kind: 'persisted', id: 42}]) {
  assert(!isPersistedSubmission(value), 'preview/invalid/absent receipt is never persisted success');
}
assert(isPersistedSubmission({kind: 'persisted', id: 'server-durable-record-id'}));
assert.equal(unavailableCapabilityRequestAdapter.availability, 'unavailable');
await assert.rejects(unavailableCapabilityRequestAdapter.submit(draft, gap), /not connected/);

const slot = (ownerId: string, accessKey = 'current-access') => createElement(CapabilityRequestSlot, {ownerId, accessKey});
const provider = (ownerId: string, slotOwnerId: string, accessKey = 'current-access', slotAccessKey = accessKey) => createElement(CapabilityRequestProvider, {ownerId, accessKey, signal: gap}, slot(slotOwnerId, slotAccessKey));
assert.equal(renderToStaticMarkup(slot('owner-a')), '', 'no provider or server-side preview means no prompt');
assert.equal(renderToStaticMarkup(provider('owner-a', 'owner-b')), '', 'a different account must never see the signal');
assert.equal(renderToStaticMarkup(provider('', '')), '', 'blank owner never sees the signal');
assert.equal(renderToStaticMarkup(provider('owner-a', 'owner-a', 'old-access', 'current-access')), '', 'changed access must not retain the signal');
assert.equal(renderToStaticMarkup(provider('owner-a', 'owner-a', '', '')), '', 'blank access key never sees the signal');
const unavailableMarkup = renderToStaticMarkup(provider('owner-a', 'owner-a'));
assert.match(unavailableMarkup, /Suggestions are not connected yet/);
assert.match(unavailableMarkup, /Yes, submit suggestion/);
assert.match(unavailableMarkup, /No, dismiss/);
const previewMarkup = renderToStaticMarkup(createElement(CapabilityRequestProvider, {ownerId: 'owner-a', accessKey: 'current-access', signal: gap, adapter: preview}, slot('owner-a')));
assert.match(previewMarkup, /No request will be saved or sent/);

console.log('PASS: capability signal exclusions/assistance gate, minimal bounded draft, truthful preview/receipt, unavailable adapter and account-scoped component checks');
