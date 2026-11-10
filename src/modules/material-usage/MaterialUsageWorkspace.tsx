"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getMaterialUsageReport,
  getMaterialUsageReports,
} from "./actions";

import { createBlankMaterialUsageReport } from "./defaults";

import { MaterialUsageEditor } from "./MaterialUsageEditor";
import { MaterialUsageHistory } from "./MaterialUsageHistory";
import { loadProductionJobOption } from "../production/job-options";
import { applyCanonicalJobSelection } from "./canonical-job-defaults";

import {
  MaterialUsageReport,
  MaterialUsageReportSummary,
} from "./types";

export function MaterialUsageWorkspace() {
  const [reports, setReports] = useState<
    MaterialUsageReportSummary[]
  >([]);

  const [selectedReport, setSelectedReport] =
    useState<MaterialUsageReport>(
      createBlankMaterialUsageReport()
    );

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const historyRequest=useRef(0);
  const detailRequest=useRef(0);
  const [historyError,setHistoryError]=useState<string|null>(null);

  const refreshHistory = useCallback(async () => {
    const request=++historyRequest.current;
    try {
      setHistoryLoading(true);setHistoryError(null);
      setError(null);

      const nextReports =
        await getMaterialUsageReports();

      if(request===historyRequest.current)setReports(nextReports);
    } catch (caughtError) {
      if(request!==historyRequest.current)return;
      setReports([]);
      setHistoryError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load material usage reports."
      );
    } finally {
      if(request===historyRequest.current)setHistoryLoading(false);
    }
  }, []);

  const openReport = useCallback(async (id: string) => {
    const request=++detailRequest.current;
    try {
      setLoading(true);
      setError(null);

      const report =
        await getMaterialUsageReport(id);

      if(request!==detailRequest.current)return;
      setSelectedReport(report);
      setSelectedId(id);
    } catch (caughtError) {
      if(request!==detailRequest.current)return;
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load the selected report."
      );
    } finally {
      if(request===detailRequest.current)setLoading(false);
    }
  }, []);

  function createNewReport() {
    detailRequest.current++;setLoading(false);
    setSelectedId(null);
    setSelectedReport(
      createBlankMaterialUsageReport()
    );
    setError(null);
  }

  useEffect(() => {
    void refreshHistory();
    return()=>{
      // Invalidate asynchronous generations; these refs are counters, not nodes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      historyRequest.current++;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      detailRequest.current++;
    };
  }, [refreshHistory]);

  useEffect(() => {
    if (historyLoading) return;
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get("openReportJob");
    if (!jobId) return;
    const latestReport = reports.find((report) => report.jobId === jobId);
    const url = new URL(window.location.href);
    url.searchParams.delete("openReportJob");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    if (latestReport) void openReport(latestReport.id);
  }, [historyLoading, openReport, reports]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get("newJob");
    if (!jobId) return;
    let active = true;
    void loadProductionJobOption(jobId).then((job) => {
      if (!active || !job) return;
      setSelectedId(null);
      setSelectedReport((current) => applyCanonicalJobSelection(current, job, job.color_plate_number ?? ""));
      const url = new URL(window.location.href);
      url.searchParams.delete("newJob");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }).catch((caughtError) => {
      if (active) setError(caughtError instanceof Error ? caughtError.message : "Unable to prepare the material report.");
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-slate-50">
      <MaterialUsageHistory
        reports={reports}
        selectedId={selectedId}
        loading={historyLoading}
        error={historyError}
        onSelect={(id) => {
          void openReport(id);
        }}
        onNew={createNewReport}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {error || historyError ? (
          <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
            {error || historyError}
          </div>
        ) : null}

        <MaterialUsageEditor
          key={selectedReport.id ?? "new-report"}
          loading={loading}
          report={selectedReport}
          onChange={setSelectedReport}
          onSaved={async (id) => {
            await refreshHistory();
            await openReport(id);
          }}
          onDeleted={async () => {
            createNewReport();
            await refreshHistory();
          }}
        />
      </div>
    </div>
  );
}
