'use client';

import {
  useEffect,
  useState,
} from 'react';

import type {
  NewProductionJob,
} from '../types';

type AddJobDialogProps = {
  isOpen: boolean;
  isSaving: boolean;
  errorMessage: string;
  onClose: () => void;
  onSubmit: (
    job: NewProductionJob,
  ) => Promise<void>;
};

type FormState = {
  name: string;
  customer: string;
  jobNumber: string;
  estimateNumber: string;
  workOrderNumber: string;

  depositDate: string;
  colorPlateNumber: string;
  sampleSubmittedDate: string;
  approvalDate: string;

  estimatedManHours: string;
  estimatedCalendarDays: string;

  requestedDeliveryDate: string;
  plannedStart: string;
  plannedEnd: string;

  remarks: string;
};

function getInitialForm(): FormState {
  return {
    name: '',
    customer: '',
    jobNumber: '',
    estimateNumber: '',
    workOrderNumber: '',

    depositDate: '',
    colorPlateNumber: '',
    sampleSubmittedDate: '',
    approvalDate: '',

    estimatedManHours: '',
    estimatedCalendarDays: '',

    requestedDeliveryDate: '',
    plannedStart: '',
    plannedEnd: '',

    remarks: '',
  };
}

const inputClass =
  'mt-1.5 h-11 w-full border border-slate-400 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-1 focus:ring-slate-950';

const labelClass =
  'block text-[10px] font-bold uppercase tracking-[0.13em] text-slate-600';

function parseOptionalNumber(
  value: string,
) {
  const trimmedValue =
    value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue =
    Number(trimmedValue);

  return Number.isFinite(
    parsedValue,
  )
    ? parsedValue
    : null;
}

