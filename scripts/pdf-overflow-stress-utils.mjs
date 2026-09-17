import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

export const repoRoot = new URL('../',import.meta.url).pathname.replace(/\/$/,'');
export const outputDirectory = `${repoRoot}/output/pdf`;
mkdirSync(outputDirectory,{recursive:true});

export async function extractPdfText(path) {
  const data=new Uint8Array(readFileSync(path));
  const document=await pdfjs.getDocument({data}).promise;
  const pages=[];
  for(let pageNumber=1;pageNumber<=document.numPages;pageNumber+=1){
    const page=await document.getPage(pageNumber);
    const content=await page.getTextContent();
    pages.push(content.items.map((item)=>item.str).join(' '));
  }
  return {text:pages.join('\n'),pages};
}

export function assertTailMarkers(text,markers,label) {
  const compactText=text.replace(/\s+/g,'');
  markers.forEach((marker)=>assert.ok(compactText.includes(marker.replace(/\s+/g,'')),`${label} PDF dropped tail marker: ${marker}`));
  assert.doesNotMatch(text,/\.\.\./,`${label} PDF must not replace authored content with ellipses`);
}

export function createEdgeHarness({name,sourcePath,startMarker,endMarker,imports,fixture,invocation}) {
  const source=readFileSync(sourcePath,'utf8');
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker);
  assert.ok(start>=0&&end>start,`${name} renderer boundaries were not found`);
  const generatedPath=`/tmp/tenops-${name}-overflow.generated.ts`;
  const generated=`${imports}\n${source.slice(start,end)}\nconst fixture=${JSON.stringify(fixture)};\n${invocation}\n`;
  writeFileSync(generatedPath,generated);
  execFileSync(process.execPath,['--import','tsx',generatedPath],{cwd:repoRoot,stdio:'inherit'});
}

export const fileImport=(path)=>JSON.stringify(pathToFileURL(path).href);
