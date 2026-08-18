import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildJobTransmittalPdfModel,
  FIRST_PAGE_ROWS,
} from "../supabase/functions/_shared/job-transmittal-pdf-model.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [migration, hardening, privilegeRepair, allocatorRepair, sharedNumbering, editableCustomer, sharedNumberingVerification, defaults, validation, preflight, privilegeInspection, allocatorInspection, verification, edge, panel, queries, mutations, inspector] = await Promise.all([
  read("../supabase/migrations/20260728_001_job_transmittals.sql"),
  read("../supabase/migrations/20260728_002_job_transmittal_hardening.sql"),
  read("../supabase/migrations/20260728_003_job_document_reservation_privileges.sql"),
  read("../supabase/migrations/20260728_004_purchase_order_allocator_privileges.sql"),
  read("../supabase/migrations/20260729_001_shared_document_numbering_suffix_one.sql"),
  read("../supabase/migrations/20260803_002_job_transmittal_editable_customer.sql"),
  read("../supabase/inspection/20260729_001_shared_document_numbering_suffix_one_verification.sql"),
  read("../src/modules/transmittals/defaults.ts"),
  read("../src/modules/transmittals/validation.ts"),
  read("../supabase/inspection/20260728_001_job_transmittal_hardening_preflight.sql"),
  read("../supabase/inspection/20260728_003_job_document_reservation_privilege_inspection.sql"),
  read("../supabase/inspection/20260728_004_purchase_order_allocator_privilege_inspection.sql"),
  read("../supabase/inspection/20260728_002_job_transmittal_hardening_verification.sql"),
  read("../supabase/functions/generate-job-transmittal-pdf/index.ts"),
  read("../src/modules/transmittals/JobTransmittalPanel.tsx"),
  read("../src/modules/transmittals/queries.ts"),
  read("../src/modules/transmittals/mutations.ts"),
  read("../src/modules/production/components/ProductionJobInspector.tsx"),
]);

for (const requirement of [
  /create table if not exists public\.job_transmittals/,
  /job_id uuid not null references public\.jobs/,
  /lower\(trim\(transmittal_number\)\)/,
  /pg_advisory_xact_lock/,
  /public\.purchase_orders/,
  /public\.job_transmittals/,
  /suffix_value[\s\S]*\+ 1/,
  /job-transmittal-documents/,
  /guard_job_transmittal_immutable/,
  /prevent_job_transmittal_delete/,
]) assert.match(migration, requirement);

