'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import type { SampleRecord } from './types';
import { colorPlateLabelFieldNames, populateColorPlateLabel, validateColorPlateLabelFields, type ColorPlateLabelFields } from './color-plate-label-fields';
import { colorPlatePrintHtml, type ColorPlateLabel } from './color-plate-label';
import { requireColorPlateLabelAccess, generateAuthorizedColorPlateLabel } from './color-plate-label-access';

const PRINT_SETUP_HINT_KEY = 'tenops.colorPlateLabel.printSetupDismissed.v1';

export default function ColorPlateLabelEditor({ sample, onClose }: { sample: SampleRecord; onClose: () => void }) {
  const auth = useAuth();
  const allowed = auth.accessAllowed && auth.can('readOperationalData') && auth.can('sample_labels.generate');
  const [confirmed, setConfirmed] = useState(false);
  const [showPrintHint, setShowPrintHint] = useState(false);
  const refreshAccess = auth.refreshProfile;
  const [fields, setFields] = useState(() => populateColorPlateLabel(sample));
  const [label, setLabel] = useState<ColorPlateLabel | null>(null);
  const [layoutError, setLayoutError] = useState('');
  const [printError, setPrintError] = useState('');
  const [printing, setPrinting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const printWindow = useRef<Window | null>(null);
  const access = useRef(allowed);
  useEffect(() => {
    access.current = allowed;
    if (!allowed) printWindow.current?.close();
  }, [allowed]);
  const mounted = useRef(true);
  const approved = Boolean(sample.approvedDate);
  const errors = validateColorPlateLabelFields(fields);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    mounted.current = true;
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus();
    return () => { mounted.current = false; printWindow.current?.close(); previous?.focus(); };
  }, []);

  useEffect(() => {
    if (confirmed) dialog.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus();
  }, [confirmed]);

  useEffect(() => {
    let cancelled = false;
    if (allowed) void requireColorPlateLabelAccess(sample.id).then(() => {
      if (!cancelled) {
        setConfirmed(true);
        try { setShowPrintHint(window.localStorage.getItem(PRINT_SETUP_HINT_KEY) !== '1'); }
        catch { setShowPrintHint(true); }
      }
    }).catch((e: unknown) => {
      if (!cancelled) { setLayoutError(e instanceof Error ? e.message : 'Label access could not be confirmed.'); void refreshAccess(); }
    });
    return () => { cancelled = true; };
  }, [allowed, sample.id, refreshAccess]);

  useEffect(() => {
    let cancelled = false;
    if (!confirmed || !allowed || Object.keys(validateColorPlateLabelFields(fields)).length) return;
    const timer = window.setTimeout(() => {
      void generateAuthorizedColorPlateLabel(fields, !approved, sample.id).then(next => {
        if (!cancelled) { setLabel(next); setLayoutError(''); }
      }).catch((e: unknown) => {
        if (!cancelled) { setLabel(null); setLayoutError(e instanceof Error ? e.message : 'The label could not be prepared.'); void refreshAccess(); }
      });
    }, 150);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [fields, approved, allowed, confirmed, sample.id, refreshAccess]);

  function change(key: keyof ColorPlateLabelFields, value: string) {
    setLabel(null); setLayoutError(''); setPrintError('');
    setFields(current => ({ ...current, [key]: value }));
  }

  function dismissPrintHint() {
    setShowPrintHint(false);
    try { window.localStorage.setItem(PRINT_SETUP_HINT_KEY, '1'); }
    catch { /* Dismiss for this visit even when browser storage is unavailable. */ }
  }

  function print() {
    if (!label || !allowed || !confirmed || Object.keys(errors).length) return;
    setPrintError('');
    // Open synchronously within the operator's click so normal popup protection permits it.
    // A standalone document lets its own @page rules control the browser print view.
    printWindow.current?.close();
    const target = window.open('', '_blank');
    if (!target) {
      setPrintError('Allow pop-ups for TenOps, then try Print again. Download PDF is also available.');
      return;
    }
    printWindow.current = target;
    setPrinting(true);
    target.opener = null;
    void requireColorPlateLabelAccess(sample.id).then(async () => {
      if (!mounted.current || !access.current || target.closed) return;
      target.document.open();
      target.document.write(colorPlatePrintHtml(label.svg));
      target.document.close();
      await target.document.fonts.ready;
      if (!mounted.current || !access.current || target.closed) return;
      target.focus();
      target.print();
    }).catch((e: unknown) => {
      target.close();
      if (mounted.current) { setLabel(null); setPrintError(e instanceof Error ? e.message : 'Printing access could not be confirmed.'); void refreshAccess(); }
    }).finally(() => { if (mounted.current) setPrinting(false); });
  }

  async function download() {
    if (!label || !allowed || !confirmed || Object.keys(errors).length) return;
    setPrinting(true); setPrintError('');
    try {
      await requireColorPlateLabelAccess(sample.id);
      if (!mounted.current || !access.current) return;
      const url = URL.createObjectURL(new Blob([new Uint8Array(label.pdf)], { type: 'application/pdf' }));
      const link = document.createElement('a'); link.href = url;
      link.download = `${fields.plate.replace(/[^a-z0-9_-]/gi, '_')}${approved ? '' : '-draft'}-label.pdf`;
      link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: unknown) {
      if (mounted.current) { setLabel(null); setPrintError(e instanceof Error ? e.message : 'Download access could not be confirmed.'); void refreshAccess(); }
    } finally { if (mounted.current) setPrinting(false); }
  }

  if (!allowed) return null;
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="color-plate-label-title" className="fixed inset-0 m-auto max-h-[90dvh] w-[min(94vw,680px)] overflow-y-auto border border-slate-400 bg-white p-5 text-slate-950 shadow-xl backdrop:bg-black/40">
    <div className="flex items-start justify-between gap-4"><div><h2 id="color-plate-label-title" className="text-xl font-bold">Print Color Plate Label</h2><p className="mt-1 text-sm text-slate-600">Review the wording, then print. Changes here apply only to this label.</p></div><button type="button" aria-label="Close label editor" onClick={onClose} className="min-h-10 px-2 font-bold">✕</button></div>
    {!confirmed && <p role="status" className="mt-3 text-sm">{layoutError || "Checking label access…"}</p>}
    {confirmed && <>
    {!approved && <p className="mt-3 border border-amber-300 bg-amber-50 p-2 text-sm font-semibold">Draft preview — this Sample has no approval date. The label will be marked DRAFT.</p>}
    <div className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2">
      {(Object.keys(colorPlateLabelFieldNames) as (keyof ColorPlateLabelFields)[]).map(key => <label key={key} className={`text-sm font-semibold ${key === 'finish' ? 'sm:col-span-2' : ''}`}>
        {colorPlateLabelFieldNames[key]} <span className="font-normal text-slate-500">(required)</span>
        <input autoFocus={key === 'project'} type={key === 'date' ? 'date' : 'text'} value={fields[key]} onChange={e => change(key, e.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `label-error-${key}` : undefined} className={`mt-1 block min-h-10 w-full border px-2 font-normal ${errors[key] ? 'border-red-600' : 'border-slate-400'}`} />
        {errors[key] && <span id={`label-error-${key}`} className="mt-1 block text-xs font-normal text-red-800">{errors[key]}</span>}
      </label>)}
    </div>
    <p className="mt-2 text-xs text-slate-600">Label edits are temporary. Reopening starts with the Sample information again.</p>
    {layoutError && <p role="alert" className="mt-3 text-sm text-red-800">{layoutError}</p>}
    {label && !Object.keys(errors).length && <div aria-label="Label preview" className="mt-4 overflow-x-auto border border-slate-300 bg-slate-50 p-3"><div className="mx-auto w-fit max-w-full bg-white [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: label.svg }} /></div>}
    {printError && <p role="alert" className="mt-3 text-sm text-red-800">{printError}</p>}
    {showPrintHint && <aside aria-label="Printer setup tip" className="mt-4 flex items-start gap-3 border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <p className="flex-1">Select DYMO LabelWriter 550 and label size 30256 the first time you print.</p>
      <button type="button" aria-label="Dismiss printer setup tip" onClick={dismissPrintHint} className="min-h-10 shrink-0 px-2 font-semibold underline">Got it</button>
    </aside>}
    <div className="mt-4 flex flex-wrap items-center gap-4"><button type="button" disabled={!label || Boolean(Object.keys(errors).length) || printing} onClick={print} className="min-h-11 bg-blue-900 px-7 text-sm font-bold text-white disabled:opacity-40">{printing ? 'Opening print…' : 'Print'}</button><button type="button" disabled={!label || printing || Boolean(Object.keys(errors).length)} onClick={()=>void download()} className="min-h-11 text-sm underline disabled:opacity-40">Download PDF</button><button type="button" onClick={onClose} className="ml-auto min-h-11 text-sm">Cancel</button></div>
    </>}
  </dialog>;
}
