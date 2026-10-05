/** Pure shop presentation. Never feeds back into formulation or planning quantities. */
const number = value => value.toLocaleString('en-US', {maximumFractionDigits: 10});
export function buildBlendShopPresentation(model, legacyEachBlend = false) {
 const partial = !legacyEachBlend && model.blendCount < 1;
 return {
  version: 1,
  basis: partial ? 'plannedQuantity' : 'blendSize',
  basisLb: partial ? model.plannedQuantity : model.blendSize,
  heading: partial ? 'AGGREGATE RECIPE — PLANNED QUANTITY' : 'AGGREGATE RECIPE — EACH BLEND',
  rows: model.aggregates.map(row => {
   const pounds = partial ? row.totalLb : row.lbPerBlend;
   const packageWeightLb = row.packageWeightLb;
   const equivalent = packageWeightLb > 0 ? pounds / packageWeightLb : null;
   const container = row.packageContainer || 'package';
   const packages = count => `${number(count)} ${container}${count > 1 ? 's' : ''}`;
   let instruction = `${number(pounds)} lb`;
   if (equivalent !== null) {
    if (!partial) instruction = packages(equivalent);
    else {
     const whole = Math.floor(equivalent);
     const remainder = pounds - whole * packageWeightLb;
     instruction = [whole ? packages(whole) : '', remainder ? `${number(remainder)} lb` : ''].filter(Boolean).join(' + ') || '0 lb';
    }
   }
   return {pounds, percentage: row.percentage, packageWeightLb, packageSource: row.packageProvenance,
    packageContainer: container, exactEquivalent: equivalent, instruction};
  }),
 };
}
export function blendShopPresentation(model, issued = false) {
 // Older issued sheets retain their original each-Blend recipe, without mutating captures.
 return model.shopPresentation || buildBlendShopPresentation(model, issued);
}
