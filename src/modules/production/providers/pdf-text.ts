import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  '../../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export type PositionedPdfText = {
  str: string;
  x: number;
  y: number;
};

export function textInReadingOrder(items: PositionedPdfText[]): string {
  const rows: Array<{ y: number; items: PositionedPdfText[] }> = [];
  for (const item of [...items].filter((candidate) => candidate.str.trim()).sort((first, second) => second.y - first.y || first.x - second.x)) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 3);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  return rows
    .sort((first, second) => second.y - first.y)
    .flatMap((row) => row.items.sort((first, second) => first.x - second.x).map((item) => item.str.trim()))
    .join('\n');
}

export async function extractEmbeddedPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const document = await loadingTask.promise;
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const items: PositionedPdfText[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        items.push({ str: item.str, x: item.transform[4], y: item.transform[5] });
      }
      pages.push(textInReadingOrder(items));
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
  return pages.join('\n');
}
