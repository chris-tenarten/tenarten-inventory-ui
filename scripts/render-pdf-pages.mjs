import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { basename,extname,join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const [input,outputRoot='tmp/pdfs/rendered']=process.argv.slice(2);
if(!input)throw new Error('Usage: node scripts/render-pdf-pages.mjs input.pdf [output-directory]');
const name=basename(input,extname(input));
const outputDirectory=join(outputRoot,name);
mkdirSync(outputDirectory,{recursive:true});
const document=await pdfjs.getDocument({data:new Uint8Array(readFileSync(input))}).promise;
for(let pageNumber=1;pageNumber<=document.numPages;pageNumber+=1){
  const page=await document.getPage(pageNumber);
  const viewport=page.getViewport({scale:2});
  const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
  await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
  writeFileSync(join(outputDirectory,`page-${String(pageNumber).padStart(2,'0')}.png`),canvas.toBuffer('image/png'));
}
console.log(JSON.stringify({input,outputDirectory,pages:document.numPages}));
