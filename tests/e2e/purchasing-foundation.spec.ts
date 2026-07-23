import { expect, test, type Page } from '@playwright/test';

const job = { id:'10000000-0000-4000-8000-000000000010', name:'AL Statehouse', job_number:'26-0206', customer:'MTT', work_order_number:'070726-1', color_plate_number:'T26-263-A', production_status:'in_production', archived_at:null, planned_start:'2026-07-02', requested_delivery_date:'2026-09-11' };
const otherJob = { ...job, id:'10000000-0000-4000-8000-000000000011', name:'Heights Career Tech', job_number:'26-0530' };
const vendor = { id:'20000000-0000-4000-8000-000000000010', name:'Klein & Co.', canonical_name:'kleinco', address:'', address_line_1:'', address_line_2:'', city:'', state:'', postal_code:'', country:'', phone:'', email:'', website:'', payment_terms:'Net 30', notes:'', is_active:true, contacts:[{ id:'21000000-0000-4000-8000-000000000010', vendor_id:'20000000-0000-4000-8000-000000000010', contact_name:'Felipe Gallegos', role:'Sales', email:'felipe@example.com', phone:'555-0100', notes:'', is_default:true, is_active:true }] };
const otherVendor = { ...vendor, id:'20000000-0000-4000-8000-000000000011', name:'T&M Supply', canonical_name:'tmsupply', contacts:[{ ...vendor.contacts[0], id:'21000000-0000-4000-8000-000000000011', vendor_id:'20000000-0000-4000-8000-000000000011', contact_name:'Megan Stone', email:'megan@example.com', phone:'555-0111' }] };
const catalog = { id:'30000000-0000-4000-8000-000000000010', vendor_name:'Klein & Co.', vendor_sku:'RB-1', item_name:'Raven Black', canonical_item_name:'Raven Black', size:'#1', canonical_size:'#1', category:'Chip / Aggregate', material_type:'chip', packaging:'50 LB Bag', unit_size:50, unit_size_uom:'LB', price:42.50, bulk_price:39.75, bulk_minimum_quantity:50, bulk_minimum_uom:'Bag', truckload_price:34.25, truckload_minimum_quantity:900, truckload_minimum_uom:'Bag', price_unit:'Bag', minimum_order_qty:null, minimum_order_uom:null, lead_time_days:null, is_active:true };
const catalogWithoutBulkPrice = { ...catalog, id:'30000000-0000-4000-8000-000000000011', vendor_sku:'NB-1', item_name:'No Bulk Black', canonical_item_name:'No Bulk Black', bulk_price:null };
const standardCatalog = [...Array.from({length:20},(_,index)=>({ id:`40000000-0000-4000-8000-${String(index).padStart(12,'0')}`, vendor:'ASG', item_name:`Black ${index+1}`, size:'#1', category:'Aggregate', material_class:'chip', unit:'50 LB Bag', price:null, price_basis:'Bag' })),{ id:'40000000-0000-4000-8000-999999999999', vendor:'T&M Supply', item_name:'Arabian Black', size:'#1', category:'glass', material_class:'recycled_aggregate', unit:'50 LB Bag', price:null, price_basis:'Bag' }];

async function mockPurchasing(page: Page) {
  await page.route('**/rest/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').at(-1);
    let body: unknown = [];
    if (table === 'jobs') body = url.searchParams.has('id') ? job : [job, otherJob];
    else if (table === 'vendors') body = [vendor, otherVendor];
    else if (table === 'vendor_catalog') body = standardCatalog;
    else if (table === 'vendor_catalog_v2') body = [catalog, catalogWithoutBulkPrice];
    await route.fulfill({ status:200, contentType:'application/json', headers:{'content-range':'0-0/1'}, body:JSON.stringify(body) });
  });
}

