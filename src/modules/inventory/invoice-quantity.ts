/** Immutable transcription evidence is separate from the editable receival.
 * The catalog contract establishes an ordering unit/package, not a stocking
 * unit. Never infer the latter or convert mass to volume (or unit systems). */
export type InvoiceSourceQuantity = { quantity: string; unit: string };
export type InvoiceQuantityOffer = { orderUnit: string; packageQuantity?: string; packageMeasure?: string; containerType?: string };
export type InvoiceQuantityBasis = {
  sourceKind: 'package_count' | 'material_total' | 'unknown';
  packageCount: string | null;
  perPackage: { quantity: string; unit: string; container: string } | null;
  totalMaterial: { quantity: string; unit: string } | null;
  receivalQuantity: string | null;
  receivalUnit: string | null;
  inventoryStockingUnit: null;
  calculation: 'source_package_count' | 'source_material_quantity' | 'exact_catalog_package_conversion' | 'unresolved';
  reasons: string[];
};
const aliases: [string, string[]][] = [['LB',['lb','lbs','pound','pounds']],['KG',['kg','kilogram','kilograms']],['GAL',['gal','gallon','gallons']],['L',['l','liter','liters']],['OZ',['oz','ounce','ounces']],['Bag',['bag','bags']],['Pail',['pail','pails']],['Box',['box','boxes']],['Bucket',['bucket','buckets']],['Drum',['drum','drums']],['Case',['case','cases']],['Tote',['tote','totes']],['Kit',['kit','kits']],['Each',['ea','each']]];
export function invoiceQuantityUnit(value: string): string { const key=value.trim().toLowerCase().replace(/\.$/,'');return aliases.find(([,values])=>values.includes(key))?.[0]??''; }
const measured = new Set(['LB','KG','GAL','L','OZ']);
function rational(value:string) { if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(value)||Number(value)<=0)return null;const [whole,fraction='']=value.split('.');return {n:BigInt(whole+fraction),d:BigInt(10)**BigInt(fraction.length)}; }
function exact(n:bigint,d:bigint):string|null { const scale=BigInt(1000000);if(n*scale%d!==BigInt(0))return null;const value=n*scale/d;return `${value/scale}${value%scale?'.'+String(value%scale).padStart(6,'0').replace(/0+$/,''):''}`; }
const equivalent=(a:string,b:string)=>{const aa=rational(a),bb=rational(b);return Boolean(aa&&bb&&aa.n*bb.d===bb.n*aa.d);};

/** Recomputed from host-retained source and the CURRENT catalog offer on every
 * review and approval. The model and client cannot supply a conversion result. */
