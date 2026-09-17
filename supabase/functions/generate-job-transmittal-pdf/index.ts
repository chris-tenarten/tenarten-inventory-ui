import { createClient } from "npm:@supabase/supabase-js@2.101.1";
import { degrees, PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import {
  buildJobTransmittalPdfModel,
  JOB_TRANSMITTAL_PDF_VERSION,
} from "../_shared/job-transmittal-pdf-model.mjs";
import { EdgeAuthorizationError, requireEdgeCapability } from "../_shared/rbac.ts";
import { chunkPdfLines, wrapMeasuredPdfText } from "../_shared/pdf-layout.mjs";
import { normalizePdfText } from "../_shared/pdf-text.mjs";

const allowedOrigins = (Deno.env.get("TENOPS_ALLOWED_ORIGINS") || "http://localhost:3000")
  .split(",").map((value) => value.trim()).filter(Boolean);
const corsFor = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
});
const json = (body: unknown, status = 200, cors: Record<string,string> = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});
const safe = (value: unknown) => normalizePdfText(value);
const filename = (value: string) => `${value.replace(/[^A-Za-z0-9._-]+/g, "-") || "transmittal"}.pdf`;
const digest = async (bytes: Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((value) => value.toString(16).padStart(2, "0")).join("");
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const hasExactKeys = (value: Record<string, unknown>, keys: string[]) => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};
const draftSnapshotKeys = [
  "cc", "comments", "customer", "delivery", "document_date", "document_version",
  "items", "job_id", "job_name", "job_number", "purpose", "recipient", "sender",
  "template_version", "transmittal_number", "transmitted_types",
];
const validDraftSnapshot = (snapshot: Record<string, unknown>) => {
  if (!hasExactKeys(snapshot,draftSnapshotKeys)
    || typeof snapshot.document_date !== "string"
    || (snapshot.document_date !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.document_date))
    || !isObject(snapshot.recipient)
    || typeof snapshot.recipient.address_line_1 !== "string"
    || snapshot.recipient.address_line_1.length > 200
    || typeof snapshot.recipient.address_line_2 !== "string"
    || snapshot.recipient.address_line_2.length > 200
    || !isObject(snapshot.sender)
    || typeof snapshot.sender.name !== "string"
    || snapshot.sender.name.length > 120
    || typeof snapshot.customer !== "string"
    || snapshot.customer.length > 200
    || !Array.isArray(snapshot.items)
    || snapshot.items.length > 100
    || typeof snapshot.comments !== "string"
    || snapshot.comments.length > 30_000) return false;
  return snapshot.items.every((item) =>
    isObject(item)
    && Object.values(item).every((value) =>
      typeof value === "string" || typeof value === "number"
    )
    && String(item.description ?? "").length <= 12_000
  );
};

