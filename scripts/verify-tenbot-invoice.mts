import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCallerInvoiceReader, createTenbotInvoiceTools } from '../supabase/functions/_shared/tenbot-invoice';
import type { InvoiceCatalogRead, InvoiceReceivalRead, InvoiceConfirmation, TenbotInvoiceDocument, TenbotInvoiceReader } from '../supabase/functions/_shared/tenbot-invoice';
import type { AgentTool, JsonValue } from '../supabase/functions/_shared/tenbot-agent';
import type { JobToolCaller } from '../supabase/functions/_shared/tenbot-job-tools';

type Fixture = { synthetic: true; document: TenbotInvoiceDocument; catalog: InvoiceCatalogRead; receivals: InvoiceReceivalRead; confirmedMetadataExample: InvoiceConfirmation };
type PreparedLine = { source_ref: string; proposal: { quantity_expected: string; unit: string; order_date: string | null; ordered_by: string | null; location: string | null }; conversion: { operation: string } | null };
type Proposal = { synthetic: true; execution_available: false; status: string; ready_lines: PreparedLine[]; held_lines: { source_ref: string; reasons: string[] }[]; excluded_lines: { reason: string }[]; missing_employee_confirmations: string[] };
const fixture = JSON.parse(await readFile(new URL('./fixtures/tenbot-invoice.synthetic.json', import.meta.url), 'utf8')) as Fixture;
const checks: string[] = [];
const context = { callerId: 'synthetic-owner', signal: new AbortController().signal };
const copy = <T,>(value: T): T => structuredClone(value);
const ref = (line: number) => `${fixture.document.id}:L${line}`;
const metadata = { supplier: 'T&M Supply', supplier_source_ref: ref(2), document_ref: 'SYN-INV-1042', document_source_ref: ref(3) };
const extractions: Record<string, JsonValue>[] = [
  { source_ref: ref(5), description: 'Alaska White', quantity: '100', unit: 'LB', size: '#1', vendor_sku: 'AW-1' },
  { source_ref: ref(6), description: 'Blue Coal', quantity: '3', unit: 'Bag', size: '#0', vendor_sku: 'BC-0' },
  { source_ref: ref(7), description: 'CC Green', quantity: '2', unit: 'Bag', size: '#1', vendor_sku: 'GREEN' },
  { source_ref: ref(8), description: 'Unlisted Violet', quantity: '4', unit: 'Bag', size: '#2', vendor_sku: 'UNK-99' },
  { source_ref: ref(9), description: 'Clear Resin', quantity: '5', unit: 'GAL', size: 'Part A', vendor_sku: 'RES-5' },
];
const selections = [
  { source_ref: ref(5), candidate_id: 'standard:synthetic-aw1' },
  { source_ref: ref(6), candidate_id: 'standard:synthetic-bc0' },
  { source_ref: ref(7), candidate_id: 'standard:synthetic-green-a' },
  { source_ref: ref(8), candidate_id: null },
  { source_ref: ref(9), candidate_id: 'standard:synthetic-res5' },
];
const prepare = { selections, exclusions: [{ source_ref: ref(10), reason: 'freight' }] };
function readerFor(source = fixture): TenbotInvoiceReader {
  return {
    async searchCatalog(query) {
      const matching = (row: Record<string, unknown>) => Object.values(row).some(value => String(value).toLowerCase().includes(query.toLowerCase()));
      return { complete: source.catalog.complete, standard: source.catalog.standard.filter(matching), specialty: source.catalog.specialty.filter(matching) };
    },
    async readReceivals() { return copy(source.receivals); },
  };
}
function toolsFor(source = fixture, confirmation?: InvoiceConfirmation, reader = readerFor(source)) {
  return createTenbotInvoiceTools({ callerId: context.callerId, document: source.document, reader, confirmation });
}
function call(tools: AgentTool[], name: string, args: Record<string, JsonValue>, override = context) {
  const tool = tools.find(item => item.name === name); assert.ok(tool, name);
  return tool.execute(args, override);
}
async function register(tools: AgentTool[], items = extractions) {
  await call(tools, 'read_invoice', {});
  for (const extraction of items) await call(tools, 'search_catalog', extraction);
  await call(tools, 'check_receival_duplicates', metadata);
}
async function test(name: string, check: () => Promise<void>) { await check(); checks.push(name); }

