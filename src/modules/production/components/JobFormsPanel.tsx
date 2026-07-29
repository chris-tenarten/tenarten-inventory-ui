'use client';

import { FileText, Quote } from 'lucide-react';

import type { ProductionJob } from '../types';
import { JobTag } from './JobTag';

type Props = {
  job: ProductionJob | null;
  onClose: () => void;
};

type PlaceholderForm = {
  title: string;
  description: string;
  icon: typeof FileText;
};

const placeholderForms: PlaceholderForm[] = [
  {
    title: 'Quote',
    description:
      'Will generate from the job record and prepopulate available project, customer, estimate, and scope information.',
    icon: Quote,
  },
];

export default function JobFormsPanel({ job, onClose }: Props) {
  if (!job) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/45"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-forms-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex h-full w-full max-w-lg flex-col border-l border-slate-500 bg-[#eef1f4] shadow-[-20px_0_60px_rgba(15,23,42,0.25)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-400 bg-white px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Job Workspace · Forms
            </div>

            <h2
              id="job-forms-title"
              className="mt-1 truncate text-xl font-bold text-slate-950"
            >
              {job.name}
            </h2>

            <div className="mt-2"><JobTag label={job.name} /></div>

            <p className="mt-1 text-sm text-slate-600">
              Preview of forms that will eventually generate from this job record.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close forms panel"
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-slate-400 bg-white text-xl font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <div className="font-bold">Proof of concept</div>
            <div className="mt-1 text-xs leading-5">
              These templates are placeholders only. No document is generated or saved yet.
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {placeholderForms.map((form) => {
              const Icon = form.icon;

              return (
                <section
                  key={form.title}
                  className="border border-slate-400 bg-white"
                >
                  <div className="flex items-start gap-3 px-4 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-slate-300 bg-slate-100 text-slate-700">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-base font-bold text-slate-950">
                          {form.title}
                        </h3>

                        <span className="border border-amber-300 bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-amber-800">
                          Planned
                        </span>
                      </div>

                      <p className="mt-2 text-sm leading-5 text-slate-600">
                        {form.description}
                      </p>

                      <button
                        type="button"
                        disabled
                        className="mt-4 inline-flex h-9 items-center gap-2 border border-slate-300 bg-slate-100 px-3 text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400"
                      >
                        <FileText className="h-4 w-4" />
                        Generate Form
                      </button>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
