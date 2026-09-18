import { createClient } from "npm:@supabase/supabase-js@2.101.1";
import { degrees, PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import {
  buildPurchaseOrderPdfModel,
  PURCHASE_ORDER_PDF_VERSION,
} from "../_shared/purchase-order-pdf-model.mjs";
import { EdgeAuthorizationError, requireEdgeCapability } from "../_shared/rbac.ts";
import { normalizePdfText } from "../_shared/pdf-text.mjs";
import { chunkPdfLines, wrapMeasuredPdfText } from "../_shared/pdf-layout.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const safeText = (value: unknown) => normalizePdfText(value);

async function renderPdf(
  orderSnapshot: Record<string, unknown>,
  linesSnapshot: Array<Record<string, unknown>>,
  generatedAt: Date,
  logoUrl: string,
  draft = false,
) {
  const model = buildPurchaseOrderPdfModel(orderSnapshot, linesSnapshot);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Purchase Order ${model.poNumber}`);
  pdf.setAuthor("Tenarten Terrazzo");
  pdf.setSubject("Issued Purchase Order");
  pdf.setProducer(`TenOps ${PURCHASE_ORDER_PDF_VERSION}`);
  pdf.setCreationDate(generatedAt);
  pdf.setModificationDate(generatedAt);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const wrap = (font: { widthOfTextAtSize(value: string, size: number): number }, value: unknown, size: number, width: number) =>
    wrapMeasuredPdfText(safeText(value), width, size, (candidate, fontSize) => font.widthOfTextAtSize(candidate, fontSize));
  const logoResponse = await fetch(logoUrl);
  if (!logoResponse.ok) throw new Error("The configured Tenarten logo could not be loaded.");
  const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
  const contentType = logoResponse.headers.get("content-type") || "";
  const logo = contentType.includes("jpeg") || contentType.includes("jpg")
    ? await pdf.embedJpg(logoBytes)
    : await pdf.embedPng(logoBytes);

  const classic = model.templateName === "classic";
  const accent = classic ? rgb(0.62, 0.82, 0.80) : rgb(0.035, 0.075, 0.16);
  const accentText = classic ? rgb(0.02, 0.07, 0.10) : rgb(1, 1, 1);
  const ink = rgb(0.02, 0.05, 0.10);
  const slate = rgb(0.31, 0.38, 0.48);
  const lineColor = classic ? rgb(0.20, 0.24, 0.27) : rgb(0.62, 0.68, 0.76);
  const pale = classic ? rgb(1, 1, 1) : rgb(0.95, 0.97, 0.985);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 32;
  const generationLabel = generatedAt.toISOString();

  const columns = model.lineLayout === "material-aware" ? [
    { key: "item", label: "ITEM", x: 32, width: 30 },
    { key: "vendorSku", label: "SKU", x: 62, width: 62 },
    { key: "description", label: "DESCRIPTION", x: 124, width: 238 },
    { key: "quantity", label: "QTY", x: 362, width: 48 },
    { key: "unit", label: "UNIT", x: 410, width: 48 },
    { key: "unitCost", label: "UNIT PRICE", x: 458, width: 58 },
    { key: "extendedCost", label: "TOTAL", x: 516, width: 64 },
  ] as const : [
    { key: "item", label: "#", x: 32, width: 22 },
    { key: "material", label: "MATERIAL", x: 54, width: 66 },
    { key: "vendorSku", label: "VENDOR SKU", x: 120, width: 48 },
    { key: "partComponent", label: "SIZE", x: 168, width: 60 },
    { key: "description", label: "DESCRIPTION", x: 228, width: 104 },
    { key: "quantity", label: "QTY", x: 332, width: 34 },
    { key: "unit", label: "UNIT", x: 366, width: 34 },
    { key: "container", label: "CONTAINER", x: 400, width: 45 },
    { key: "containerSize", label: "CONTAINER SIZE", x: 445, width: 47 },
    { key: "unitCost", label: "UNIT COST", x: 492, width: 44 },
    { key: "extendedCost", label: "EXTENDED", x: 536, width: 44 },
  ] as const;
  const type = model.typography;
  const rowFontSize = type.row;
  const rowLineHeight = type.rowLeading;
  // Exceptionally long identities continue on labeled detail pages. Ordinary
  // documents retain the original form geometry; no authored tail is discarded.
  const details: string[] = [];
  const retain = (lines: string[], count: number, label: string) => {
    if (lines.length <= count) return lines;
    details.push(label, ...lines.slice(count - 1), "");
    return [...lines.slice(0, count - 1), "(see details)"];
  };
  const metadata = [
    { value: `PO # ${model.poNumber}`, size: type.metadataNumber, font: bold },
    { value: `PO Date ${model.poDate || model.issueDate}`, size: type.emphasis, font: regular },
    { value: `PO Originated By ${model.originatedBy || "-"}`, size: type.emphasis, font: regular },
  ].map(field => ({...field, lines: retain(wrap(field.font, field.value, field.size, 190), 3, "PO METADATA CONTINUED")}));
  const headerShift = metadata.reduce((extra, field) => extra + (field.lines.length - 1) * 14, 0);
  const authorizedLines = retain(wrap(regular, model.authorizedBy || "-", type.emphasis, 230), 2, "AUTHORIZED BY CONTINUED");
  const vendorNameLines = retain(wrap(bold, model.vendor.name || "-", type.name, 284), 3, "VENDOR NAME CONTINUED");
  const vendorAddressLines = retain(wrap(regular, model.vendor.address || "-", type.body, 284), 8, "VENDOR ADDRESS CONTINUED");
  const vendorContactLines = retain(wrap(regular, model.vendor.contact || "-", type.body, 234), 10, "VENDOR CONTACT CONTINUED");
  const vendorHeight = Math.max(60, 34 + vendorNameLines.length * type.nameLeading + vendorAddressLines.length * type.bodyLeading, 26 + vendorContactLines.length * type.bodyLeading);
  const vendorBandY = 674 - headerShift;
  const vendorBottom = vendorBandY - vendorHeight;
  const projectBandY = vendorBottom - 20;
  const jobNameLines = retain(wrap(bold, model.job.kind === "linked" ? model.job.name : "Stock Purchase", type.emphasis, 152), 3, "JOB REFERENCE CONTINUED");
  const paymentLines = retain(wrap(regular, model.paymentTerms || "-", type.body, 74), 3, "PAYMENT TERMS CONTINUED");
  const jobNumberLines = retain(wrap(bold, model.job.kind === "linked" ? model.job.number : "-", type.emphasis, 116), 3, "JOB NUMBER CONTINUED");
  const requestedDateLines = retain(wrap(regular, model.requestedDate || "-", type.body, 52), 3, "DATE REQUESTED CONTINUED");
  const shipToLines = retain(wrap(regular, model.shipTo || "-", type.body, 234), 8, "SHIP TO CONTINUED");
  const projectHeight = Math.max(64, (type.label > 6.2 ? 54 : 42) + jobNameLines.length * type.bodyLeading + paymentLines.length * type.bodyLeading, (type.label > 6.2 ? 54 : 42) + jobNumberLines.length * type.bodyLeading + requestedDateLines.length * type.bodyLeading, 26 + shipToLines.length * type.bodyLeading);
  const projectBottom = projectBandY - projectHeight;
  const tableHeaderY = projectBottom - 28;
  const totalRows = [
    ["Subtotal", model.totals.subtotal],
    [`Discount${model.totals.discountPercent ? ` @ ${model.totals.discountPercent}%` : ""}`, model.totals.discount],
    [`Sales Tax${model.totals.taxPercent ? ` @ ${model.totals.taxPercent}%` : ""}`, model.totals.tax],
    ["Freight", model.totals.freight], ["GRAND TOTAL", model.totals.grandTotal],
  ].map(([label, amount], index) => {
    const size = index === 4 ? type.total : type.emphasis;
    const font = index === 4 ? bold : regular;
    const labels = wrap(font, label, size, 108);
    const amounts = wrap(font, amount, size, 70);
    return { labels, amounts, size, font, height: Math.max(20, Math.max(labels.length, amounts.length) * (size + 2) + 4) };
  });
  const totalsHeight = 12 + totalRows.reduce((sum, row) => sum + row.height, 0);
  const tableCapacity = Math.max(24, tableHeaderY - (96 + totalsHeight));
  const maxFragmentLines = Math.max(1, Math.floor((tableCapacity - 8) / rowLineHeight));
  const laidOutLines = model.lines.flatMap((line) => {
    const cells = columns.map((column) => wrap(regular, line[column.key], rowFontSize, column.width - 8));
    const lineCount = Math.max(1, ...cells.map((cell) => cell.length));
    const fragments = [];
    for (let offset = 0; offset < lineCount; offset += maxFragmentLines) {
      const fragmentCells = cells.map((cell) => cell.slice(offset, offset + maxFragmentLines));
      const fragmentLineCount = Math.max(1, ...fragmentCells.map((cell) => cell.length));
      fragments.push({ line, cells: fragmentCells, height: Math.max(24, fragmentLineCount * rowLineHeight + 8) });
    }
    return fragments;
  });
  const renderPages: typeof laidOutLines[] = [];
  for (const laidOutLine of laidOutLines) {
    let pageLines = renderPages.at(-1);
    if (!pageLines || pageLines.reduce((sum, item) => sum + item.height, 0) + laidOutLine.height > tableCapacity) {
      pageLines = [];
      renderPages.push(pageLines);
    }
    pageLines.push(laidOutLine);
  }
  const noteLines = wrap(regular, model.vendorNotes || "-", type.notes, 325);
  const firstNoteCapacity = Math.min(5, Math.floor(48 / type.notesLeading) + 1);
  const firstNoteLines = noteLines.slice(0, firstNoteCapacity);
  const overflowNoteLines = noteLines.slice(firstNoteCapacity);
  const noteChunks = overflowNoteLines.length ? chunkPdfLines(overflowNoteLines, Math.min(48, Math.floor(588 / type.notesContinuationLeading))) : [];
  const detailChunks = details.length ? chunkPdfLines(details.flatMap(line => wrap(regular, line, type.notes, 532)), Math.floor(588 / type.notesContinuationLeading)) : [];
  const continuationChunks = [...detailChunks.map(lines => ({lines, kind: "DETAILS"})), ...noteChunks.map(lines => ({lines, kind: "NOTES & SPECIAL CONDITIONS"}))];
  const totalPages = renderPages.length + continuationChunks.length;

  renderPages.forEach((pageLines, pageIndex) => {
    const page = pdf.addPage([pageWidth, pageHeight]);
    const drawText = (value: unknown, x: number, y: number, size = 8, font = regular, color = ink) =>
      page.drawText(safeText(value), { x, y, size, font, color });
    const box = (x: number, y: number, width: number, height: number, fill = rgb(1, 1, 1)) =>
      page.drawRectangle({ x, y, width, height, color: fill, borderColor: lineColor, borderWidth: 0.6 });
    const sectionBand = (label: string, y: number) => {
      page.drawRectangle({ x: margin, y, width: 548, height: 16, color: accent, borderColor: lineColor, borderWidth: 0.6 });
      const labelWidth = bold.widthOfTextAtSize(label, 7);
      drawText(label, margin + (548 - labelWidth) / 2, y + 5, 7, bold, accentText);
    };
    const fieldLabel = (label: string, x: number, y: number) => drawText(label, x, y, type.label, bold, slate);

    const logoScale = Math.min(48 / logo.height, 54 / logo.width);
    page.drawImage(logo, { x: margin, y: pageHeight - margin - logo.height * logoScale, width: logo.width * logoScale, height: logo.height * logoScale });
    drawText("TENARTEN TERRAZZO", 94, 750, 15, bold);
    drawText("PRECAST MANUFACTURING", 94, 736, 7, bold, slate);
    drawText("2933 Eisenhower St., Suite 120", 94, 724, 7, regular, slate);
    drawText("Carrollton, TX 75007 | www.precasttz.com", 94, 713, 7, regular, slate);
    drawText("PURCHASE ORDER", 390, 750, 18, bold);
    let metadataY = 730;
    metadata.forEach(field => {
      field.lines.forEach(line => { drawText(line, 390, metadataY, field.size, field.font); metadataY -= 14; });
    });
    page.drawLine({ start: { x: margin, y: 696 - headerShift }, end: { x: pageWidth - margin, y: 696 - headerShift }, thickness: 1.5, color: accent });

    // Both templates deliberately share the original form's grid. Only their
    // restrained color treatment differs.
    sectionBand("VENDOR INFORMATION", vendorBandY);
    box(margin, vendorBottom, 300, vendorHeight, pale);
    box(332, vendorBottom, 248, vendorHeight, pale);
    fieldLabel("VENDOR", 38, vendorBandY - 11);
    vendorNameLines.forEach((line, index) => drawText(line, 38, vendorBandY - 25 - index * type.nameLeading, type.name, bold));
    vendorAddressLines.forEach((line, index) => drawText(line, 38, vendorBandY - 25 - vendorNameLines.length * type.nameLeading - index * type.bodyLeading, type.body));
    fieldLabel("CONTACT", 338, vendorBandY - 11);
    vendorContactLines.forEach((line, index) => drawText(line, 338, vendorBandY - 25 - index * type.bodyLeading, type.body));

    sectionBand("PROJECT INFORMATION", projectBandY);
    box(margin, projectBottom, 168, projectHeight, pale);
    box(200, projectBottom, 132, projectHeight, pale);
    box(332, projectBottom, 248, projectHeight, pale);
    const projectLabelY = projectBandY - 11;
    fieldLabel(model.job.kind === "linked" ? "JOB REFERENCE" : "PURCHASE TYPE", 38, projectLabelY);
    jobNameLines.forEach((line, index) => drawText(line, 38, projectLabelY - 15 - index * type.bodyLeading, type.emphasis, bold));
    const paymentY = projectLabelY - 22 - jobNameLines.length * type.bodyLeading;
    fieldLabel("PAYMENT TERMS", 38, paymentY);
    paymentLines.forEach((line, index) => drawText(line, 116, paymentY - (type.label > 6.2 ? 12 : 0) - index * type.bodyLeading, type.body));
    fieldLabel("JOB NUMBER", 206, projectLabelY);
    jobNumberLines.forEach((line, index) => drawText(line, 206, projectLabelY - 15 - index * type.bodyLeading, type.emphasis, bold));
    const requestedY = projectLabelY - 22 - jobNumberLines.length * type.bodyLeading;
    fieldLabel("DATE REQUESTED", 206, requestedY);
    requestedDateLines.forEach((line, index) => drawText(line, 270, requestedY - (type.label > 6.2 ? 12 : 0) - index * type.bodyLeading, type.body));
    fieldLabel("SHIP TO", 338, projectLabelY);
    shipToLines.forEach((line, index) => drawText(line, 338, projectLabelY - 15 - index * type.bodyLeading, type.body));

    page.drawRectangle({ x: margin, y: tableHeaderY, width: 548, height: 28, color: accent, borderColor: lineColor, borderWidth: 0.6 });
    columns.forEach((column) => {
      const labels = wrap(bold, column.label, type.header, column.width - 8);
      labels.forEach((line, index) => drawText(line, column.x + 4, tableHeaderY + 17 - index * (type.header > 5.2 ? 8 : 7), type.header, bold, accentText));
    });

    let rowTop = tableHeaderY;
    pageLines.forEach((laidOutLine, rowIndex) => {
      const rowBottom = rowTop - laidOutLine.height;
      if (rowIndex % 2 === 1) page.drawRectangle({ x: margin, y: rowBottom, width: 548, height: laidOutLine.height, color: pale });
      columns.forEach((column, columnIndex) => {
        page.drawRectangle({ x: column.x, y: rowBottom, width: column.width, height: laidOutLine.height, borderColor: lineColor, borderWidth: 0.4 });
        laidOutLine.cells[columnIndex].forEach((value, lineIndex) => {
          drawText(value, column.x + 4, rowTop - 10 - lineIndex * rowLineHeight, rowFontSize);
        });
      });
      rowTop = rowBottom;
    });

    if (pageIndex === renderPages.length - 1) {
      box(margin, 94, 342, 82);
      page.drawRectangle({ x: margin, y: 160, width: 342, height: 16, color: accent, borderColor: lineColor, borderWidth: 0.6 });
      drawText("NOTES & SPECIAL CONDITIONS", 40, 165, 7, bold, accentText);
      firstNoteLines.forEach((line, index) => drawText(line, 40, 146 - index * type.notesLeading, type.notes));
      box(382, 94, 198, totalsHeight, pale);
      let totalY = 94 + totalsHeight - 17;
      totalRows.forEach(row => {
        row.labels.forEach((line, index) => drawText(line, 392, totalY - index * (row.size + 2), row.size, row.font));
        row.amounts.forEach((line, index) => drawText(line, Math.min(510, 574 - row.font.widthOfTextAtSize(line, row.size)), totalY - index * (row.size + 2), row.size, row.font));
        totalY -= row.height;
      });
      drawText("AUTHORIZED BY", 40, 78, 7, bold, slate);
      authorizedLines.forEach((line, index) => drawText(line, 40, 62 - index * 12, type.emphasis));
      page.drawLine({ start: { x: 38, y: authorizedLines.length > 1 ? 43 : 55 }, end: { x: 270, y: authorizedLines.length > 1 ? 43 : 55 }, thickness: 0.6, color: slate });
    }

    drawText(`Generated ${generationLabel}`, margin, 22, 6, regular, slate);
    drawText(`${model.templateName} v${model.templateVersion} | ${model.documentVersion}`, 218, 22, 6, regular, slate);
    drawText(`Page ${pageIndex + 1} of ${totalPages}`, 520, 22, 6, regular, slate);
    if (draft) {
      page.drawText("DRAFT - NOT ISSUED", {
        x: 92,
        y: 360,
        size: 48,
        font: bold,
        color: rgb(0.78, 0.81, 0.85),
        rotate: degrees(32),
        opacity: 0.45,
      });
    }
  });

  continuationChunks.forEach(({lines, kind}, noteIndex) => {
    const pageIndex = renderPages.length + noteIndex;
    const page = pdf.addPage([pageWidth, pageHeight]);
    const drawText = (value: unknown, x: number, y: number, size = 8, font = regular, color = ink) =>
      page.drawText(safeText(value), { x, y, size, font, color });
    drawText("TENARTEN TERRAZZO", margin, 750, 14, bold);
    wrap(bold, `PURCHASE ORDER ${model.poNumber} - ${kind === "DETAILS" ? "DETAILS" : "NOTES"} CONTINUED`, 10, 320).forEach((line, index) => drawText(line, 260, 750 - index * 12, 10, bold));
    page.drawLine({ start: { x: margin, y: 730 }, end: { x: pageWidth - margin, y: 730 }, thickness: 1.5, color: accent });
    page.drawRectangle({ x: margin, y: 690, width: 548, height: 20, color: accent, borderColor: lineColor, borderWidth: 0.6 });
    drawText(`${kind} - CONTINUED`, 40, 697, 7, bold, accentText);
    page.drawRectangle({ x: margin, y: 70, width: 548, height: 620, color: rgb(1,1,1), borderColor: lineColor, borderWidth: 0.6 });
    lines.forEach((line, index) => drawText(line, 40, 672 - index * type.notesContinuationLeading, type.notes));
    drawText(`Generated ${generationLabel}`, margin, 22, 6, regular, slate);
    drawText(`${model.templateName} v${model.templateVersion} | ${model.documentVersion}`, 218, 22, 6, regular, slate);
    drawText(`Page ${pageIndex + 1} of ${totalPages}`, 520, 22, 6, regular, slate);
  });

  return new Uint8Array(await pdf.save({ useObjectStreams: false }));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "PDF service configuration is incomplete." }, 500);
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let body: {
    action?: string;
    issuanceId?: string;
    actor?: string;
    purchaseOrderId?: string;
    poNumber?: string;
    confirmation?: string;
    orderSnapshot?: Record<string, unknown>;
    linesSnapshot?: Array<Record<string, unknown>>;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "A JSON request body is required." }, 400);
  }
  try {
    const capability = body.action === "purge-test-purchase-order"
      ? "manageUsers"
      : body.action === "draft-preview" || body.action === "preview" || body.action === "download"
        ? "previewOperationalDocuments"
        : "issuePurchaseOrder";
    await requireEdgeCapability(request, capability);
  } catch (error) {
    if (error instanceof EdgeAuthorizationError) return json({ error: error.message }, error.status);
    return json({ error: "Authorization failed." }, 500);
  }
  if (body.action === "draft-preview") {
    if (!body.orderSnapshot || !Array.isArray(body.linesSnapshot)) {
      return json({ error: "Draft Purchase Order values are required." }, 400);
    }
    try {
      const logoUrl = Deno.env.get("TENOPS_LOGO_URL");
      if (!logoUrl) throw new Error("TENOPS_LOGO_URL is not configured for Purchase Order PDFs.");
      const bytes = await renderPdf(
        { ...body.orderSnapshot, status: "draft" },
        body.linesSnapshot,
        new Date(),
        logoUrl,
        true,
      );
      return new Response(bytes, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Cache-Control": "no-store",
          "Content-Disposition": "inline",
        },
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Draft PDF preview failed.";
      return json({ error: message }, 500);
    }
  }

  if (body.action === "purge-test-purchase-order") {
    const orderId = String(body.purchaseOrderId ?? "");
    const poNumber = String(body.poNumber ?? "");
    const confirmation = String(body.confirmation ?? "");
    if (!orderId || !poNumber) return json({ error: "Purchase Order identity is required." }, 400);
    const { data: paths, error: purgeError } = await service.rpc("purge_test_purchase_order", {
      p_purchase_order_id: orderId,
      p_expected_po_number: poNumber,
      p_confirmation: confirmation,
    });
    if (purgeError) return json({ error: purgeError.message }, 409);
    const cleanupFailures: string[] = [];
    for (const path of paths ?? []) {
      if (!path.storage_bucket || !path.storage_path) continue;
      const { error: storageError } = await service.storage
        .from(path.storage_bucket)
        .remove([path.storage_path]);
      if (storageError) cleanupFailures.push(path.storage_path);
    }
    return json({ status: "deleted", storageCleanupComplete: cleanupFailures.length === 0, cleanupFailures });
  }

  if (!body.issuanceId) return json({ error: "An issuance ID is required." }, 400);

  if (body.action === "download" || body.action === "preview") {
    const { data: document, error } = await service
      .from("purchase_order_documents")
      .select("status,storage_bucket,storage_path")
      .eq("issuance_id", body.issuanceId)
      .single();
    if (error || document?.status !== "generated" || !document.storage_path) {
      return json({ error: "The permanent Purchase Order PDF is not available." }, 404);
    }
    const signedUrlOptions = body.action === "download"
      ? { download: true }
      : undefined;
    const { data, error: signedError } = await service.storage
      .from(document.storage_bucket)
      .createSignedUrl(document.storage_path, 600, signedUrlOptions);
    if (signedError || !data?.signedUrl) return json({ error: "Unable to prepare the PDF download." }, 500);
    return json({ url: data.signedUrl });
  }

  let documentId = "";
  let snapshotHash = "";
  try {
    const { data: claimRows, error: claimError } = await service.rpc(
      "claim_purchase_order_pdf_generation",
      { p_issuance_id: body.issuanceId, p_actor: body.actor || "AI" },
    );
    if (claimError) throw claimError;
    const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
    if (!claim) throw new Error("The PDF generation claim returned no document.");
    documentId = claim.document_id;
    snapshotHash = claim.snapshot_hash;

    if (claim.document_status === "generated") {
      return json({ status: "generated", reused: true });
    }
    if (claim.document_version !== PURCHASE_ORDER_PDF_VERSION) {
      throw new Error("The Purchase Order PDF document version is unsupported.");
    }

    const { data: existing } = await service.storage
      .from(claim.storage_bucket)
      .download(claim.storage_path);
    if (existing) {
      const generatedAt = new Date().toISOString();
      const { error } = await service.from("purchase_order_documents").update({
        status: "generated",
        generated_at: generatedAt,
        failed_at: null,
        last_error: null,
        updated_at: generatedAt,
      }).eq("id", documentId).eq("snapshot_hash", snapshotHash);
      if (error) throw error;
      return json({ status: "generated", reused: true });
    }

    const logoUrl = Deno.env.get("TENOPS_LOGO_URL");
    if (!logoUrl) throw new Error("TENOPS_LOGO_URL is not configured for permanent PDFs.");
    const generatedAt = new Date();
    const pdfBytes = await renderPdf(
      claim.order_snapshot,
      claim.lines_snapshot,
      generatedAt,
      logoUrl,
    );
    const { error: uploadError } = await service.storage
      .from(claim.storage_bucket)
      .upload(claim.storage_path, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
        metadata: {
          snapshot_hash: snapshotHash,
          document_version: PURCHASE_ORDER_PDF_VERSION,
        },
      });
    if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) throw uploadError;

    const completedAt = generatedAt.toISOString();
    const { error: completeError } = await service.from("purchase_order_documents").update({
      status: "generated",
      generated_at: completedAt,
      failed_at: null,
      last_error: null,
      updated_at: completedAt,
    }).eq("id", documentId).eq("snapshot_hash", snapshotHash);
    if (completeError) throw completeError;
    return json({ status: "generated", reused: Boolean(uploadError) });
  } catch (caught) {
    const message = caught instanceof Error
      ? caught.message
      : typeof caught === "object" && caught && "message" in caught
        ? String(caught.message)
        : "Permanent PDF generation failed.";
    if (documentId) {
      const failedAt = new Date().toISOString();
      await service.from("purchase_order_documents").update({
        status: "failed",
        failed_at: failedAt,
        last_error: message.slice(0, 1000),
        updated_at: failedAt,
      }).eq("id", documentId).eq("snapshot_hash", snapshotHash).neq("status", "generated");
    }
    return json({ error: message }, 500);
  }
});