test('Production launch prefills the canonical Job and catalog search survives Vendor and Job transitions', async ({ page }) => {
  await mockPurchasing(page);
  await page.goto(`/purchasing?jobId=${job.id}`);

  await expect(page.getByRole('heading', { name:'New Purchase Order' })).toBeVisible();
  await expect(page.getByRole('button', { name:'26-0206 — AL Statehouse' })).toBeVisible();
  await expect(page.getByText('Use PO-level Job / stock', { exact:true })).toHaveCount(0);
  await expect(page.locator('input[type="date"]').nth(1)).toHaveValue('2026-09-11');

  const search = page.getByPlaceholder('Search by material, SKU, vendor, or size...');
  await search.fill('Black');
  await expect(page.getByRole('button', { name:/Raven Black/ })).toBeVisible();

  await page.locator('input[list="po-vendor-options"]').fill('Klein & Co.');
  await expect(page.getByPlaceholder('Editable contact snapshot')).toHaveValue('Felipe Gallegos · Sales · felipe@example.com · 555-0100');
  await expect(page.getByRole('option', { name:/Select configured contact/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name:/Raven Black/ })).toBeVisible();

  await page.locator('input[list="po-vendor-options"]').fill('T&M Supply');
  await expect(page.getByPlaceholder('Editable contact snapshot')).toHaveValue('Megan Stone · Sales · megan@example.com · 555-0111');
  await page.getByRole('button', { name:/Arabian Black/ }).click();
  await expect(page.getByRole('button', { name:'Configure Bulk Pricing' })).toBeVisible();
  await page.getByRole('button', { name:'View Historical Prices' }).click();
  await expect(page.getByText('No issued PO price history was found for this Vendor and material.')).toBeVisible();
  await page.getByLabel('Unit Price').fill('35');
  await page.getByRole('button', { name:'Configure Bulk Pricing' }).click();
  await expect(page.getByLabel(/Bulk Price/)).toHaveValue('');
  await expect(page.getByLabel('Bulk Minimum Quantity')).toHaveValue('');
  await page.getByRole('button', { name:'Cancel' }).click();
  await page.getByRole('button', { name:'Configure Truckload Pricing' }).click();
  await expect(page.getByLabel(/Truckload Price/)).toHaveValue('');
  await expect(page.getByLabel('Truckload Minimum Quantity')).toHaveValue('900');
  await expect(page.getByLabel('Truckload Minimum Unit')).toHaveValue('Bag');
  await page.getByRole('button', { name:'Cancel' }).click();
  await page.getByRole('button', { name:'Save as Individual Catalog Price' }).click();
  await expect(page.getByText('Create Maintained Vendor Catalog Item', { exact:true })).toBeVisible();
  await expect(page.getByRole('button', { name:'Save as Individual Catalog Price' }).first()).toBeVisible();
  await page.getByRole('button', { name:'Cancel' }).click();
  await page.locator('input[list="po-vendor-options"]').fill('Klein & Co.');
  await expect(page.getByText(/catalog suggestion:/)).toHaveCount(0);
  await expect(page.getByRole('button', { name:/Catalog Price/ })).toHaveCount(0);
  await search.fill('Black');

  await page.locator('input[list="po-vendor-options"]').fill('Unconfigured Vendor');
  await expect(page.getByPlaceholder('Editable contact snapshot')).toHaveValue('');

  await page.locator('label:text-is("Job Reference / Link Production Job") + select').selectOption(otherJob.id);
  await expect(page.getByRole('button', { name:/Raven Black/ })).toBeVisible();

  await page.locator('input[list="po-vendor-options"]').fill('');
  await page.locator('label:text-is("Job Reference / Link Production Job") + select').selectOption('');
  await expect(page.getByRole('button', { name:/Raven Black/ })).toBeVisible();
});

