"use client";
import { Settings2, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  applySupplierRatioDefault,
  applyFormulationProfile,
  calculateSampleFormulation,
  previewIncreasedFillerAdjustment,
  SAMPLE_FORMULATION_CALCULATION_VERSION,
  SAMPLE_FORMULATION_PROFILES,
  MASS_BALANCE_SAMPLE_FORMULATION_CALCULATION_VERSION,
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
  onApplyAdjustment,
}: {
  state: SampleFormulationState;
  rows: SampleBlendRow[];
  resinSupplier: string;
  onChange: (state: SampleFormulationState) => void;
  onApplyAdjustment: (state: SampleFormulationState, targetFillerOz: string) => void;
}) {
  const result = useMemo(
    () => calculateSampleFormulation(state, rows),
    [state, rows],
  );
  const isMassBalance =
    state.calculationVersion ===
    MASS_BALANCE_SAMPLE_FORMULATION_CALCULATION_VERSION;
  const isV4 = state.calculationVersion === SAMPLE_FORMULATION_CALCULATION_VERSION;
  const calculatedTarget = useMemo(
    () => calculateSampleFormulation(
      { ...state, basis: "weight_per_sf", totalWeight: "" },
      rows,
    ),
    [state, rows],
  );
  const [advanced, setAdvanced] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustmentFiller, setAdjustmentFiller] = useState("");
  const adjustmentPreview = useMemo(
    () => previewIncreasedFillerAdjustment(state, rows, adjustmentFiller),
    [state, rows, adjustmentFiller],
  );
  const adjustmentResult = useMemo(() => {
    if (!adjustmentPreview) return null;
    const adjustmentRows = rows.map((row) => row.componentRole === "filler"
      ? {...row,quantity:adjustmentPreview.targetFillerOz,quantityProvenance:"manual" as const}
      : row);
    return calculateSampleFormulation(
      {...state,materialDensity:adjustmentPreview.resultingChipDensityLbCft},
      adjustmentRows,
    );
  }, [adjustmentPreview, rows, state]);
  const patch = (changes: Partial<SampleFormulationState>) => {
    const breaksAdjustment = Boolean(state.adjustment) && ["length","width","thicknessIn","dimensionUnit"].some((key) => key in changes);
    onChange({
      ...state,
      ...(breaksAdjustment ? {adjustment:null,chipDensityProvenance:"manual" as const,fillerProvenance:"manual" as const} : {}),
      ...changes,
    });
  };
  const patchProfile = (changes: Partial<NonNullable<SampleFormulationState["profile"]>>) => {
    if (!state.profile) return;
    onChange({...state,profile:{...state.profile,...changes,id:'custom',name:state.profile.id==='custom'?state.profile.name:`${state.profile.name} (Custom)`},profileProvenance:'custom'});
  };
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
            Chip Mix: {number(result.availableChipMixOz)} oz
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {isMassBalance
              ? `${number(result.totalFormulaWeightOz)} oz formula − ${number(result.nonChipWeightOz)} oz filler/resin/hardener`
              : isV4
                ? `${number(result.availableChipMixOz)} oz from ${number(result.effectiveChipDensityLbCft)} lb/CFT. Expected dry pool ${number(result.dryPoolOz)} oz; actual ${number(result.actualDryTotalOz)} oz.`
                : "Calculated from production pour area × Weight / SF. Filler and Resin are entered separately."}
          </p>
          {result.invalidMassBalance && <p className="mt-1 text-xs font-bold text-red-700">Non-chip ingredients exceed Total Formula Weight. Reduce them or increase the total.</p>}
          {isV4 && Math.abs(Number(result.dryPoolVarianceOz||0))>0.005 && <div className="mt-3 border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950"><p className="font-bold">This formula differs from the selected profile&apos;s expected dry-material balance by {Number(result.dryPoolVarianceOz)>0?'+':''}{number(result.dryPoolVarianceOz)} oz.</p><p className="mt-1">This is allowed. Use Adjust Formulation only when you intend to preserve the profile relationship.</p></div>}
          {isV4 && <button type="button" onClick={()=>{setAdjustmentFiller(result.effectiveFillerOz);setAdjusting(true);}} className="mt-3 min-h-10 border border-slate-400 bg-white px-3 text-xs font-bold">Adjust Formulation</button>}
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
            {isV4 && <label className={`${label} sm:col-span-2`}>
              Formulation Profile
              <select value={state.profile?.id??''} onChange={(event)=>{const profile=SAMPLE_FORMULATION_PROFILES.find(candidate=>candidate.id===event.target.value);if(profile)onChange(applyFormulationProfile(state,profile));}} className={input}>
                {state.profile&&!SAMPLE_FORMULATION_PROFILES.some(profile=>profile.id===state.profile?.id)&&<option value={state.profile.id}>{state.profile.name}</option>}
                {SAMPLE_FORMULATION_PROFILES.map(profile=><option key={profile.id} value={profile.id}>{profile.name}</option>)}
              </select>
              <span className={hint}>Captured with this Sample. Changing supplier alone does not change the profile.</span>
            </label>}
            {isV4 && <>
              <label className={label}>Dry-material Rate<input type="number" min="0" step="0.000001" value={state.profile?.dryPoolOzPerCft??''} onChange={(event)=>patchProfile({dryPoolOzPerCft:event.target.value})} className={input}/><span className={hint}>oz/CFT · advanced custom profile</span></label>
              <label className={label}>Default Filler Rate<input type="number" min="0" step="0.000001" value={state.profile?.defaultFillerOzPerCft??''} onChange={(event)=>patchProfile({defaultFillerOzPerCft:event.target.value})} className={input}/><span className={hint}>oz/CFT · applies only to Profile-default Filler</span></label>
              <label className={label}>Resin-volume Rate<input type="number" min="0" step="0.000001" value={state.profile?.resinFlOzPerCft??''} onChange={(event)=>patchProfile({resinFlOzPerCft:event.target.value})} className={input}/><span className={hint}>fl oz/CFT · applies only to Profile-default Resin</span></label>
            </>}
            {isMassBalance && <label className={label}>
              Total Formula Weight
              <input type="number" min="0" step="0.01" value={state.totalFormulaWeightOz} onChange={(event)=>patch({totalFormulaWeightOz:event.target.value})} className={input}/>
              <span className={hint}>ounces · historical V2 mass-balance input</span>
            </label>}
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
                  patch({ materialDensity: event.target.value,chipDensityProvenance:'manual',fillerProvenance:state.fillerProvenance==='increased_filler_adjustment'?'manual':state.fillerProvenance,adjustment:null })
                }
                className={input}
              />
              <span className={hint}>{isV4?`lb/CFT · ${state.chipDensityProvenance.replaceAll('_',' ')} · authoritative Chip Mix input`:'lb/CFT'}</span>
            </label>
            {!isV4 && <label className={label}>
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
            </label>}
            {!isV4 && <label className={label}>
              Geometry Chip Mix Reference
              <input
                type="number"
                min="0"
                step="0.0001"
                value={
                  state.basis === "total_weight"
                    ? state.totalWeight
                    : result.geometryChipMixWeight
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
                  : `Reference only: ${number(calculatedTarget.geometryChipMixWeight)} lb`}
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
            </label>}
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
      {adjusting && <div role="dialog" aria-modal="true" aria-label="Adjust Formulation" className="mt-4 border-2 border-blue-800 bg-blue-50 p-4">
        <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">Increase Filler while preserving dry-material profile</h3><p className="mt-1 text-xs text-slate-700">This intentionally coordinates Filler, effective Chip density, Chip Mix, and calculated Aggregate ounces.</p></div><button type="button" onClick={()=>setAdjusting(false)} aria-label="Close formulation adjustment" className="h-10 w-10 border border-slate-400 bg-white"><X className="mx-auto h-4 w-4"/></button></div>
        <label className={`${label} mt-3 block max-w-xs`}>Target Filler<input type="number" min="0" step="0.01" value={adjustmentFiller} onChange={event=>setAdjustmentFiller(event.target.value)} className={input}/><span className={hint}>oz at the current production geometry</span></label>
        {adjustmentPreview?<div className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><p>Filler: <strong>{number(result.effectiveFillerOz)} → {number(adjustmentPreview.targetFillerOz)} oz</strong></p><p>Density: <strong>{number(result.effectiveChipDensityLbCft)} → {number(adjustmentPreview.resultingChipDensityLbCft)} lb/CFT</strong></p><p>Chip Mix: <strong>{number(result.availableChipMixOz)} → {number(adjustmentPreview.resultingChipMixOz)} oz</strong></p><p>Expected dry pool: <strong>{number(result.dryPoolOz)} oz unchanged</strong></p><p className="sm:col-span-2">Aggregate ounces: <strong>{rows.map((row,index)=>row.componentRole==='aggregate'?`${row.percentage||0}% → ${number(adjustmentResult?.rows[index]?.effectiveQuantity??'')} oz`:null).filter(Boolean).join(' · ')}</strong></p><p>Resin / Hardener: <strong>{number(result.effectiveResinFlOz)} / {number(result.rows[rows.findIndex(row=>row.componentRole==='hardener')]?.effectiveQuantity??'')} fl oz unchanged</strong></p></div>:<p className="mt-3 text-xs font-bold text-red-700">Enter a Filler quantity that does not exceed the expected dry pool.</p>}
        <div className="mt-4 flex gap-2"><button type="button" disabled={!adjustmentPreview} onClick={()=>{if(!adjustmentPreview)return;onApplyAdjustment({...state,materialDensity:adjustmentPreview.resultingChipDensityLbCft,chipDensityProvenance:'increased_filler_adjustment',fillerProvenance:'increased_filler_adjustment',adjustment:adjustmentPreview.adjustment},adjustmentPreview.targetFillerOz);setAdjusting(false);}} className="min-h-11 bg-blue-800 px-4 text-xs font-bold text-white disabled:opacity-50">Apply coordinated adjustment</button><button type="button" onClick={()=>setAdjusting(false)} className="min-h-11 border border-slate-400 bg-white px-4 text-xs font-bold">Cancel</button></div>
      </div>}
    </section>
  );
}
