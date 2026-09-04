// @ts-nocheck -- Deno Edge Function; validated through its local renderer fixture.
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  buildSamplePdfModel,
  paginateSampleRows,
  SAMPLE_PDF_VERSION,
  sampleRowHeight,
  wrapSampleText,
} from "../_shared/sample-work-order-pdf-model.mjs";
import { normalizePdfText } from "../_shared/pdf-text.mjs";

const allowedOrigins = new Set([
  "https://tenops.pages.dev",
  "https://tendev.pages.dev",
  "http://localhost:3000",
]);
const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://tenops.pages.dev",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});
const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
export async function renderSampleWorkOrder(snapshot: Record<string, unknown>) {
  const model = buildSamplePdfModel(snapshot);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Sample Work Order ${model.colorPlateNumber || ""}`.trim());
  pdf.setAuthor("Tenarten Terrazzo");
  pdf.setProducer(`TenOps ${SAMPLE_PDF_VERSION}`);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.05, 0.12, 0.22);
  const blue = rgb(0.08, 0.28, 0.48);
  const gray = rgb(0.35, 0.39, 0.44);
  const line = rgb(0.62, 0.66, 0.71);
  const pale = rgb(0.94, 0.96, 0.98);
  const white = rgb(1, 1, 1);
  const columns = [
    { label: "%", width: 38, characters: 4 },
    { label: "COLOR", width: 146, characters: 18 },
    { label: "SIZE", width: 58, characters: 6 },
    { label: "TYPE", width: 72, characters: 8 },
    { label: "QTY", width: 46, characters: 5 },
    { label: "UNIT", width: 52, characters: 6 },
    { label: "VENDOR", width: 120, characters: 15 },
  ];
  const pages = paginateSampleRows(model.rows);

  for (const layout of pages) {
    const page = pdf.addPage([612, 792]);
    page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: white });
    const text = (value: string, x: number, y: number, size = 8, font = regular, color = navy) =>
      page.drawText(normalizePdfText(value), { x, y, size, font, color });
    const rect = (x: number, y: number, width: number, height: number, fill = white) =>
      page.drawRectangle({ x, y, width, height, borderColor: line, borderWidth: 0.7, color: fill });
    const tableRect = (x: number, y: number, width: number, height: number, fill = white) =>
      page.drawRectangle({ x, y, width, height, borderColor: navy, borderWidth: 1, color: fill });
    const fittedText = (value: string, x: number, y: number, width: number, startSize = 8.3) => {
      let size = startSize;
      while (size > 6.5 && bold.widthOfTextAtSize(value, size) > width) size -= 0.2;
      text(value, x, y, size, bold, navy);
    };
    const field = (label: string, value: string, x: number, y: number, width: number) => {
      text(label.toUpperCase(), x, y + 15.5, 6.5, bold, gray);
      rect(x, y, width, 14);
      fittedText(value, x + 4, y + 3.3, width - 8);
    };
    const centeredText = (value: string, x: number, y: number, width: number, height: number, size: number, font = bold, color = navy) => {
      const textWidth = font.widthOfTextAtSize(value, size);
      const textHeight = font.heightAtSize(size, { descender: true });
      text(value, x + Math.max(0, (width - textWidth) / 2), y + (height - textHeight) / 2 + 1.5, size, font, color);
    };

    page.drawRectangle({ x: 28, y: 735, width: 556, height: 34, color: navy });
    text("TENARTEN TERRAZZO", 40, 750, 16, bold, white);
    text("SAMPLE WORK ORDER", 404, 751, 10, bold, white);
    text(layout.continuation ? "CHIP BLEND CONTINUATION" : "FORMULATION + SAMPLE DEVELOPMENT", 405, 741, 5.8, regular, white);
    text(`Page ${layout.pageNumber} of ${layout.pageCount}`, 535, 776, 6, regular, gray);

    if (!layout.continuation) {
      field("Project Name", model.projectName, 40, 704, 250);
      field("Requested By", model.requestedBy, 322, 704, 250);
      field("Customer Name", model.customerName, 40, 681, 250);
      field("Date Requested", model.requestedDate, 322, 681, 250);
      field("Color Plate #", model.colorPlateNumber, 40, 658, 250);
      field("Prepared By", model.preparedBy, 322, 658, 250);
      field("Sample Size", model.sampleSize, 40, 635, 120);
      field("Sample Quantity", model.sampleQuantity, 170, 635, 120);
      field("Job #", model.jobNumber, 322, 635, 120);
      field("Approved Date", model.approvedDate, 452, 635, 120);
      field("Finish Requested", model.finishRequested, 322, 612, 250);

      text("NOTES", 40, 600, 7, bold, gray);
      rect(40, 570, 532, 25, pale);
      wrapSampleText(model.notes, 100).slice(0, 2).forEach((part, index) => text(part, 46, 582 - index * 10, 8, bold, navy));
      field("Filler", model.filler, 40, 548, 250);
      field("Sealer", model.sealer, 322, 548, 250);
      field("Resin Supplier", model.resinSupplier, 40, 521, 250);
      field("Resin Color and #", model.resinColorNumber, 322, 521, 250);
    }

    const headingY = layout.continuation ? 692 : 478;
    const headingHeight = 30;
    page.drawRectangle({ x: 40, y: headingY, width: 532, height: headingHeight, borderColor: navy, borderWidth: 1.1, color: pale });
    centeredText(layout.continuation ? "CHIP BLEND - CONTINUATION" : "CHIP BLEND", 40, headingY, 532, headingHeight, 12, bold, blue);
    const headerY = headingY - 36;
    const headerHeight = 28;
    let x = 40;
    for (const column of columns) {
      tableRect(x, headerY, column.width, headerHeight, pale);
      centeredText(column.label, x, headerY, column.width, headerHeight, 9, bold, navy);
      x += column.width;
    }

    let y = headerY;
    for (const row of layout.rows) {
      const height = sampleRowHeight(row);
      y -= height;
      x = 40;
      const values = [row.percentage, row.color, row.size, row.materialType, row.quantity, row.unit, row.vendor];
      columns.forEach((column, index) => {
        tableRect(x, y, column.width, height);
        const lines = wrapSampleText(values[index], column.characters);
        lines.forEach((part, lineIndex) =>
          text(part, x + 6, y + height - 15 - lineIndex * 11, 9.3, bold, navy));
        x += column.width;
      });
    }

    if (!layout.rows.length) {
      y -= 36;
      x = 40;
      for (const column of columns) {
        tableRect(x, y, column.width, 36);
        x += column.width;
      }
    }

    if (layout.pageNumber === layout.pageCount) {
      const noteTop = Math.max(88, y - 14);
      text("MORE NOTES", 40, noteTop, 7, bold, gray);
      rect(40, 40, 532, noteTop - 56, pale);
      wrapSampleText(model.moreNotes, 100)
        .slice(0, Math.max(1, Math.floor((noteTop - 68) / 10)))
        .forEach((part, index) => text(part, 46, noteTop - 28 - index * 10, 8, bold, navy));
    }
    text(model.issueNumber ? `ISSUED FORM - ISSUE ${model.issueNumber}` : "DRAFT PREVIEW", 40, 22, 6, bold, model.issueNumber ? blue : gray);
    text(SAMPLE_PDF_VERSION, 450, 22, 5.5, regular, gray);
  }
  return new Uint8Array(await pdf.save());
}

if (typeof Deno !== "undefined") Deno.serve(async (req) => {
  const headers = cors(req.headers.get("origin") || "");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    const authorization = req.headers.get("authorization") || "";
    if (!authorization) return json({ error: "Authentication required." }, 401, headers);
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const user = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: allowed, error: accessError } = await user.rpc("has_app_capability", { p_capability: "readOperationalData" });
    if (accessError || allowed !== true) return json({ error: "Sample access denied." }, 403, headers);
    const body = await req.json();
    const action = String(body.action || "");
    if (action === "preview") {
      const bytes = await renderSampleWorkOrder(body.snapshot);
      return new Response(bytes, { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=\"Sample-Work-Order-Preview.pdf\"" } });
    }
    const documentId = String(body.documentId || "");
    if (!/^[0-9a-f-]{36}$/i.test(documentId)) return json({ error: "Invalid Sample document." }, 400, headers);
    const service = createClient(url, serviceKey);
    const { data: document, error } = await service
      .from("sample_issued_documents")
      .select("id,sample_id,issue_number,issued_snapshot,storage_bucket,storage_path,generation_status")
      .eq("id", documentId)
      .single();
    if (error || !document) return json({ error: "Issued Sample Form not found." }, 404, headers);
    const path = `${document.sample_id}/${document.id}.pdf`;
    if (action === "generate") {
      await service.from("sample_issued_documents").update({ generation_status: "generating", last_error: null }).eq("id", documentId);
      try {
        const bytes = await renderSampleWorkOrder(document.issued_snapshot);
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
          .map((part) => part.toString(16).padStart(2, "0"))
          .join("");
        const upload = await service.storage.from("sample-documents").upload(path, bytes, { contentType: "application/pdf", upsert: true });
        if (upload.error) throw upload.error;
        const updated = await service
          .from("sample_issued_documents")
          .update({ generation_status: "generated", storage_path: path, snapshot_hash: hash, generated_at: new Date().toISOString(), last_error: null })
          .eq("id", documentId);
        if (updated.error) throw updated.error;
      } catch (cause) {
        await service
          .from("sample_issued_documents")
          .update({ generation_status: "failed", last_error: cause instanceof Error ? cause.message : "PDF generation failed." })
          .eq("id", documentId);
        throw cause;
      }
    }
    const signed = await service.storage.from("sample-documents").createSignedUrl(path, 3600);
    if (signed.error) return json({ error: "Sample PDF is unavailable." }, 404, headers);
    return json({ url: signed.data.signedUrl }, 200, headers);
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : "Sample PDF request failed." }, 500, headers);
  }
});