test('Draft PDF previews both templates without creating persistent records', async ({ page }) => {
  let previewCalls = 0;
  const previewTemplates: string[] = [];
  const previewSkus: string[] = [];
  let databaseWrites = 0;
  page.on('request', request => {
    if (request.url().includes('/rest/v1/') && request.method() !== 'GET') databaseWrites += 1;
  });
  await mockPurchasing(page);
  await page.route('**/functions/v1/generate-purchase-order-pdf', async route => {
    const body = route.request().postDataJSON() as {
      action?:string;
      orderSnapshot?:{template_name?:string};
      linesSnapshot?:Array<{vendor_sku?:string}>;
    };
    expect(body.action).toBe('draft-preview');
    previewCalls += 1;
    previewTemplates.push(String(body.orderSnapshot?.template_name));
    previewSkus.push(String(body.linesSnapshot?.[0]?.vendor_sku || ''));
    await route.fulfill({
      status:200,
      contentType:'application/pdf',
      headers:{'cache-control':'no-store'},
      body:Buffer.from('%PDF-1.4\n%%EOF\n'),
    });
  });
  await page.goto('/purchasing');
  await page.getByRole('button', { name:'+ New Purchase Order' }).click();
  await page.locator('input[list="po-vendor-options"]').fill('Klein & Co.');
  await page.getByPlaceholder('Search by material, SKU, vendor, or size...').fill('Raven');
  await page.getByRole('button', { name:/Raven Black/ }).click();
  await expect(page.getByLabel('Vendor SKU')).toHaveValue('RB-1');
  await expect(page.getByLabel('Document Template')).toHaveValue('tenops');
  await page.getByRole('button', { name:'Preview Draft PDF' }).click();
  await expect(page.getByRole('dialog', { name:'Purchase Order Preview' })).toBeVisible();
  await page.getByRole('button', { name:'Close document viewer' }).click();
  await page.getByLabel('Document Template').selectOption('classic');
  await page.getByRole('button', { name:'Preview Draft PDF' }).click();
  await expect(page.getByRole('dialog', { name:'Purchase Order Preview' })).toBeVisible();
  expect(previewCalls).toBe(2);
  expect(previewTemplates).toEqual(['tenops','classic']);
  expect(previewSkus).toEqual(['RB-1','RB-1']);
  expect(databaseWrites).toBe(0);
});

test('catalog pricing follows maintained, bulk, incompatible-unit, missing-price, and free-text branches', async ({ page }) => {
  await mockPurchasing(page);
  await page.goto('/purchasing');
  await page.getByRole('button', { name:'+ New Purchase Order' }).click();
  await expect(page.getByRole('button', { name:'Issue Purchase Order' })).toHaveCount(0);
  await page.locator('input[list="po-vendor-options"]').fill('Klein & Co.');

  const search = page.getByPlaceholder('Search by material, SKU, vendor, or size...');
  await search.fill('Raven');
  await page.getByRole('button', { name:/Raven Black/ }).click();
  const quantity = page.getByLabel('Quantity Ordered');
  const orderUnit = page.getByLabel('Order Unit');

  await quantity.fill('49');
  await orderUnit.fill('Bag');
  await expect(page.getByText(/Individual catalog suggestion:/)).toContainText('$42.5');
  await expect(page.getByRole('button', { name:'Update Individual Catalog Price' })).toBeVisible();

  await quantity.fill('50');
  await expect(page.getByText(/Bulk catalog suggestion:/)).toContainText('$39.75');
  await expect(page.getByRole('button', { name:'Update Bulk Pricing' })).toBeVisible();
  await quantity.fill('51');
  await expect(page.getByRole('button', { name:'Update Bulk Pricing' })).toBeVisible();
  await quantity.fill('899');
  await expect(page.getByText(/Bulk catalog suggestion:/)).toContainText('$39.75');
  await quantity.fill('900');
  await expect(page.getByText(/Truckload catalog suggestion:/)).toContainText('$34.25');
  await expect(page.getByRole('button', { name:'Update Truckload Pricing' })).toBeVisible();
  await quantity.fill('49');
  await expect(page.getByRole('button', { name:'Update Individual Catalog Price' })).toBeVisible();

  await quantity.fill('50');
  await orderUnit.fill('Pallet');
  await expect(page.getByRole('button', { name:'Update Individual Catalog Price' })).toBeVisible();

  await search.fill('No Bulk');
  await page.getByRole('button', { name:/No Bulk Black/ }).click();
  await orderUnit.fill('Bag');
  await expect(page.getByText(/Bulk catalog suggestion:/)).toContainText('Call for pricing');
  await expect(page.getByRole('button', { name:'Update Bulk Pricing' })).toBeVisible();

  await page.getByLabel('Material').fill('Free-text Black');
  await expect(page.getByText(/catalog suggestion:/)).toHaveCount(0);
  await expect(page.getByRole('button', { name:/Catalog Price/ })).toHaveCount(0);
  await expect(page.getByLabel('Material')).toHaveValue('Free-text Black');
});

