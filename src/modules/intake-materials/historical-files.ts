import {extractWorkbookForm,extractPdfForm,type Point} from './historical-extraction';
export async function historicalDocumentParts(file:File){
 if(file.size>20*1024*1024)throw new Error('Historical originals are limited to 20 MB.');
 if(/\.xlsx$/i.test(file.name)){
  const {readSheetNames}=await import('read-excel-file');return readSheetNames(file);
 }
 if(/\.pdf$/i.test(file.name)){
  const task=await loadPdf(file);try{const pdf=await task.promise;return Array.from({length:pdf.numPages},(_,i)=>`Page ${i+1}`);}finally{await task.destroy();}
 }
 throw new Error('Choose an .xlsx workbook or PDF. Legacy .xls and scanned forms require transcription/export.');
}
async function loadPdf(file:File){
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',import.meta.url).toString();
 return pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())});
}
export async function extractHistoricalFile(file:File,part:number){
 if(/\.xlsx$/i.test(file.name)){
  const {default:read}=await import('read-excel-file');const rows=await read(file,{sheet:part+1});return extractWorkbookForm(rows,`${file.name} · sheet ${part+1}`);
 }
 const task=await loadPdf(file);try{const pdf=await task.promise;const page=await pdf.getPage(part+1),content=await page.getTextContent();const points:Point[]=content.items.flatMap(item=>'str' in item?[{x:item.transform[4],y:item.transform[5],text:item.str.trim()}]:[]);return extractPdfForm(points,`${file.name} · page ${part+1}`);}finally{await task.destroy();}
}
