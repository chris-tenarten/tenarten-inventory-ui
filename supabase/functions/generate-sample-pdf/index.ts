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
import { chunkPdfLines, wrapMeasuredPdfText } from "../_shared/pdf-layout.mjs";

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
  const wrap = (value: unknown, width: number, size = 8.3, font = bold) =>
    wrapMeasuredPdfText(normalizePdfText(value), width, size, (candidate, fontSize) => font.widthOfTextAtSize(candidate, fontSize));
  const metadataRows = [
    [["Project Name",model.projectName],["Requested By",model.requestedBy]],
    [["Customer Name",model.customerName],["Date Requested",model.requestedDate]],
    [["Color Plate #",model.colorPlateNumber],["Prepared By",model.preparedBy]],
    [["Sample Size",model.sampleSize],["Sample Quantity",model.sampleQuantity],["Job #",model.jobNumber],["Approved Date",model.approvedDate]],
    [["Finish Requested",model.finishRequested]],
    ...(model.formulationSummary?[[["Formulation",model.formulationSummary]]]:[]),
  ].map((fields) => ({ fields:fields.map(([label,value])=>({label,value,lines:wrap(value,fields.length===4?112:fields.length===1?524:242)})) }))
    .map((row)=>({...row,height:Math.max(23,18+Math.max(...row.fields.map((field)=>field.lines.length))*9)}));
  const notesLines = wrap(model.notes,520,8,bold);
  const notesHeight = Math.max(35,18+notesLines.length*10);
  const materialRows = [
    [["Filler",model.filler],["Sealer",model.sealer]],
    [["Resin Supplier",model.resinSupplier],["Resin Color and #",model.resinColorNumber]],
  ].map((fields)=>({fields:fields.map(([label,value])=>({label,value,lines:wrap(value,242)}))}))
    .map((row)=>({...row,height:Math.max(27,18+Math.max(...row.fields.map((field)=>field.lines.length))*9)}));
  const metadataHeight = metadataRows.reduce((sum,row)=>sum+row.height+5,0)+notesHeight+7+materialRows.reduce((sum,row)=>sum+row.height+5,0);
  const firstHeadingY = 726-metadataHeight-30;
  const metadataOnlyFirstPage = firstHeadingY < 190;
  const rowPages = paginateSampleRows(model.rows,metadataOnlyFirstPage?510:Math.max(40,firstHeadingY-150),510);
  const basePages = metadataOnlyFirstPage
    ? [{rows:[],continuation:false,metadataOnly:true},...rowPages.map((page)=>({...page,continuation:true}))]
    : rowPages;
  const lastBase = basePages.at(-1)!;
  const lastHeadingY = lastBase.continuation ? 692 : firstHeadingY;
  const lastRowsBottom = lastHeadingY-64-lastBase.rows.reduce((sum,row)=>sum+sampleRowHeight(row),0);
  const firstMoreCapacity = Math.max(0,Math.floor((Math.max(88,lastRowsBottom-14)-68)/10));
  const moreNoteLines = wrap(model.moreNotes,520,8,bold);
  const firstMoreLines = moreNoteLines.slice(0,firstMoreCapacity);
  const overflowMoreLines = moreNoteLines.slice(firstMoreCapacity);
  const moreNoteChunks = overflowMoreLines.length ? chunkPdfLines(overflowMoreLines,52) : [];
  const pages = [
    ...basePages,
    ...moreNoteChunks.map((lines)=>({rows:[],continuation:true,noteContinuation:true,noteLines:lines})),
  ].map((page,index,all)=>({...page,pageNumber:index+1,pageCount:all.length}));

  for (const layout of pages) {
    const page = pdf.addPage([612, 792]);
    page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: white });
    const text = (value: string, x: number, y: number, size = 8, font = regular, color = navy) =>
      page.drawText(normalizePdfText(value), { x, y, size, font, color });
    const rect = (x: number, y: number, width: number, height: number, fill = white) =>
      page.drawRectangle({ x, y, width, height, borderColor: line, borderWidth: 0.7, color: fill });
    const tableRect = (x: number, y: number, width: number, height: number, fill = white) =>
      page.drawRectangle({ x, y, width, height, borderColor: navy, borderWidth: 1, color: fill });
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

    if (layout.noteContinuation) {
      text("SAMPLE NOTES - CONTINUED",40,700,9,bold,blue);
      rect(40,70,532,612,pale);
      layout.noteLines.forEach((part,index)=>text(part,46,662-index*11,8,bold,navy));
      text(model.issueNumber ? `ISSUED FORM - ISSUE ${model.issueNumber}` : model.renderContext === "working" ? "WORKING SAMPLE - NOT ISSUED" : "DRAFT PREVIEW", 40, 22, 6, bold, model.issueNumber ? blue : gray);
      text(SAMPLE_PDF_VERSION, 450, 22, 5.5, regular, gray);
      continue;
    }

    if (!layout.continuation) {
      let cursorTop=726;
      const drawMetadataRow=(row:{fields:Array<{label:string;lines:string[]}>;height:number})=>{
        const count=row.fields.length;const gap=count===1?0:count===2?32:10;const width=(532-gap*(count-1))/count;const bottom=cursorTop-row.height;
        row.fields.forEach((field,index)=>{const x=40+index*(width+gap);text(field.label.toUpperCase(),x,cursorTop-8,6.5,bold,gray);rect(x,bottom,width,row.height-14);field.lines.forEach((part,lineIndex)=>text(part,x+4,cursorTop-24-lineIndex*9,8.3,bold,navy));});
        cursorTop=bottom-5;
      };
      metadataRows.forEach(drawMetadataRow);
      text("NOTES",40,cursorTop-8,7,bold,gray);const notesBottom=cursorTop-notesHeight;rect(40,notesBottom,532,notesHeight-14,pale);notesLines.forEach((part,index)=>text(part,46,cursorTop-24-index*10,8,bold,navy));cursorTop=notesBottom-7;
      materialRows.forEach(drawMetadataRow);
    }

    if (layout.metadataOnly) {
      text(model.issueNumber ? `ISSUED FORM - ISSUE ${model.issueNumber}` : model.renderContext === "working" ? "WORKING SAMPLE - NOT ISSUED" : "DRAFT PREVIEW", 40, 22, 6, bold, model.issueNumber ? blue : gray);
      text(SAMPLE_PDF_VERSION, 450, 22, 5.5, regular, gray);
      continue;
    }

    const headingY = layout.continuation ? 692 : firstHeadingY;
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

    if (layout.pageNumber === basePages.length) {
      const noteTop = Math.max(88, y - 14);
      text("MORE NOTES", 40, noteTop, 7, bold, gray);
      rect(40, 40, 532, noteTop - 56, pale);
      firstMoreLines.forEach((part, index) => text(part, 46, noteTop - 28 - index * 10, 8, bold, navy));
    }
    text(model.issueNumber ? `ISSUED FORM - ISSUE ${model.issueNumber}` : model.renderContext === "working" ? "WORKING SAMPLE - NOT ISSUED" : "DRAFT PREVIEW", 40, 22, 6, bold, model.issueNumber ? blue : gray);
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
    if (action === "delete") {
      const sampleId = String(body.sampleId || "");
      if (!/^[0-9a-f-]{36}$/i.test(sampleId)) return json({ error: "Invalid Sample deletion request." }, 400, headers);
      const { data: ownedObjects, error: prepareError } = await user.rpc("prepare_admin_delete_sample", { p_sample_id: sampleId });
      if (prepareError) return json({ error: prepareError.message }, prepareError.code === "42501" ? 403 : 409, headers);
      const service = createClient(url, serviceKey);
      const objects = (ownedObjects || []) as Array<{ storage_bucket: string; storage_path: string }>;
      const grouped = new Map<string, string[]>();
      for (const item of objects) grouped.set(item.storage_bucket, [...(grouped.get(item.storage_bucket) || []), item.storage_path]);
      for (const [bucket, paths] of grouped) {
        if (!paths.length) continue;
        const removed = await service.storage.from(bucket).remove(paths);
        if (removed.error) return json({ error: "Sample PDF cleanup failed; the Sample records were not deleted." }, 500, headers);
      }
      if (objects.length) {
        const cleared = await service.from("sample_issued_documents").update({ storage_path: "" }).eq("sample_id", sampleId);
        if (cleared.error) return json({ error: "Stored Sample PDFs were removed, but issued records remain. Contact an administrator before retrying." }, 500, headers);
      }
      const { error: deleteError } = await user.rpc("admin_permanently_delete_sample", { p_sample_id: sampleId, p_confirmation: "PERMANENTLY_DELETE_ISSUED_SAMPLE" });
      if (deleteError) return json({ error: `Stored PDFs were cleaned up, but Sample record deletion failed: ${deleteError.message}` }, 500, headers);
      return json({ deleted: true }, 200, headers);
    }
    if (action === "preview") {
      const bytes = await renderSampleWorkOrder(body.snapshot);
      return new Response(bytes, { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=\"Sample-Work-Order-Preview.pdf\"" } });
    }
    if (action === "working") {
      const sampleId = String(body.sampleId || "");
      const versionId = body.versionId ? String(body.versionId) : null;
      if (!/^[0-9a-f-]{36}$/i.test(sampleId) || (versionId && !/^[0-9a-f-]{36}$/i.test(versionId))) return json({ error: "Invalid Sample working document request." }, 400, headers);
      const { data: snapshot, error: snapshotError } = await user.rpc("get_sample_working_pdf_snapshot", { p_sample_id: sampleId, p_version_id: versionId });
      if (snapshotError || !snapshot) return json({ error: snapshotError?.message || "Working Sample was not found." }, 404, headers);
      const bytes = await renderSampleWorkOrder(snapshot);
      return new Response(bytes, { headers: { ...headers, "Content-Type": "application/pdf", "Cache-Control": "no-store", "Content-Disposition": "inline; filename=\"Working-Sample-Work-Order.pdf\"" } });
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
