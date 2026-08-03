import { createClient } from "npm:@supabase/supabase-js@2.101.1";
import { degrees, PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import {
  buildJobTransmittalPdfModel,
  JOB_TRANSMITTAL_PDF_VERSION,
} from "../_shared/job-transmittal-pdf-model.mjs";

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
const safe = (value: unknown) => String(value ?? "")
  .replaceAll("—", "-").replaceAll("–", "-")
  .replace(/[^\x20-\x7e\u00a0-\u00ff\n]/g, "?");
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
  pdf.setAuthor("Tenarten Terrazzo Co.");
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
  const wrap = (value: unknown, size: number, width: number, max = 4) => {
    const lines: string[] = [];
    for (const paragraph of safe(value).split("\n")) {
      let current = "";
      const words = paragraph.split(/\s+/).filter(Boolean).flatMap((word) => {
        if (regular.widthOfTextAtSize(word,size) <= width) return [word];
        const pieces:string[] = [];
        let piece = "";
        for (const character of word) {
          if (piece && regular.widthOfTextAtSize(piece+character,size) > width) {
            pieces.push(piece); piece = character;
          } else piece += character;
        }
        if (piece) pieces.push(piece);
        return pieces;
      });
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (regular.widthOfTextAtSize(candidate, size) <= width) current = candidate;
        else { if (current) lines.push(current); current = word; }
        if (lines.length >= max) break;
      }
      if (current && lines.length < max) lines.push(current);
      if (lines.length >= max) break;
    }
    return lines;
  };

  const totalPages = model.pages.length + Math.max(0, model.commentPages.length - 1);
  model.pages.forEach((items, pageIndex) => {
    const page = pdf.addPage([pageWidth, pageHeight]);
    const t = (value: unknown, x: number, y: number, size = 7.5, font = regular, color = ink) =>
      page.drawText(safe(value), { x, y, size, font, color });
    const wrapped = (value: unknown, x: number, y: number, width: number, size = 7.5, max = 4, font = regular, color = ink) =>
      wrap(value, size, width, max).forEach((line, index) => page.drawText(line, { x, y: y - index * (size + 2), size, font, color }));
    const rect = (x: number, y: number, width: number, height: number, fill = rgb(1, 1, 1), stroke = border) =>
      page.drawRectangle({ x, y, width, height, color: fill, borderColor: stroke, borderWidth: 0.65 });
    const checkbox = (checked: boolean, label: string, x: number, y: number) => {
      page.drawRectangle({ x, y, width: 9, height: 9, color: checked ? navy : rgb(1,1,1), borderColor: checked ? navy : border, borderWidth: 0.8 });
      if (checked) {
        page.drawLine({ start:{x:x+2,y:y+4},end:{x:x+4,y:y+2},thickness:1.2,color:rgb(1,1,1) });
        page.drawLine({ start:{x:x+4,y:y+2},end:{x:x+8,y:y+8},thickness:1.2,color:rgb(1,1,1) });
      }
      t(label, x + 14, y + 1, 7.2);
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
    t("Tenarten Terrazzo Co.", 104, 755, 15, bold, navy);
    t("PRECAST MANUFACTURING", 104, 741, 7, bold, gold);
    t("2933 Eisenhower St., Suite 120", 104, 727, 7);
    t("Carrollton, TX 75007", 104, 716, 7);
    t("www.precasttz.com", 104, 705, 7, regular, navy);
    t(pageIndex ? "LETTER OF TRANSMITTAL - CONTINUED" : "LETTER OF TRANSMITTAL", pageIndex ? 349 : 382, 744, pageIndex ? 11 : 15, bold, navy);
    page.drawLine({ start:{x:margin,y:696},end:{x:580,y:696},thickness:1.2,color:navy });
    page.drawLine({ start:{x:margin,y:693},end:{x:580,y:693},thickness:2.2,color:gold });
    if (pageIndex > 0) {
      t(`Transmittal ${model.transmittalNumber} | Job ${model.job.number} | ${model.job.name} | ${model.documentDate}`,margin,681,7,bold,navy);
    }

    if (pageIndex === 0) {
      band("RECIPIENT", 669); page.drawRectangle({ x:306, y:669, width:274, height:17, color:pale, borderColor:navy, borderWidth:.65 }); t("PROJECT INFORMATION", 315,674,7.5,bold,navy);
      rect(32, 574, 274, 95); rect(306, 574, 274, 95);
      t("To", 42, 653, 6.5, bold, muted); wrapped(model.recipient.company,84,653,210,7.5,2,bold);
      t("Address", 42, 638, 6.5, bold, muted); wrapped([model.recipient.addressLine1,model.recipient.addressLine2].filter(Boolean).join("\n"),84,638,210,7,3);
      t("Attn", 42, 605, 6.5, bold, muted); wrapped(model.recipient.attention,84,605,210,7,1);
      t("Contact", 42, 590, 6.5, bold, muted); wrapped([model.recipient.officePhone,model.recipient.mobilePhone,model.recipient.email].filter(Boolean).join(" | "),84,590,210,6.4,1);
      t("Date", 316, 653, 6.5, bold, muted); t(model.documentDate, 400, 653, 7.5);
      t("Re / Project", 316, 638, 6.5, bold, muted); wrapped(model.job.name,400,638,170,7.2,2);
      t("Customer", 316, 623, 6.5, bold, muted); wrapped(model.job.customer,400,623,170,7.2,1);
      t("Job #", 316, 608, 6.5, bold, muted); t(model.job.number, 400, 608, 7.5);
      t("Transmittal #", 316, 593, 6.5, bold, muted); t(model.transmittalNumber, 400, 593, 8, bold);
      t("CC", 316, 578, 6.5, bold, muted); wrapped(model.cc,400,578,170,6.8,1);
      band("TRANSMITTED ITEMS", 561, true); rect(32, 508, 548, 53);
      t("Delivery", 42, 542, 7, bold); checkbox(model.delivery.attached,"Attached",105,538); checkbox(model.delivery.separateCover,`Under Separate Cover Via ${model.delivery.via}`,200,538);
      t("Item type", 42, 519, 7, bold); checkbox(model.types.shopDrawing,"Shop Drawing",105,515); checkbox(model.types.letter,"Letter",210,515); checkbox(model.types.samples,"Samples",280,515); checkbox(model.types.other,`Other ${model.types.otherLabel}`,365,515);
    }

    const tableTop = pageIndex === 0 ? 492 : 665;
    const headerY = tableTop - 20;
    const columns = [
      {x:32,w:112,label:"Submittal"},{x:144,w:58,label:"Quantity"},{x:202,w:72,label:"Date"},
      {x:274,w:82,label:"Number"},{x:356,w:224,label:"Description"},
    ];
    columns.forEach((column) => { rect(column.x, headerY, column.w, 20, pale); t(column.label,column.x+6,headerY+7,7,bold,navy); });
    let y = headerY - 42;
    items.forEach((item) => {
      columns.forEach((column) => rect(column.x, y, column.w, 42));
      t(item.submittal,38,y+27,7); t(item.quantity,150,y+27,7); t(item.date,208,y+27,7); t(item.number,280,y+27,7);
      wrapped(item.description,362,y+27,210,7,3);
      y -= 42;
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
      const commentsY = purposeY - 132;
      band("COMMENTS", commentsY + 72); rect(32, commentsY, 356, 72);
      wrapped(model.commentPages[0], 42, commentsY + 56, 336, 7.5, 8);
      page.drawRectangle({x:400,y:commentsY+72,width:180,height:17,color:navy,borderColor:navy,borderWidth:.65});
      t("TRANSMITTED BY",409,commentsY+77,7.5,bold,rgb(1,1,1)); rect(400,commentsY,180,72);
      t(model.sender.name,410,commentsY+53,8,bold); t(model.sender.phone,410,commentsY+36,7); t(model.sender.email,410,commentsY+20,7,regular,navy);
    }

    t("Tenarten Terrazzo Co. · Precast Manufacturing · www.precasttz.com", margin, 20, 6.3, regular, muted);
    t(`Page ${pageIndex + 1} of ${totalPages}`, 535, 20, 6.3, regular, muted);
    if (draft) page.drawText("DRAFT PREVIEW", { x:140,y:380,size:43,font:bold,color:rgb(.72,.75,.8),rotate:degrees(32),opacity:.32 });
  });
  model.commentPages.slice(1).forEach((comment, commentIndex) => {
    const pageIndex = model.pages.length + commentIndex;
    const page = pdf.addPage([pageWidth,pageHeight]);
    const t = (value: unknown,x:number,y:number,size=7.5,font=regular,color=ink) =>
      page.drawText(safe(value),{x,y,size,font,color});
    t("Tenarten Terrazzo Co.",margin,755,15,bold,navy);
    t("LETTER OF TRANSMITTAL - COMMENTS CONTINUED",300,748,11,bold,navy);
    page.drawLine({start:{x:margin,y:724},end:{x:580,y:724},thickness:1.2,color:navy});
    page.drawLine({start:{x:margin,y:721},end:{x:580,y:721},thickness:2.2,color:gold});
    t(`Transmittal ${model.transmittalNumber} | Job ${model.job.number} | ${model.job.name} | ${model.documentDate}`,margin,704,7,bold,navy);
    page.drawRectangle({x:margin,y:72,width:548,height:610,color:rgb(1,1,1),borderColor:border,borderWidth:.65});
    page.drawRectangle({x:margin,y:665,width:548,height:17,color:pale,borderColor:navy,borderWidth:.65});
    t("COMMENTS CONTINUED",margin+9,670,7.5,bold,navy);
    wrap(comment,8,526,60).forEach((line,index)=>t(line,margin+10,646-index*11,8));
    t("Tenarten Terrazzo Co. · Precast Manufacturing · www.precasttz.com",margin,20,6.3,regular,muted);
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
    console.error("Job Transmittal request failed", error);
    return json({error:"The transmittal request failed. Retry the operation or contact an administrator."},500,cors);
  }
});