export function deriveInvoiceQuantity(source:InvoiceSourceQuantity|null|undefined,offer:InvoiceQuantityOffer|undefined,sourceText=''):InvoiceQuantityBasis {
  const basis:InvoiceQuantityBasis={sourceKind:'unknown',packageCount:null,perPackage:null,totalMaterial:null,receivalQuantity:null,receivalUnit:null,inventoryStockingUnit:null,calculation:'unresolved',reasons:[]};
  if(!source||!rational(source.quantity)||!invoiceQuantityUnit(source.unit)){basis.reasons.push('missing_invoice_quantity_evidence');return basis;}
  const sourceUnit=invoiceQuantityUnit(source.unit),count=!measured.has(sourceUnit);basis.sourceKind=count?'package_count':'material_total';
  if(count)basis.packageCount=source.quantity;else basis.totalMaterial={quantity:source.quantity,unit:sourceUnit};
  if(!offer)return basis;
  const target=invoiceQuantityUnit(offer.orderUnit),container=invoiceQuantityUnit(offer.containerType??''),measure=invoiceQuantityUnit(offer.packageMeasure??''),pkg=rational(offer.packageQuantity??'');basis.receivalUnit=target||null;
  if((offer.packageQuantity||offer.packageMeasure)&&(!pkg||!measured.has(measure)||!container||measured.has(container)))basis.reasons.push('invalid_catalog_package');
  if(pkg&&measured.has(measure)&&container&&!measured.has(container))basis.perPackage={quantity:offer.packageQuantity!,unit:measure,container};
  if(!target)basis.reasons.push('unknown_catalog_receival_unit');
  else if(sourceUnit===target){basis.receivalQuantity=source.quantity;basis.calculation=count?'source_package_count':'source_material_quantity';}
  else if(!count&&basis.perPackage&&sourceUnit===measure&&target===container){const amount=rational(source.quantity)!;const result=exact(amount.n*pkg!.d,amount.d*pkg!.n);if(result===null)basis.reasons.push('non_exact_package_conversion');else if(!/^\d+$/.test(result))basis.reasons.push('non_integral_package_count');else {basis.packageCount=result;basis.receivalQuantity=result;basis.calculation='exact_catalog_package_conversion';}}
  else basis.reasons.push('incompatible_unit_or_package');
  if(count&&sourceUnit===container&&basis.perPackage){const amount=rational(source.quantity)!;const total=exact(amount.n*pkg!.n,amount.d*pkg!.d);if(total!==null)basis.totalMaterial={quantity:total,unit:measure};}

  // Quantity assertions on the SAME source line must agree. An explicit package
  // label or multiplication factor is per-container evidence, never the total.
  // Multiple conflicting totals/counts hold this line, rather than trusting the
  // model's choice of one visible number. This parser only rejects conflicts;
  // it does not invent extraction fields or overwrite the immutable source.
  const mentions=[...sourceText.matchAll(/(?:^|[^a-zA-Z0-9.#-])(\d+(?:\.\d+)?)\s*(?:-\s*)?(?:\|\s*)?([a-zA-Z.]+)\b/g)].map(match=>({quantity:match[1],unit:invoiceQuantityUnit(match[2]),index:(match.index??0)+match[0].indexOf(match[1]),end:(match.index??0)+match[0].length})).filter(item=>item.unit);
  for(const mention of mentions){
    const after=sourceText.slice(mention.end),before=sourceText.slice(0,mention.index),following=after.match(/^\s*\.?\s*(?:[\/-]\s*|per\s+)?(bag|bags|pail|pails|box|boxes|bucket|buckets|drum|drums|case|cases|tote|totes|kit|kits)\b/i),factor=/[@×]\s*$|\bx\s*$|\b(?:at|each)\s*$/i.test(before);
    const perContainer=measured.has(mention.unit)&&Boolean(following||factor&&mentions.some(item=>!measured.has(item.unit)&&item.index<mention.index));
    if(perContainer){
      if(!basis.perPackage||mention.unit!==measure||!equivalent(mention.quantity,offer.packageQuantity??'')||following&&invoiceQuantityUnit(following[1])!==container)basis.reasons.push('invoice_catalog_package_conflict');
      if(sourceUnit===mention.unit&&equivalent(source.quantity,mention.quantity))basis.reasons.push('source_quantity_is_package_size');
      continue;
    }
    if(basis.totalMaterial&&mention.unit===basis.totalMaterial.unit&&!equivalent(mention.quantity,basis.totalMaterial.quantity))basis.reasons.push('conflicting_source_quantity');
    if(basis.packageCount&&mention.unit===(count?sourceUnit:container)&&!equivalent(mention.quantity,basis.packageCount))basis.reasons.push('conflicting_source_quantity');
  }
  basis.reasons=[...new Set(basis.reasons)];if(basis.reasons.length){basis.receivalQuantity=null;basis.calculation='unresolved';}return basis;
}

export function invoiceQuantityIssues(source:InvoiceSourceQuantity|null|undefined,offer:InvoiceQuantityOffer|undefined,quantity:string,unit:string,sourceText=''): {basis:InvoiceQuantityBasis;reasons:string[]} {
  const basis=deriveInvoiceQuantity(source,offer,sourceText),reasons=[...basis.reasons];
  if(offer&&basis.receivalQuantity!==null&&basis.receivalUnit){if(!equivalent(quantity,basis.receivalQuantity))reasons.push('source_quantity_mismatch');if(invoiceQuantityUnit(unit)!==basis.receivalUnit)reasons.push('source_unit_mismatch');}
  return {basis,reasons:[...new Set(reasons)]};
}
