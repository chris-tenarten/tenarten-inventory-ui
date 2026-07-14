'use client';

import { Paperclip, ExternalLink, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  createJobAttachmentDownloadUrl,
  deleteJobAttachment,
  loadJobAttachments,
  uploadJobAttachments,
} from '../jobs';
import type {
  JobAttachment,
  JobDocumentType,
  ProductionJob,
} from '../types';

type Props = {
  job: ProductionJob | null;
  onClose: () => void;
  onChanged: (jobId: string, attachmentCount: number) => void;
};

const documentTypes: Array<{ value: JobDocumentType; label: string }> = [
  { value: 'estimate', label: 'Estimate' },
  { value: 'work_order', label: 'Work Order' },
  { value: 'blend_sheet', label: 'Blend Sheet' },
  { value: 'shop_drawing', label: 'Shop Drawing' },
  { value: 'cut_ticket', label: 'Cut Ticket' },
  { value: 'color_plate', label: 'Color Plate' },
  { value: 'sample_approval', label: 'Sample / Approval' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'photo', label: 'Photo' },
  { value: 'other', label: 'Other' },
];

function formatFileSize(bytes: number | null) {
  if (bytes === null) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}

function documentTypeLabel(value: JobDocumentType) {
  return documentTypes.find((option) => option.value === value)?.label ?? value;
}

export default function JobAttachmentsPanel({
  job,
  onClose,
  onChanged,
}: Props) {
  const [attachments, setAttachments] = useState<JobAttachment[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState<JobDocumentType>('other');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!job) {
      setAttachments([]);
      setSelectedFiles([]);
      setErrorMessage('');
      return;
    }

    const currentJob = job;
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const files = await loadJobAttachments(currentJob.id);
        if (!cancelled) setAttachments(files);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Unable to load attachments.',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [job]);

  if (!job) return null;

  async function handleUpload() {
    if (!job || selectedFiles.length === 0) return;

    setIsUploading(true);
    setErrorMessage('');
    try {
      const uploaded = await uploadJobAttachments(
        job.id,
        selectedFiles,
        documentType,
      );
      const next = [...uploaded, ...attachments];
      setAttachments(next);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onChanged(job.id, next.length);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to upload attachments.',
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleOpen(attachment: JobAttachment) {
    setErrorMessage('');
    try {
      const url = await createJobAttachmentDownloadUrl(attachment.storage_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to open attachment.',
      );
    }
  }

  async function handleDelete(attachment: JobAttachment) {
    if (!job) return;
    if (!window.confirm(`Remove “${attachment.file_name}” from this job?`)) return;

    setDeletingId(attachment.id);
    setErrorMessage('');
    try {
      await deleteJobAttachment(attachment);
      const next = attachments.filter((item) => item.id !== attachment.id);
      setAttachments(next);
      onChanged(job.id, next.length);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to remove attachment.',
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/45"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-attachments-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isUploading && !deletingId) {
          onClose();
        }
      }}
    >
      <div className="flex h-full w-full max-w-xl flex-col border-l border-slate-500 bg-[#eef1f4] shadow-[-20px_0_60px_rgba(15,23,42,0.25)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-400 bg-white px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              <Paperclip className="h-3.5 w-3.5" />
              Job Attachments
            </div>
            <h2 id="job-attachments-title" className="mt-1 truncate text-xl font-bold text-slate-950">
              {job.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading || Boolean(deletingId)}
            aria-label="Close attachments"
            className="inline-flex h-9 w-9 items-center justify-center border border-slate-400 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <section className="border border-slate-400 bg-white">
            <div className="border-b border-slate-300 bg-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-700">
              Upload Files
            </div>
            <div className="space-y-4 p-4">
              <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                Document Type
                <select
                  value={documentType}
                  onChange={(event) =>
                    setDocumentType(event.target.value as JobDocumentType)
                  }
                  disabled={isUploading}
                  className="mt-1.5 h-10 w-full border border-slate-400 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-950"
                >
                  {documentTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                disabled={isUploading}
                onChange={(event) =>
                  setSelectedFiles(Array.from(event.target.files ?? []))
                }
                className="block w-full text-sm text-slate-700 file:mr-3 file:h-10 file:border file:border-slate-400 file:bg-slate-100 file:px-4 file:text-xs file:font-bold file:uppercase file:tracking-[0.06em] file:text-slate-700 hover:file:bg-slate-200"
              />

              {selectedFiles.length > 0 && (
                <div className="border border-slate-300 bg-slate-50">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${file.size}-${index}`}
                      className="flex items-center justify-between gap-3 border-b border-slate-300 px-3 py-2 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {file.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFiles((current) =>
                            current.filter((_, fileIndex) => fileIndex !== index),
                          )
                        }
                        disabled={isUploading}
                        className="text-xs font-bold uppercase tracking-[0.06em] text-red-700 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={isUploading || selectedFiles.length === 0}
                className="inline-flex h-10 w-full items-center justify-center gap-2 border border-slate-950 bg-slate-900 px-4 text-xs font-bold uppercase tracking-[0.08em] text-white hover:bg-slate-950 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:text-slate-600"
              >
                <Upload className="h-4 w-4" />
                {isUploading ? 'Uploading…' : 'Upload Files'}
              </button>
            </div>
          </section>

          <section className="mt-5 border border-slate-400 bg-white">
            <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-4 py-3">
              <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-700">
                Existing Files
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {attachments.length}
              </span>
            </div>

            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm font-semibold text-slate-600">
                Loading attachments…
              </div>
            ) : attachments.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                No files attached.
              </div>
            ) : (
              attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-start justify-between gap-4 border-b border-slate-300 px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-slate-950">
                      {attachment.file_name}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>{documentTypeLabel(attachment.document_type)}</span>
                      <span>{formatFileSize(attachment.size_bytes)}</span>
                      <span>{formatDate(attachment.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void handleOpen(attachment)}
                      className="inline-flex h-8 items-center gap-1.5 border border-slate-400 bg-white px-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-700 hover:bg-slate-100"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(attachment)}
                      disabled={deletingId === attachment.id}
                      className="inline-flex h-8 items-center gap-1.5 border border-red-300 bg-red-50 px-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deletingId === attachment.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>

          {errorMessage && (
            <div className="mt-5 border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}