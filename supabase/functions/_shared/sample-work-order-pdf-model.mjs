export const SAMPLE_PDF_VERSION = "sample-work-order-pdf-v6-density-profile";

const value = (source, camel, snake = camel) => String(source?.[camel] ?? source?.[snake] ?? "");

export function buildSamplePdfModel(snapshot) {
  if (!snapshot || typeof snapshot !== "object") throw new Error("Sample snapshot is required.");
  const rows = Array.isArray(snapshot.blendRows)
    ? snapshot.blendRows
    : Array.isArray(snapshot.blend_rows)
      ? snapshot.blend_rows
      : [];
  const formulation = snapshot.formulation ?? snapshot.formulation_state ?? {};
  const derived = formulation.derived ?? {};
  const formulationBasis = value(formulation, "basis");
  const massBalance = value(formulation, "calculationVersion") === "sample-formulation-v2-mass-balance";
  const historicalParity = value(formulation, "calculationVersion") === "sample-formulation-v3-historical-parity";
  const volumetricProfile = value(formulation, "calculationVersion") === "sample-formulation-v4-volumetric-profile";
  const densityProfile = value(formulation, "calculationVersion") === "sample-formulation-v4-density-profile";
  const capturedProfile = volumetricProfile || densityProfile;
  const profile = formulation.profile ?? {};
  const formulationSummary = formulationBasis
    ? [
        massBalance ? `Total Formula ${derived.totalFormulaWeightOz ?? value(formulation, "totalFormulaWeightOz")} oz` : capturedProfile ? "Captured formulation profile" : formulationBasis === "weight_per_sf" ? "Weight / SF" : "Total Weight",
        (massBalance || historicalParity || capturedProfile) && derived.availableChipMixOz != null ? `Chip Mix ${derived.availableChipMixOz} oz` : "",
        capturedProfile && value(profile, "name") ? `Profile ${value(profile, "name")}` : "",
        densityProfile && derived.effectiveChipDensityLbCft != null ? `Density ${derived.effectiveChipDensityLbCft} lb/CFT` : "",
        capturedProfile && derived.effectiveFillerOz != null ? `Filler ${derived.effectiveFillerOz} oz` : "",
        capturedProfile && derived.effectiveResinFlOz != null ? `Resin ${derived.effectiveResinFlOz} fl oz` : "",
        densityProfile && derived.dryPoolOz != null ? `Expected dry ${derived.dryPoolOz} oz` : "",
        densityProfile && derived.actualDryTotalOz != null ? `Actual dry ${derived.actualDryTotalOz} oz` : "",
        densityProfile && derived.dryPoolVarianceOz != null ? `Variance ${Number(derived.dryPoolVarianceOz)>0?'+':''}${derived.dryPoolVarianceOz} oz` : "",
        historicalParity && derived.availableChipMixOz != null ? "Calculated from production pour" : "",
        massBalance && derived.nonChipWeightOz != null ? `Filler / Resin / Hardener ${derived.nonChipWeightOz} oz` : "",
        derived.areaSf == null ? "" : `Area ${derived.areaSf} SF`,
        derived.effectiveWeightPerSf == null ? "" : `${derived.effectiveWeightPerSf} lb/SF`,
        !massBalance && !historicalParity && derived.targetWeight != null ? `Target ${derived.targetWeight} ${value(formulation, "weightUnit") || "lb"}` : "",
        !densityProfile && value(formulation, "materialDensity") ? `Density ${value(formulation, "materialDensity")} lb/CFT` : "",
        value(formulation, "thicknessIn") ? `Thickness ${value(formulation, "thicknessIn")} in` : "",
        `Resin : Hardener ${value(formulation, "resinParts") || "5"}:${value(formulation, "hardenerParts") || "1"}`,
      ].filter(Boolean).join(" · ")
    : "";
  return {
    requestedBy: value(snapshot, "requestedBy", "requested_by"),
    requestedDate: value(snapshot, "requestedDate", "requested_date"),
    projectName: value(snapshot, "projectName", "project_name"),
    preparedBy: value(snapshot, "preparedBy", "prepared_by"),
    customerName: value(snapshot, "customerName", "customer_name"),
    jobNumber: value(snapshot, "jobNumber", "job_number"),
    colorPlateNumber: value(snapshot, "colorPlateNumber", "color_plate_number"),
    finishRequested: value(snapshot, "finishRequested", "finish_requested"),
    sampleSize: value(snapshot, "sampleSize", "sample_size"),
    sampleQuantity: value(snapshot, "sampleQuantity", "sample_quantity"),
    notes: value(snapshot, "notes"),
    filler: value(snapshot, "filler"),
    sealer: value(snapshot, "sealer"),
    resinSupplier: value(snapshot, "resinSupplier", "resin_supplier"),
    resinColorNumber: value(snapshot, "resinColorNumber", "resin_color_number"),
    moreNotes: value(snapshot, "moreNotes", "more_notes"),
    approvedDate: value(snapshot, "approvedDate", "approved_date"),
    issueNumber: Number(snapshot.issueNumber ?? snapshot.issue_number ?? 0),
    renderContext: value(snapshot, "renderContext", "render_context"),
    formulationSummary,
    calculationVersion: value(formulation, "calculationVersion"),
    rows: rows.map((row) => ({
      percentage: value(row, "percentage"),
      color: value(row, "color"),
      size: value(row, "size"),
      materialType: value(row, "materialType", "material_type"),
      quantity: value(row, "quantityProvenance", "quantity_provenance") === "calculated"
        ? value(row, "calculatedQuantity", "calculated_quantity") || value(row, "quantity")
        : value(row, "quantity"),
      calculatedQuantity: value(row, "calculatedQuantity", "calculated_quantity"),
      quantityProvenance: value(row, "quantityProvenance", "quantity_provenance"),
      unit: value(row, "unit"),
      vendor: value(row, "vendor"),
    })),
  };
}

