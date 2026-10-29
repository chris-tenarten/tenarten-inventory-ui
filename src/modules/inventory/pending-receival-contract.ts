/** Pure mapping shared by the existing manual Inventory form and local review drafts.
 * Authorization, duplicate decisions, transactions and persistence remain caller-owned. */
export type PendingReceivalInput={vendor:string;material:string;size:string;category:string;quantityExpected:number;unit:string;location:string;palletNumber:string;orderedBy:string;orderDate:string;eta:string|null;notes:string|null;productionJobId:string|null;temporaryJobLabel:string|null;reservationLabel:string|null;reservationNotes:string};
export function positiveExpectedQuantity(value:unknown):number|null{const quantity=typeof value==='number'?value:typeof value==='string'?Number(value):NaN;return Number.isFinite(quantity)&&quantity>0?quantity:null;}
export function buildPendingReceivalRow(input:PendingReceivalInput){
 const vendor=input.vendor.trim(),material=input.material.trim(),orderedBy=input.orderedBy.trim(),orderDate=input.orderDate.trim(),quantity=positiveExpectedQuantity(input.quantityExpected);
 if(!vendor)throw Error('Vendor is required.');
 if(!orderedBy)throw Error('Ordered by is required.');
 if(!orderDate)throw Error('Order date is required.');
 if(!material||quantity===null)throw Error('Material and positive expected quantity are required.');
 const productionJobId=input.productionJobId||null,temporaryJobLabel=input.temporaryJobLabel?.trim()||null,isReserved=Boolean(productionJobId||temporaryJobLabel);
 return {vendor,material_name:material,size:input.size.trim()||null,category:input.category.trim()||null,quantity_expected:quantity,quantity_received:0,unit:input.unit.trim()||'Bags',location:input.location.trim()||'Denton',pallet_number:input.palletNumber.trim()||null,status:'pending' as const,ordered_by:orderedBy,order_date:orderDate,received_by:null,eta:input.eta||null,notes:input.notes||null,received_at:null,is_earmarked:isReserved,earmarked_job_name:isReserved?input.reservationLabel:null,earmark_notes:isReserved&&input.reservationNotes.trim()?input.reservationNotes.trim():null,production_job_id:productionJobId,temporary_job_label:temporaryJobLabel};
}