async function render(snapshot: Record<string, unknown>, logoUrl: string, draft: boolean) {
  const model = buildJobTransmittalPdfModel(snapshot, {
    allowEmptyItems: draft,
    allowBlankTransmittalNumber: draft,
  });
  const pdf = await PDFDocument.create();
  const now = new Date();
  pdf.setTitle(`Letter of Transmittal ${model.transmittalNumber}`);
  pdf.setAuthor("Tenarten Terrazzo");
  pdf.setSubject(`Letter of Transmittal for ${model.job.name}`);
  pdf.setProducer(`TenOps ${JOB_TRANSMITTAL_PDF_VERSION}`);
  pdf.setCreationDate(now);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let logo: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
  if (logoUrl) {
    try {
      const logoResponse = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) });
      if (logoResponse.ok) {
        const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
        logo = (logoResponse.headers.get("content-type") || "").includes("jpeg")
          ? await pdf.embedJpg(logoBytes) : await pdf.embedPng(logoBytes);
      }
    } catch {
      logo = null;
    }
  }
  const navy = rgb(0.09, 0.21, 0.36);
  const gold = rgb(0.79, 0.64, 0.15);
  const ink = rgb(0.08, 0.12, 0.19);
  const muted = rgb(0.35, 0.41, 0.50);
  const pale = rgb(0.90, 0.92, 0.95);
  const border = rgb(0.56, 0.63, 0.71);
  const pageWidth = 612, pageHeight = 792, margin = 32, contentWidth = 548;
  const wrap = (value: unknown, size: number, width: number) =>
    wrapMeasuredPdfText(safe(value), width, size, (candidate, fontSize) => regular.widthOfTextAtSize(candidate, fontSize));
  const columns = [
    {x:32,w:112,label:"Submittal",key:"submittal"},{x:144,w:58,label:"Quantity",key:"quantity"},{x:202,w:72,label:"Date",key:"date"},
    {x:274,w:82,label:"Number",key:"number"},{x:356,w:224,label:"Description",key:"description"},
  ] as const;
  const recipientCompanyLines = wrap(model.recipient.company || "-", 7.5, 210);
  const recipientAddressLines = wrap([model.recipient.addressLine1,model.recipient.addressLine2].filter(Boolean).join("\n") || "-", 7, 210);
  const recipientAttentionLines = wrap(model.recipient.attention || "-", 7, 210);
  const recipientContactLines = wrap([model.recipient.officePhone,model.recipient.mobilePhone,model.recipient.email].filter(Boolean).join(" | ") || "-", 6.4, 210);
  const projectNameLines = wrap(model.job.name || "-", 7.2, 170);
  const customerLines = wrap(model.job.customer || "-", 7.2, 170);
  const jobNumberLines = wrap(model.job.number || "-", 7.5, 170);
  const transmittalNumberLines = wrap(model.transmittalNumber || "-", 8, 170);
  const ccLines = wrap(model.cc || "-", 6.8, 170);
  const recipientHeight = Math.max(95, 28 + recipientCompanyLines.length * 9.5 + recipientAddressLines.length * 9 + recipientAttentionLines.length * 9 + recipientContactLines.length * 8.5);
  const projectHeight = Math.max(95, 24 + (projectNameLines.length + customerLines.length + jobNumberLines.length + transmittalNumberLines.length + ccLines.length) * 9);
  const informationHeight = Math.max(recipientHeight, projectHeight);
  const informationBottom = 669 - informationHeight;
  const transmittedBandY = informationBottom - 13;
  const separateCoverLineCount = wrap(`Under Separate Cover Via ${model.delivery.via}`, 7.2, 366).length;
  const otherTypeLineCount = wrap(`Other ${model.types.otherLabel}`, 7.2, 201).length;
  const deliveryRowHeight = Math.max(23, separateCoverLineCount * 9 + 9);
  const typeRowHeight = Math.max(23, otherTypeLineCount * 9 + 9);
  const transmittedHeight = deliveryRowHeight + typeRowHeight + 7;
  const transmittedBottom = transmittedBandY - transmittedHeight;
  const firstTableTop = transmittedBottom - 16;
  const firstTableCapacity = Math.max(42, firstTableTop - 250);
  // The identity is rendered bold; keep a conservative measure because the local
  // wrapping helper measures with the regular face.
  const continuationIdentityLines = wrap(`Transmittal ${model.transmittalNumber} | Job ${model.job.number} | ${model.job.name} | ${model.documentDate}`, 7, contentWidth - 36);
  const continuationTableTop = 665 - Math.max(0, continuationIdentityLines.length - 1) * 9;
  const continuationCapacity = continuationTableTop - 90;
  const rowLineHeight = 9;
  const maxFragmentLines = Math.max(1, Math.floor((continuationCapacity - 8) / rowLineHeight));
  const laidOutItems = model.pages.flat().flatMap((item) => {
    const cells = columns.map((column) => wrap(item[column.key], column.key === "description" ? 7 : 6.8, column.w - 12));
    const lineCount = Math.max(1, ...cells.map((cell) => cell.length));
    const fragments = [];
    for (let offset = 0; offset < lineCount; offset += maxFragmentLines) {
      const fragmentCells = cells.map((cell) => cell.slice(offset, offset + maxFragmentLines));
      const fragmentLineCount = Math.max(1, ...fragmentCells.map((cell) => cell.length));
      fragments.push({ item, cells:fragmentCells, height:Math.max(42, 16 + fragmentLineCount * rowLineHeight) });
    }
    return fragments;
  });
  const itemPages: typeof laidOutItems[] = [[]];
  for (const item of laidOutItems) {
    let page = itemPages.at(-1)!;
    const capacity = itemPages.length === 1 ? firstTableCapacity : continuationCapacity;
    if (page.reduce((sum,current)=>sum+current.height,0)+item.height>capacity) {
      page=[];
      itemPages.push(page);
    }
    page.push(item);
  }
  const senderLines = [model.sender.name,model.sender.phone,model.sender.email].flatMap((value)=>wrap(value,7,160));
  const commentBoxHeight = Math.min(120,Math.max(72,25+senderLines.length*10));
  const firstCommentCapacity = Math.max(1,Math.floor((commentBoxHeight-20)/9.5));
  const commentLines = wrap(model.comments || "-", 7.5, 336);
  const firstCommentLines = commentLines.slice(0,firstCommentCapacity);
  const overflowCommentLines = commentLines.slice(firstCommentCapacity);
  const commentChunks = overflowCommentLines.length ? chunkPdfLines(overflowCommentLines,52) : [];
  const totalPages = itemPages.length + commentChunks.length;
  itemPages.forEach((items, pageIndex) => {
    const page = pdf.addPage([pageWidth, pageHeight]);
    const t = (value: unknown, x: number, y: number, size = 7.5, font = regular, color = ink) =>
      page.drawText(safe(value), { x, y, size, font, color });
    const wrapped = (value: unknown, x: number, y: number, width: number, size = 7.5, _max = Number.POSITIVE_INFINITY, font = regular, color = ink) =>
      wrap(value, size, width).forEach((line, index) => page.drawText(line, { x, y: y - index * (size + 2), size, font, color }));
    const rect = (x: number, y: number, width: number, height: number, fill = rgb(1, 1, 1), stroke = border) =>
      page.drawRectangle({ x, y, width, height, color: fill, borderColor: stroke, borderWidth: 0.65 });
    const checkbox = (checked: boolean, label: string, x: number, y: number) => {
      page.drawRectangle({ x, y, width: 9, height: 9, color: checked ? navy : rgb(1,1,1), borderColor: checked ? navy : border, borderWidth: 0.8 });
      if (checked) {
        page.drawLine({ start:{x:x+2,y:y+4},end:{x:x+4,y:y+2},thickness:1.2,color:rgb(1,1,1) });
        page.drawLine({ start:{x:x+4,y:y+2},end:{x:x+8,y:y+8},thickness:1.2,color:rgb(1,1,1) });
      }
      wrap(label,7.2,Math.max(30,580-x-14)).forEach((line,index)=>t(line,x+14,y+1-index*9,7.2));
    };
    const band = (label: string, y: number, dark = false) => {
      page.drawRectangle({ x: margin, y, width: contentWidth, height: 17, color: dark ? navy : pale, borderColor: navy, borderWidth: 0.65 });
      t(label, margin + 9, y + 5, 7.5, bold, dark ? rgb(1,1,1) : navy);
    };

    if (logo) {
      const logoScale = Math.min(52 / logo.height, 58 / logo.width);
      page.drawImage(logo, { x: margin, y: 711, width: logo.width * logoScale, height: logo.height * logoScale });
    } else {
      page.drawRectangle({x:margin,y:716,width:45,height:45,borderColor:gold,borderWidth:1.5});
      t("T",48,729,22,bold,gold);
    }
    t("Tenarten Terrazzo", 104, 755, 15, bold, navy);
    t("PRECAST MANUFACTURING", 104, 741, 7, bold, gold);
    t("2933 Eisenhower St., Suite 120", 104, 727, 7);
    t("Carrollton, TX 75007", 104, 716, 7);
    t("www.precasttz.com", 104, 705, 7, regular, navy);
    t(pageIndex ? "LETTER OF TRANSMITTAL - CONTINUED" : "LETTER OF TRANSMITTAL", pageIndex ? 349 : 382, 744, pageIndex ? 11 : 15, bold, navy);
    page.drawLine({ start:{x:margin,y:696},end:{x:580,y:696},thickness:1.2,color:navy });
    page.drawLine({ start:{x:margin,y:693},end:{x:580,y:693},thickness:2.2,color:gold });
    if (pageIndex > 0) {
      continuationIdentityLines.forEach((line,index)=>t(line,margin,681-index*9,7,bold,navy));
    }

    if (pageIndex === 0) {
      band("RECIPIENT", 669); page.drawRectangle({ x:306, y:669, width:274, height:17, color:pale, borderColor:navy, borderWidth:.65 }); t("PROJECT INFORMATION", 315,674,7.5,bold,navy);
      rect(32, informationBottom, 274, informationHeight); rect(306, informationBottom, 274, informationHeight);
      let recipientY = 653;
      t("To", 42, recipientY, 6.5, bold, muted); recipientCompanyLines.forEach((line,index)=>t(line,84,recipientY-index*9.5,7.5,bold)); recipientY-=recipientCompanyLines.length*9.5+5;
      t("Address", 42, recipientY, 6.5, bold, muted); recipientAddressLines.forEach((line,index)=>t(line,84,recipientY-index*9,7)); recipientY-=recipientAddressLines.length*9+5;
      t("Attn", 42, recipientY, 6.5, bold, muted); recipientAttentionLines.forEach((line,index)=>t(line,84,recipientY-index*9,7)); recipientY-=recipientAttentionLines.length*9+5;
      t("Contact", 42, recipientY, 6.5, bold, muted); recipientContactLines.forEach((line,index)=>t(line,84,recipientY-index*8.5,6.4));
      let projectY = 657;
      const projectField = (label:string, lines:string[], size=7.2, font=regular) => { t(label,316,projectY,6.5,bold,muted); lines.forEach((line,index)=>t(line,400,projectY-index*9,size,font)); projectY-=Math.max(15,lines.length*9+5); };
      projectField("Date",wrap(model.documentDate || "-",7.5,170),7.5);
      projectField("Re / Project",projectNameLines);
      projectField("Customer",customerLines);
      projectField("Job #",jobNumberLines,7.5);
      projectField("Transmittal #",transmittalNumberLines,8,bold);
      projectField("CC",ccLines,6.8);
      band("TRANSMITTED ITEMS", transmittedBandY, true); rect(32, transmittedBottom, 548, transmittedHeight);
      t("Delivery", 42, transmittedBandY-19, 7, bold); checkbox(model.delivery.attached,"Attached",105,transmittedBandY-23); checkbox(model.delivery.separateCover,`Under Separate Cover Via ${model.delivery.via}`,200,transmittedBandY-23);
      const typeY = transmittedBandY-deliveryRowHeight-19;
      t("Item type", 42, typeY, 7, bold); checkbox(model.types.shopDrawing,"Shop Drawing",105,typeY-4); checkbox(model.types.letter,"Letter",210,typeY-4); checkbox(model.types.samples,"Samples",280,typeY-4); checkbox(model.types.other,`Other ${model.types.otherLabel}`,365,typeY-4);
    }

    const tableTop = pageIndex === 0 ? firstTableTop : continuationTableTop;
    const headerY = tableTop - 20;
    columns.forEach((column) => { rect(column.x, headerY, column.w, 20, pale); t(column.label,column.x+6,headerY+7,7,bold,navy); });
    let y = headerY;
    items.forEach((layout) => {
      y -= layout.height;
      columns.forEach((column,columnIndex) => {
        rect(column.x, y, column.w, layout.height);
        layout.cells[columnIndex].forEach((line,lineIndex)=>t(line,column.x+6,y+layout.height-14-lineIndex*rowLineHeight,column.key === "description" ? 7 : 6.8));
      });
    });

    if (pageIndex === 0) {
      const purposeY = Math.min(y - 26, 226);
      band("TRANSMITTAL PURPOSE", purposeY, false);
      rect(32, purposeY - 54, 548, 54);
      checkbox(model.purpose.approval,"For Approval",42,purposeY-20);
      checkbox(model.purpose.use,"For Your Use",145,purposeY-20);
      checkbox(model.purpose.record,"For Record Purpose",240,purposeY-20);
      checkbox(model.purpose.rfi,"Request for Information",375,purposeY-20);
      checkbox(model.purpose.review,`Review and Advise By ${model.purpose.reviewBy}`,42,purposeY-43);
      const commentsTop = purposeY - 60;
      const commentsY = commentsTop - commentBoxHeight;
      band("COMMENTS", commentsTop); rect(32, commentsY, 356, commentBoxHeight);
      firstCommentLines.forEach((line,index)=>t(line,42,commentsTop-16-index*9.5,7.5));
      page.drawRectangle({x:400,y:commentsTop,width:180,height:17,color:navy,borderColor:navy,borderWidth:.65});
      t("TRANSMITTED BY",409,commentsTop+5,7.5,bold,rgb(1,1,1)); rect(400,commentsY,180,commentBoxHeight);
      senderLines.forEach((line,index)=>t(line,410,commentsTop-17-index*10,index===0?8:7,index===0?bold:regular,index>1?navy:ink));
    }

    t("Tenarten Terrazzo · Precast Manufacturing · www.precasttz.com", margin, 20, 6.3, regular, muted);
    t(`Page ${pageIndex + 1} of ${totalPages}`, 535, 20, 6.3, regular, muted);
    if (draft) page.drawText("DRAFT PREVIEW", { x:140,y:380,size:43,font:bold,color:rgb(.72,.75,.8),rotate:degrees(32),opacity:.32 });
  });
  commentChunks.forEach((comment, commentIndex) => {
    const pageIndex = itemPages.length + commentIndex;
    const page = pdf.addPage([pageWidth,pageHeight]);
    const t = (value: unknown,x:number,y:number,size=7.5,font=regular,color=ink) =>
      page.drawText(safe(value),{x,y,size,font,color});
    t("Tenarten Terrazzo",margin,755,15,bold,navy);
    t("LETTER OF TRANSMITTAL - COMMENTS CONTINUED",300,748,11,bold,navy);
    page.drawLine({start:{x:margin,y:724},end:{x:580,y:724},thickness:1.2,color:navy});
    page.drawLine({start:{x:margin,y:721},end:{x:580,y:721},thickness:2.2,color:gold});
    t(`Transmittal ${model.transmittalNumber} | Job ${model.job.number} | ${model.job.name} | ${model.documentDate}`,margin,704,7,bold,navy);
    page.drawRectangle({x:margin,y:72,width:548,height:610,color:rgb(1,1,1),borderColor:border,borderWidth:.65});
    page.drawRectangle({x:margin,y:665,width:548,height:17,color:pale,borderColor:navy,borderWidth:.65});
    t("COMMENTS CONTINUED",margin+9,670,7.5,bold,navy);
    comment.forEach((line,index)=>t(line,margin+10,646-index*11,8));
    t("Tenarten Terrazzo · Precast Manufacturing · www.precasttz.com",margin,20,6.3,regular,muted);
    t(`Page ${pageIndex+1} of ${totalPages}`,535,20,6.3,regular,muted);
  });
  return new Uint8Array(await pdf.save({ useObjectStreams: false }));
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins.includes(origin)) {
    return json({ error:"Origin is not allowed." },403);
  }
  const cors = corsFor(origin);
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error:"Method not allowed." },405,cors);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const logoUrl = Deno.env.get("TENOPS_LOGO_URL");
  if (!url || !key) return json({ error:"Transmittal PDF service configuration is incomplete." },500,cors);
  const service = createClient(url,key,{auth:{persistSession:false}});
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 280_000) return json({error:"The request body is too large."},413,cors);
  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return json({error:"Unable to read the request body."},400,cors);
  }
  if (!rawBody || new TextEncoder().encode(rawBody).length > 280_000) {
    return json({error:rawBody ? "The request body is too large." : "A JSON request body is required."},rawBody ? 413 : 400,cors);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(rawBody); } catch { return json({error:"A valid JSON request body is required."},400,cors); }
  if (!isObject(parsed) || typeof parsed.action !== "string") {
    return json({error:"The request shape is invalid."},400,cors);
  }
  const body = parsed;
  try {
    await requireEdgeCapability(
      request,
      body.action === "generate" ? "issueTransmittal" : "previewOperationalDocuments",
    );
    if (body.action === "draft-preview") {
      if (!hasExactKeys(body,["action","snapshot"])
        || !isObject(body.snapshot)
        || !validDraftSnapshot(body.snapshot)) {
        return json({error:"Draft transmittal values are required."},400,cors);
      }
      const bytes = await render(body.snapshot,logoUrl || "",true);
      return new Response(bytes,{headers:{...cors,"Content-Type":"application/pdf","Cache-Control":"no-store"}});
    }
    if (!["preview","generate"].includes(body.action)) return json({error:"Unknown action."},400,cors);
    if (!hasExactKeys(body,["action","transmittalId"])
      || typeof body.transmittalId !== "string"
      || !uuidPattern.test(body.transmittalId)) {
      return json({error:"A valid transmittal ID is required."},400,cors);
    }
    if (body.action === "preview") {
      const {data:record,error} = await service.from("job_transmittals").select("id,document_status,storage_bucket,storage_path").eq("id",body.transmittalId).single();
      if (error || !record) return json({error:"The Letter of Transmittal was not found."},404,cors);
      if (record.document_status !== "generated" || !record.storage_path) {
        return json({error:"The permanent PDF is not available."},409,cors);
      }
      const {data:signed,error:signedError} = await service.storage.from(record.storage_bucket).createSignedUrl(record.storage_path,600);
      if (signedError) return json({error:"A temporary PDF link could not be created."},502,cors);
      return json({url:signed.signedUrl},200,cors);
    }
    const {data:claimData,error:claimError} = await service.rpc("claim_job_transmittal_pdf_generation",{
      p_transmittal_id:body.transmittalId,p_stale_after_seconds:900,
    });
    if (claimError) {
      const message = String(claimError.message || "");
      if (message.includes("GENERATION_ALREADY_ACTIVE")) return json({error:"PDF generation is already active."},409,cors);
      if (message.includes("TRANSMITTAL_NOT_FOUND")) return json({error:"The Letter of Transmittal was not found."},404,cors);
      throw claimError;
    }
    const claim = Array.isArray(claimData) ? claimData[0] : claimData;
    if (!claim) throw new Error("The PDF generation claim returned no data.");
    if (claim.document_status === "generated" && claim.storage_path) {
      const {data:signed,error:signedError} = await service.storage.from(claim.storage_bucket).createSignedUrl(claim.storage_path,600);
      if (signedError) return json({error:"The PDF is generated, but a download link could not be created."},502,cors);
      return json({status:"generated",url:signed.signedUrl},200,cors);
    }
    try {
      const bytes = await render(claim.snapshot,logoUrl || "",false);
      const documentHash = await digest(bytes);
      const path = `${body.transmittalId}/${filename(claim.transmittal_number)}`;
      const {error:uploadError} = await service.storage.from("job-transmittal-documents").upload(path,bytes,{contentType:"application/pdf",upsert:false});
      if (uploadError) {
        const {data:existing,error:downloadError} = await service.storage.from("job-transmittal-documents").download(path);
        if (downloadError || !existing) throw uploadError;
        const existingBytes = new Uint8Array(await existing.arrayBuffer());
        if (!existingBytes.length || await digest(existingBytes) !== documentHash) {
          throw new Error("An existing storage object does not match the immutable Transmittal snapshot.");
        }
      }
      const {data:completed,error:completeError} = await service.rpc("complete_job_transmittal_pdf_generation",{
        p_transmittal_id:body.transmittalId,p_claim_token:claim.claim_token,
        p_bucket:"job-transmittal-documents",p_path:path,p_document_hash:documentHash,
        p_size_bytes:bytes.length,p_content_type:"application/pdf",
      });
      if (completeError) throw completeError;
      if (!completed) throw new Error("The PDF generation claim is no longer active.");
      const {data:signed,error:signedError} = await service.storage.from("job-transmittal-documents").createSignedUrl(path,600);
      if (signedError) return json({status:"generated",error:"The PDF was generated, but a download link could not be created."},502,cors);
      return json({status:"generated",url:signed.signedUrl},200,cors);
    } catch (generationError) {
      await service.rpc("fail_job_transmittal_pdf_generation",{
        p_transmittal_id:body.transmittalId,p_claim_token:claim.claim_token,
        p_error:generationError instanceof Error ? generationError.message : "PDF generation failed.",
      });
      throw generationError;
    }
  } catch (error) {
    if (error instanceof EdgeAuthorizationError) return json({ error: error.message }, error.status, cors);
    console.error("Job Transmittal request failed", error);
    return json({error:"The transmittal request failed. Retry the operation or contact an administrator."},500,cors);
  }
});