test('catalog search tolerates one source failure and reports failure when both sources fail', async ({ page }) => {
  let failure: 'standard'|'specialty'|'both' = 'standard';
  await page.route('**/rest/v1/**', async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').at(-1);
    if (table === 'vendor_catalog' && (failure === 'standard' || failure === 'both')) {
      await route.fulfill({ status:503, contentType:'application/json', body:JSON.stringify({ message:'Legacy catalog unavailable' }) });
      return;
    }
    if (table === 'vendor_catalog_v2' && (failure === 'specialty' || failure === 'both')) {
      await route.fulfill({ status:503, contentType:'application/json', body:JSON.stringify({ message:'Maintained catalog unavailable' }) });
      return;
    }
    const body = table === 'jobs' ? [job, otherJob]
      : table === 'vendors' ? [vendor, otherVendor]
      : table === 'vendor_catalog' ? standardCatalog
      : table === 'vendor_catalog_v2' ? [catalog]
      : [];
    await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(body) });
  });
  await page.goto('/purchasing');
  await page.getByRole('button', { name:'+ New Purchase Order' }).click();
  const search = page.getByPlaceholder('Search by material, SKU, vendor, or size...');

  await search.fill('Raven');
  await expect(page.getByRole('button', { name:/Raven Black/ })).toBeVisible();
  failure = 'specialty';
  await search.fill('Arabian');
  await expect(page.getByRole('button', { name:/Arabian Black/ })).toBeVisible();
  failure = 'both';
  await search.fill('Failure');
  await expect(page.getByRole('alert').filter({ hasText:'Catalog search is temporarily unavailable.' })).toBeVisible();
  await expect(search).toHaveValue('Failure');
});

test('legacy catalog save uses a live-compatible category and preserves call-for-pricing tiers', async ({ page }) => {
  await mockPurchasing(page);
  let submitted: Record<string,unknown>|null = null;
  const allowed = new Set(['marble','glass','resin','filler','misc']);
  await page.route('**/rest/v1/rpc/save_purchasing_catalog_item', async route => {
    const payload = route.request().postDataJSON() as {p_item?:Record<string,unknown>};
    submitted = payload.p_item ?? null;
    if (!submitted || !allowed.has(String(submitted.category))) {
      await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'23514',message:'vendor_catalog_v2_category_check'})});
      return;
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify('30000000-0000-4000-8000-000000000099')});
  });
  await page.goto('/purchasing');
  await page.getByRole('button',{name:'+ New Purchase Order'}).click();
  await expect(page.locator('#po-vendor-options option')).toHaveCount(2);
  await page.locator('input[list="po-vendor-options"]').fill('T&M Supply');
  const search=page.getByPlaceholder('Search by material, SKU, vendor, or size...');
  await search.fill('Arabian');
  await page.getByRole('button',{name:/Arabian Black/}).click();
  await page.getByLabel('Unit Price').fill('75.20');
  await page.getByRole('button',{name:'Configure Bulk Pricing'}).click();
  await page.getByLabel('Bulk Minimum Quantity').fill('50');
  await expect(page.getByLabel(/Bulk Price/)).toHaveValue('');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button',{name:'Create Maintained Item with Bulk Tier'}).click();
  await expect.poll(() => submitted).not.toBeNull();
  expect(submitted!.category).toBe('glass');
  expect(submitted!.bulk_price).toBeNull();
  expect(submitted!.bulk_minimum_quantity).toBe('50');
  expect(submitted!.bulk_minimum_uom).toBe('Bag');
  await expect(page.getByRole('alert').filter({hasText:'category_check'})).toHaveCount(0);
  await expect(page.getByLabel('Material')).toHaveValue('Arabian Black');
});

