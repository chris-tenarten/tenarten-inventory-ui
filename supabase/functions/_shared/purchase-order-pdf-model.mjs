export const PURCHASE_ORDER_PDF_VERSION = "po-pdf-v2";
export const PURCHASE_ORDER_ROWS_PER_PAGE = 12;

const text = (value) => value == null ? "" : String(value);
const money = (value) => {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toFixed(2)}` : text(value);
};
const displayDate = (value) => {
  const source = text(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(source);
  return match ? `${Number(match[2])}/${Number(match[3])}/${match[1]}` : source;
};

const appendUnique = (parts, value) => {
  const next = text(value).trim();
  if (!next) return;
  const normalized = next.toLowerCase();
  if (!parts.some((part) => part.toLowerCase().includes(normalized) || normalized.includes(part.toLowerCase()))) parts.push(next);
};

export function buildPurchaseOrderLineDescription(line) {
  const lineKind = text(line.line_kind) || "chip";
  const parts = [];
  const manual = text(line.description || line.notes).trim();
  const manualNormalized = manual.toLowerCase();
  const structured = [];
  appendUnique(structured, line.material);
  if (lineKind === "resin") {
    appendUnique(structured, line.resin_color);
    appendUnique(structured, line.component_type);
  } else {
    appendUnique(structured, line.chip_size || line.part_component);
  }
  appendUnique(structured, text(line.container_size) || [text(line.package_quantity), text(line.package_measure)].filter(Boolean).join(" "));
  appendUnique(structured, line.container || line.container_type);
  if (lineKind === "chip") appendUnique(structured, line.moisture_condition ? text(line.moisture_condition).replace(/^./, (letter) => letter.toUpperCase()) : "");
  structured.forEach((value) => { if (!manualNormalized.includes(value.toLowerCase())) appendUnique(parts, value); });
  appendUnique(parts, manual);
  return parts.join(", ");
}

export function buildPurchaseOrderPdfModel(orderSnapshot, linesSnapshot) {
  if (!orderSnapshot || typeof orderSnapshot !== "object" || Array.isArray(orderSnapshot)) {
    throw new Error("The issuance header snapshot is invalid.");
  }
  if (!Array.isArray(linesSnapshot) || linesSnapshot.length === 0) {
    throw new Error("The issuance line snapshot is invalid.");
  }

  const poNumber = text(orderSnapshot.po_number);
  if (!poNumber) throw new Error("The issuance snapshot has no Purchase Order number.");

  const linked = Boolean(text(orderSnapshot.production_job_id));
  const modeAware = Object.prototype.hasOwnProperty.call(orderSnapshot, "material_classification");
  const lines = [...linesSnapshot]
    .sort((left, right) => Number(left.line_number) - Number(right.line_number))
    .map((line) => ({
      item: text(line.line_number),
      material: text(line.material),
      vendorSku: text(line.vendor_sku),
      lineKind: text(line.line_kind) || "chip",
      partComponent: text(line.part_component || line.chip_size),
      description: modeAware ? buildPurchaseOrderLineDescription(line) || text(line.display_description) : text(line.description || line.notes || line.display_description),
      quantity: text(line.quantity),
      unit: text(line.unit),
      container: text(line.container || line.container_type),
      containerSize: text(line.container_size) || [text(line.package_quantity), text(line.package_measure)].filter(Boolean).join(" "),
      unitCost: money(line.unit_price),
      extendedCost: money(line.line_total),
    }));

  const pages = [];
  for (let index = 0; index < lines.length; index += PURCHASE_ORDER_ROWS_PER_PAGE) {
    pages.push(lines.slice(index, index + PURCHASE_ORDER_ROWS_PER_PAGE));
  }

  return {
    documentVersion: PURCHASE_ORDER_PDF_VERSION,
    templateName: text(orderSnapshot.template_name) === "classic" ? "classic" : "tenops",
    templateVersion: Number(orderSnapshot.template_version) || 1,
    poNumber,
    poDate: displayDate(orderSnapshot.po_date),
    issueDate: displayDate(orderSnapshot.issued_at || orderSnapshot.po_date),
    generatedFromStatus: text(orderSnapshot.status),
    lineLayout: modeAware ? "material-aware" : "legacy",
    materialClassification: (() => {
      if (!modeAware) return "Chip";
      const kinds = new Set(lines.map((line) => line.lineKind));
      if (kinds.size > 1) return "Mixed";
      const only = [...kinds][0] || "chip";
      return only === "chip" ? "Chip / Aggregate" : only.replace(/^./, (letter) => letter.toUpperCase());
    })(),
    vendor: {
      name: text(orderSnapshot.vendor_name),
      contact: text(orderSnapshot.vendor_contact),
      address: text(orderSnapshot.vendor_address),
    },
    job: linked ? {
      kind: "linked",
      number: text(orderSnapshot.job_number),
      name: text(orderSnapshot.job_name),
    } : {
      kind: "stock",
      number: "",
      name: "Stock Purchase",
    },
    shipTo: text(orderSnapshot.ship_to),
    paymentTerms: text(orderSnapshot.payment_terms),
    requestedDate: displayDate(orderSnapshot.requested_date),
    originatedBy: text(orderSnapshot.originated_by),
    authorizedBy: text(orderSnapshot.authorized_by),
    vendorNotes: text(orderSnapshot.commercial_notes),
    lines,
    pages,
    totals: {
      subtotal: money(orderSnapshot.subtotal),
      discountPercent: text(orderSnapshot.discount_percent),
      discount: money(orderSnapshot.discount_amount),
      taxPercent: text(orderSnapshot.tax_percent),
      freight: money(orderSnapshot.freight),
      tax: money(orderSnapshot.tax_amount),
      grandTotal: money(orderSnapshot.total),
    },
  };
}
