import { BINARY_TYPE, INBOX_ATTACHMENT_BUCKET, previewType, resumableEndpoint, validateFiles } from './files';

export type Entry = { id: string; name: string; size: number; contentType: string; lastModified?: number };
export type Draft = { id: string; recipient: string; body: string; job: string; entries: Entry[] };
export type TransferState = { phase: 'preparing'|'uploading'|'retrying'|'finalizing'|'failed'|'canceling'|'canceled'|'sent'; uploaded: number; total: number; fileIndex: number; fileUploaded: number; error: string };
export type Transport = {
  begin(draft: Draft): Promise<void>;
  status(id: string): Promise<{ status: string; completed: string[] }>;
  heartbeat(id: string): Promise<void>;
  upload(id: string, entry: Entry, file: File, signal: AbortSignal, progress: (bytes:number, retrying?:boolean)=>void): Promise<void>;
  preview?(id:string,entry:Entry,file:File,signal:AbortSignal):Promise<void>;
  finalize(id: string, count: number): Promise<void>;
  cancel(id: string): Promise<string[]>;
  remove(paths: string[]): Promise<void>;
  discard(id: string): Promise<void>;
};
const message = (error: unknown) => error instanceof Error ? error.message : 'Transfer failed. Retry to reconcile the private draft.';

// The controller survives dialog remounts, but is scoped to a single signed-in account.
// No File bodies, message bodies, tokens or signed URLs are persisted to browser storage.
export class MessageTransfer {
  state: TransferState;
  draft: Draft;
  private listeners = new Set<()=>void>();
  private abort = new AbortController();
  private running?: Promise<void>;
  private cancelRequested = false;
  private cancelRunning?: Promise<void>;
  get cancellationPending() { return this.cancelRequested; }
  private prepared = false;
  constructor(public files: File[], recipient: string, body: string, job: string, private transport: Transport, recovered?: Draft) {
    const total = validateFiles(files);
    if (!files.length&&!recovered) throw new Error('Choose at least one attachment.');
    this.draft = recovered ?? { id: crypto.randomUUID(), recipient, body, job, entries: files.map(file=>({id:crypto.randomUUID(),name:file.name,size:file.size,contentType:BINARY_TYPE,lastModified:file.lastModified})) };
    this.prepared=!!recovered;
    this.state = { phase:recovered?'failed':'preparing', uploaded:0, total:recovered?recovered.entries.reduce((sum,e)=>sum+e.size,0):total, fileIndex:0, fileUploaded:0, error:recovered?'Recovered private transfer. Check its result, or reselect the original files to resume.':'' };
  }
  get needsFiles() { return !this.files.length; }
  supplyFiles(files:File[]) {
    validateFiles(files);
    if(files.length!==this.draft.entries.length)throw new Error('Reselect all original files, or cancel this transfer.');
    const remaining=[...files];
    const matched=this.draft.entries.map(entry=>{
      const index=remaining.findIndex(file=>file.name===entry.name&&file.size===entry.size&&(entry.lastModified===undefined||entry.lastModified===file.lastModified));
      if(index<0)throw new Error('The selected filenames, sizes or modification dates do not match the original files.');
      return remaining.splice(index,1)[0];
    });
    this.files=matched;this.set({error:''});
  }
  subscribe = (listener: ()=>void) => { this.listeners.add(listener); return ()=>{this.listeners.delete(listener);}; };
  snapshot = () => this.state;
  private set(patch: Partial<TransferState>) { this.state = {...this.state,...patch}; this.listeners.forEach(listener=>listener()); }
  start() {
    if (this.running || ['sent','canceled'].includes(this.state.phase)) return this.running ?? Promise.resolve();
    if(this.cancelRequested)return this.cancel();
    this.abort = new AbortController();
    this.running = this.run().finally(()=>{this.running=undefined;});
    return this.running;
  }
  private async run() {
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      this.set({phase:'preparing',error:''});
      if (!this.prepared) {
        for (let i=0;i<this.files.length;i++) this.draft.entries[i].contentType = await previewType(this.files[i]);
        this.prepared = true;
      }
      await this.transport.begin(this.draft); // same ID + immutable manifest on every retry
      if (this.cancelRequested) return;
      const initial = await this.transport.status(this.draft.id);
      if (initial.status==='ready') { this.set({phase:'sent',uploaded:this.state.total}); return; }
      if (initial.status!=='active') {this.cancelRequested=true;this.set({phase:'failed',error:'This draft is being cleaned up. Retry cleanup to finish.'});return;}
      if(this.needsFiles)throw new Error('Reselect the original files to resume, or cancel this private draft.');
      timer = setInterval(()=>{void this.transport.heartbeat(this.draft.id).catch(()=>{this.abort.abort();});},60_000);
      let completed = 0;
      for (let i=0;i<this.files.length;i++) {
        if (this.cancelRequested) return;
        const entry = this.draft.entries[i];
        this.set({phase:'uploading',fileIndex:i,fileUploaded:0,uploaded:completed});
        if (!initial.completed.includes(entry.id)) {
          try {
            await this.transport.upload(this.draft.id,entry,this.files[i],this.abort.signal,(bytes,retrying)=>this.set({phase:retrying?'retrying':'uploading',fileUploaded:bytes,uploaded:completed+bytes}));
          } catch (error) {
            if (this.cancelRequested) return;
            // Lost final PATCH response / conflict: reconcile actual object, never overwrite.
            const recovered = await this.transport.status(this.draft.id);
            if (!recovered.completed.includes(entry.id)) throw error;
          }
        }
        // Optional bounded derivative. Original transfer/finalization never depends on it.
        if (!this.cancelRequested && this.transport.preview) {
          try { await this.transport.preview(this.draft.id,entry,this.files[i],this.abort.signal); } catch { /* Download remains available without a preview. */ }
        }
        completed += entry.size;
        this.set({uploaded:completed,fileUploaded:entry.size});
      }
      if (this.cancelRequested) return;
      this.set({phase:'finalizing'});
      await this.transport.finalize(this.draft.id,this.files.length);
      this.set({phase:'sent',uploaded:this.state.total});
    } catch (error) {
      if (!this.cancelRequested) this.set({phase:'failed',error:message(error)});
      // Never delete on failure: finalization may already have committed.
    } finally { if (timer) clearInterval(timer); }
  }
  cancel() {
    if(this.cancelRunning)return this.cancelRunning;
    this.cancelRunning=this.performCancel().finally(()=>{this.cancelRunning=undefined;});
    return this.cancelRunning;
  }
  private async performCancel() {
    if (this.state.phase==='sent'||this.state.phase==='canceled') return;
    this.cancelRequested=true;
    this.set({phase:'canceling',error:''});
    this.abort.abort();
    await this.running;
    try {
      // begin reconciles an uncertain create response before cancel can discard anything.
      await this.transport.begin(this.draft);
      const status = await this.transport.status(this.draft.id);
      if (status.status==='ready') { this.set({phase:'sent',uploaded:this.state.total}); return; }
      const paths = await this.transport.cancel(this.draft.id);
      for (let i=0;i<paths.length;i+=100) await this.transport.remove(paths.slice(i,i+100));
      await this.transport.discard(this.draft.id);
      this.set({phase:'canceled'});
    } catch (error) { this.set({phase:'failed',error:`Cleanup not complete. Retry Cancel. ${message(error)}`}); }
  }
  stopForSignOut() { this.cancelRequested=true; this.abort.abort(); this.listeners.clear(); }
}

