import { canPreview } from './files';

export const PREVIEW_MAX_BYTES = 196608;
export const PREVIEW_MAX_EDGE = 1280;
export type PreviewMetadata = { path: string; bytes: number; width: number; height: number };
export type PreviewBlob = { blob: Blob; width: number; height: number };

/** Read bounded raster headers before allocating decoded pixels. Unknown headers fail closed. */
export function rasterDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start,end));
  if(bytes.length>=24 && bytes[0]===137 && text(1,4)==='PNG') return {width:v.getUint32(16),height:v.getUint32(20)};
  if(bytes.length>=10 && ['GIF87a','GIF89a'].includes(text(0,6))) return {width:v.getUint16(6,true),height:v.getUint16(8,true)};
  if(bytes.length>=30 && text(0,4)==='RIFF' && text(8,12)==='WEBP') {
    if(text(12,16)==='VP8X') return {width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)};
    if(text(12,16)==='VP8 ' && bytes[23]===157 && bytes[24]===1 && bytes[25]===42) return {width:v.getUint16(26,true)&16383,height:v.getUint16(28,true)&16383};
    if(text(12,16)==='VP8L' && bytes[20]===47) return {width:1+bytes[21]+((bytes[22]&63)<<8),height:1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&15)<<10)};
    return null;
  }
  if(bytes.length<4 || bytes[0]!==255 || bytes[1]!==216) return null;
  let i=2;
  while(i+4<=bytes.length){
    if(bytes[i++]!==255)return null;
    while(i<bytes.length && bytes[i]===255)i++;
    const marker=bytes[i++];
    if(marker===217||marker===218)return null;
    if(marker===1||(marker>=208&&marker<=215))continue;
    if(i+2>bytes.length)return null;
    const length=v.getUint16(i);
    if(length<2||i+length>bytes.length)return null;
    if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7)return {height:v.getUint16(i+3),width:v.getUint16(i+5)};
    i+=length;
  }
  return null;
}
export function validPreviewMetadata(p: PreviewMetadata) {
  return Number.isInteger(p.bytes)&&p.bytes>0&&p.bytes<=PREVIEW_MAX_BYTES&&[p.width,p.height].every(n=>Number.isInteger(n)&&n>0&&n<=PREVIEW_MAX_EDGE);
}
export async function generatePreview(file:File,contentType:string,signal:AbortSignal):Promise<PreviewBlob|null>{
  if(signal.aborted||!canPreview({originalFilename:file.name,contentType,byteSize:file.size}))return null;
  const dimensions=rasterDimensions(new Uint8Array(await file.slice(0,262144).arrayBuffer()));
  if(!dimensions||dimensions.width<1||dimensions.height<1||dimensions.width>8192||dimensions.height>8192||dimensions.width*dimensions.height>16000000||signal.aborted)return null;
  if(contentType==='image/jpeg'&&file.size<=PREVIEW_MAX_BYTES&&Math.max(dimensions.width,dimensions.height)<=PREVIEW_MAX_EDGE)return {blob:file,...dimensions};
  const bitmap=await createImageBitmap(file);
  try{
    if(signal.aborted||bitmap.width*bitmap.height>16000000)return null;
    let scale=Math.min(1,PREVIEW_MAX_EDGE/Math.max(bitmap.width,bitmap.height));
    for(let attempt=0;attempt<5;attempt++){
      const width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const context=canvas.getContext('2d');if(!context)return null;
      context.fillStyle='#ffffff';context.fillRect(0,0,width,height);context.drawImage(bitmap,0,0,width,height);
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',attempt===0?.82:.68));
      canvas.width=canvas.height=0;
      if(signal.aborted)return null;
      if(blob&&blob.size<=PREVIEW_MAX_BYTES)return {blob,width,height};
      scale*=.75;
    }
    return null;
  }finally{bitmap.close();}
}

/** A malicious sender cannot force an unbounded response or oversized raster into the thread. */
export async function fetchPreview(url:string,p:PreviewMetadata,signal:AbortSignal):Promise<Blob>{
  if(!validPreviewMetadata(p))throw Error('Invalid preview bounds.');
  const response=await fetch(url,{signal,referrerPolicy:'no-referrer'});
  if(!response.ok||!response.body)throw Error('Preview unavailable.');
  if(Number(response.headers.get('content-length')||0)>PREVIEW_MAX_BYTES){await response.body.cancel();throw Error('Preview exceeds bounds.');}
  const reader=response.body.getReader();const chunks:Uint8Array<ArrayBuffer>[]=[];let count=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>PREVIEW_MAX_BYTES)throw Error('Preview exceeds bounds.');chunks.push(new Uint8Array(value));}}
  catch(error){await reader.cancel();throw error;}finally{reader.releaseLock();}
  const blob=new Blob(chunks,{type:'image/jpeg'});const bytes=new Uint8Array(await blob.arrayBuffer());const d=rasterDimensions(bytes);
  if(bytes[0]!==255||bytes[1]!==216||count!==p.bytes||!d||d.width!==p.width||d.height!==p.height)throw Error('Preview invalid.');
  return blob;
}
