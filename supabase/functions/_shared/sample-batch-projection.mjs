// Shared read-only Batch projection. Extracted without math changes from the accepted Sample projection.
const SAMPLE_FORMULATION_CALCULATION_VERSION = "sample-formulation-v4-density-profile";
const numeric = (value) => value != null && value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const validBatchTarget = (value) => {
  const n = numeric(value);
  return n !== null && n > 0 && n <= 99999999999999e-6 ? n : null;
};
function deriveBatchReference(state) {
  if (state.calculationVersion !== SAMPLE_FORMULATION_CALCULATION_VERSION) return null;
  const chipTargetLb = validBatchTarget(state.profile?.batchChipTargetLb);
  const referenceThicknessIn = validBatchTarget(state.profile?.batchReferenceThicknessIn);
  const chipDensityLbCft = validBatchTarget(state.profile?.defaultChipDensityLbCft);
  if (chipTargetLb === null || referenceThicknessIn === null || chipDensityLbCft === null) return null;
  const volumeCft = chipTargetLb / chipDensityLbCft;
  const referenceThicknessFt = referenceThicknessIn / 12;
  const coverageSf = volumeCft / referenceThicknessFt;
  const chipRateLbSf = chipTargetLb / coverageSf;
  return { chipTargetLb, chipDensityLbCft, referenceThicknessIn, referenceThicknessFt, volumeCft, coverageSf, chipRateLbSf };
}
function formatBatchQuantity(value, unit) {
  if (value === null) return "\u2014";
  const rounded = Number(value.toFixed(unit === "gal" ? 6 : 4));
  return `${Math.abs(value - rounded) > 1e-10 ? "\u2248 " : ""}${rounded.toLocaleString("en-US", { maximumFractionDigits: unit === "gal" ? 6 : 4 })}`;
}
function projectSampleBatch(state, rows) {
  const target = validBatchTarget(state.profile?.batchChipTargetLb);
  const supported = state.calculationVersion === SAMPLE_FORMULATION_CALCULATION_VERSION;
  const length = numeric(state.length), width = numeric(state.width), thickness = numeric(state.thicknessIn), density = numeric(state.materialDensity);
  const volume = length !== null && width !== null && thickness !== null ? length * width * (state.dimensionUnit === "in" ? 1 / 144 : 1) * thickness / 12 : 0;
  const chipLb = volume * (density ?? 0), factor = target && chipLb > 0 ? target / chipLb : null;
  const manualChip = rows.some((r) => r.componentRole === "aggregate" && r.quantityProvenance === "manual");
  const percentages = rows.filter((r) => r.componentRole === "aggregate" && r.quantityProvenance === "calculated");
  const totalPercent = percentages.reduce((sum, r) => sum + (numeric(r.percentage) ?? 0), 0);
  const reconciles = percentages.length > 0 && percentages.every((r) => numeric(r.percentage) !== null) && Math.abs(totalPercent - 100) < 5e-4;
  const mass = (r) => {
    const n = numeric(r.quantity);
    const u = (r.unit ?? "").trim().toLowerCase();
    return n === null ? null : u === "lb" ? n * 16 : u === "oz" ? n : null;
  };
  const liquid = (r) => {
    const n = numeric(r.quantity);
    const u = (r.unit ?? "").trim().toLowerCase();
    return n === null ? null : ["gal", "gallon", "gallons"].includes(u) ? n * 128 : ["fl oz", "fluid oz", "fluid ounce", "fluid ounces"].includes(u) ? n : null;
  };
  const resinIndex = rows.findIndex((r) => r.componentRole === "resin");
  const hardenerIndex = rows.findIndex((r) => r.componentRole === "hardener");
  const resin = resinIndex < 0 ? null : rows[resinIndex].quantityProvenance === "calculated" ? numeric(state.profile?.resinFlOzPerCft) : null;
  const resinOz = resinIndex < 0 ? null : rows[resinIndex].quantityProvenance === "manual" ? liquid(rows[resinIndex]) : resin === null ? null : volume * resin;
  const a = numeric(state.resinParts), b = numeric(state.hardenerParts);
  const projected = rows.map((r, index) => {
    if (!supported || !target) return { quantity: null, unit: "", note: !supported ? "Legacy formulation: review in Working Pour" : "Batch basis not captured" };
    if (r.componentRole === "aggregate") return r.quantityProvenance === "manual" ? { quantity: null, unit: "lb", note: "Manual chip quantity: review in Working Pour" } : { quantity: numeric(r.percentage) === null ? null : target * Number(r.percentage) / 100, unit: "lb", note: "Authored percentage \xD7 Batch chip target" };
    if (!factor || manualChip || !reconciles) return { quantity: null, unit: "", note: "Complete the Working Pour and calculated chip composition" };
    let amount = null;
    let unit = "lb";
    if (r.componentRole === "resin" || r.componentRole === "hardener") {
      if (r.quantityProvenance === "calculated" && index !== (r.componentRole === "resin" ? resinIndex : hardenerIndex)) return { quantity: null, unit: "gal", note: "Additional calculated binder row: review in Working Pour" };
      unit = "gal";
      amount = r.quantityProvenance === "manual" ? liquid(r) : r.componentRole === "resin" ? resinOz : resinOz !== null && a && b !== null ? resinOz * b / a : null;
    } else if (r.componentRole === "filler" || r.componentRole === "other" && /^filler$/i.test(r.color ?? "") && r.quantityProvenance === "calculated") {
      const rate = numeric(state.profile?.defaultFillerOzPerCft);
      amount = r.quantityProvenance === "manual" ? mass(r) : rate === null ? null : volume * rate;
    } else {
      amount = mass(r);
      if (amount === null) {
        amount = liquid(r);
        unit = "gal";
      }
    }
    return { quantity: amount === null ? null : amount * factor / (unit === "gal" ? 128 : 16), unit, note: amount === null ? "Batch projection unavailable: quantity or unit is not explicit" : r.quantityProvenance === "manual" ? "From Working Pour override" : "Projected from this formulation" };
  });
  const issues = [];
  if (!supported) issues.push("Legacy formulation: Batch projection unavailable. Working Pour is unchanged.");
  else if (!target) issues.push(state.profile && Object.hasOwn(state.profile, "batchChipTargetLb") ? "Batch chip target not configured" : "Batch basis not captured");
  else {
    if (manualChip) issues.push("Manual chip quantities: review in Working Pour.");
    if (!reconciles) issues.push(`Incomplete chip composition: ${totalPercent}% of 100%.`);
    if (!factor) issues.push("Complete a positive Working Pour to project all components.");
    if (projected.some((r) => r.quantity === null)) issues.push("Batch reference incomplete; review the unavailable rows.");
  }
  return { target, totalPercent, subtotalLb: target === null ? null : target * totalPercent / 100, rows: projected, issues, complete: issues.length === 0, fraction: supported && target && factor && !manualChip && reconciles ? chipLb / target : null };
}
export {
  deriveBatchReference,
  formatBatchQuantity,
  projectSampleBatch,
  validBatchTarget
};