// In-memory upload URLs allow same-page TUS retries without leaving credentials in localStorage.
const uploadUrls = new Map<string,string>();
export async function uploadResumable(options: {
  baseUrl:string; id:string; entry:Entry; file:File; signal:AbortSignal;
  credentials:()=>Promise<{token:string;key:string}>;
  progress:(bytes:number,retrying?:boolean)=>void;
}) {
  const { Upload } = await import('tus-js-client');
  const {id,entry,file,signal,progress} = options;
  if (signal.aborted) throw new Error('Upload stopped.');
  const path=`${id}/${entry.id}/file`;
  let lastBytes=0;
  await new Promise<void>((resolve,reject)=>{
    const finish=(error?:Error)=>{signal.removeEventListener('abort',stop); if(error)reject(error);else resolve();};
    const upload=new Upload(file,{
      endpoint:resumableEndpoint(options.baseUrl), uploadUrl:uploadUrls.get(path),
      chunkSize:6*1024*1024, retryDelays:[0,3000,5000,10000,20000],
      storeFingerprintForResuming:false, removeFingerprintOnSuccess:true,
      metadata:{bucketName:INBOX_ATTACHMENT_BUCKET,objectName:path,contentType:BINARY_TYPE,cacheControl:'0'},
      onBeforeRequest:async(request)=>{if(signal.aborted)throw new Error('Upload stopped.');const credential=await options.credentials();if(signal.aborted)throw new Error('Upload stopped.');request.setHeader('Authorization',`Bearer ${credential.token}`);request.setHeader('apikey',credential.key);},
      onUploadUrlAvailable:()=>{if(upload.url)uploadUrls.set(path,upload.url);},
      onShouldRetry:(error)=>{const status=error.originalResponse?.getStatus()??0;const retry=status===0||status===408||status===429||status>=500;if(retry)progress(lastBytes,true);return retry&&!signal.aborted;},
      onProgress:(bytes)=>{lastBytes=bytes;progress(bytes);},
      onError:(error)=>finish(new Error(('originalResponse' in error && error.originalResponse?.getStatus()===401)?'Sign in again, then retry the transfer.':'Upload interrupted. Retry to resume safely.')),
      onSuccess:()=>{uploadUrls.delete(path);finish();},
    });
    const stop=()=>{void upload.abort().then(()=>finish(new Error('Upload stopped.')),()=>finish(new Error('Upload stopped.')));};
    signal.addEventListener('abort',stop,{once:true});
    upload.start();
  });
}
export function clearUploadUrls() { uploadUrls.clear(); }
