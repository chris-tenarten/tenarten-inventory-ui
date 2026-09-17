import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const token=process.env.TENOPS_ANTHONY_ACCESS_TOKEN;
if(!url||!anon||!token) throw new Error('Hosted URL, anon key, and Anthony access token are required.');
if(process.env.TENOPS_CONFIRM_HERMES_PO_RECOVERY!=='RECOVER_ANTHONY_HERMES_2026_09_15') {
  throw new Error('Exact recovery confirmation is required.');
}
const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
const jobId='38552df8-5a2f-4179-88af-4bd47f2c12bf';
const vendorId='303c94f8-9849-432d-b36d-264b81b923f3';
const one=async(promise,label)=>{const {data,error}=await promise;if(error)throw new Error(`${label}: ${error.message}`);return data;};
const recoveryKey='anthony-hermes-dcs-2026-09-15';
const [job,vendor,contacts]=await Promise.all([
  one(client.from('jobs').select('id,job_number,name').eq('id',jobId).single(),'Hermes Job'),
  one(client.from('vendors').select('id,name,address_line_1,city,state,postal_code,country,payment_terms').eq('id',vendorId).single(),'DCS Vendor'),
  one(client.from('vendor_contacts').select('contact_name,role,email,is_active').eq('vendor_id',vendorId).eq('is_active',true),'DCS contact'),
]);
assert.equal(job.job_number,'26-0808');assert.equal(job.name,'Hermes - Manhasset, NY');assert.equal(vendor.name,'DCS Inc.');
const contact=contacts.find(item=>item.contact_name==='Cindy Nowak'&&item.role==='VP Production'&&item.email==='cindyn@dynamiccolorsolutions.com');
assert(contact,'Canonical DCS contact did not match the reviewed recovery value.');
const p_order={
  production_job_id:jobId,job_number_snapshot:job.job_number,job_name_snapshot:job.name,
  vendor_id:vendorId,vendor_name_snapshot:vendor.name,
  vendor_address_snapshot:[vendor.address_line_1,[vendor.city,vendor.state,vendor.postal_code].filter(Boolean).join(', '),vendor.country].filter(Boolean).join('\n'),
  vendor_contact_snapshot:[contact.contact_name,contact.role,contact.email].join(' · '),
  ship_to_snapshot:'2933 EISENHOWER ST., SUITE 120\nCARROLLTON, TX 75007\nAttn. Marcos Alvarado',
  payment_terms_snapshot:vendor.payment_terms,authorized_by_snapshot:'',order_date:'2026-09-15',requested_date:'2026-09-25',currency:'USD',
  discount_percent:null,tax_percent:null,freight:null,commercial_notes:null,internal_notes:null,
};
const p_lines=[['100','50','2.46'],['20','20','2.71']].map(([quantity,packageQuantity,unitPrice],index)=>({
  line_number:index+1,material_type:'pigment',production_job_id:jobId,catalog_source:null,catalog_item_id:null,vendor_sku_snapshot:null,
  material_name_snapshot:'Dry Cement Pigment',chip_size:null,resin_color:null,component_type:null,package_quantity:packageQuantity,package_measure:'LB',container_type:'Bag',moisture_condition:null,
  quantity_ordered:quantity,order_unit:'bag',unit_price:unitPrice,price_basis:null,notes:'Color #188 Hershey Bar Lot match',
}));
const orderId=await one(client.rpc('recover_purchase_order_draft_v2',{p_order,p_lines,p_actor:'AI',p_confirmation:'RECOVER_EVIDENCE_BACKED_UNNUMBERED_DRAFT',p_recovery_key:recoveryKey}),'recover Draft');
const recovered=await one(client.from('purchase_orders').select('id,po_number,status,total,production_job_id,vendor_id,lines:purchase_order_lines(material_type,details:chip_purchase_order_line_details(*))').eq('id',orderId).single(),'verify recovered Draft');
assert.equal(recovered.po_number,null);assert.equal(recovered.status,'draft');assert.equal(Number(recovered.total),300.20);assert.equal(recovered.lines.length,2);
assert(recovered.lines.every(line=>line.material_type==='pigment'));
console.log(JSON.stringify({purchaseOrderId:orderId,status:recovered.status,poNumber:recovered.po_number,total:Number(recovered.total)},null,2));
