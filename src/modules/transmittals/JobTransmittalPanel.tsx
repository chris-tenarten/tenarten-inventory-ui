"use client";

import { Download, Eye, FileText, Info, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DocumentViewer from "@/components/documents/DocumentViewer";
import type { ProductionJob } from "@/modules/production/types";
import { createJobTransmittalDraft, createTransmittalItem } from "./defaults";
import {
  generateJobTransmittalPdf,
  getJobTransmittalPdfUrl,
  loadProvisionalTransmittalNumber,
  downloadJobTransmittalPdf,
  issueJobTransmittal,
  previewJobTransmittal,
} from "./mutations";
import { loadJobTransmittals } from "./queries";
import type { JobTransmittalDraft, JobTransmittalRecord } from "./types";
import { validateJobTransmittal } from "./validation";

const names = ["Anthony", "Chris", "Gio", "Marcos", "Pat"];
const field = "mt-1 h-9 w-full rounded-sm border border-slate-300 bg-white px-2 text-sm";
const area = "mt-1 w-full rounded-sm border border-slate-300 bg-white px-2 py-2 text-sm";
const label = "text-xs font-bold text-slate-700";
const section = "border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-700";
const senderKey = "tenops.job-transmittal.sender";

type Props = { job: ProductionJob; onClose(): void };

export default function JobTransmittalPanel({ job, onClose }: Props) {
  const initialDraftRef = useRef<JobTransmittalDraft>(createJobTransmittalDraft(job));
  const [draft, setDraft] = useState<JobTransmittalDraft>(initialDraftRef.current);
  const [history, setHistory] = useState<JobTransmittalRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [busy, setBusy] = useState<"preview" | "issue" | string>("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ url: string; filename: string } | null>(null);
  const [senderChoice, setSenderChoice] = useState(
    names.includes(initialDraftRef.current.senderName) ? initialDraftRef.current.senderName : "Other",
  );
  const [historyMode, setHistoryMode] = useState(false);
  const [provisionalNumber, setProvisionalNumber] = useState("");
  const [numberOverride, setNumberOverride] = useState(false);
  const [issuedRecord, setIssuedRecord] = useState<{id:string;number:string}|null>(null);
  const [showEarlyAccessBanner, setShowEarlyAccessBanner] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pristineRef = useRef(JSON.stringify(initialDraftRef.current));
  const errors = useMemo(() => validateJobTransmittal(draft), [draft]);
  const dirty = JSON.stringify(draft) !== pristineRef.current;

  useEffect(() => {
    try {
      const remembered = JSON.parse(localStorage.getItem(senderKey) || "{}") as {
        name?: string; phone?: string; email?: string;
      };
      if (remembered.name) {
        setDraft((current) => {
          const next = {...current,senderName:remembered.name || "",senderPhone:remembered.phone || "",senderEmail:remembered.email || ""};
          pristineRef.current = JSON.stringify(next);
          return next;
        });
        setSenderChoice(names.includes(remembered.name) ? remembered.name : "Other");
      }
    } catch {}
  }, []);

  useEffect(() => {
    let active = true;
    loadProvisionalTransmittalNumber(job.id)
      .then((number) => { if (active) setProvisionalNumber(number); })
      .catch(() => {});
    return () => { active = false; };
  }, [job.id]);

  const reload = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistory(await loadJobTransmittals(job.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load transmittal history.");
    } finally {
      setHistoryLoading(false);
    }
  }, [job.id]);
  useEffect(() => { void reload(); }, [reload]);

  const requestClose = useCallback(() => {
    if (dirty && !issuedRecord && !window.confirm("Discard this unsaved Letter of Transmittal?")) return;
    onClose();
  }, [dirty, issuedRecord, onClose]);

  useEffect(() => {
    closeRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); requestClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button,input,select,textarea")].filter((element)=>!element.hasAttribute("disabled"));
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    };
    window.addEventListener("keydown",key);
    return () => window.removeEventListener("keydown",key);
  }, [requestClose]);

  useEffect(() => {
    if (!dirty || issuedRecord) return;
    const warn = (event:BeforeUnloadEvent) => { event.preventDefault(); event.returnValue=""; };
    window.addEventListener("beforeunload",warn);
    return () => window.removeEventListener("beforeunload",warn);
  }, [dirty,issuedRecord]);

  const patch = <K extends keyof JobTransmittalDraft>(key: K, value: JobTransmittalDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const rememberSender = () => localStorage.setItem(senderKey, JSON.stringify({
    name: draft.senderName.trim(), phone: draft.senderPhone.trim(), email: draft.senderEmail.trim(),
  }));

  async function previewDraft() {
    setBusy("preview"); setError("");
    try {
      const displayedNumber = draft.transmittalNumber.trim() || provisionalNumber;
      const blob = await previewJobTransmittal({
        ...draft,
        transmittalNumber: displayedNumber,
      });
      setPreview({ url: URL.createObjectURL(blob), filename: `${displayedNumber || "Provisional-Transmittal"}.pdf` });
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Unable to preview the transmittal.");
    } finally { setBusy(""); }
  }

  async function issue() {
    if (issuedRecord) { setError(`Transmittal ${issuedRecord.number} is already issued. Generate or retry that record instead of issuing another number.`); return; }
    if (errors.length) { setError(errors[0]); return; }
    if (!window.confirm("Generate this immutable Letter of Transmittal? Its submitted content cannot be edited later.")) return;
    setBusy("issue"); setError("");
    try {
      rememberSender();
      const displayedNumber = draft.transmittalNumber.trim() || provisionalNumber;
      const issued = await issueJobTransmittal(
        { ...draft, transmittalNumber: displayedNumber },
        numberOverride ? displayedNumber : null,
      );
      setIssuedRecord(issued);
      await generateJobTransmittalPdf(issued.id);
      await downloadJobTransmittalPdf(issued.id, `${issued.number}.pdf`);
      setDraft({
        ...createJobTransmittalDraft(job),
        senderName: draft.senderName,
        senderPhone: draft.senderPhone,
        senderEmail: draft.senderEmail,
      });
      setNumberOverride(false);
      void loadProvisionalTransmittalNumber(job.id)
        .then(setProvisionalNumber)
        .catch(() => {});
      await reload();
      setHistoryMode(true);
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : "Unable to generate the transmittal.");
      await reload();
    } finally { setBusy(""); }
  }

  async function openRecord(record: JobTransmittalRecord, download = false) {
    setBusy(record.id); setError("");
    try {
      const url = await getJobTransmittalPdfUrl(record.id);
      if (download) await downloadJobTransmittalPdf(record.id, `${record.transmittalNumber}.pdf`);
      else setPreview({ url, filename: `${record.transmittalNumber}.pdf` });
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Unable to open the transmittal.");
    } finally { setBusy(""); }
  }

  async function retry(record: JobTransmittalRecord) {
    setBusy(record.id); setError("");
    try {
      await generateJobTransmittalPdf(record.id);
      await downloadJobTransmittalPdf(record.id, `${record.transmittalNumber}.pdf`);
      await reload();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Unable to retry PDF generation.");
      await reload();
    } finally { setBusy(""); }
  }

  return <>
    <div className="fixed inset-0 z-[120] bg-slate-950/45" role="dialog" aria-modal="true" aria-label="Letter of Transmittal">
      <div ref={dialogRef} className="ml-auto flex h-full w-full max-w-4xl flex-col bg-[#eef1f4] shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-300 bg-white px-5 py-4">
          <div><div className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-500">Production · Forms</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-950">Letter of Transmittal</h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">{job.job_number || "No job number"} · {job.name}</p></div>
          <button ref={closeRef} type="button" onClick={requestClose} className="flex h-9 w-9 items-center justify-center border border-slate-300 bg-white" aria-label="Close"><X className="h-5 w-5"/></button>
        </header>
        {showEarlyAccessBanner && (
          <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50/80 px-5 py-2.5 text-sm text-amber-950 sm:items-center">
            <Info className="mt-1 h-4 w-4 shrink-0 text-amber-700 sm:mt-0" aria-hidden="true" />
            <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
              <div className="shrink-0 font-bold">Early Access</div>
              <div className="text-amber-900">
                This workflow is still under active development. Feedback is welcome.
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss Early Access notice"
              onClick={() => setShowEarlyAccessBanner(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-amber-800 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex border-b border-slate-300 bg-white px-5">
          <button type="button" onClick={() => setHistoryMode(false)} className={`min-h-11 border-b-2 px-3 text-sm font-bold ${!historyMode ? "border-blue-800 text-blue-900" : "border-transparent text-slate-500"}`}>Create</button>
          <button type="button" onClick={() => setHistoryMode(true)} className={`min-h-11 border-b-2 px-3 text-sm font-bold ${historyMode ? "border-blue-800 text-blue-900" : "border-transparent text-slate-500"}`}>History ({history.length})</button>
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto p-5">
          <div>
          {error && <div role="alert" className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</div>}
          {historyMode ? <div className="space-y-3">
            {historyLoading ? <p className="text-sm text-slate-600">Loading history…</p> : history.length === 0 ? <div className="border border-slate-300 bg-white p-5 text-sm text-slate-600">No Letters of Transmittal have been generated for this job.</div> : history.map((record) =>
              <article key={record.id} className="flex flex-wrap items-center gap-3 border border-slate-300 bg-white p-4">
                <FileText className="h-5 w-5 text-slate-500"/><div className="min-w-0 flex-1"><div className="font-bold">{record.transmittalNumber}</div>
                  <div className="text-xs text-slate-500">{record.documentDate} · {record.recipientName} · {record.generatedBy}</div>
                  <div className="mt-1 text-[11px] text-slate-500">Issued {new Date(record.issuedAt).toLocaleString()}{record.generatedAt ? ` · PDF generated ${new Date(record.generatedAt).toLocaleString()}` : ""}</div>
                  {record.documentStatus === "failed" && <div className="mt-1 text-xs font-semibold text-red-700">{record.documentError || "PDF generation failed."}</div>}</div>
                <span className="text-xs font-bold uppercase text-slate-500">{record.documentStatus}</span>
                {record.documentStatus === "generated" && <><button type="button" disabled={busy === record.id} onClick={() => openRecord(record)} className="inline-flex h-9 items-center gap-1 border border-slate-300 px-3 text-xs font-bold"><Eye className="h-4 w-4"/>Preview</button>
                  <button type="button" disabled={busy === record.id} onClick={() => openRecord(record,true)} className="inline-flex h-9 items-center gap-1 border border-slate-300 px-3 text-xs font-bold"><Download className="h-4 w-4"/>Download</button></>}
                {record.documentStatus !== "generated" && record.recoverable && <button type="button" disabled={busy === record.id} onClick={() => retry(record)} className="inline-flex h-9 items-center gap-1 border border-amber-400 bg-amber-50 px-3 text-xs font-bold text-amber-900"><RefreshCw className="h-4 w-4"/>{record.documentStatus==="pending"?"Generate":record.documentStatus==="generating"?"Resume":"Retry"}</button>}
              </article>)}
          </div> : <div className="space-y-5">
            <section className="border border-slate-300 bg-white p-4"><h3 className={section}>Document details</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className={label}>Date<input type="date" value={draft.documentDate} onChange={(e)=>patch("documentDate",e.target.value)} className={field}/></label>
                <label className={label}>Transmittal # <span className="font-normal text-slate-500">(optional override)</span><input value={draft.transmittalNumber || provisionalNumber} onChange={(e)=>{setNumberOverride(Boolean(e.target.value.trim()));patch("transmittalNumber",e.target.value);}} placeholder="Allocated when generated" className={field}/>{provisionalNumber && !numberOverride && <span className="mt-1 block text-[11px] font-normal text-slate-500">Checked against existing Purchase Orders and Transmittals. Rechecked when generated.</span>}</label>
                <label className={label}>Job #<input value={draft.jobNumber} onChange={(e)=>patch("jobNumber",e.target.value)} className={field}/></label>
                <label className={label}>Job name<input value={draft.jobName} onChange={(e)=>patch("jobName",e.target.value)} className={field}/></label>
                <label className={`${label} sm:col-span-2`}>Customer Name<input value={draft.customer} onChange={(e)=>patch("customer",e.target.value)} className={field}/><span className="mt-1 block text-[10px] font-normal text-slate-500">Populated from the Production job for this document only. Editing it does not change the job.</span></label></div></section>
            <section className="border border-slate-300 bg-white p-4"><h3 className={section}>Recipient</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className={`${label} sm:col-span-2`}>Attention<input value={draft.recipient.attention} onChange={(e)=>patch("recipient",{...draft.recipient,attention:e.target.value})} className={field}/></label>
                <label className={`${label} sm:col-span-2`}>Address<textarea value={draft.recipient.addressLine1} onChange={(e)=>patch("recipient",{...draft.recipient,addressLine1:e.target.value})} rows={3} className={area}/></label>
                <label className={`${label} sm:col-span-2`}>Address line 2 <span className="font-normal text-slate-500">(optional)</span><textarea value={draft.recipient.addressLine2} onChange={(e)=>patch("recipient",{...draft.recipient,addressLine2:e.target.value})} rows={2} className={area}/></label>
                <label className={label}>Office phone<input value={draft.recipient.officePhone} onChange={(e)=>patch("recipient",{...draft.recipient,officePhone:e.target.value})} className={field}/></label>
                <label className={label}>Mobile phone<input value={draft.recipient.mobilePhone} onChange={(e)=>patch("recipient",{...draft.recipient,mobilePhone:e.target.value})} className={field}/></label>
                <label className={label}>Email<input type="email" value={draft.recipient.email} onChange={(e)=>patch("recipient",{...draft.recipient,email:e.target.value})} className={field}/></label>
                <label className={label}>CC<input value={draft.cc} onChange={(e)=>patch("cc",e.target.value)} className={field}/></label></div></section>
            <section className="border border-slate-300 bg-white p-4"><h3 className={section}>Delivery and item types</h3>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3 text-sm"><label><input type="checkbox" checked={draft.deliveryAttached} onChange={(e)=>patch("deliveryAttached",e.target.checked)} className="mr-2"/>Attached</label>
                <label><input type="checkbox" checked={draft.deliverySeparateCover} onChange={(e)=>patch("deliverySeparateCover",e.target.checked)} className="mr-2"/>Under Separate Cover Via</label>
                <input value={draft.deliveryVia} onChange={(e)=>patch("deliveryVia",e.target.value)} aria-label="Delivery via" className="h-8 border border-slate-300 px-2" placeholder="Method"/>
                {[["typeShopDrawing","Shop Drawing"],["typeLetter","Letter"],["typeSamples","Samples"],["typeOther","Other"]].map(([key,text])=><label key={key}><input type="checkbox" checked={Boolean(draft[key as keyof JobTransmittalDraft])} onChange={(e)=>patch(key as keyof JobTransmittalDraft,e.target.checked as never)} className="mr-2"/>{text}</label>)}
                {draft.typeOther && <input value={draft.typeOtherLabel} onChange={(e)=>patch("typeOtherLabel",e.target.value)} aria-label="Other item type" className="h-8 border border-slate-300 px-2" placeholder="Other type"/>}</div></section>
            <section className="border border-slate-300 bg-white p-4"><div className="flex items-center justify-between"><h3 className={section}>Items being transmitted</h3>
              <button type="button" onClick={()=>patch("items",[...draft.items,createTransmittalItem()])} className="inline-flex h-8 items-center gap-1 border border-slate-300 px-2 text-xs font-bold"><Plus className="h-4 w-4"/>Add row</button></div>
              <div className="mt-3 space-y-3">{draft.items.map((item,index)=><div key={item.id} className="grid gap-2 border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1.2fr_.5fr_.8fr_.8fr_2fr_auto]">
                {([["submittal","Submittal"],["quantity","Qty"],["date","Date"],["number","Number"],["description","Description"]] as const).map(([key,text])=><label key={key} className={label}>{text}{key==="description"?<textarea value={item[key]} onChange={(e)=>patch("items",draft.items.map((row,i)=>i===index?{...row,[key]:e.target.value}:row))} rows={2} className={area}/>:<input type={key==="date"?"date":"text"} value={item[key]} onChange={(e)=>patch("items",draft.items.map((row,i)=>i===index?{...row,[key]:e.target.value}:row))} className={field}/>}</label>)}
                <button type="button" disabled={draft.items.length===1} onClick={()=>patch("items",draft.items.filter((_,i)=>i!==index))} className="mt-5 h-9 w-9 border border-slate-300 text-red-700 disabled:opacity-30" aria-label={`Remove item ${index+1}`}><Trash2 className="mx-auto h-4 w-4"/></button></div>)}</div></section>
            <section className="border border-slate-300 bg-white p-4"><h3 className={section}>Purpose</h3>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">{[["purposeApproval","For Approval"],["purposeUse","For Your Use"],["purposeRecord","For Record Purpose"],["purposeRfi","Request for Information"],["purposeReview","Review and Advise By"]].map(([key,text])=><label key={key}><input type="checkbox" checked={Boolean(draft[key as keyof JobTransmittalDraft])} onChange={(e)=>patch(key as keyof JobTransmittalDraft,e.target.checked as never)} className="mr-2"/>{text}</label>)}
                {draft.purposeReview&&<input type="date" value={draft.reviewBy} onChange={(e)=>patch("reviewBy",e.target.value)} aria-label="Review by" className="h-8 border border-slate-300 px-2"/>}</div>
              <label className={`${label} mt-4 block`}>Comments<textarea value={draft.comments} onChange={(e)=>patch("comments",e.target.value)} rows={5} className={area}/></label></section>
            <section className="border border-slate-300 bg-white p-4"><h3 className={section}>Sender</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3"><label className={label}>Transmitted by<select value={senderChoice} onChange={(e)=>{setSenderChoice(e.target.value);if(e.target.value!=="Other")patch("senderName",e.target.value);}} className={field}>{names.map((name)=><option key={name}>{name}</option>)}<option>Other</option></select>
                {senderChoice==="Other"&&<input value={draft.senderName} onChange={(e)=>patch("senderName",e.target.value)} className={field} placeholder="Sender name"/>}</label>
                <label className={label}>Phone<input value={draft.senderPhone} onChange={(e)=>patch("senderPhone",e.target.value)} className={field}/></label>
                <label className={label}>Email<input type="email" value={draft.senderEmail} onChange={(e)=>patch("senderEmail",e.target.value)} className={field}/></label></div></section>
          </div>}
          </div>
        </main>
        {!historyMode && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-300 bg-white px-5 py-3">
          <div className="text-xs text-slate-500">{errors.length ? errors[0] : "Preview does not reserve a number or create history."}</div>
          <div className="flex gap-2"><button type="button" disabled={Boolean(busy)} onClick={previewDraft} className="inline-flex h-10 items-center gap-2 border border-slate-400 bg-white px-4 text-sm font-bold"><Eye className="h-4 w-4"/>{busy==="preview"?"Rendering…":"Preview PDF"}</button>
            <button type="button" disabled={Boolean(busy)||Boolean(issuedRecord)} onClick={issue} className="inline-flex h-10 items-center gap-2 border border-blue-900 bg-blue-900 px-4 text-sm font-bold text-white disabled:opacity-50"><Download className="h-4 w-4"/>{issuedRecord?`Issued ${issuedRecord.number}`:busy==="issue"?"Generating…":"Generate & Download"}</button></div></footer>}
      </div>
    </div>
    {preview && <DocumentViewer title="Letter of Transmittal" filename={preview.filename} mimeType="application/pdf" url={preview.url} onClose={()=>{if(preview.url.startsWith("blob:"))URL.revokeObjectURL(preview.url);setPreview(null);}}/>}
  </>;
}