assert.match(edge, /pdf-lib@1\.17\.1/);
assert.match(edge, /draft-preview/);
assert.match(edge, /createSignedUrl/);
assert.match(edge, /fail_job_transmittal_pdf_generation/);
assert.match(edge, /job-transmittal-documents/);
assert.doesNotMatch(edge, /job_attachments/);
assert.match(panel, /History \(\{history\.length\}\)/);
assert.match(panel, /Generate & Download/);
assert.match(panel, /Retry/);
assert.match(mutations, /issue_job_transmittal/);
assert.match(inspector, /Letter of Transmittal/);
for (const requirement of [
  /job_document_numbers/,
  /unique \(prefix, suffix\)/,
  /last_value between 0 and 999/,
  /reserve_job_document_number/,
  /create or replace function public\.allocate_purchase_order_number/,
  /DOCUMENT_NUMBER_NAMESPACE_EXHAUSTED/,
  /revoke all on public\.job_transmittals from anon/,
  /create or replace function public\.list_job_transmittals/,
  /grant execute on function public\.list_job_transmittals\(uuid\) to anon/,
  /grant execute on function public\.issue_job_transmittal\(uuid,text,jsonb,text\) to anon/,
  /grant execute on function public\.preview_next_job_document_number\(uuid\) to anon/,
  /claim_job_transmittal_pdf_generation/,
  /generation_claim_token/,
  /complete_job_transmittal_pdf_generation/,
  /fail_job_transmittal_pdf_generation/,
]) assert.match(hardening, requirement);
assert.match(hardening, /nullif\(trim\(p_snapshot#>>'\{recipient,company\}'\),''\)/);
assert.match(hardening, /nullif\(trim\(item->>'description'\),''\)/);
assert.match(hardening, /generation_claim_token is null[\s\S]*generation_claimed_at is null[\s\S]*interval '15 minutes'/);
assert.match(hardening, /Registry-ineligible numeric PO\/Transmittal numbers exist/);
assert.match(preflight, /duplicate normalized number/);
assert.match(preflight, /suffix 000 is outside 001\.\.999/);
assert.match(preflight, /broad numeric document number fails exact/);
assert.match(privilegeRepair, /owner to postgres/);
assert.match(privilegeRepair, /from public, anon, authenticated, service_role/);
assert.match(privilegeInspection, /pg_get_function_identity_arguments/);
assert.match(privilegeInspection, /public_can_execute/);
assert.match(privilegeInspection, /service_role_can_execute/);
assert.match(allocatorRepair, /PO_ALLOCATOR_WRAPPER_BOUNDARY_INVALID/);
assert.match(allocatorRepair, /allocate_purchase_order_number\(uuid\) owner to postgres/);
assert.match(allocatorRepair, /from public, anon, authenticated, service_role/);
assert.match(allocatorInspection, /security_definer/);
assert.match(allocatorInspection, /service_role_can_execute/);
assert.match(allocatorInspection, /dependent_function/);
assert.match(sharedNumbering, /p_requested_number, 1/);
assert.doesNotMatch(sharedNumbering, /p_requested_number, 2/);
assert.match(sharedNumbering, /coalesce\(\([\s\S]*sequence\.last_value[\s\S]*\), 0\)/);
assert.match(sharedNumbering, /select max\(number\.suffix\)/);
assert.match(sharedNumbering, /grant execute on function public\.issue_job_transmittal\(uuid,text,jsonb,text\)[\s\S]*to anon, authenticated, service_role/);
assert.match(sharedNumbering, /grant execute on function public\.preview_next_job_document_number\(uuid\)[\s\S]*to anon, authenticated, service_role/);
assert.match(sharedNumberingVerification, /VERIFY_PO_TRANSMITTAL_PO_SEQUENCE/);
assert.match(sharedNumberingVerification, /VERIFY_TRANSMITTAL_TRANSMITTAL_PO_SEQUENCE/);
assert.match(sharedNumberingVerification, /rollback;/);
assert.match(defaults, /submittal: "Color Plate"/);
assert.match(defaults, /quantity: "1"/);
assert.match(defaults, /date: job\.sample_submitted_date \?\? ""/);
assert.match(defaults, /number: colorPlateNumber/);
assert.match(defaults, /typeSamples: Boolean\(colorPlateNumber\)/);
assert.match(defaults, /name: "Anthony"/);
assert.match(defaults, /phone: "469-491-7002"/);
assert.match(defaults, /email: "sales@tenartenterrazzo\.com"/);
assert.doesNotMatch(panel, />Company<input/);
assert.match(panel, />Customer Name<input/);
assert.match(panel, /value=\{draft\.customer\}/);
assert.match(panel, /Editing it does not change the job/);
assert.match(panel, />Address<textarea/);
assert.match(panel, />Job name<input/);
assert.match(validation, /0319-001/);
assert.match(validation, /Address fields must be 200 characters or fewer/);
for (const requirement of [
  /VERIFY_FUNCTION_MISSING/,
  /VERIFY_PUBLIC_FUNCTION_EXECUTE/,
  /VERIFY_OWNER_PRIVATE_FUNCTION/,
  /VERIFY_RESERVATION_HELPER_CALLER_BOUNDARY/,
  /VERIFY_PO_ALLOCATOR_CALLER_BOUNDARY/,
  /VERIFY_ANON_RAW_TABLE_ACCESS/,
  /VERIFY_SANITIZED_HISTORY_CONTRACT/,
  /VERIFY_REGISTRY_COUNT/,
  /VERIFY_PO_FIRST_SUFFIX/,
  /VERIFY_FIRST_TRANSMITTAL_SUFFIX/,
  /VERIFY_BLANK_RECIPIENT_ACCEPTED/,
  /VERIFY_BLANK_ITEM_ACCEPTED/,
  /VERIFY_LEGACY_GENERATING_NOT_RECOVERABLE/,
  /VERIFY_ACTIVE_CLAIM_STOLEN/,
  /VERIFY_STALE_FAILURE_OVERWROTE_SUCCESS/,
  /VERIFY_ISSUANCE_ROLLBACK_FAILED/,
  /rollback;/,
]) assert.match(verification, requirement);
assert.doesNotMatch(hardening, /auth\.uid\(\)/);
assert.doesNotMatch(hardening, /grant select on public\.job_transmittals to anon/);
assert.doesNotMatch(hardening, /grant execute on function public\.claim_job_transmittal_pdf_generation\(uuid,integer\) to anon/);
assert.match(edge, /requireEdgeCapability/);
assert.match(edge, /body\.action === "generate" \? "issueTransmittal" : "previewOperationalDocuments"/);
assert.match(edge, /Origin is not allowed/);
assert.match(edge, /hasExactKeys/);
assert.match(edge, /uuidPattern/);
assert.match(edge, /request body is too large/i);
assert.match(edge, /claim_job_transmittal_pdf_generation/);
assert.match(edge, /complete_job_transmittal_pdf_generation/);
assert.match(edge, /fail_job_transmittal_pdf_generation/);
assert.match(edge, /TENOPS_ALLOWED_ORIGINS/);
assert.doesNotMatch(edge, /Access-Control-Allow-Origin": "\*"/);
assert.match(panel, /Discard this unsaved Letter of Transmittal/);
assert.match(panel, /Checked against existing Purchase Orders and Transmittals/);
assert.match(panel, /numberOverride \? displayedNumber : null/);
assert.match(mutations, /requestedNumber: string \| null/);
assert.match(mutations, /customer: draft\.customer\.trim\(\)/);
assert.match(editableCustomer, /display_customer := trim\(coalesce\(p_snapshot->>'customer', ''\)\)/);
assert.match(editableCustomer, /jsonb_typeof\(p_snapshot->'customer'\) is distinct from 'string'/);
assert.match(editableCustomer, /'customer', display_customer/);
assert.doesNotMatch(editableCustomer, /'customer', selected_job\.customer/);
assert.match(editableCustomer, /p_requested_number, 1/);
assert.match(editableCustomer, /grant execute on function public\.issue_job_transmittal/);
assert.match(panel, /record\.documentStatus !== "generated"/);
assert.doesNotMatch(panel, /previewDraft\(\)[\s\S]{0,120}errors\.length/);
assert.match(panel, /useState\(true\)/);
assert.match(panel, /This workflow is still under active development\./);
assert.match(panel, /Feedback is welcome\./);
assert.doesNotMatch(panel, /earlyAccessBannerKey|sessionStorage/);
assert.doesNotMatch(panel, /EARLY ACCESS|rotate-\[28deg\]|opacity-\[0\.07\]/);
assert.doesNotMatch(edge, /EARLY ACCESS/);
assert.match(edge, /allowEmptyItems: draft/);
assert.match(edge, /allowBlankTransmittalNumber: draft/);
assert.match(edge, /t\("CC", 316, 582,[\s\S]{0,100}wrapped\(model\.cc,400,582/);
assert.match(edge, /band\("TRANSMITTED ITEMS", 561, true\)/);
assert.match(edge, /snapshot\.recipient\.address_line_1\.length > 200/);
assert.doesNotMatch(panel, /auth\.getSession|authenticated/);
assert.match(queries, /rpc\("list_job_transmittals"/);
assert.doesNotMatch(queries, /\.from\("job_transmittals"\)/);
assert.match(inspector, /onClick=\{\(\) => setTransmittalOpen\(true\)\}/);
assert.match(inspector, /\{transmittalOpen && \(/);

const items = Array.from({ length: FIRST_PAGE_ROWS + 3 }, (_, index) => ({
  line_number: index + 1,
  submittal: "Sample",
  quantity: "1",
  date: "2026-07-28",
  number: `S-${index + 1}`,
  description: "Fictional verification item",
}));
const model = buildJobTransmittalPdfModel({
  transmittal_number: "0417-002",
  document_date: "2026-07-28",
  job_id: "job-id",
  job_number: "26-0417",
  job_name: "Verification Job",
  customer: "Editable Customer",
  recipient: { company: "Example Recipient", address_line_1: "Line One\nLine Two", address_line_2: "Line Three" },
  items,
  sender: { name: "Chris" },
});
assert.equal(model.transmittalNumber, "0417-002");
assert.equal(model.job.customer, "Editable Customer");
assert.equal(model.recipient.addressLine1, "Line One\nLine Two");
assert.equal(model.recipient.addressLine2, "Line Three");
assert.equal(model.pages.length, 2);
assert.equal(model.pages[0].length, FIRST_PAGE_ROWS);
assert.equal(model.pages[1].length, 3);

const longDescription = `${"LongSegment".repeat(30)} ${"operational detail ".repeat(80)}`;
const longModel = buildJobTransmittalPdfModel({
  transmittal_number:"0417-003", document_date:"2026-07-28",
  job_id:"job-id", job_number:"26-0417", job_name:"Verification Job",
  recipient:{company:"Example Recipient"},
  items:[{line_number:1,submittal:"Shop drawing",quantity:"1",date:"2026-07-28",number:"SD-1",description:longDescription}],
  comments:"Comment detail ".repeat(200),
  sender:{name:"Chris"},
});
const renderedDescription = longModel.pages.flat().map((item) => item.description).join(" ");
assert.equal(renderedDescription.replaceAll(" ",""), longDescription.replaceAll(/\s/g,""));
assert.ok(longModel.commentPages.length > 1);
assert.equal(longModel.commentPages.join(" ").replaceAll(" ",""), ("Comment detail ".repeat(200)).trim().replaceAll(/\s/g,""));

const incompletePreviewModel = buildJobTransmittalPdfModel({
  transmittal_number: "",
  document_date: "",
  job_id: "job-id",
  job_number: "26-0417",
  job_name: "Verification Job",
  recipient: {},
  items: [],
  sender: {},
}, { allowEmptyItems: true, allowBlankTransmittalNumber: true });
assert.equal(incompletePreviewModel.transmittalNumber, "");
assert.equal(incompletePreviewModel.pages.length, 1);
assert.equal(incompletePreviewModel.pages[0].length, 1);
assert.equal(incompletePreviewModel.pages[0][0].description, "");
assert.throws(() => buildJobTransmittalPdfModel({
  transmittal_number: "",
  document_date: "",
  job_id: "job-id",
  job_number: "26-0417",
  job_name: "Verification Job",
  recipient: {},
  items: [],
  sender: {},
}), /no transmitted items/i);

console.log("Job Transmittal verification passed.");
