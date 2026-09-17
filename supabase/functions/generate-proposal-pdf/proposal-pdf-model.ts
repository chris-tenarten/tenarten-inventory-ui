// @ts-nocheck -- Shared pure model accepts both database snake_case and UI camelCase snapshots.
export const PROPOSAL_PDF_VERSION = 'proposal-pdf-v2';
export const PROPOSAL_ESCALATION_NOTICE = 'This estimate may be subject to an escalation if not supplied by requested date';
export const PROPOSAL_LEAD_TIME_NOTICE = 'Lead time for materials and fabrication durations TBD upon receipt of notice to proceed';

const value = (source, camel, snake = camel) => String(source?.[camel] ?? source?.[snake] ?? '');
const firstValue = (source, ...keys) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) return String(source[key]);
  }
  return '';
};
const number = (source, camel, snake = camel) => {
  const parsed = Number(source?.[camel] ?? source?.[snake] ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const dimensionAliases = {
  length: 'length',
  lengthInches: 'length',
  length_inches: 'length',
  width: 'width',
  widthInches: 'width',
  width_inches: 'width',
  riserHeight: 'riserHeight',
  riser_height: 'riserHeight',
  riserHeightInches: 'riserHeight',
  riser_height_inches: 'riserHeight',
  thickness: 'thickness',
  thicknessInches: 'thickness',
  thickness_inches: 'thickness',
  cubicFeet: 'cubicFeet',
  cubic_feet: 'cubicFeet',
  cft: 'cubicFeet',
  linearFeet: 'linearFeet',
  linear_feet: 'linearFeet',
  lf: 'linearFeet',
  estimatedWeight: 'estimatedWeight',
  estimated_weight: 'estimatedWeight',
  estimatedWeightPounds: 'estimatedWeight',
  estimated_weight_pounds: 'estimatedWeight',
};
const dimensionApplicability = (source, camel, snake = camel) => {
  const candidate = source?.[camel] ?? source?.[snake];
  if (Array.isArray(candidate)) {
    return Object.fromEntries(candidate
      .map((key) => dimensionAliases[String(key)])
      .filter(Boolean)
      .map((key) => [key, true]));
  }
  if (!candidate || typeof candidate !== 'object') return {};
  return Object.fromEntries(Object.entries(candidate)
    .map(([key, applicable]) => [dimensionAliases[key], applicable === true || applicable === 'true'])
    .filter(([key]) => Boolean(key)));
};

const explicitGeometryKeys = ['length', 'width', 'riserHeight', 'thickness', 'cubicFeet', 'linearFeet', 'estimatedWeight'];
const legacyGeometryKeys = ['length', 'width', 'heightThickness', 'cft', 'lf', 'estimatedWeight'];

export function buildProposalPdfModel(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('Proposal snapshot is required.');
  const sourceLines = Array.isArray(snapshot.lines) ? snapshot.lines : [];
  const lines = sourceLines.map((line, index) => {
    const lineType = value(line, 'lineType', 'line_type') || 'product';
    const applicability = dimensionApplicability(line, 'dimensionApplicability', 'dimension_applicability');
    const geometryProfile = value(line, 'geometryProfile', 'geometry_profile');
    const lengthInches = firstValue(line, 'lengthInches', 'length_inches');
    const widthInches = firstValue(line, 'widthInches', 'width_inches');
    const riserHeightInches = firstValue(line, 'riserHeightInches', 'riser_height_inches');
    const thicknessInches = firstValue(line, 'thicknessInches', 'thickness_inches');
    const cubicFeet = firstValue(line, 'cubicFeet', 'cubic_feet');
    const linearFeet = firstValue(line, 'linearFeet', 'linear_feet');
    const estimatedWeightPounds = firstValue(line, 'estimatedWeightPounds', 'estimated_weight_pounds');
    const hasExplicitDimensionApplicability = Object.keys(applicability).length > 0;
    const applicableValue = (key, current) =>
      hasExplicitDimensionApplicability && applicability[key] !== true ? '' : current;
    const usesV2Geometry = Boolean(
      geometryProfile
      || Object.keys(applicability).length
      || [lengthInches, widthInches, riserHeightInches, thicknessInches, cubicFeet, linearFeet, estimatedWeightPounds].some((entry) => entry !== '')
    );
    return {
      itemNumber: value(line, 'itemNumber', 'item_number') || (lineType === 'product' ? String(index + 1) : ''),
      lineType,
      description: value(line, 'description'),
      ref: value(line, 'ref'),
      colorPlate: value(line, 'colorPlate', 'color_plate'),
      quantity: value(line, 'quantity'),
      unit: value(line, 'unit'),
      length: usesV2Geometry ? applicableValue('length', lengthInches) : value(line, 'length'),
      width: usesV2Geometry ? applicableValue('width', widthInches) : value(line, 'width'),
      riserHeight: usesV2Geometry ? applicableValue('riserHeight', riserHeightInches) : '',
      thickness: usesV2Geometry ? applicableValue('thickness', thicknessInches) : '',
      heightThickness: usesV2Geometry ? '' : value(line, 'heightThickness', 'height_thickness'),
      cubicFeet: usesV2Geometry ? applicableValue('cubicFeet', cubicFeet) : value(line, 'cft'),
      linearFeet: usesV2Geometry ? applicableValue('linearFeet', linearFeet) : value(line, 'lf'),
      cft: usesV2Geometry ? '' : value(line, 'cft'),
      lf: usesV2Geometry ? '' : value(line, 'lf'),
      estimatedWeight: usesV2Geometry ? applicableValue('estimatedWeight', estimatedWeightPounds) : value(line, 'estimatedWeight', 'estimated_weight'),
      geometryProfile,
      dimensionApplicability: applicability,
      hasExplicitDimensionApplicability,
      usesV2Geometry,
      rate: number(line, 'rate'),
      total: number(line, 'total'),
    };
  });
  const hasV2Geometry = lines.some((line) => line.usesV2Geometry);
  const hasLegacyHeightThickness = hasV2Geometry && lines.some((line) => !line.usesV2Geometry && line.heightThickness);
  const geometryKeys = hasV2Geometry
    ? explicitGeometryKeys.filter((key) => lines.some((line) =>
      line.usesV2Geometry && line.hasExplicitDimensionApplicability
        ? line.dimensionApplicability[key] === true
        : Boolean(line[key])
    ))
    : [...legacyGeometryKeys];
  if (hasLegacyHeightThickness) {
    const firstDerivedIndex = geometryKeys.findIndex((key) => ['cubicFeet', 'linearFeet', 'estimatedWeight'].includes(key));
    geometryKeys.splice(firstDerivedIndex < 0 ? geometryKeys.length : firstDerivedIndex, 0, 'heightThickness');
  }
  const customerName = value(snapshot, 'customerName', 'customer_name');
  const structuredAddress = [
    value(snapshot, 'customerStreet', 'customer_street'),
    value(snapshot, 'customerAddressLine2', 'customer_address_line_2'),
    [
      value(snapshot, 'customerCity', 'customer_city'),
      value(snapshot, 'customerState', 'customer_state'),
      value(snapshot, 'customerPostalCode', 'customer_postal_code'),
    ].filter(Boolean).join(' '),
  ].filter(Boolean);
  const structuredContact = [
    value(snapshot, 'customerContactName', 'customer_contact_name'),
    value(snapshot, 'customerOfficePhone', 'customer_office_phone'),
    value(snapshot, 'customerMobilePhone', 'customer_mobile_phone'),
    value(snapshot, 'customerEmail', 'customer_email'),
  ].filter(Boolean);
  const addressLines = structuredAddress.length
    ? structuredAddress
    : [value(snapshot, 'customerAddress', 'customer_address')].filter(Boolean);
  const contactLines = structuredContact.length
    ? structuredContact
    : [value(snapshot, 'customerContact', 'customer_contact')].filter(Boolean);
  const customerDisplay = [customerName, ...addressLines, ...contactLines].filter(Boolean).join('\n');
  const model = {
    estimateNumber: value(snapshot, 'estimateNumber', 'estimate_number'),
    versionMinor: number(snapshot, 'versionMinor', 'version_minor'),
    proposalDate: value(snapshot, 'proposalDate', 'proposal_date'),
    customerName,
    customerDisplay,
    projectName: value(snapshot, 'projectName', 'project_name'),
    projectNumber: value(snapshot, 'projectNumber', 'project_number'),
    projectLocation: value(snapshot, 'projectLocation', 'project_location'),
    sideMark: value(snapshot, 'sideMark', 'side_mark'),
    salesRep: value(snapshot, 'salesRep', 'sales_rep'),
    terms: value(snapshot, 'terms'),
    validDays: value(snapshot, 'validDays', 'valid_days'),
    requestedDelivery: value(snapshot, 'requestedDelivery', 'requested_delivery'),
    fob: value(snapshot, 'fob'),
    destinationZip: value(snapshot, 'destinationZip', 'destination_zip'),
    taxCounty: value(snapshot, 'taxCounty', 'tax_county'),
    submittedByName: value(snapshot, 'submittedByName', 'submitted_by_name'),
    submittedByPhone: value(snapshot, 'submittedByPhone', 'submitted_by_phone'),
    submittedByEmail: value(snapshot, 'submittedByEmail', 'submitted_by_email'),
    notes: value(snapshot, 'notes'),
    disclaimer: value(snapshot, 'disclaimerSnapshot', 'disclaimer_snapshot'),
    formula: value(snapshot, 'formulaSnapshot', 'formula_snapshot'),
    taxEnabled: Boolean(snapshot.taxEnabled ?? snapshot.tax_enabled),
    taxRate: number(snapshot, 'taxRate', 'tax_rate'),
    subtotal: number(snapshot, 'subtotal'),
    tax: number(snapshot, 'tax'),
    total: number(snapshot, 'total'),
    geometryKeys,
    legacyGeometry: !hasV2Geometry,
    lines,
  };
  if (!model.estimateNumber) throw new Error('Estimate number is required.');
  const subtotal = Math.round(model.lines.reduce((total, line) => total + line.total, 0) * 100) / 100;
  const tax = model.taxEnabled ? Math.round(subtotal * model.taxRate) / 100 : 0;
  return {
    ...model,
    subtotal,
    tax,
    total: Math.round((subtotal + tax) * 100) / 100,
    revised: model.versionMinor > 0,
    notesClarifications: model.notes,
  };
}

const defaultMeasure = (text, size) => String(text ?? '').length * size * 0.52;

function breakToken(token, width, size, measure) {
  const parts = [];
  let current = '';
  for (const character of token) {
    const candidate = current + character;
    if (current && measure(candidate, size) > width) {
      parts.push(current);
      current = character;
    } else current = candidate;
  }
  if (current) parts.push(current);
  return parts;
}

export function wrapProposalText(input, width, size = 6.4, measure = defaultMeasure) {
  const lines = [];
  for (const paragraph of String(input ?? '').split('\n')) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    let current = '';
    const tokens = paragraph.split(/\s+/).filter(Boolean).flatMap((token) =>
      measure(token, size) > width ? breakToken(token, width, size, measure) : [token]
    );
    for (const token of tokens) {
      const candidate = current ? `${current} ${token}` : token;
      if (current && measure(candidate, size) > width) {
        lines.push(current);
        current = token;
      } else current = candidate;
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [''];
}

const columnDefinitions = {
  itemNumber: { label: 'Item', width: 20 },
  description: { label: 'Description', width: 140 },
  ref: { label: 'REF', width: 30 },
  colorPlate: { label: 'COLOR PLATE', width: 38, headerSize: 4.5 },
  quantity: { label: 'QTY', width: 22 },
  unit: { label: '', width: 18 },
  length: { label: 'L', width: 25 },
  width: { label: 'W', width: 25 },
  riserHeight: { label: 'RH', width: 25 },
  thickness: { label: 'T', width: 25 },
  heightThickness: { label: 'H/T', width: 29 },
  cft: { label: 'CFT', width: 28 },
  lf: { label: 'LF', width: 24 },
  cubicFeet: { label: 'CFT', width: 28 },
  linearFeet: { label: 'LF', width: 24 },
  estimatedWeight: { label: 'EST. weight', width: 38, headerSize: 4.5 },
  rate: { label: 'Rate', width: 42 },
  total: { label: 'Total', width: 48 },
};

export function proposalPdfColumns(model) {
  const keys = ['itemNumber', 'description', 'ref', 'colorPlate', 'quantity', 'unit', ...model.geometryKeys, 'rate', 'total'];
  const columns = keys.map((key) => ({ key, ...columnDefinitions[key] }));
  const description = columns.find((column) => column.key === 'description');
  const used = columns.reduce((total, column) => total + (column.key === 'description' ? 0 : column.width), 0);
  description.width = Math.max(96, 548 - used);
  let x = 32;
  return columns.map((column) => {
    const positioned = { ...column, x };
    x += column.width;
    return positioned;
  });
}

export function paginateProposalPdf(model, options = {}) {
  const measure = options.measureText ?? defaultMeasure;
  const columns = proposalPdfColumns(model);
  const descriptionColumn = columns.find((column) => column.key === 'description');
  const descriptionWidth = options.descriptionWidth ?? Math.max(80, descriptionColumn.width - 12);
  const rowFontSize = options.rowFontSize ?? 6.4;
  const lineHeight = options.lineHeight ?? 9;
  const minRowHeight = options.minRowHeight ?? 34;
  const firstCapacity = options.firstRowsHeight ?? 350;
  const continuationCapacity = options.continuationRowsHeight ?? 620;
  const closingHeight = options.closingHeight ?? 150;
  const customerLines = options.customerLines ?? wrapProposalText(model.customerDisplay, 255, 7.5, measure);
  const maxFirstCustomerLines = options.maxFirstCustomerLines ?? 14;
  const materialDisclaimerLines = [...(options.materialDisclaimerLines ?? [])];
  const dimensionDisclaimerLines = [...(options.dimensionDisclaimerLines ?? [])];
  const firstDisclaimerLineLimit = options.firstDisclaimerLineLimit ?? 8;
  const disclaimerContinuationLineLimit = options.disclaimerContinuationLineLimit ?? 70;
  const firstPage = {
    continuation: false,
    rows: [],
    customerLines: customerLines.slice(0, maxFirstCustomerLines),
    materialDisclaimerLines: materialDisclaimerLines.splice(0, firstDisclaimerLineLimit),
    dimensionDisclaimerLines: dimensionDisclaimerLines.splice(0, firstDisclaimerLineLimit),
    usedHeight: 0,
    capacity: firstCapacity,
    closing: false,
  };
  const pages = [firstPage];
  const remainingCustomerLines = customerLines.slice(maxFirstCustomerLines);
  const customerContinuationLineLimit = options.customerContinuationLineLimit ?? 65;
  while (remainingCustomerLines.length) {
    pages.push({
      continuation: true,
      customerContinuation: true,
      customerLines: remainingCustomerLines.splice(0, customerContinuationLineLimit),
      rows: [],
      usedHeight: 0,
      capacity: 0,
      closing: false,
    });
  }
  while (materialDisclaimerLines.length || dimensionDisclaimerLines.length) {
    pages.push({
      continuation: true,
      disclaimerContinuation: true,
      materialDisclaimerLines: materialDisclaimerLines.splice(0, disclaimerContinuationLineLimit),
      dimensionDisclaimerLines: dimensionDisclaimerLines.splice(0, disclaimerContinuationLineLimit),
      rows: [],
      usedHeight: 0,
      capacity: 0,
      closing: false,
    });
  }
  const frontMatterOnly = pages.length > 1;
  firstPage.frontMatterOnly = frontMatterOnly;
  firstPage.capacity = frontMatterOnly ? 0 : firstCapacity;
  let page = frontMatterOnly
    ? { continuation: true, rows: [], usedHeight: 0, capacity: continuationCapacity, closing: false }
    : firstPage;
  if (frontMatterOnly) pages.push(page);
  const maxDescriptionLines = Math.max(1, Math.floor((continuationCapacity - 16) / lineHeight));

  model.lines.forEach((line, sourceIndex) => {
    const allCellLines = Object.fromEntries(columns.map((column) => [
      column.key,
      wrapProposalText(line[column.key], column.key === 'description' ? descriptionWidth : Math.max(8,column.width-6), column.key === 'description' ? rowFontSize : 5.9, measure),
    ]));
    const lineCount = Math.max(1,...Object.values(allCellLines).map((lines)=>lines.length));
    const fragments = [];
    for (let offset = 0; offset < lineCount; offset += maxDescriptionLines) {
      fragments.push(Object.fromEntries(Object.entries(allCellLines).map(([key,lines])=>[key,lines.slice(offset,offset+maxDescriptionLines)])));
    }
    fragments.forEach((cellLines, fragmentIndex) => {
      const fragmentLineCount=Math.max(1,...Object.values(cellLines).map((lines)=>lines.length));
      const height = Math.max(minRowHeight, 16 + fragmentLineCount * lineHeight);
      if (page.usedHeight + height > page.capacity) {
        page = { continuation: true, rows: [], usedHeight: 0, capacity: continuationCapacity, closing: false };
        pages.push(page);
      }
      page.rows.push({ line, sourceIndex, fragmentIndex, continuationFragment: fragmentIndex > 0, height, descriptionLines:cellLines.description, cellLines });
      page.usedHeight += height;
    });
  });

  const notesLines = model.notesClarifications ? wrapProposalText(model.notesClarifications, 530, 6.2, measure) : [];
  const formulaLines = model.formula ? wrapProposalText(model.formula, 345, 6.2, measure) : [];
  const noteLineHeight = 8;
  const formulaLineHeight = 8.2;
  const rowPageNoteLimit = 20;
  const closingFormulaLineLimit = options.closingFormulaLineLimit ?? 20;
  const formulaPageLineLimit = options.formulaContinuationLineLimit ?? Math.max(1, Math.floor((continuationCapacity - 32) / formulaLineHeight));
  const notesPageLineLimit = options.notesContinuationLineLimit ?? Math.max(1, Math.floor((continuationCapacity - 32) / noteLineHeight));
  const closingFormulaLines = [...formulaLines];
  const closingNotesLines = [...notesLines];
  let supplementalPageAdded = false;
  const formulaLinesReservedForClosing = closingNotesLines.length > rowPageNoteLimit ? 0 : closingFormulaLineLimit;

  while (closingFormulaLines.length > formulaLinesReservedForClosing) {
    const chunkSize = Math.min(formulaPageLineLimit, closingFormulaLines.length - formulaLinesReservedForClosing);
    pages.push({
      continuation: true,
      formulaContinuation: true,
      formulaLines: closingFormulaLines.splice(0, chunkSize),
      rows: [],
      usedHeight: 0,
      capacity: 0,
      closing: false,
    });
    supplementalPageAdded = true;
  }
  while (closingNotesLines.length > rowPageNoteLimit) {
    const chunkSize = Math.min(notesPageLineLimit, closingNotesLines.length - rowPageNoteLimit);
    pages.push({
      continuation: true,
      notesContinuation: true,
      notesLines: closingNotesLines.splice(0, chunkSize),
      rows: [],
      usedHeight: 0,
      capacity: 0,
      closing: false,
    });
    supplementalPageAdded = true;
  }

  let final = pages.at(-1);
  if (!final) throw new Error('Proposal pagination failed.');
  const formulaHeight = closingFormulaLines.length ? Math.max(64, 28 + closingFormulaLines.length * formulaLineHeight) : 0;
  const requiredClosingHeight = closingHeight + Math.max(0, formulaHeight - 64) + closingNotesLines.length * noteLineHeight;
  if (supplementalPageAdded || final.capacity - final.usedHeight < requiredClosingHeight) {
    final = { continuation: true, rows: [], usedHeight: 0, capacity: continuationCapacity, closing: false };
    pages.push(final);
  }
  final.notesLines = closingNotesLines;
  final.formulaLines = closingFormulaLines;
  final.formulaHeight = formulaHeight;
  final.closing = true;

  return pages.map((entry, index) => ({
    ...entry,
    notesLines: entry.notesLines ?? [],
    formulaLines: entry.formulaLines ?? [],
    formulaHeight: entry.formulaHeight ?? 0,
    customerLines: entry.customerLines ?? [],
    materialDisclaimerLines: entry.materialDisclaimerLines ?? [],
    dimensionDisclaimerLines: entry.dimensionDisclaimerLines ?? [],
    pageNumber: index + 1,
    pageCount: pages.length,
    repeatTableHeader: entry.rows.length > 0,
    showIdentity: index > 0,
    showRevised: model.revised,
    showTotals: entry.closing,
  }));
}
