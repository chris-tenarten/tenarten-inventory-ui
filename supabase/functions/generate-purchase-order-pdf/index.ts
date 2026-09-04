import { createClient } from "npm:@supabase/supabase-js@2.101.1";
import { degrees, PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import {
  buildPurchaseOrderPdfModel,
  PURCHASE_ORDER_PDF_VERSION,
} from "../_shared/purchase-order-pdf-model.mjs";
import { EdgeAuthorizationError, requireEdgeCapability } from "../_shared/rbac.ts";
import { normalizePdfText } from "../_shared/pdf-text.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const safeText = (value: unknown) => normalizePdfText(value);
const shorten = (font: { widthOfTextAtSize(value: string, size: number): number }, value: string, size: number, width: number) => {
  const source = safeText(value);
  if (font.widthOfTextAtSize(source, size) <= width) return source;
  let result = source;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}...`, size) > width) result = result.slice(0, -1);
  return `${result}...`;
};
const wrap = (font: { widthOfTextAtSize(value: string, size: number): number }, value: string, size: number, width: number, maxLines = 3) => {
  const lines: string[] = [];
  for (const paragraph of safeText(value).split("\n")) {
    let current = "";
    const words = paragraph.split(/\s+/).filter(Boolean).flatMap((word) => {
      if (font.widthOfTextAtSize(word, size) <= width) return [word];
      const parts: string[] = [];
      let part = "";
      for (const character of word) {
        if (part && font.widthOfTextAtSize(`${part}${character}`, size) > width) {
          parts.push(part);
          part = character;
        } else part += character;
      }
      if (part) parts.push(part);
      return parts;
    });
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) current = candidate;
      else {
        if (current) lines.push(current);
        current = word;
      }
      if (lines.length === maxLines) break;
    }
    if (lines.length < maxLines && current) lines.push(current);
    if (lines.length === maxLines) break;
  }
  return lines;
};

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

  const columns = [
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
  const rowFontSize = 6.2;
  const rowLineHeight = 8;
  const laidOutLines = model.lines.map((line) => {
    const cells = columns.map((column) => wrap(regular, line[column.key], rowFontSize, column.width - 8, 16));
    const lineCount = Math.max(1, ...cells.map((cell) => cell.length));
    return { line, cells, height: Math.max(24, lineCount * rowLineHeight + 8) };
  });
  const renderPages: typeof laidOutLines[] = [];
  for (const laidOutLine of laidOutLines) {
    let pageLines = renderPages.at(-1);
    if (!pageLines || pageLines.reduce((sum, item) => sum + item.height, 0) + laidOutLine.height > 294) {
      pageLines = [];
      renderPages.push(pageLines);
    }
    pageLines.push(laidOutLine);
  }

  renderPages.forEach((pageLines, pageIndex) => {
    const page = pdf.addPage([pageWidth, pageHeight]);
    const drawText = (value: unknown, x: number, y: number, size = 8, font = regular, color = ink) =>
      page.drawText(safeText(value), { x, y, size, font, color });
    const drawWrapped = (
      value: unknown,
      x: number,
      y: number,
      width: number,
      size = 8,
      maxLines = 3,
      font = regular,
      color = ink,
    ) => wrap(font, String(value ?? ""), size, width, maxLines)
      .forEach((line, index) => drawText(line, x, y - index * (size + 2), size, font, color));
    const box = (x: number, y: number, width: number, height: number, fill = rgb(1, 1, 1)) =>
      page.drawRectangle({ x, y, width, height, color: fill, borderColor: lineColor, borderWidth: 0.6 });
    const sectionBand = (label: string, y: number) => {
      page.drawRectangle({ x: margin, y, width: 548, height: 16, color: accent, borderColor: lineColor, borderWidth: 0.6 });
      const labelWidth = bold.widthOfTextAtSize(label, 7);
      drawText(label, margin + (548 - labelWidth) / 2, y + 5, 7, bold, accentText);
    };
    const fieldLabel = (label: string, x: number, y: number) => drawText(label, x, y, 6.2, bold, slate);
    const fieldValue = (
      value: unknown,
      x: number,
      y: number,
      width: number,
      size = 7.5,
      font = regular,
    ) => drawText(shorten(font, safeText(value) || "-", size, width), x, y, size, font);

    const logoScale = Math.min(48 / logo.height, 54 / logo.width);
    page.drawImage(logo, { x: margin, y: pageHeight - margin - logo.height * logoScale, width: logo.width * logoScale, height: logo.height * logoScale });
    drawText("TENARTEN TERRAZZO", 94, 750, 15, bold);
    drawText("PRECAST MANUFACTURING", 94, 736, 7, bold, slate);
    drawText("2933 Eisenhower St., Suite 120", 94, 724, 7, regular, slate);
    drawText("Carrollton, TX 75007 | www.precasttz.com", 94, 713, 7, regular, slate);
    drawText("PURCHASE ORDER", 390, 750, 18, bold);
    drawText(`PO # ${model.poNumber}`, 390, 730, 10, bold);
    drawText(`PO Date ${model.poDate || model.issueDate}`, 390, 716, 8);
    drawText(`PO Originated By ${model.originatedBy || "-"}`, 390, 702, 8);
    page.drawLine({ start: { x: margin, y: 696 }, end: { x: pageWidth - margin, y: 696 }, thickness: 1.5, color: accent });

    // Both templates deliberately share the original form's grid. Only their
    // restrained color treatment differs.
    sectionBand("VENDOR INFORMATION", 674);
    box(margin, 614, 300, 60, pale);
    box(332, 614, 248, 60, pale);
    fieldLabel("VENDOR", 38, 663);
    fieldValue(model.vendor.name, 38, 649, 284, 8.5, bold);
    drawWrapped(model.vendor.address, 38, 636, 284, 7, 3);
    fieldLabel("CONTACT", 338, 663);
    drawWrapped(model.vendor.contact, 338, 649, 234, 7, 4);

    sectionBand("PROJECT INFORMATION", 594);
    box(margin, 530, 168, 64, pale);
    box(200, 530, 132, 64, pale);
    box(332, 530, 248, 64, pale);
    fieldLabel(model.job.kind === "linked" ? "JOB REFERENCE" : "PURCHASE TYPE", 38, 583);
    fieldValue(model.job.kind === "linked" ? model.job.name : "Stock Purchase", 38, 568, 152, 8, bold);
    fieldLabel("PAYMENT TERMS", 38, 548);
    fieldValue(model.paymentTerms, 116, 548, 74, 7);
    fieldLabel("JOB NUMBER", 206, 583);
    fieldValue(model.job.kind === "linked" ? model.job.number : "-", 206, 568, 116, 8, bold);
    fieldLabel("DATE REQUESTED", 206, 548);
    fieldValue(model.requestedDate, 270, 548, 52, 7);
    fieldLabel("SHIP TO", 338, 583);
    drawWrapped(model.shipTo || "-", 338, 568, 234, 7, 4);

    page.drawRectangle({ x: margin, y: 502, width: 548, height: 28, color: accent, borderColor: lineColor, borderWidth: 0.6 });
    columns.forEach((column) => {
      const labels = wrap(bold, column.label, 5.2, column.width - 8, 2);
      labels.forEach((line, index) => drawText(line, column.x + 4, 519 - index * 7, 5.2, bold, accentText));
    });

    let rowTop = 502;
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
      drawWrapped(model.vendorNotes, 40, 146, 325, 8, 5);
      box(382, 94, 198, 112, pale);
      const totals = [
        ["Subtotal", model.totals.subtotal],
        [`Discount${model.totals.discountPercent ? ` @ ${model.totals.discountPercent}%` : ""}`, model.totals.discount],
        [`Sales Tax${model.totals.taxPercent ? ` @ ${model.totals.taxPercent}%` : ""}`, model.totals.tax],
        ["Freight", model.totals.freight],
        ["GRAND TOTAL", model.totals.grandTotal],
      ];
      totals.forEach(([label, amount], index) => {
        const y = 189 - index * 20;
        drawText(label, 392, y, index === 4 ? 9 : 8, index === 4 ? bold : regular);
        drawText(amount, 510, y, index === 4 ? 9 : 8, index === 4 ? bold : regular);
      });
      drawText("AUTHORIZED BY", 40, 78, 7, bold, slate);
      drawText(model.authorizedBy || "-", 40, 62, 8);
      page.drawLine({ start: { x: 38, y: 55 }, end: { x: 270, y: 55 }, thickness: 0.6, color: slate });
    }

    drawText(`Generated ${generationLabel}`, margin, 22, 6, regular, slate);
    drawText(`${model.templateName} v${model.templateVersion} | ${model.documentVersion}`, 218, 22, 6, regular, slate);
    drawText(`Page ${pageIndex + 1} of ${renderPages.length}`, 520, 22, 6, regular, slate);
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
