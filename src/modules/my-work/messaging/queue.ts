import { validateFiles } from './files';

export type FileSource = 'picker'|'paste'|'drop';
export function exposedFiles(data: Pick<DataTransfer,'items'|'files'>): File[] {
  // A browser may expose the same files through both collections. Never concatenate them.
  const items=Array.from(data.items??[]).filter(item=>item.kind==='file').map(item=>item.getAsFile()).filter((file):file is File=>!!file);
  return items.length ? items : Array.from(data.files??[]);
}
export function clipboardNames(files:File[],existing:File[],now=new Date()) {
  const used=new Set(existing.map(file=>file.name));
  const pad=(value:number)=>String(value).padStart(2,'0');
  const stamp=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
  return files.map(file=>{
    if(file.name && !/^(?:image|screenshot|blob)(?:\.[a-z0-9]+)?$/i.test(file.name)){used.add(file.name);return file;}
    const extension:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/heic':'heic','image/heif':'heif','image/svg+xml':'svg'};
    const suffix=extension[file.type]||file.name.match(/\.([a-z0-9]+)$/i)?.[1]||'bin';
    const stem=`${file.type.startsWith('image/')?'Screenshot':'Clipboard file'} ${stamp}`;
    let name=`${stem}.${suffix}`,n=2;
    while(used.has(name))name=`${stem} (${n++}).${suffix}`;
    used.add(name);
    // Blob-backed rename, no arrayBuffer, data URL or Base64 copy.
    return new File([file],name,{type:file.type,lastModified:file.lastModified});
  });
}
export class AttachmentQueue {
  files:File[]=[];
  private handled=new WeakSet<object>();
  add(files:File[],source:FileSource,event?:object,now?:Date) {
    if(event){if(this.handled.has(event))return this.files;this.handled.add(event);}
    const incoming=source==='paste'?clipboardNames(files,this.files,now):files;
    const next=[...this.files,...incoming];validateFiles(next);this.files=next;return next;
  }
  clear(){this.files=[];}
  remove(index:number){this.files=this.files.filter((_,i)=>i!==index);return this.files;}
}
