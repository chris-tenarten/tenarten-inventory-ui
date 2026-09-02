export const SAMPLE_PDF_VERSION = "sample-work-order-pdf-v2-local-candidate";

const value = (source, camel, snake = camel) => String(source?.[camel] ?? source?.[snake] ?? "");

export function buildSamplePdfModel(snapshot) {
  if (!snapshot || typeof snapshot !== "object") throw new Error("Sample snapshot is required.");
  const rows = Array.isArray(snapshot.blendRows)
    ? snapshot.blendRows
    : Array.isArray(snapshot.blend_rows)
      ? snapshot.blend_rows
      : [];
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
    rows: rows.map((row) => ({
      percentage: value(row, "percentage"),
      color: value(row, "color"),
      size: value(row, "size"),
      materialType: value(row, "materialType", "material_type"),
      quantity: value(row, "quantity"),
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
