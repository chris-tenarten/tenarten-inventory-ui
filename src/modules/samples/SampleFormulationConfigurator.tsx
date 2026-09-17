"use client";
import { Settings2, X } from "lucide-react";
import { useState } from "react";
import {
  applySupplierRatioDefault,
  calculateSampleFormulation,
  type SampleFormulationState,
} from "./formulation";
import type { SampleBlendRow } from "./types";
import { setSampleFormulationDefault } from "./queries";
const input =
  "mt-1 h-12 w-full min-w-0 border border-slate-300 bg-white px-3 text-base outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100 sm:h-9 sm:px-2 sm:text-sm";
const label = "text-xs font-bold text-slate-700";
const hint = "mt-1 block text-[11px] font-normal text-slate-500";
const number = (value: string, digits = 2) => {
  const parsed = Number(value);
  return value !== "" && Number.isFinite(parsed) ? parsed.toFixed(digits) : "—";
};
const inches = (value: string) =>
  Number(value) === 0.375
    ? "3/8″"
    : value
      ? `${Number(value).toLocaleString()}″`
      : "—";
export default function SampleFormulationConfigurator({
  state,
  rows,
  resinSupplier,
  onChange,
}: {
  state: SampleFormulationState;
  rows: SampleBlendRow[];
  resinSupplier: string;
  onChange: (state: SampleFormulationState) => void;
}) {
  const result = calculateSampleFormulation(state, rows);
  const calculatedTarget = calculateSampleFormulation(
    { ...state, basis: "weight_per_sf", totalWeight: "" },
    rows,
  );
  const [advanced, setAdvanced] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState("");
  const patch = (changes: Partial<SampleFormulationState>) =>
    onChange({ ...state, ...changes });
  const resetWeightPerSf = () =>
    patch({
      weightPerSf: result.calculatedWeightPerSf,
      weightPerSfProvenance: "calculated",
    });
  const resetTarget = () => patch({ basis: "weight_per_sf", totalWeight: "" });
  const resetRatio = () =>
    onChange(applySupplierRatioDefault(state, resinSupplier));
  const saveDefault = async () => {
    setDefaultStatus("Saving…");
    try {
      await setSampleFormulationDefault(state, resinSupplier);
      setDefaultStatus("Saved for future new Samples.");
    } catch (caught) {
      setDefaultStatus(
        caught instanceof Error ? caught.message : "Unable to save default.",
      );
    }
  };
  return (
    <section className="border border-slate-300 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide">
            Sample Plate Quantities
          </h2>
          <p className="mt-2 text-base font-semibold">
            {state.finishedPlateQuantity || "—"} pcs ·{" "}
            {inches(state.finishedPlateWidth)} ×{" "}
            {inches(state.finishedPlateLength)} · {inches(state.thicknessIn)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Production pour: {inches(state.width)} × {inches(state.length)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Total area: {number(result.finishedAreaSf)} SF
          </p>
          <p className="mt-1 text-sm font-bold">
            Chip Mix: {number(result.targetWeight)} lb /{" "}
            {number(result.targetWeightOz)} oz
          </p>
          {state.basis === "total_weight" && (
            <p className="mt-1 text-xs font-bold text-amber-700">
              Modified target; calculated target is overridden.
            </p>
          )}
        </div>
        <button
          type="button"
          aria-expanded={advanced}
          onClick={() => setAdvanced((value) => !value)}
          className="inline-flex min-h-11 items-center gap-2 border border-slate-400 bg-white px-3 text-xs font-bold"
        >
          <Settings2 className="h-4 w-4" />
          {advanced
            ? "Close Calculation Settings"
            : "Adjust Sample Plate Calculation"}
        </button>
      </div>
      {advanced && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Custom Sample Calculation
            </h3>
            <button
              type="button"
              onClick={() => setAdvanced(false)}
              aria-label="Close calculation settings"
              className="h-9 w-9 border border-slate-300"
            >
              <X className="mx-auto h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className={label}>
              Finished Plate Width
              <input
                type="number"
                min="0"
                step="0.001"
                value={state.finishedPlateWidth}
                onChange={(event) =>
                  patch({ finishedPlateWidth: event.target.value })
                }
                className={input}
              />
              <span className={hint}>inches</span>
            </label>
            <label className={label}>
              Finished Plate Length
              <input
                type="number"
                min="0"
                step="0.001"
                value={state.finishedPlateLength}
                onChange={(event) =>
                  patch({ finishedPlateLength: event.target.value })
                }
                className={input}
              />
              <span className={hint}>inches</span>
            </label>
            <label className={label}>
              Finished Pieces
              <input
                type="number"
                min="1"
                step="1"
                value={state.finishedPlateQuantity}
                onChange={(event) =>
                  patch({ finishedPlateQuantity: event.target.value })
                }
                className={input}
              />
            </label>
            <label className={label}>
              Thickness
              <input
                type="number"
                min="0"
                step="0.001"
                value={state.thicknessIn}
                onChange={(event) => patch({ thicknessIn: event.target.value })}
                className={input}
              />
              <span className={hint}>inches · 0.375 = 3/8″</span>
            </label>
            <label className={label}>
              Production Pour Width
              <input
                type="number"
                min="0"
                step="0.001"
                value={state.width}
                onChange={(event) => patch({ width: event.target.value })}
                className={input}
              />
            </label>
            <label className={label}>
              Production Pour Length
              <input
                type="number"
                min="0"
                step="0.001"
                value={state.length}
                onChange={(event) => patch({ length: event.target.value })}
                className={input}
              />
            </label>
            <label className={label}>
              Dimension Unit
              <select
                value={state.dimensionUnit}
                onChange={(event) =>
                  patch({ dimensionUnit: event.target.value as "in" | "ft" })
                }
                className={input}
              >
                <option value="in">inches</option>
                <option value="ft">feet</option>
              </select>
            </label>
            <label className={label}>
              Material Density
              <input
                type="number"
                min="0"
                step="0.001"
                value={state.materialDensity}
                onChange={(event) =>
                  patch({ materialDensity: event.target.value })
                }
                className={input}
              />
              <span className={hint}>lb/CFT</span>
            </label>
            <label className={label}>
              Weight / SF
              <input
                type="number"
                min="0"
                step="0.0001"
                readOnly={state.weightPerSfProvenance === "calculated"}
                value={
                  state.weightPerSfProvenance === "calculated"
                    ? result.effectiveWeightPerSf
                    : state.weightPerSf
                }
                onChange={(event) =>
                  patch({
                    weightPerSf: event.target.value,
                    weightPerSfProvenance: "manual",
                  })
                }
                className={`${input} ${state.weightPerSfProvenance === "calculated" ? "bg-slate-100" : ""}`}
              />
              <span className={hint}>
                {state.weightPerSfProvenance === "manual"
                  ? "Modified"
                  : "Calculated: Density × Thickness ÷ 12"}
              </span>
              {state.weightPerSfProvenance === "manual" ? (
                <button
                  type="button"
                  onClick={resetWeightPerSf}
                  className="mt-2 min-h-9 border border-slate-300 px-2 text-xs font-bold"
                >
                  Reset to Calculated
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      weightPerSf: result.effectiveWeightPerSf,
                      weightPerSfProvenance: "manual",
                    })
                  }
                  className="mt-2 min-h-9 border border-slate-300 px-2 text-xs font-bold"
                >
                  Override
                </button>
              )}
            </label>
            <label className={label}>
              Target Aggregate Weight
              <input
                type="number"
                min="0"
                step="0.0001"
                value={
                  state.basis === "total_weight"
                    ? state.totalWeight
                    : result.targetWeight
                }
                onChange={(event) =>
                  patch({
                    basis: "total_weight",
                    totalWeight: event.target.value,
                  })
                }
                className={input}
              />
              <span className={hint}>
                {state.basis === "total_weight"
                  ? "Modified for this Sample"
                  : `Calculated: ${number(calculatedTarget.targetWeight)} lb`}
              </span>
              {state.basis === "total_weight" && (
                <button
                  type="button"
                  onClick={resetTarget}
                  className="mt-2 min-h-9 border border-slate-300 px-2 text-xs font-bold"
                >
                  Reset to Calculated
                </button>
              )}
            </label>
            <label className={label}>
              Resin : Hardener Ratio
              <select
                value={`${state.resinParts}:${state.hardenerParts}`}
                onChange={(event) => {
                  const [resinParts, hardenerParts] =
                    event.target.value.split(":");
                  patch({
                    resinParts,
                    hardenerParts,
                    ratioProvenance: "manual",
                  });
                }}
                className={input}
              >
                <option value="5:1">5:1</option>
                <option value="4:1">4:1</option>
              </select>
              <span className={hint}>
                {state.ratioProvenance === "manual"
                  ? "Modified"
                  : `${state.ratioDefaultSource || "General"} default`}
              </span>
              {state.ratioProvenance === "manual" && (
                <button
                  type="button"
                  onClick={resetRatio}
                  className="mt-2 min-h-9 border border-slate-300 px-2 text-xs font-bold"
                >
                  Reset to Supplier Default
                </button>
              )}
            </label>
          </div>
          <button
            type="button"
            onClick={() => void saveDefault()}
            className="mt-4 min-h-10 border border-slate-300 bg-white px-3 text-xs font-bold"
          >
            Use settings for future new Samples
          </button>
          {defaultStatus && (
            <span role="status" className="ml-3 text-xs text-slate-500">
              {defaultStatus}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
