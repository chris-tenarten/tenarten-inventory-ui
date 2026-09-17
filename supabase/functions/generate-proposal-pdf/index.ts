import { createClient } from 'npm:@supabase/supabase-js@2.101.1';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import {
  buildProposalPdfModel,
  paginateProposalPdf,
  proposalPdfColumns,
  PROPOSAL_ESCALATION_NOTICE,
  PROPOSAL_LEAD_TIME_NOTICE,
  PROPOSAL_PDF_VERSION,
  wrapProposalText,
} from './proposal-pdf-model.ts';
import { tenartenLogo } from './tenarten-logo.ts';
import { normalizePdfText } from '../_shared/pdf-text.mjs';

const allowed = (Deno.env.get('TENOPS_ALLOWED_ORIGINS') || 'http://localhost:3000').split(',').map((entry) => entry.trim()).filter(Boolean);
const cors = (origin: string) => ({
  'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || 'http://localhost:3000',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  Vary: 'Origin',
});
const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
const safe = (input: unknown) => normalizePdfText(input);

export async function render(snapshot: Record<string, unknown>) {
  const model = buildProposalPdfModel(snapshot);
  const pdf = await PDFDocument.create();
  const logo = await pdf.embedPng(tenartenLogo);
  pdf.setTitle(`Estimate ${model.estimateNumber}`);
  pdf.setAuthor('Tenarten Terrazzo');
  pdf.setProducer(`TenOps ${PROPOSAL_PDF_VERSION}`);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.04, 0.1, 0.22);
  const ink = rgb(0.06, 0.08, 0.12);
  const gray = rgb(0.35, 0.38, 0.43);
  const pale = rgb(0.94, 0.95, 0.96);
  const red = rgb(0.75, 0.05, 0.05);
  const measureText = (input: string, size: number) => regular.widthOfTextAtSize(safe(input), size);
  const measureBoldText = (input: string, size: number) => bold.widthOfTextAtSize(safe(input), size);
  const customerLines = wrapProposalText(model.customerDisplay, 255, 7.5, measureText);
  const identityFields = [
    { caption: 'Date', value: model.proposalDate },
    { caption: 'Estimate #', value: model.estimateNumber, emphasized: true },
    { caption: 'Project #', value: model.projectNumber, emphasized: true },
    { caption: 'Project Name', value: model.projectName, emphasized: true },
    { caption: 'Project Location', value: model.projectLocation },
    { caption: 'Valid for', value: `${model.validDays} days` },
    { caption: 'Requested delivery date', value: model.requestedDelivery },
  ].map((field) => ({
    ...field,
    lines: wrapProposalText(field.value, 180, 7.2, field.emphasized ? measureBoldText : measureText),
  }));
  const firstCustomerLineCount = Math.min(customerLines.length, 14);
  const identityHeight = Math.max(73, 24 + firstCustomerLineCount * 9, 18 + identityFields.reduce((sum,field)=>sum+Math.max(15,field.lines.length*9+5),0));
  const identityExtraHeight = identityHeight - 73;
  const summaryFields = [['F.O.B.', model.fob], ['Side Mark', model.sideMark], ['Sales Rep', model.salesRep], ['Terms', model.terms]]
    .map(([caption,value])=>({caption,lines:wrapProposalText(value,125,7,measureBoldText)}));
  const summaryRowHeights = [0,1].map((row)=>Math.max(30,...summaryFields.slice(row*2,row*2+2).map((field)=>18+field.lines.length*8)));
  const summaryHeight = Math.max(60,summaryRowHeights[0]+summaryRowHeights[1]);
  const [materialDisclaimer,...dimensionDisclaimerParts] = safe(model.disclaimer).split(/\n\s*\n/);
  const materialDisclaimerLines = wrapProposalText(materialDisclaimer,258,5.4,measureText);
  const dimensionDisclaimerLines = wrapProposalText(dimensionDisclaimerParts.join(' '),258,5.4,measureText);
  const firstDisclaimerLineLimit = 8;
  const firstMaterialDisclaimerLines = materialDisclaimerLines.slice(0, firstDisclaimerLineLimit);
  const firstDimensionDisclaimerLines = dimensionDisclaimerLines.slice(0, firstDisclaimerLineLimit);
  const disclaimerHeight = Math.max(44,20+Math.max(firstMaterialDisclaimerLines.length,firstDimensionDisclaimerLines.length)*7);
  const firstTableTop = 476 - identityExtraHeight - (summaryHeight-60) - (disclaimerHeight-44);
  const continuationProjectLines = [
    `Project #: ${model.projectNumber || '-'}`,
    `Project Name: ${model.projectName || '-'}`,
    `Project Location: ${model.projectLocation || '-'}`,
  ].flatMap((current) => wrapProposalText(current, 420, 7, measureBoldText));
  const continuationEstimateLines = wrapProposalText(`Estimate ${model.estimateNumber}`, 300, 11, measureBoldText);
  const continuationProjectTop = Math.min(730, 750 - continuationEstimateLines.length * 12);
  const continuationDividerY = Math.min(710, continuationProjectTop - continuationProjectLines.length * 9 - 4);
  const continuationTableTop = continuationDividerY - 22;
  const continuationRowsHeight = Math.max(80, continuationTableTop - 90);
  const continuationTextHeight = Math.max(40, continuationTableTop - 70);
  const columns = proposalPdfColumns(model);
  const layout = paginateProposalPdf(model, {
    measureText,
    customerLines,
    firstRowsHeight: Math.max(34, firstTableTop - 148),
    continuationRowsHeight,
    customerContinuationLineLimit: Math.max(1, Math.floor(continuationTextHeight / 9)),
    formulaContinuationLineLimit: Math.max(1, Math.floor(continuationTextHeight / 8.2)),
    notesContinuationLineLimit: Math.max(1, Math.floor(continuationTextHeight / 8)),
    materialDisclaimerLines,
    dimensionDisclaimerLines,
    firstDisclaimerLineLimit,
    disclaimerContinuationLineLimit: Math.max(1, Math.floor(continuationTextHeight / 7)),
  });
  const money = (amount: number) => `$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  for (const pageLayout of layout) {
    const page = pdf.addPage([612, 792]);
    const text = (input: unknown, x: number, y: number, size = 7, font = regular, color = ink) =>
      page.drawText(safe(input), { x, y, size, font, color });
    const rect = (x: number, y: number, width: number, height: number, fill = rgb(1, 1, 1)) =>
      page.drawRectangle({ x, y, width, height, color: fill, borderColor: gray, borderWidth: 0.55 });
    const drawLines = (lines: string[], x: number, y: number, size = 7, lineHeight = size + 2, font = regular, color = ink) =>
      lines.forEach((line, index) => text(line, x, y - index * lineHeight, size, font, color));

    if (pageLayout.pageNumber === 1) {
      page.drawImage(logo, { x: 32, y: 700, width: 66, height: 67.55 });
      text('Tenarten Terrazzo', 106, 752, 15, bold, navy);
      text('PRECAST MANUFACTURING', 106, 738, 7, bold);
      text('2933 Eisenhower St., Suite 120', 106, 725);
      text('Carrollton, TX 75007', 106, 714);
      text('www.precasttz.com', 106, 703, 7, regular, navy);
      text('Estimate', 478, 750, 18, bold, ink);
      rect(478, 716, 102, 22);
      if (model.revised) text('REVISED', 500, 723, 10, bold, red);
      page.drawLine({ start: { x: 32, y: 693 }, end: { x: 580, y: 693 }, thickness: 1.5, color: navy });

      const identityBottom = 683 - identityHeight;
      rect(32, identityBottom, 274, identityHeight);
      rect(306, identityBottom, 274, identityHeight);
      text('Customer / Address / Contact', 39, 671, 6, bold, gray);
      drawLines(pageLayout.customerLines, 39, 657, 7.5, 9);
      let identityY=670;
      identityFields.forEach((field)=>{text(field.caption,315,identityY,6,bold,gray);drawLines(field.lines,390,identityY,7.2,9,field.emphasized?bold:regular);identityY-=Math.max(15,field.lines.length*9+5);});

      const summaryBottom = identityBottom - summaryHeight;
      let summaryTop=identityBottom;
      [0,1].forEach((row)=>{const rowHeight=summaryRowHeights[row];summaryFields.slice(row*2,row*2+2).forEach((field,column)=>{const x=32+column*137;rect(x,summaryTop-rowHeight,137,rowHeight,pale);text(field.caption,x+6,summaryTop-12,6,bold,gray);drawLines(field.lines,x+6,summaryTop-24,7,8,bold);});summaryTop-=rowHeight;});
      rect(306, summaryBottom, 274, summaryHeight);
      page.drawLine({ start: { x: 306, y: summaryBottom + summaryHeight/2 }, end: { x: 580, y: summaryBottom + summaryHeight/2 }, thickness: 0.55, color: gray });
      [[PROPOSAL_ESCALATION_NOTICE, summaryBottom + summaryHeight - 16], [PROPOSAL_LEAD_TIME_NOTICE, summaryBottom + summaryHeight/2 - 16]].forEach(([notice, y]) => {
        const lines = wrapProposalText(notice, 254, 6, (candidate, size) => bold.widthOfTextAtSize(candidate, size));
        lines.forEach((line, index) => text(line, 316 + (254 - bold.widthOfTextAtSize(line, 6)) / 2, y - index * 8, 6, bold));
      });
      const disclaimerBottom = summaryBottom - disclaimerHeight;
      rect(32, disclaimerBottom, 274, disclaimerHeight);
      rect(306, disclaimerBottom, 274, disclaimerHeight);
      drawLines(pageLayout.materialDisclaimerLines, 39, summaryBottom - 15, 5.4, 7);
      drawLines(pageLayout.dimensionDisclaimerLines, 313, summaryBottom - 15, 5.4, 7);
    } else {
      text('Tenarten Terrazzo', 32, 754, 12, bold, navy);
      continuationEstimateLines.forEach((line, index) =>
        text(line, 580 - bold.widthOfTextAtSize(safe(line), 11), 754 - index * 12, 11, bold, navy)
      );
      const pageLabel = `Page ${pageLayout.pageNumber} of ${pageLayout.pageCount}`;
      text(pageLabel, 580 - regular.widthOfTextAtSize(safe(pageLabel), 7), continuationProjectTop, 7, regular, gray);
      drawLines(continuationProjectLines, 32, continuationProjectTop, 7, 9, bold);
      if (model.revised) text('REVISED', 520, continuationDividerY + 7, 9, bold, red);
      page.drawLine({ start: { x: 32, y: continuationDividerY }, end: { x: 580, y: continuationDividerY }, thickness: 1.2, color: navy });
    }

    if (pageLayout.customerContinuation) {
      text('CUSTOMER / CONTACT CONTINUED', 32, continuationDividerY - 25, 7, bold, navy);
      drawLines(pageLayout.customerLines, 32, continuationDividerY - 42, 7.5, 9);
      continue;
    }
    if (pageLayout.disclaimerContinuation) {
      const disclaimerTop = continuationDividerY - 42;
      const disclaimerContinuationHeight = Math.max(
        44,
        25 + Math.max(pageLayout.materialDisclaimerLines.length, pageLayout.dimensionDisclaimerLines.length) * 7,
      );
      text('TERMS / DISCLAIMERS CONTINUED', 32, continuationDividerY - 25, 7, bold, navy);
      rect(32, disclaimerTop - disclaimerContinuationHeight, 274, disclaimerContinuationHeight);
      rect(306, disclaimerTop - disclaimerContinuationHeight, 274, disclaimerContinuationHeight);
      text('MATERIAL', 39, disclaimerTop - 13, 6, bold, gray);
      text('DIMENSION', 313, disclaimerTop - 13, 6, bold, gray);
      drawLines(pageLayout.materialDisclaimerLines, 39, disclaimerTop - 25, 5.4, 7);
      drawLines(pageLayout.dimensionDisclaimerLines, 313, disclaimerTop - 25, 5.4, 7);
      continue;
    }
    if (pageLayout.formulaContinuation) {
      text('FORMULA / COLOR CONTINUED', 32, continuationDividerY - 25, 7, bold, navy);
      drawLines(pageLayout.formulaLines, 32, continuationDividerY - 42, 6.2, 8.2);
      continue;
    }
    if (pageLayout.notesContinuation) {
      text('NOTES / CLARIFICATIONS CONTINUED', 32, continuationDividerY - 25, 7, bold, navy);
      drawLines(pageLayout.notesLines, 32, continuationDividerY - 42, 6.2, 8);
      continue;
    }

    const tableTop = pageLayout.pageNumber === 1 ? firstTableTop : continuationTableTop;
    if (pageLayout.repeatTableHeader) {
      for (const column of columns) {
        rect(column.x, tableTop, column.width, 22, pale);
        if (column.label) text(column.label, column.x + 3, tableTop + 8, column.headerSize ?? 6, bold, navy);
      }
    }
    let y = tableTop;
    for (const row of pageLayout.rows) {
      y -= row.height;
      for (const column of columns) rect(column.x, y, column.width, row.height);
      const line = row.line;
      for (const column of columns) {
        if (column.key === 'description') {
          drawLines(row.descriptionLines, column.x + 4, y + row.height - 13, 6.4, 9);
          continue;
        }
        if (row.continuationFragment && ['rate','total'].includes(column.key)) continue;
        let current = line[column.key] ?? '';
        let font = regular;
        if (column.key === 'rate') current = line.lineType === 'included' ? 'INCL' : line.lineType === 'informational' ? '' : money(line.rate);
        if (column.key === 'total') {
          current = line.lineType === 'included' ? 'INCL' : line.lineType === 'informational' ? '' : money(line.total);
          font = bold;
        }
        const size=['colorPlate','rate','total'].includes(column.key)?5.5:5.9;
        const lines=['rate','total'].includes(column.key)?wrapProposalText(current,column.width-6,size,measureText):row.cellLines[column.key];
        drawLines(lines,column.x+3,y+row.height-13,size,size+2,font);
      }
    }

    if (pageLayout.notesLines.length && !pageLayout.closing) {
      text('NOTES / CLARIFICATIONS', 32, 680, 7, bold, navy);
      drawLines(pageLayout.notesLines, 32, 666, 6.2, 8);
    }
    if (pageLayout.closing) {
      const formulaHeight = pageLayout.formulaHeight;
      const closingTop = pageLayout.rows.length
        ? Math.min(y - 12, 210 + Math.max(0, formulaHeight - 64) + pageLayout.notesLines.length * 8)
        : Math.min(650, continuationTableTop);
      const closingPanelHeight = Math.max(64, formulaHeight);
      if (formulaHeight) {
        rect(32, closingTop - formulaHeight, 360, formulaHeight);
        text('FORMULA / COLOR', 39, closingTop - 15, 6.5, bold, navy);
        drawLines(pageLayout.formulaLines, 39, closingTop - 27, 6.2, 8.2);
      }
      rect(392, closingTop - closingPanelHeight, 188, closingPanelHeight);
      [['Subtotal', model.subtotal], [model.taxEnabled ? `Tax (${model.taxRate}%)` : 'Tax', model.tax], ['TOTAL', model.total]]
        .forEach(([caption, amount], index) => {
          text(caption, 402, closingTop - 18 - index * 18, 7, index === 2 ? bold : regular);
          text(money(Number(amount)), 492, closingTop - 18 - index * 18, 7, index === 2 ? bold : regular);
        });
      let noteY = closingTop - closingPanelHeight - 19;
      if (pageLayout.notesLines.length) {
        text('NOTES / CLARIFICATIONS', 32, noteY, 7, bold, navy);
        noteY -= 13;
        drawLines(pageLayout.notesLines, 32, noteY, 6.2, 8);
      }
      text('Quote respectfully submitted by:', 32, 66, 7, regular, gray);
      text(model.submittedByName || 'Anthony Iorio', 32, 53, 8, bold);
      drawLines(wrapProposalText([model.submittedByPhone, model.submittedByEmail].filter(Boolean).join(' | '),300,6.5,measureText),32,41,6.5,8,regular,navy);
      text('Purchase approved by:', 355, 66, 7);
      page.drawLine({ start: { x: 350, y: 49 }, end: { x: 500, y: 49 }, thickness: 0.6, color: gray });
      page.drawLine({ start: { x: 515, y: 49 }, end: { x: 580, y: 49 }, thickness: 0.6, color: gray });
      text('Customer Signature', 355, 33, 7);
      text('Date', 520, 33, 7);
    }
  }
  return new Uint8Array(await pdf.save());
}

if (typeof Deno !== 'undefined') Deno.serve(async (request) => {
  const origin = request.headers.get('origin') || '';
  const headers = cors(origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  try {
    const authorization = request.headers.get('authorization') || '';
    if (!authorization) return json({ error: 'Authentication required.' }, 401, headers);
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const user = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: access, error: accessError } = await user.rpc('has_proposal_access');
    if (accessError || access !== true) return json({ error: 'Proposal access denied.' }, 403, headers);
    const body = await request.json();
    const action = String(body.action || '');
    if (action === 'preview') {
      const bytes = await render(body.snapshot);
      return new Response(bytes, { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="Proposal-Preview.pdf"' } });
    }
    const id = String(body.proposalId || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Invalid Proposal.' }, 400, headers);
    const service = createClient(url, serviceKey);
    if (action === 'delete') {
      const { data: identity } = await user.auth.getUser();
      const userId = identity.user?.id;
      const [{ data: admin }, { count: revisions }, { data: document }] = await Promise.all([
        service.from('app_users').select('role,is_active').eq('user_id', userId || '').maybeSingle(),
        service.from('proposals').select('id', { count: 'exact', head: true }).eq('prior_proposal_id', id),
        service.from('proposal_pdf_documents').select('storage_bucket,storage_path').eq('proposal_id', id).maybeSingle(),
      ]);
      if (admin?.role !== 'admin' || admin?.is_active !== true) return json({ error: 'Only an active Admin may delete an issued Proposal.' }, 403, headers);
      if ((revisions ?? 0) > 0) return json({ error: 'A Proposal with revisions cannot be deleted.' }, 409, headers);
      if (document?.storage_path) {
        const removed = await service.storage.from(String(document.storage_bucket || 'proposal-documents')).remove([String(document.storage_path)]);
        if (removed.error) return json({ error: 'The generated Proposal PDF could not be removed; no records were deleted.' }, 500, headers);
      }
      const { error: deleteError } = await user.rpc('admin_delete_issued_proposal', { p_proposal_id: id });
      if (deleteError) throw deleteError;
      return json({ deleted: true }, 200, headers);
    }
    const { data: proposal, error } = await service.from('proposals').select('issued_snapshot,estimate_number,status').eq('id', id).single();
    if (error || proposal?.status !== 'issued' || !proposal.issued_snapshot) return json({ error: 'Issued Proposal not found.' }, 404, headers);
    const path = `${id}/${String(proposal.estimate_number).replace(/[^A-Za-z0-9._-]/g, '-')}.pdf`;
    if (action === 'generate') {
      await service.from('proposal_pdf_documents').update({ status: 'generating', last_error: null }).eq('proposal_id', id);
      try {
        const bytes = await render(proposal.issued_snapshot);
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map((entry) => entry.toString(16).padStart(2, '0')).join('');
        const upload = await service.storage.from('proposal-documents').upload(path, bytes, { contentType: 'application/pdf', upsert: true });
        if (upload.error) throw upload.error;
        await service.from('proposal_pdf_documents').update({
          status: 'generated',
          document_version: PROPOSAL_PDF_VERSION,
          storage_path: path,
          snapshot_hash: hash,
          generated_at: new Date().toISOString(),
          last_error: null,
        }).eq('proposal_id', id);
      } catch (cause) {
        await service.from('proposal_pdf_documents').update({
          status: 'failed',
          last_error: cause instanceof Error ? cause.message : 'PDF generation failed.',
        }).eq('proposal_id', id);
        throw cause;
      }
    }
    const signed = await service.storage.from('proposal-documents').createSignedUrl(path, 3600);
    if (signed.error) return json({ error: 'Proposal PDF is unavailable.' }, 404, headers);
    return json({ url: signed.data.signedUrl }, 200, headers);
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : 'Proposal PDF request failed.' }, 500, headers);
  }
});