await test('raw synthetic attachment, not pre-extracted model answers', async () => {
  const result = await call(toolsFor(), 'read_invoice', {});
  const json = JSON.stringify(result.data);
  assert.ok(json.includes('100 LB')); assert.ok(json.includes('SYNTHETIC'));
  assert.ok(!json.includes('ready_lines')); assert.ok(!json.includes('catalog_item_id'));
});
await test('independent exact quantity conversion, holds ambiguity/unmatched/duplicates, excludes freight', async () => {
  const tools = toolsFor(fixture, fixture.confirmedMetadataExample); await register(tools);
  const result = await call(tools, 'prepare_pending_receivals', prepare), proposal = result.proposal as unknown as Proposal;
  assert.deepEqual(proposal.ready_lines.map(line => [line.proposal.quantity_expected, line.proposal.unit]), [['2', 'Bag'], ['1', 'Pail']]);
  assert.equal(proposal.held_lines.length, 3);
  assert.deepEqual(proposal.held_lines[0].reasons, ['potential_duplicate']);
  assert.deepEqual(proposal.held_lines[1].reasons, ['ambiguous_catalog_match']);
  assert.ok(proposal.held_lines[2].reasons.includes('unmatched_material'));
  assert.equal(proposal.excluded_lines[0].reason, 'freight');
  assert.deepEqual(result.data, result.proposal);
  assert.equal(proposal.status, 'review_only_no_execution'); assert.equal(proposal.execution_available, false);
  assert.equal(proposal.synthetic, true);
});
await test('missing metadata is explicit; invoice date and reader identity never become order metadata', async () => {
  const tools = toolsFor(); await register(tools);
  const proposal = (await call(tools, 'prepare_pending_receivals', prepare)).proposal as unknown as Proposal;
  assert.deepEqual(proposal.missing_employee_confirmations, ['ordered_by', 'order_date', 'location']);
  assert.ok(proposal.ready_lines.every(line => line.proposal.order_date === null && line.proposal.ordered_by === null && line.proposal.location === null));
});
await test('owner/session binding and read-first evidence boundary', async () => {
  const tools = toolsFor();
  await assert.rejects(call(tools, 'read_invoice', {}, { ...context, callerId: 'other-owner' }), /invoice_session_not_authorized/);
  await assert.rejects(call(tools, 'search_catalog', extractions[0]), /read_invoice_first/);
  await call(tools, 'read_invoice', {});
  await assert.rejects(call(tools, 'search_catalog', { ...extractions[0], source_ref: 'other-document:L5' }), /invalid_invoice_evidence/);
});
await test('malformed, negative, zero and invented positive quantities rejected', async () => {
  const tools = toolsFor(); await call(tools, 'read_invoice', {});
  for (const quantity of ['0', '-1', 'NaN', '1e2', '100.0000001', '999', '1.2.3']) await assert.rejects(call(tools, 'search_catalog', { ...extractions[0], quantity }), /invalid_invoice_quantity|unsupported_invoice_quantity_unit/);
  await assert.rejects(call(tools, 'search_catalog', { ...extractions[0], unit: 'KG' }), /unsupported_invoice_quantity_unit/);
  await assert.rejects(call(tools, 'search_catalog', { ...extractions[0], description: 'Invented material' }), /unsupported_invoice_extraction/);
});
await test('SKU/size prefixes cannot impersonate complete source identities', async () => {
  const bad = copy(fixture); bad.document.text = bad.document.text.replace('AW-1 | Alaska White | #1', 'AW-10 | Alaska White | #10');
  const tools = toolsFor(bad); await call(tools, 'read_invoice', {});
  await assert.rejects(call(tools, 'search_catalog', extractions[0]), /unsupported_invoice_extraction/);
  await assert.rejects(call(tools, 'search_catalog', { ...extractions[0], size: '#10' }), /unsupported_invoice_extraction/);
});
await test('supplier and full invoice reference require their own labeled evidence', async () => {
  const tools = toolsFor(); await call(tools, 'read_invoice', {}); await call(tools, 'search_catalog', extractions[0]);
  await assert.rejects(call(tools, 'check_receival_duplicates', { ...metadata, supplier: 'Alaska White', supplier_source_ref: ref(5) }), /unsupported_invoice_metadata/);
  await assert.rejects(call(tools, 'check_receival_duplicates', { ...metadata, document_ref: 'INV' }), /unsupported_invoice_metadata/);
  await assert.rejects(call(tools, 'check_receival_duplicates', { ...metadata, supplier: 'T&M' }), /unsupported_invoice_metadata/);
});
await test('no arbitrary rows, SQL, actor metadata or fabricated candidate IDs in prepare', async () => {
  const tools = toolsFor(); await register(tools);
  await assert.rejects(call(tools, 'prepare_pending_receivals', { ...prepare, quantity_expected: '10000' }), /invalid_invoice_argument/);
  await assert.rejects(call(tools, 'prepare_pending_receivals', { ...prepare, ordered_by: 'Fabricated actor' }), /invalid_invoice_argument/);
  await assert.rejects(call(tools, 'prepare_pending_receivals', { ...prepare, sql: 'select 1' }), /invalid_invoice_argument/);
  await assert.rejects(call(tools, 'prepare_pending_receivals', { ...prepare, selections: [{ ...selections[0], candidate_id: 'standard:foreign-record' }, ...selections.slice(1)] }), /catalog_candidate_not_in_session/);
});
await test('every registered line reviewed exactly once; no forged or repeated refs', async () => {
  const tools = toolsFor(); await register(tools);
  await assert.rejects(call(tools, 'prepare_pending_receivals', { ...prepare, selections: selections.slice(1) }), /all_extracted_lines_must_be_reviewed/);
  await assert.rejects(call(tools, 'prepare_pending_receivals', { ...prepare, selections: [selections[0], selections[0], ...selections.slice(2)] }), /invalid_invoice_selection/);
  await assert.rejects(call(tools, 'prepare_pending_receivals', { ...prepare, selections: [{ ...selections[0], source_ref: 'foreign:L5' }, ...selections.slice(1)] }), /invalid_invoice_selection/);
});
await test('material lines cannot be hidden as freight; freight cannot enter material preparation', async () => {
  const tools = toolsFor(); await register(tools);
  await assert.rejects(call(tools, 'prepare_pending_receivals', { ...prepare, exclusions: [{ source_ref: ref(5), reason: 'freight' }] }), /invalid_invoice_exclusion/);
  await assert.rejects(call(tools, 'search_catalog', { ...extractions[0], source_ref: ref(10), description: 'Delivery charge' }), /non_material_invoice_line/);
});
await test('catalog completeness, row identity uniqueness and financial-field projection', async () => {
  const bad = copy(fixture); bad.catalog.complete = false;
  const tools = toolsFor(bad); await call(tools, 'read_invoice', {});
  await assert.rejects(call(tools, 'search_catalog', extractions[0]), /invoice_read_incomplete/);
  const duplicate = copy(fixture); duplicate.catalog.standard.push(copy(duplicate.catalog.standard[0]));
  const duplicateTools = toolsFor(duplicate); await call(duplicateTools, 'read_invoice', {});
  await assert.rejects(call(duplicateTools, 'search_catalog', extractions[0]), /invoice_read_incomplete/);
  const financial = copy(fixture); financial.catalog.standard[0].price = 12345; financial.catalog.standard[0].private_notes = 'Never model context';
  const financialTools = toolsFor(financial); await call(financialTools, 'read_invoice', {});
  const output = JSON.stringify((await call(financialTools, 'search_catalog', extractions[0])).data);
  assert.ok(!output.includes('12345')); assert.ok(!output.includes('Never model context')); assert.ok(!output.includes('referencePrice'));
});
await test('incomplete duplicate checks never establish absence', async () => {
  const bad = copy(fixture); bad.receivals.complete = false;
  const tools = toolsFor(bad); await call(tools, 'read_invoice', {}); await call(tools, 'search_catalog', extractions[0]);
  await assert.rejects(call(tools, 'check_receival_duplicates', metadata), /invoice_read_incomplete/);
  await assert.rejects(call(tools, 'prepare_pending_receivals', { selections: [selections[0]], exclusions: [] }), /current_duplicate_check_required/);
});
await test('tool errors recover by re-reading; failed refresh invalidates older duplicate evidence', async () => {
  let broken = false;
  const reader = readerFor();
  const tools = toolsFor(fixture, undefined, { ...reader, async readReceivals(signal) { if (broken) throw new Error('synthetic_reader_failure'); return reader.readReceivals(signal); } });
  await register(tools); broken = true;
  await assert.rejects(call(tools, 'check_receival_duplicates', metadata), /synthetic_reader_failure/);
  await assert.rejects(call(tools, 'prepare_pending_receivals', prepare), /current_duplicate_check_required/);
  broken = false; await call(tools, 'check_receival_duplicates', metadata);
  assert.ok((await call(tools, 'prepare_pending_receivals', prepare)).proposal);
});
await test('a new catalog extraction invalidates the earlier duplicate snapshot', async () => {
  const tools = toolsFor(); await register(tools); await call(tools, 'search_catalog', extractions[0]);
  await assert.rejects(call(tools, 'prepare_pending_receivals', prepare), /current_duplicate_check_required/);
});
await test('incompatible units, missing invoice sizes and supplier mismatch remain held', async () => {
  const bad = copy(fixture); bad.catalog.standard[0].unit = '5 GAL Pail'; bad.catalog.standard[4].vendor = 'Other Supplier';
  const tools = toolsFor(bad); await register(tools, [{ ...extractions[0], size: null }, ...extractions.slice(1)]);
  const proposal = (await call(tools, 'prepare_pending_receivals', prepare)).proposal as unknown as Proposal;
  const first = proposal.held_lines.find(line => line.source_ref === ref(5)); assert.ok(first);
  assert.ok(first.reasons.includes('missing_invoice_material_size')); assert.ok(first.reasons.includes('incompatible_unit_or_package'));
  assert.ok(proposal.held_lines.find(line => line.source_ref === ref(9))?.reasons.includes('unmatched_material'));
});
await test('nonterminating package divisions are held rather than rounded', async () => {
  const bad = copy(fixture); bad.catalog.standard[0].unit = '3 LB Bag';
  const tools = toolsFor(bad); await register(tools);
  const proposal = (await call(tools, 'prepare_pending_receivals', prepare)).proposal as unknown as Proposal;
  assert.ok(proposal.held_lines.find(line => line.source_ref === ref(5))?.reasons.includes('non_exact_package_conversion'));
});
await test('explicit invoice package conflicts are held even when SKU and container unit match', async () => {
  for (const packageLabel of ['25 LB Bag', '5 KG Bag']) {
    const bad = copy(fixture); bad.document.text = bad.document.text.replace('100 LB', `100 LB | Package: ${packageLabel}`);
    const tools = toolsFor(bad); await register(tools);
    const proposal = (await call(tools, 'prepare_pending_receivals', prepare)).proposal as unknown as Proposal;
    assert.ok(proposal.held_lines.find(line => line.source_ref === ref(5))?.reasons.includes('invoice_catalog_package_conflict'), packageLabel);
  }
});
await test('a matching SKU cannot silently override a conflicting invoice material description', async () => {
  const bad = copy(fixture); bad.document.text = bad.document.text.replace('AW-1 | Alaska White', 'AW-1 | Clear Resin');
  const tools = toolsFor(bad); await register(tools, [{ ...extractions[0], description: 'Clear Resin' }, ...extractions.slice(1)]);
  const proposal = (await call(tools, 'prepare_pending_receivals', prepare)).proposal as unknown as Proposal;
  assert.ok(proposal.held_lines.find(line => line.source_ref === ref(5))?.reasons.includes('invoice_catalog_material_conflict'));
});
await test('no executor is discoverable and approval language never expands capabilities', async () => {
  const tools = toolsFor();
  assert.deepEqual(tools.map(tool => [tool.name, tool.kind]), [['read_invoice', 'read'], ['search_catalog', 'read'], ['check_receival_duplicates', 'read'], ['prepare_pending_receivals', 'prepare']]);
  assert.ok(!tools.some(tool => /execute|insert|approve|receive_quantity/.test(tool.name)));
});
await test('caller read adapter fixes tables/projections, quotes search grammar and refuses incomplete counts', async () => {
  const calls: { table: string; columns: string; filter: string }[] = [];
  let count: number | null = 0;
  const caller = {
    from(table: string) {
      return { select(columns: string) {
        const record = { table, columns, filter: '' }; calls.push(record);
        const query = { eq() { return query; }, in() { return query; }, or(filter: string) { record.filter = filter; return query; }, order() { return query; }, range() { return query; }, abortSignal() { return query; }, then(resolve: (value: unknown) => void) { return Promise.resolve({ data: [], error: null, count }).then(resolve); } };
        return query;
      } };
    },
    rpc() { throw new Error('RPC must not be called'); },
  } as unknown as JobToolCaller;
  const reader = createCallerInvoiceReader(caller);
  await reader.searchCatalog('AW%,id.eq.1', context.signal); await reader.readReceivals(context.signal);
  assert.deepEqual(calls.map(call => call.table), ['vendor_catalog', 'vendor_catalog_v2', 'pending_receivals']);
  assert.ok(calls.every(call => !/\b(price|bulk_price|notes|created_by|ordered_by)\b/.test(call.columns)));
  assert.ok(calls[0].filter.includes(JSON.stringify('%AW\\%,id.eq.1%')));
  count = null; await assert.rejects(reader.searchCatalog('AW', context.signal), /invoice_read_incomplete/);
  count = 1001; await assert.rejects(reader.readReceivals(context.signal), /invoice_read_incomplete/);
});

console.log(JSON.stringify({ status: 'pass', mode: 'offline deterministic contract validation; no model or OCR test', groups: checks.length, checks, database_writes: 0, inference_calls: 0 }, null, 2));
