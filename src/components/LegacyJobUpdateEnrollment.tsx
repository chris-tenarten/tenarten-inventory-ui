"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type AdminUser = { user_id: string; display_name: string; email: string; is_active: boolean };

type EnrollmentCandidate = {
  update_id: string;
  job_id: string;
  job_number: string | null;
  job_name: string;
  update_created_at: string;
  update_preview: string;
  legacy_assignee_name: string;
  is_resolved: boolean;
  canonical_assignee_user_id: string | null;
  canonical_assignee_name: string | null;
  enrollment_notification_exists: boolean;
  eligibility_status: "eligible" | "assigned_to_target_missing_notification" | "resolved_excluded" | "canonical_assignee_conflict" | "already_enrolled";
  is_eligible: boolean;
};

const STATUS_LABELS: Record<EnrollmentCandidate["eligibility_status"], string> = {
  eligible: "Eligible",
  assigned_to_target_missing_notification: "Assigned; notification missing",
  resolved_excluded: "Resolved — excluded",
  canonical_assignee_conflict: "Different account assigned — conflict",
  already_enrolled: "Already enrolled",
};

export default function LegacyJobUpdateEnrollment({ users }: { users: AdminUser[] }) {
  const [targetUserId, setTargetUserId] = useState("");
  const [legacyName, setLegacyName] = useState("");
  const [candidates, setCandidates] = useState<EnrollmentCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewed, setPreviewed] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function invalidatePreview() {
    setCandidates([]);
    setPreviewed(false);
    setMessage("");
  }

  async function preview(preserveMessage = false) {
    setLoading(true); setError("");
    if (!preserveMessage) setMessage("");
    const { data, error: previewError } = await supabase.rpc("preview_legacy_job_update_enrollment", {
      p_target_user_id: targetUserId,
      p_legacy_assignee_name: legacyName,
    });
    if (previewError) setError(previewError.message);
    else { setCandidates((data ?? []) as EnrollmentCandidate[]); setPreviewed(true); }
    setLoading(false);
  }

  async function execute() {
    const approvedIds = candidates.filter((candidate) => candidate.is_eligible).map((candidate) => candidate.update_id);
    if (!approvedIds.length) return;
    setLoading(true); setError(""); setMessage("");
    const { data, error: executeError } = await supabase.rpc("execute_legacy_job_update_enrollment", {
      p_target_user_id: targetUserId,
      p_legacy_assignee_name: legacyName,
      p_approved_update_ids: approvedIds,
    });
    if (executeError) setError(executeError.message);
    else {
      const result = (data?.[0] ?? { converted_count: 0, notified_count: 0, skipped_count: 0 }) as { converted_count: number; notified_count: number; skipped_count: number };
      setMessage(`${result.converted_count} assignment${result.converted_count === 1 ? "" : "s"} connected; ${result.notified_count} notification${result.notified_count === 1 ? "" : "s"} created${result.skipped_count ? `; ${result.skipped_count} skipped` : ""}.`);
      await preview(true);
    }
    setLoading(false);
  }

  const eligibleCount = candidates.filter((candidate) => candidate.is_eligible).length;
  return <section className="mt-6 border-t border-slate-200 pt-5">
    <h3 className="text-base font-bold text-slate-950">Outstanding Job Update enrollment</h3>
    <p className="mt-1 text-sm text-slate-600">Preview an employee&apos;s exact legacy assignment name before connecting reviewed unresolved Updates to their account.</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <select aria-label="Enrollment target account" value={targetUserId} onChange={(event) => { setTargetUserId(event.target.value); invalidatePreview(); }} className="h-10 border border-slate-300 bg-white px-2 text-sm">
        <option value="">Select active account</option>
        {users.filter((user) => user.is_active).map((user) => <option key={user.user_id} value={user.user_id}>{user.display_name} · {user.email}</option>)}
      </select>
      <input aria-label="Approved legacy assignee identity" value={legacyName} onChange={(event) => { setLegacyName(event.target.value); invalidatePreview(); }} placeholder="Exact legacy assignee name" className="h-10 border border-slate-300 px-2 text-sm" />
      <button type="button" disabled={loading || !targetUserId || !legacyName.trim()} onClick={() => void preview()} className="h-10 border border-slate-400 px-3 text-xs font-bold disabled:opacity-50">Preview assignments</button>
    </div>
    {error ? <div role="alert" className="mt-3 border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</div> : null}
    {message ? <div role="status" className="mt-3 border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</div> : null}
    {previewed ? <div className="mt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-600">{candidates.length} exact-match candidate{candidates.length === 1 ? "" : "s"} · {eligibleCount} eligible</span>
        <button type="button" disabled={loading || eligibleCount === 0} onClick={() => void execute()} className="tenops-selected-surface h-9 border px-3 text-xs font-bold disabled:opacity-50">Connect {eligibleCount} reviewed assignment{eligibleCount === 1 ? "" : "s"}</button>
      </div>
      <div className="max-h-80 overflow-auto border border-slate-200">
        <table className="w-full min-w-[760px] border-collapse text-xs">
          <thead><tr className="bg-slate-100 text-left"><th className="p-2">Job</th><th className="p-2">Update</th><th className="p-2">Legacy assignment</th><th className="p-2">Canonical assignment</th><th className="p-2">Review result</th></tr></thead>
          <tbody>{candidates.map((candidate) => <tr key={candidate.update_id} className="border-t border-slate-200 align-top">
            <td className="p-2 font-semibold">{candidate.job_number ? `${candidate.job_number} · ` : ""}{candidate.job_name}</td>
            <td className="p-2"><time className="block text-[10px] text-slate-500">{new Date(candidate.update_created_at).toLocaleString()}</time><span className="mt-1 block max-w-sm whitespace-pre-wrap">{candidate.update_preview}</span></td>
            <td className="p-2">{candidate.legacy_assignee_name}<span className="mt-1 block text-[10px] text-slate-500">{candidate.is_resolved ? "Resolved" : "Unresolved"}</span></td>
            <td className="p-2">{candidate.canonical_assignee_name ?? "Not connected"}<span className="mt-1 block text-[10px] text-slate-500">{candidate.enrollment_notification_exists ? "Notification exists" : "No enrollment notification"}</span></td>
            <td className={`p-2 font-bold ${candidate.is_eligible ? "text-emerald-700" : candidate.eligibility_status === "canonical_assignee_conflict" ? "text-red-700" : "text-slate-500"}`}>{STATUS_LABELS[candidate.eligibility_status]}</td>
          </tr>)}</tbody>
        </table>
        {!candidates.length ? <div className="p-4 text-sm text-slate-500">No Job Updates match that exact legacy assignment.</div> : null}
      </div>
    </div> : null}
  </section>;
}