export function wrapSampleText(input, maxCharacters) {
  const lines = [];
  for (const paragraph of String(input ?? "").split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";
    for (const sourceWord of words) {
      const chunks = [];
      let word = sourceWord;
      while (word.length > maxCharacters) {
        chunks.push(word.slice(0, maxCharacters));
        word = word.slice(maxCharacters);
      }
      if (word) chunks.push(word);
      for (const chunk of chunks) {
        const candidate = current ? `${current} ${chunk}` : chunk;
        if (candidate.length <= maxCharacters) current = candidate;
        else {
          if (current) lines.push(current);
          current = chunk;
        }
      }
    }
    if (current) lines.push(current);
    else if (!words.length) lines.push("");
  }
  return lines;
}

const sampleColumnCharacters = [4, 18, 6, 8, 5, 6, 15];

export function sampleRowLineCount(row) {
  const values = [row.percentage, row.color, row.size, row.materialType, row.quantity, row.unit, row.vendor];
  return Math.max(1, ...values.map((entry, index) => wrapSampleText(entry, sampleColumnCharacters[index]).length));
}

export function sampleRowHeight(row) {
  return Math.max(36, 12 + sampleRowLineCount(row) * 11);
}

export function paginateSampleRows(rows, firstPageCapacity = 305, continuationCapacity = 510) {
  if (!rows.length) return [{ rows: [], pageNumber: 1, pageCount: 1, continuation: false }];
  const pages = [];
  let current = [];
  let used = 0;
  let capacity = firstPageCapacity;
  for (const row of rows) {
    const height = sampleRowHeight(row);
    if (current.length && used + height > capacity) {
      pages.push({ rows: current, continuation: pages.length > 0 });
      current = [];
      used = 0;
      capacity = continuationCapacity;
    }
    current.push(row);
    used += height;
  }
  if (current.length) pages.push({ rows: current, continuation: pages.length > 0 });
  return pages.map((page, index) => ({
    ...page,
    pageNumber: index + 1,
    pageCount: pages.length,
  }));
}
