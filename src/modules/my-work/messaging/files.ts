export const MAX_FILE_BYTES = 50_000_000;
export const MAX_MESSAGE_BYTES = 200_000_000;
export const MAX_PREVIEW_BYTES = 20_000_000;
export const INBOX_ATTACHMENT_BUCKET = 'my-work-inbox-attachments';
export const BINARY_TYPE = 'application/octet-stream';
export type FileDescriptor = { name: string; size: number; type?: string };

export function validateFiles(files: FileDescriptor[]) {
  let total = 0;
  for (const file of files) {
    if (!file.name || [...file.name].length > 500 || file.name.includes('\0')) throw new Error('Filenames must contain 1–500 characters without null characters.');
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_FILE_BYTES) throw new Error(`${file.name} exceeds the 50 MB file limit.`);
    total += file.size;
  }
  if (total > MAX_MESSAGE_BYTES) throw new Error('Attachments exceed the 200 MB message limit.');
  return total;
}
export const fileSize = (bytes: number) => bytes < 1000 ? `${bytes} B` : bytes < 1_000_000 ? `${(bytes / 1000).toFixed(1)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;
export const fileExtension = (name: string) => name.match(/\.([a-z0-9]{1,20})$/i)?.[1].toUpperCase() || 'File';
const rasterExtensions: Record<string, RegExp> = {
  'image/png': /\.png$/i, 'image/jpeg': /\.jpe?g$/i, 'image/gif': /\.gif$/i, 'image/webp': /\.webp$/i,
};
export function canPreview(file: { originalFilename: string; contentType: string; byteSize: number }) {
  return file.byteSize > 0 && file.byteSize <= MAX_PREVIEW_BYTES && !!rasterExtensions[file.contentType]?.test(file.originalFilename);
}
// Classification is a preview hint, never a transfer allowlist or malware verdict.
export async function previewType(file: File) {
  if (!canPreview({ originalFilename: file.name, contentType: file.type, byteSize: file.size })) return BINARY_TYPE;
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const text = String.fromCharCode(...bytes);
  const valid = file.type === 'image/png' ? [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)
    : file.type === 'image/jpeg' ? bytes[0]===255 && bytes[1]===216 && bytes[2]===255
    : file.type === 'image/gif' ? /^GIF8[79]a/.test(text)
    : text.startsWith('RIFF') && text.slice(8,12)==='WEBP';
  return valid ? file.type : BINARY_TYPE;
}
export function downloadUrl(signedUrl: string, name: string) {
  const url = new URL(signedUrl);
  // URLSearchParams escapes delimiters; never interpolate an original name into a URL/header.
  url.searchParams.set('download', name.replace(/[\u0000-\u001f\u007f/\\]/g, '_') || 'attachment');
  return url.toString();
}
export function resumableEndpoint(base: string) {
  const url = new URL(base);
  if (url.hostname.endsWith('.supabase.co') && !url.hostname.endsWith('.storage.supabase.co')) url.hostname = url.hostname.replace(/\.supabase\.co$/, '.storage.supabase.co');
  url.pathname = '/storage/v1/upload/resumable';
  return url.toString();
}
