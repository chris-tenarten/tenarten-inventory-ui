/* eslint-disable @next/next/no-img-element -- signed attachment URLs must render directly without remote-image configuration */
'use client';

import { ChevronLeft, ChevronRight, Download, Expand, ExternalLink, Minus, Plus, Printer, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

type Props = {
  mode?: 'fullscreen' | 'embedded';
  title: string;
  filename: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  metadata?: string;
  url?: string;
  children?: ReactNode;
  onClose(): void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onOpenFullscreen?: () => void;
};

const imageTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const extension = (filename: string) => filename.split('.').pop()?.toLowerCase() ?? '';
const formatSize = (bytes?: number | null) => bytes === null || bytes === undefined ? '' : bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

export default function DocumentViewer({ mode = 'fullscreen', title, filename, mimeType, sizeBytes, metadata, url: sourceUrl, children, onClose, onPrevious, onNext, hasPrevious, hasNext, onOpenFullscreen }: Props) {
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(Boolean(sourceUrl && (mimeType === 'application/pdf' || imageTypes.has(mimeType ?? '') || ['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(extension(filename)))));
  const [previewError, setPreviewError] = useState('');
  const ext = extension(filename);
  const isPdf = mimeType === 'application/pdf' || ext === 'pdf';
  const isImage = imageTypes.has(mimeType ?? '') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
  const [pdfRenderUrl, setPdfRenderUrl] = useState<string>();
  const url = isPdf ? pdfRenderUrl : sourceUrl;
  const previewable = Boolean(children || (url && (isPdf || isImage)));

  useEffect(() => {
    if (!sourceUrl || !isPdf) return;
    let active = true;
    let objectUrl = '';
    fetch(sourceUrl)
      .then(response => {
        if (!response.ok) throw new Error(`PDF request failed with status ${response.status}.`);
        return response.blob();
      })
      .then(blob => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfRenderUrl(objectUrl);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
        setPreviewError('Unable to load this PDF preview. Use Open or Download to access the file.');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isPdf, sourceUrl]);

  useEffect(() => {
    if (mode !== 'fullscreen') return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [mode, onClose]);

  if (mode === 'embedded') return <div className="overflow-hidden border border-slate-300 bg-white" role="region" aria-label={`${title}: ${filename}`}>
    <header className="flex flex-wrap items-center gap-2 border-b border-slate-300 bg-slate-50 px-3 py-2">
      <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-slate-950" title={filename}>{filename}</div><div className="truncate text-[11px] text-slate-500">{formatSize(sizeBytes)}{formatSize(sizeBytes) && metadata ? ' · ' : ''}{metadata}</div></div>
      {(onPrevious || onNext) && <div className="flex"><button type="button" disabled={!hasPrevious} onClick={onPrevious} className="inline-flex h-8 w-8 items-center justify-center border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30" aria-label="Previous attachment"><ChevronLeft className="h-4 w-4"/></button><button type="button" disabled={!hasNext} onClick={onNext} className="inline-flex h-8 w-8 items-center justify-center border border-l-0 border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30" aria-label="Next attachment"><ChevronRight className="h-4 w-4"/></button></div>}
      {onOpenFullscreen && <button type="button" onClick={onOpenFullscreen} className="inline-flex h-8 items-center gap-1 border border-slate-300 bg-white px-2 text-xs font-bold hover:bg-slate-100"><Expand className="h-4 w-4"/>Open Full Screen</button>}
      {url && <a href={url} download={filename} className="inline-flex h-8 items-center gap-1 border border-slate-300 bg-white px-2 text-xs font-bold hover:bg-slate-100"><Download className="h-4 w-4"/>Download</a>}
      <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center border border-slate-300 bg-white hover:bg-slate-100" aria-label="Close attachment preview"><X className="h-4 w-4"/></button>
    </header>
    <div className="relative h-72 overflow-auto bg-slate-100 p-2 sm:h-80">
      {loading && <div className="absolute inset-x-0 top-3 z-10 mx-auto w-fit bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow">Loading preview…</div>}
      {previewError && <div role="alert" className="absolute inset-x-3 top-3 z-10 border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-800 shadow">{previewError}</div>}
      {url && isPdf ? <iframe title={filename} src={url} onLoad={() => setLoading(false)} onError={() => { setLoading(false); setPreviewError('Unable to render this PDF preview.'); }} className="h-full min-h-64 w-full border-0 bg-white"/> : url && isImage ? <img src={url} alt={filename} onLoad={() => setLoading(false)} onError={() => { setLoading(false); setPreviewError('Unable to render this image preview.'); }} className="h-full w-full object-contain"/> : <div className="flex h-full flex-col items-center justify-center p-6 text-center"><div className="text-sm font-bold text-slate-900">Preview unavailable</div><div className="mt-2 max-w-full truncate text-xs text-slate-600">{filename}</div><div className="mt-1 text-xs text-slate-500">{mimeType || ext.toUpperCase() || 'Unknown file type'}{formatSize(sizeBytes) ? ` · ${formatSize(sizeBytes)}` : ''}</div>{url && <div className="mt-4 flex gap-2"><a href={url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 border border-slate-400 bg-white px-2 text-xs font-bold"><ExternalLink className="h-4 w-4"/>Open</a><a href={url} download={filename} className="inline-flex h-8 items-center gap-1 border border-slate-400 bg-white px-2 text-xs font-bold"><Download className="h-4 w-4"/>Download</a></div>}</div>}
    </div>
  </div>;

  return <div className="fixed inset-0 z-[140] flex flex-col bg-slate-950/80" role="dialog" aria-modal="true" aria-label={title}>
    <header className="flex min-h-14 flex-wrap items-center gap-2 border-b border-slate-700 bg-slate-950 px-3 py-2 text-white print:hidden">
      <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{title}</div><div className="truncate text-[11px] text-slate-300">{filename}{formatSize(sizeBytes) ? ` · ${formatSize(sizeBytes)}` : ''}{metadata ? ` · ${metadata}` : ''}</div></div>
      {(onPrevious || onNext) && <div className="flex"><button type="button" disabled={!hasPrevious} onClick={onPrevious} className="inline-flex h-9 w-9 items-center justify-center border border-slate-600 disabled:opacity-30" aria-label="Previous document"><ChevronLeft className="h-4 w-4"/></button><button type="button" disabled={!hasNext} onClick={onNext} className="inline-flex h-9 w-9 items-center justify-center border border-l-0 border-slate-600 disabled:opacity-30" aria-label="Next document"><ChevronRight className="h-4 w-4"/></button></div>}
      {previewable && <div className="flex items-center"><button type="button" onClick={() => setZoom(value => Math.max(50, value - 10))} className="inline-flex h-9 w-9 items-center justify-center border border-slate-600" aria-label="Zoom out"><Minus className="h-4 w-4"/></button><span className="inline-flex h-9 min-w-14 items-center justify-center border-y border-slate-600 px-2 text-xs">{zoom}%</span><button type="button" onClick={() => setZoom(value => Math.min(200, value + 10))} className="inline-flex h-9 w-9 items-center justify-center border border-slate-600" aria-label="Zoom in"><Plus className="h-4 w-4"/></button></div>}
      {url && <><a href={url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1 border border-slate-600 px-2 text-xs font-bold"><ExternalLink className="h-4 w-4"/>Open</a><a href={url} download={filename} className="inline-flex h-9 items-center gap-1 border border-slate-600 px-2 text-xs font-bold"><Download className="h-4 w-4"/>Download</a></>}
      {children && <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-1 border border-slate-600 px-2 text-xs font-bold"><Printer className="h-4 w-4"/>Print</button>}
      <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center border border-slate-600" aria-label="Close document viewer"><X className="h-5 w-5"/></button>
    </header>
    <main className="relative min-h-0 flex-1 overflow-auto bg-slate-800 p-3 sm:p-6">
      {loading && <div className="absolute inset-x-0 top-6 z-10 mx-auto w-fit bg-slate-950 px-3 py-2 text-xs font-bold text-white shadow">Loading preview…</div>}
      {previewError && <div role="alert" className="absolute inset-x-0 top-6 z-10 mx-auto w-fit border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-800 shadow">{previewError}</div>}
      {children ? <div className="document-print-root mx-auto origin-top transition-transform" style={{ width: `${zoom}%`, maxWidth: 'none' }}>{children}</div> : url && isPdf ? <div className="mx-auto h-full origin-top bg-white" style={{ width: `${zoom}%`, minWidth: 640 }}><iframe title={filename} src={url} onLoad={()=>setLoading(false)} onError={()=>{setLoading(false);setPreviewError('Unable to render this PDF preview.');}} className="h-full min-h-[700px] w-full border-0"/></div> : url && isImage ? <img src={url} alt={filename} onLoad={()=>setLoading(false)} onError={()=>{setLoading(false);setPreviewError('Unable to render this image preview.');}} className="mx-auto origin-top bg-white shadow-2xl" style={{ width: `${zoom}%`, maxWidth: 'none' }}/> : <div className="mx-auto mt-16 max-w-lg border border-slate-600 bg-slate-900 p-8 text-center text-white"><div className="text-lg font-bold">Preview unavailable</div><div className="mt-2 text-sm text-slate-300">{filename}</div><div className="mt-1 text-xs text-slate-400">{mimeType || ext.toUpperCase() || 'Unknown file type'}{formatSize(sizeBytes) ? ` · ${formatSize(sizeBytes)}` : ''}</div>{url && <a href={url} target="_blank" rel="noreferrer" className="mt-5 inline-flex h-9 items-center border border-slate-500 px-3 text-xs font-bold">Open or download</a>}</div>}
    </main>
  </div>;
}
