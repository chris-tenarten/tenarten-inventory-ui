import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { validateColorPlateLabelFields, type ColorPlateLabelFields } from './color-plate-label-fields';

export const LABEL_WIDTH = 288;
export const LABEL_HEIGHT = 166.5;
type Text = { text: string; x: number; y: number; size: number; width: number; font: 'regular' | 'bold' | 'italic' };
type Rule = { x: number; y: number; width: number; height: number };
export type ColorPlateLabel = { texts: Text[]; rules: Rule[]; pdf: Uint8Array; svg: string; draft: boolean };
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Top-down point coordinates are shared by the SVG print view and PDF fallback.
export async function createColorPlateLabel(fields: ColorPlateLabelFields, draft: boolean): Promise<ColorPlateLabel> {
  if (Object.keys(validateColorPlateLabelFields(fields)).length) throw new Error('Complete the required label information before printing.');
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const texts: Text[] = [], rules: Rule[] = [];
  const width = (text: string, size: number, font: PDFFont) => {
    try { return font.widthOfTextAtSize(text, size); }
    catch { throw new Error('One or more characters cannot be printed. Use plain English letters, numbers and punctuation.'); }
  };
  const add = (text: string, x: number, y: number, size: number, font: Text['font'] = 'regular') => {
    texts.push({ text, x, y, size, font, width: width(text, size, fonts[font]) });
  };
  const center = (text: string, y: number, size: number, font: Text['font'] = 'regular') => add(text, (LABEL_WIDTH - width(text, size, fonts[font])) / 2, y, size, font);
  const fitSize = (text: string, max: number, min: number, available: number, font: Text['font'], name: string) => {
    for (let size = max; size >= min; size -= 0.25) if (width(text, size, fonts[font]) <= available) return size;
    throw new Error(`${name} is too long to print clearly. Shorten its label wording.`);
  };
  const wrap = (text: string, size: number, available: number, font: Text['font']) => {
    const lines: string[] = []; let line = '';
    for (const word of text.trim().split(/\s+/)) {
      if (width(word, size, fonts[font]) > available) return null;
      const next = line ? `${line} ${word}` : word;
      if (width(next, size, fonts[font]) > available) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };
  center('TENARTEN TERRAZZO CO.', 16, 13, 'bold');
  center('PRECAST TERRAZZO MANUFACTURING', 27, 9, 'italic');
  center('2933 Eisenhower St, Suite 120   Carrollton, TX 75007   469.491.7002', 37, 7);
  rules.push({ x: 9, y: 41, width: 270, height: 0 });
  const date = `${fields.date.slice(5, 7)}/${fields.date.slice(8, 10)}/${fields.date.slice(2, 4)}`;
  const dateWidth = width(date, 8, fonts.regular);
  const project = `Project: ${fields.project.trim()}`;
  add(project, 9, 52, fitSize(project, 9, 7.5, 258 - dateWidth, 'regular', 'Project'), 'regular');
  add(date, 279 - dateWidth, 52, 8);
  rules.push({ x: 9, y: 57, width: 270, height: 24 });
  const plate = `${draft ? 'DRAFT ' : ''}COLOR PLATE #${fields.plate.trim().replace(/^#/, '')}`;
  center(plate, 74, fitSize(plate, 15, 11, 260, 'bold', 'Color Plate number'), 'bold');
  const rows = [ ['Matrix:', fields.matrix], ['CHIPS:', fields.chips], ['SIZE:', fields.sizes], ['FINISH:', fields.finish] ];
  // Reserve footer space. Short labels keep the familiar one-line rows; longer labels wrap
  // only within a fixed budget, with an explicit legibility floor.
  let rowSize = 9.5, lines: string[][] = [];
  for (; rowSize >= 8; rowSize -= 0.25) {
    const wrapped = rows.map(([name, value]) => wrap(`${name} ${value}`, rowSize, 270, 'bold'));
    if (wrapped.every(Boolean) && wrapped.reduce((sum, row) => sum + row!.length, 0) * (rowSize + 1.5) <= 50) { lines = wrapped as string[][]; break; }
  }
  if (!lines.length) throw new Error('The material descriptions are too long to print clearly. Shorten matrix, chips, chip sizes or finish wording.');
  let baseline = 92;
  for (const row of lines) for (const line of row) { add(line, 9, baseline, rowSize, 'bold'); baseline += rowSize + 1.5; }
  const disclaimer = 'Final terrazzo color may vary slightly from this sample due to naturally occurring variances in materials produced at the time the order is placed.';
  const footer = wrap(disclaimer, 6.5, 270, 'bold')!;
  footer.forEach((line, i) => center(line, 142 + i * 8, 6.5, 'bold'));
  center('sales@tenartenterrazzo.com', 160, 8);
  const page = doc.addPage([LABEL_WIDTH, LABEL_HEIGHT]);
  for (const text of texts) page.drawText(text.text, { x: text.x, y: LABEL_HEIGHT - text.y, size: text.size, font: fonts[text.font], color: rgb(0, 0, 0) });
  for (const rule of rules) {
    if (rule.height) page.drawRectangle({ x: rule.x, y: LABEL_HEIGHT - rule.y - rule.height, width: rule.width, height: rule.height, borderWidth: 0.6, borderColor: rgb(0, 0, 0) });
    else page.drawLine({ start: { x: rule.x, y: LABEL_HEIGHT - rule.y }, end: { x: rule.x + rule.width, y: LABEL_HEIGHT - rule.y }, thickness: 0.6, color: rgb(0, 0, 0) });
  }
  doc.setTitle(`Color Plate ${fields.plate.trim()}`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LABEL_WIDTH} ${LABEL_HEIGHT}" width="4in" height="2.3125in" role="img" aria-label="Color Plate label"><rect width="288" height="166.5" fill="white"/>${rules.map(r => r.height ? `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="none" stroke="black" stroke-width="0.6"/>` : `<path d="M${r.x} ${r.y}h${r.width}" stroke="black" stroke-width="0.6"/>`).join('')}${texts.map(t => `<text x="${t.x}" y="${t.y}" font-family="Arial, Helvetica, sans-serif" font-size="${t.size}" font-weight="${t.font === 'bold' ? '700' : '400'}" font-style="${t.font === 'italic' ? 'italic' : 'normal'}" textLength="${t.width}" lengthAdjust="spacingAndGlyphs">${escape(t.text)}</text>`).join('')}</svg>`;
  return { texts, rules, pdf: await doc.save(), svg, draft };
}

export function colorPlatePrintHtml(svg: string) {
  // SVG is generated exclusively above from escaped text; never accept arbitrary markup.
  return `<!doctype html><html><head><meta charset="utf-8"><title>Color Plate Label</title><style>@page{size:4in 2.3125in;margin:0}html,body{margin:0;padding:0;width:4in;height:2.3125in;background:white}svg{display:block;width:4in;height:2.3125in}*{box-sizing:border-box;print-color-adjust:exact}</style></head><body>${svg}</body></html>`;
}
