"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getMaterialUsageReport,
  getMaterialUsageReports,
} from "./actions";

import { createBlankMaterialUsageReport } from "./defaults";

import { MaterialUsageEditor } from "./MaterialUsageEditor";
import { MaterialUsageHistory } from "./MaterialUsageHistory";

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

  const refreshHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setError(null);

      const nextReports =
        await getMaterialUsageReports();

      setReports(nextReports);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load material usage reports."
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const openReport = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const report =
        await getMaterialUsageReport(id);

      setSelectedReport(report);
      setSelectedId(id);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load the selected report."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  function createNewReport() {
    setSelectedId(null);
    setSelectedReport(
      createBlankMaterialUsageReport()
    );
    setError(null);
  }

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-slate-50">
      <MaterialUsageHistory
        reports={reports}
        selectedId={selectedId}
        loading={historyLoading}
        onSelect={(id) => {
          void openReport(id);
        }}
        onNew={createNewReport}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {error ? (
          <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
            {error}
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