export default function AddJobDialog({
  isOpen,
  isSaving,
  errorMessage,
  onClose,
  onSubmit,
}: AddJobDialogProps) {
  const [
    form,
    setForm,
  ] = useState<FormState>(
    getInitialForm,
  );

  const [
    validationError,
    setValidationError,
  ] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm(
      getInitialForm(),
    );

    setValidationError('');
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  function updateField<
    K extends keyof FormState,
  >(
    field: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setValidationError('');

    const name =
      form.name.trim();

    if (!name) {
      setValidationError(
        'Enter a project name.',
      );

      return;
    }

    const hasPlannedStart =
      Boolean(
        form.plannedStart,
      );

    const hasPlannedEnd =
      Boolean(
        form.plannedEnd,
      );

    if (
      hasPlannedStart !==
      hasPlannedEnd
    ) {
      setValidationError(
        'Enter both planned dates, or leave both blank for an unscheduled record.',
      );

      return;
    }

    if (
      form.plannedStart &&
      form.plannedEnd &&
      form.plannedEnd <
        form.plannedStart
    ) {
      setValidationError(
        'The planned finish date cannot be before the planned start date.',
      );

      return;
    }

    const estimatedManHours =
      parseOptionalNumber(
        form.estimatedManHours,
      );

    if (
      form.estimatedManHours.trim() &&
      (
        estimatedManHours ===
          null ||
        estimatedManHours < 0
      )
    ) {
      setValidationError(
        'Estimated man hours must be zero or greater.',
      );

      return;
    }

    const estimatedCalendarDays =
      parseOptionalNumber(
        form.estimatedCalendarDays,
      );

    if (
      form.estimatedCalendarDays.trim() &&
      (
        estimatedCalendarDays ===
          null ||
        estimatedCalendarDays <
          0 ||
        !Number.isInteger(
          estimatedCalendarDays,
        )
      )
    ) {
      setValidationError(
        'Estimated calendar days must be a whole number of zero or greater.',
      );

      return;
    }

    await onSubmit({
      name,

      customer:
        form.customer.trim() ||
        null,

      job_number:
        form.jobNumber.trim() ||
        null,

      estimate_number:
        form.estimateNumber.trim() ||
        null,

      work_order_number:
        form.workOrderNumber.trim() ||
        null,

      deposit_date:
        form.depositDate ||
        null,

      color_plate_number:
        form.colorPlateNumber.trim() ||
        null,

      sample_submitted_date:
        form.sampleSubmittedDate ||
        null,

      approval_date:
        form.approvalDate ||
        null,

      estimated_man_hours:
        estimatedManHours,

      estimated_calendar_days:
        estimatedCalendarDays,

      requested_delivery_date:
        form.requestedDeliveryDate ||
        null,

      planned_start:
        form.plannedStart ||
        null,

      planned_end:
        form.plannedEnd ||
        null,

      remarks:
        form.remarks.trim() ||
        null,
    });
  }

  const displayedError =
    validationError ||
    errorMessage;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 px-3 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-job-title"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !isSaving
        ) {
          onClose();
        }
      }}
    >
      <div className="max-h-full w-full max-w-5xl overflow-y-auto border border-slate-500 bg-[#eef1f4] shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-400 bg-white px-5 py-4 sm:px-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Production Pipeline
            </div>

            <h2
              id="new-job-title"
              className="mt-1 text-2xl font-bold tracking-tight text-slate-950"
            >
              New Production Record
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Add a project to the pipeline. Only the project name is required.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close new production record dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-slate-400 bg-white text-xl font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 px-5 py-5 sm:px-6">
            <section>
              <div className="mb-3 border-b border-slate-300 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">
                  Project Identity
                </h3>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <label className={labelClass}>
                  Project Name
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) =>
                      updateField(
                        'name',
                        event.target.value,
                      )
                    }
                    placeholder="Project name"
                    autoFocus
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  Customer
                  <input
                    type="text"
                    value={
                      form.customer
                    }
                    onChange={(event) =>
                      updateField(
                        'customer',
                        event.target.value,
                      )
                    }
                    placeholder="Customer or contractor"
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  Job Number
                  <input
                    type="text"
                    value={
                      form.jobNumber
                    }
                    onChange={(event) =>
                      updateField(
                        'jobNumber',
                        event.target.value,
                      )
                    }
                    placeholder="Add when assigned"
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  Estimate Number
                  <input
                    type="text"
                    value={
                      form.estimateNumber
                    }
                    onChange={(event) =>
                      updateField(
                        'estimateNumber',
                        event.target.value,
                      )
                    }
                    placeholder="Estimate number"
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  Work Order Number
                  <input
                    type="text"
                    value={
                      form.workOrderNumber
                    }
                    onChange={(event) =>
                      updateField(
                        'workOrderNumber',
                        event.target.value,
                      )
                    }
                    placeholder="Add when assigned"
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  Deposit Received
                  <input
                    type="date"
                    value={
                      form.depositDate
                    }
                    onChange={(event) =>
                      updateField(
                        'depositDate',
                        event.target.value,
                      )
                    }
                    className={inputClass}
                  />
                </label>
              </div>
            </section>

            <section>
              <div className="mb-3 border-b border-slate-300 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">
                  Pre-Production
                </h3>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <label className={labelClass}>
                  Color Plate Number
                  <input
                    type="text"
                    value={
                      form.colorPlateNumber
                    }
                    onChange={(event) =>
                      updateField(
                        'colorPlateNumber',
                        event.target.value,
                      )
                    }
                    placeholder="Add when assigned"
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  Sample Submitted
                  <input
                    type="date"
                    value={
                      form.sampleSubmittedDate
                    }
                    onChange={(event) =>
                      updateField(
                        'sampleSubmittedDate',
                        event.target.value,
                      )
                    }
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  Approval Date
                  <input
                    type="date"
                    value={
                      form.approvalDate
                    }
                    onChange={(event) =>
                      updateField(
                        'approvalDate',
                        event.target.value,
                      )
                    }
                    className={inputClass}
                  />
                </label>
              </div>
            </section>

            <section>
              <div className="mb-3 border-b border-slate-300 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">
                  Production Planning
                </h3>
              </div>

              <div className="mb-4 border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                Planned dates are optional. Records without both dates will remain visible as unscheduled work.
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <label className={labelClass}>
                  Estimated Man Hours
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={
                      form.estimatedManHours
                    }
                    onChange={(event) =>
                      updateField(
                        'estimatedManHours',
                        event.target.value,
                      )
                    }
                    placeholder="Optional"
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  Estimated Calendar Days
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={
                      form.estimatedCalendarDays
                    }
                    onChange={(event) =>
                      updateField(
                        'estimatedCalendarDays',
                        event.target.value,
                      )
                    }
                    placeholder="Optional"
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  Requested Delivery
                  <input
                    type="date"
                    value={
                      form.requestedDeliveryDate
                    }
                    onChange={(event) =>
                      updateField(
                        'requestedDeliveryDate',
                        event.target.value,
                      )
                    }
                    className={inputClass}
                  />
                </label>

                <div />

                <label className={labelClass}>
                  Planned Start
                  <input
                    type="date"
                    value={
                      form.plannedStart
                    }
                    onChange={(event) =>
                      updateField(
                        'plannedStart',
                        event.target.value,
                      )
                    }
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  Planned Finish
                  <input
                    type="date"
                    value={
                      form.plannedEnd
                    }
                    min={
                      form.plannedStart ||
                      undefined
                    }
                    onChange={(event) =>
                      updateField(
                        'plannedEnd',
                        event.target.value,
                      )
                    }
                    className={inputClass}
                  />
                </label>
              </div>
            </section>

            <section>
              <div className="mb-3 border-b border-slate-300 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">
                  Remarks
                </h3>
              </div>

              <label className={labelClass}>
                Project Notes
                <textarea
                  value={
                    form.remarks
                  }
                  onChange={(event) =>
                    updateField(
                      'remarks',
                      event.target.value,
                    )
                  }
                  placeholder="Optional project notes"
                  rows={4}
                  className="mt-1.5 w-full resize-y border border-slate-400 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                />
              </label>
            </section>
          </div>

          {displayedError && (
            <div className="mx-5 mb-5 border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 sm:mx-6">
              {displayedError}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-400 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-11 border border-slate-400 bg-white px-5 text-xs font-bold uppercase tracking-[0.08em] text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="h-11 border border-slate-950 bg-slate-900 px-6 text-xs font-bold uppercase tracking-[0.08em] text-white transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving
                ? 'Creating Record…'
                : 'Create Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}