test('failed PO and catalog-price writes preserve entered work and remain retryable', async ({ page }) => {
  await page.route('**/rest/v1/**', async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').at(-1);
    if (table === 'save_chip_purchase_order_draft_v2') {
      await route.fulfill({ status:500, contentType:'application/json', body:JSON.stringify({ message:'E2E forced PO save failure' }) });
      return;
    }
    if (url.pathname.includes('/rpc/save_purchasing_catalog_item')) {
      await route.fulfill({ status:500, contentType:'application/json', body:JSON.stringify({ message:'E2E forced catalog write failure' }) });
      return;
    }
    const body = table === 'jobs' ? [job, otherJob]
      : table === 'vendors' ? [vendor, otherVendor]
      : table === 'vendor_catalog' ? standardCatalog
      : table === 'vendor_catalog_v2' ? [catalog]
      : [];
    await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(body) });
  });
  await page.route('**/rest/v1/rpc/save_purchasing_catalog_item', route =>
    route.fulfill({ status:500, contentType:'application/json', body:JSON.stringify({ code:'E2E_FAILURE', details:null, hint:null, message:'E2E forced catalog write failure' }) }),
  );
  await page.goto('/purchasing');
  await page.getByRole('button', { name:'+ New Purchase Order' }).click();
  await page.locator('input[list="po-vendor-options"]').fill('Klein & Co.');
  const search = page.getByPlaceholder('Search by material, SKU, vendor, or size...');
  await search.fill('Raven');
  await page.getByRole('button', { name:/Raven Black/ }).click();
  await page.getByLabel('Quantity Ordered').fill('10');
  await page.getByLabel('Order Unit').fill('Bag');
  await page.getByRole('button', { name:'Save Draft' }).click();
  await expect(page.getByRole('alert').filter({ hasText:'Unable to save Purchase Order draft.' })).toBeVisible();
  await expect(page.getByLabel('Material')).toHaveValue('Raven Black');
  await expect(page.getByLabel('Quantity Ordered')).toHaveValue('10');
  await expect(page.getByRole('button', { name:'Save Draft' })).toBeEnabled();

  await page.getByLabel('Unit Price').fill('44.25');
  await page.getByRole('button', { name:'Update Individual Catalog Price' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name:'Update Individual Catalog Price' }).first().click();
  await expect(page.getByRole('alert').filter({ hasText:'E2E forced catalog write failure' })).toBeVisible();
  await expect(page.getByLabel('Unit Price').first()).toHaveValue('44.25');
  await expect(page.getByRole('button', { name:'Update Individual Catalog Price' }).first()).toBeEnabled();
});

test('primary Purchasing controls remain reachable at a constrained desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width:1024, height:720 });
  await mockPurchasing(page);
  await page.goto(`/purchasing?jobId=${job.id}`);
  await expect(page.getByRole('heading', { name:'New Purchase Order' })).toBeVisible();
  await expect(page.getByRole('button', { name:'Save Draft' })).toBeVisible();
  const search = page.getByPlaceholder('Search by material, SKU, vendor, or size...');
  await search.scrollIntoViewIfNeeded();
  await search.fill('Raven');
  const result = page.getByRole('button', { name:/Raven Black/ });
  await expect(result).toBeVisible();
  const box = await result.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(1024);
  await result.click();
  await expect(page.getByLabel('Material')).toHaveValue('Raven Black');
});

test('saved Draft issuance is confirmation-protected, idempotent in the UI, and becomes read-only', async ({ page }) => {
  let issued = false;
  let issueCalls = 0;
  let pdfAttempts = 0;
  let pdfPreviewCalls = 0;
  let pdfStatus: 'pending'|'failed'|'generated' = 'pending';
  let pendingReceivalCreateCalls = 0;
  const createdPendingLineIds = new Set<string>();
  const order = () => ({
    id:'50000000-0000-4000-8000-000000000010', po_family_id:'50000000-0000-4000-8000-000000000011',
    po_number:'0723-001', po_category:'chip', status:issued?'issued':'draft', production_job_id:null,
    job_number_snapshot:null, job_name_snapshot:null, vendor_id:vendor.id, vendor_name_snapshot:vendor.name,
    vendor_address_snapshot:'Vendor address', vendor_contact_snapshot:'Felipe Gallegos', ship_to_snapshot:'Tenarten',
    payment_terms_snapshot:'Net 30', authorized_by_snapshot:'Anthony Iorio', order_date:'2026-07-23',
    requested_date:null, currency:'USD', subtotal:425, discount_percent:null, discount_amount:0,
    tax_percent:null, tax_amount:0, freight:null, total:425, commercial_notes:'Keep this note',
    internal_notes:'Internal value', revision_number:1, supersedes_purchase_order_id:null, revision_reason:null,
    created_by:'AI', updated_by:'AI', created_at:'2026-07-23T10:00:00.000Z',
    updated_at:issued?'2026-07-23T10:05:00.000Z':'2026-07-23T10:00:00.000Z',
    issued_at:issued?'2026-07-23T10:05:00.000Z':null, issued_by:issued?'AI':null,
    issuances:issued?[{id:'60000000-0000-4000-8000-000000000010',revision_number:1,issued_at:'2026-07-23T10:05:00.000Z',issued_by:'AI',snapshot_hash:'a'.repeat(64)}]:[],
    lines:[{id:'70000000-0000-4000-8000-000000000010',purchase_order_id:'50000000-0000-4000-8000-000000000010',line_number:1,line_category:'chip',status:'active',details:{purchase_order_line_id:'70000000-0000-4000-8000-000000000010',production_job_id:null,catalog_source:'specialty',catalog_item_id:catalog.id,vendor_sku_snapshot:'RB-1',material_name_snapshot:'Raven Black',chip_size:'#1',package_quantity:50,package_measure:'LB',container_type:'Bag',moisture_condition:'dry',quantity_ordered:10,order_unit:'Bag',unit_price:42.5,price_basis:'Bag',notes:'Line note'}}],
  });
  await page.route('**/rest/v1/**', async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').at(-1);
    if (url.pathname.includes('/rpc/issue_purchase_order')) {
      issueCalls += 1;
      issued = true;
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{purchase_order_id:order().id,issuance_id:'60000000-0000-4000-8000-000000000010',issued_at:'2026-07-23T10:05:00.000Z',issued_by:'AI',revision_number:1,snapshot_hash:'a'.repeat(64),status:'issued'}])});
      return;
    }
    if (url.pathname.includes('/rpc/create_pending_receivals_from_purchase_order')) {
      pendingReceivalCreateCalls += 1;
      const request = route.request().postDataJSON() as { p_lines:Array<{source_line_id:string}> };
      const results = request.p_lines.map((line,index) => {
        createdPendingLineIds.add(line.source_line_id);
        return {
          pending_receival_id:`90000000-0000-4000-8000-${String(index + createdPendingLineIds.size).padStart(12,'0')}`,
          source_line_id:line.source_line_id,
          source_line_number:line.source_line_id.endsWith('11') ? 2 : 1,
          creation_status:'created',
        };
      });
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(results)});
      return;
    }
    let body: unknown = [];
    if (table === 'purchase_orders') body = url.searchParams.has('id') ? order() : [{...order(),lines:[{id:'70000000-0000-4000-8000-000000000010'}]}];
    else if (table === 'purchase_order_documents') body = issued ? [{id:'80000000-0000-4000-8000-000000000010',issuance_id:'60000000-0000-4000-8000-000000000010',status:pdfStatus,snapshot_hash:'a'.repeat(64),storage_bucket:'purchase-order-documents',storage_path:pdfStatus==='generated'?'60000000-0000-4000-8000-000000000010/0723-001.pdf':null,document_version:'po-pdf-v1',generation_started_at:null,generated_at:pdfStatus==='generated'?'2026-07-23T10:06:00.000Z':null,failed_at:pdfStatus==='failed'?'2026-07-23T10:05:30.000Z':null,last_error:pdfStatus==='failed'?'E2E forced PDF failure':null,attempt_count:pdfAttempts}] : [];
    else if (table === 'purchase_order_issuances') body = {
      id:'60000000-0000-4000-8000-000000000010',
      order_snapshot:{po_number:'0723-001',vendor_name:vendor.name,production_job_id:job.id,job_number:job.job_number,job_name:job.name},
      lines_snapshot:[
        {purchase_order_line_id:'70000000-0000-4000-8000-000000000010',line_number:1,line_kind:'chip',material:'Raven Black',vendor_sku:'RB-1',chip_size:'#1',quantity:10,unit:'Bag'},
        {purchase_order_line_id:'70000000-0000-4000-8000-000000000011',line_number:2,line_kind:'chip',material:'White Marble',vendor_sku:null,chip_size:'#2',quantity:2,unit:'Pallet'},
        {purchase_order_line_id:'70000000-0000-4000-8000-000000000012',line_number:3,line_kind:'service',material:'Freight',vendor_sku:null,chip_size:null,quantity:1,unit:'Service'},
      ],
    };
    else if (table === 'pending_receivals') body = [...createdPendingLineIds].map((sourceLineId,index) => ({
      id:`90000000-0000-4000-8000-${String(index + 1).padStart(12,'0')}`,
      source_purchase_order_line_id:sourceLineId,
    }));
    else if (table === 'jobs') body = [job,otherJob];
    else if (table === 'vendors') body = [vendor,otherVendor];
    else if (table === 'vendor_catalog') body = standardCatalog;
    else if (table === 'vendor_catalog_v2') body = [catalog];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.route('**/functions/v1/generate-purchase-order-pdf', async route => {
    const body = route.request().postDataJSON() as {action?:string};
    if (body.action === 'preview') {
      pdfPreviewCalls += 1;
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({url:'data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK'})});
      return;
    }
    pdfAttempts += 1;
    if (pdfAttempts === 1) {
      pdfStatus = 'failed';
      await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'E2E forced PDF failure'})});
      return;
    }
    pdfStatus = 'generated';
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'generated'})});
  });
  await page.goto('/purchasing');
  await page.getByText('0723-001',{exact:true}).click();
  await expect(page.getByRole('button',{name:'Issue Purchase Order'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Save Draft'})).toBeVisible();

  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button',{name:'Issue Purchase Order'}).click();
  expect(issueCalls).toBe(0);

  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button',{name:'Issue Purchase Order'}).dblclick();
  await expect(page.getByRole('alert').filter({hasText:'The Purchase Order remains Issued'})).toBeVisible();
  expect(issueCalls).toBe(1);
  expect(pdfAttempts).toBe(1);
  await expect(page.getByRole('button',{name:'Save Draft'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Issue Purchase Order'})).toHaveCount(0);
  await expect(page.getByLabel('Material')).toBeDisabled();
  await expect(page.getByRole('button',{name:'Retry PDF Generation'})).toBeVisible();
  await page.getByRole('button',{name:'Retry PDF Generation'}).click();
  await expect(page.getByRole('button',{name:'Open / Download'})).toBeVisible();
  expect(pdfAttempts).toBe(2);
  await page.getByRole('button',{name:'Open / Download'}).click();
  await expect(page.getByRole('dialog',{name:'Issued Purchase Order'})).toBeVisible();
  expect(pdfPreviewCalls).toBe(1);
  await page.getByRole('button',{name:'Close document viewer'}).click();
  await expect(page.getByRole('button',{name:'Create Pending Receivals'})).toBeVisible();
  await page.getByRole('button',{name:'Create Pending Receivals'}).click();
  const pendingReceivalReview = page.getByRole('dialog',{name:'Review Pending Receivals'});
  await expect(pendingReceivalReview).toBeVisible();
  await expect(pendingReceivalReview.getByLabel('Material').first()).toHaveValue('Raven Black');
  await expect(pendingReceivalReview.getByLabel('Quantity').first()).toHaveValue('10');
  await expect(pendingReceivalReview.getByLabel('Unit').first()).toHaveValue('Bag');
  await expect(pendingReceivalReview.getByLabel('ETA').first()).toHaveValue('');
  await expect(pendingReceivalReview.getByText('Excluded: This is not a supported material line.')).toBeVisible();
  await pendingReceivalReview.getByLabel('Include PO line 2').uncheck();
  await page.getByRole('button',{name:'Create 1 Pending Receival'}).click();
  await expect(page.getByText('1 Pending Receival created from PO 0723-001.')).toBeVisible();
  expect(pendingReceivalCreateCalls).toBe(1);
  await expect(page.getByText('1 eligible line remaining.')).toBeVisible();
  await page.getByRole('button',{name:'Create Remaining Lines'}).click();
  await expect(page.getByRole('dialog',{name:'Review Pending Receivals'}).getByText('Previously created')).toBeVisible();
  await page.getByRole('button',{name:'Create 1 Pending Receival'}).click();
  await expect(page.getByText('Pending Receivals have been created for every eligible line.')).toBeVisible();
  expect(pendingReceivalCreateCalls).toBe(2);
  await expect(page.getByRole('button',{name:'Create Pending Receivals'})).toHaveCount(0);

  await page.reload();
  await page.getByText('0723-001',{exact:true}).click();
  await expect(page.getByText('Issued Purchase Order',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Material')).toBeDisabled();
  await expect(page.getByRole('button',{name:'View Issued PDF'})).toBeEnabled();
  await expect(page.getByText('Pending Receivals have been created for every eligible line.')).toBeVisible();
  expect(pendingReceivalCreateCalls).toBe(2);
});

test('issuance failure preserves Draft values and gives stale-draft retry guidance', async ({ page }) => {
  const savedOrder = {
    id:'50000000-0000-4000-8000-000000000020',po_family_id:'50000000-0000-4000-8000-000000000021',po_number:'0723-002',po_category:'chip',status:'draft',
    production_job_id:null,job_number_snapshot:null,job_name_snapshot:null,vendor_id:vendor.id,vendor_name_snapshot:vendor.name,
    vendor_address_snapshot:'',vendor_contact_snapshot:'',ship_to_snapshot:'',payment_terms_snapshot:'Net 30',authorized_by_snapshot:'',
    order_date:'2026-07-23',requested_date:null,currency:'USD',subtotal:100,discount_percent:null,discount_amount:0,tax_percent:null,tax_amount:0,freight:null,total:100,
    commercial_notes:'Preserve me',internal_notes:'',revision_number:1,supersedes_purchase_order_id:null,revision_reason:null,created_by:'AI',updated_by:'AI',
    created_at:'2026-07-23T11:00:00.000Z',updated_at:'2026-07-23T11:00:00.000Z',issued_at:null,issued_by:null,issuances:[],
    lines:[{id:'70000000-0000-4000-8000-000000000020',purchase_order_id:'50000000-0000-4000-8000-000000000020',line_number:1,line_category:'chip',status:'active',details:{purchase_order_line_id:'70000000-0000-4000-8000-000000000020',production_job_id:null,catalog_source:null,catalog_item_id:null,vendor_sku_snapshot:null,material_name_snapshot:'Arabian Black',chip_size:'#1',package_quantity:50,package_measure:'LB',container_type:'Bag',moisture_condition:'dry',quantity_ordered:10,order_unit:'Bag',unit_price:10,price_basis:'Bag',notes:null}}],
  };
  await page.route('**/rest/v1/**', async route => {
    const url=new URL(route.request().url()); const table=url.pathname.split('/').at(-1);
    if(url.pathname.includes('/rpc/issue_purchase_order')){await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({message:'This Purchase Order changed since it was loaded.'})});return;}
    const body=table==='purchase_orders'?(url.searchParams.has('id')?savedOrder:[{...savedOrder,lines:[{id:savedOrder.lines[0].id}]}]):table==='vendors'?[vendor]:table==='jobs'?[job]:[];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/purchasing');
  await page.getByText('0723-002',{exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Issue Purchase Order'}).click();
  await expect(page.getByRole('alert').filter({hasText:'Reload and review the latest changes before issuing.'})).toBeVisible();
  await expect(page.getByLabel('Material')).toHaveValue('Arabian Black');
  await expect(page.getByText('Preserve me',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Issue Purchase Order'})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Save Draft'})).toBeVisible();
});
