import { PROPOSAL_ESTIMATE_CALCULATION_VERSION } from './estimate-defaults';
import type {
  EstimateCostRow,
  EstimateLaborRow,
  ProposalEstimateAssumptionOverrides,
  ProposalEstimateAssumptions,
  ProposalEstimateInputs,
  ProposalEstimateOutputs,
} from './estimate-types';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const nonnegative = (value: number | null | undefined) => finite(value) && value >= 0 ? value : null;
const safeDivide = (numerator: number, denominator: number | null) => denominator && denominator > 0 ? numerator / denominator : null;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const costRow = (key: string, label: string, quantity: number, unit: string, unitCost: number): EstimateCostRow => ({
  key,
  label,
  quantity,
  unit,
  unitCost,
  cost: quantity * unitCost,
});
const laborRow = (key: string, label: string, quantity: number, unit: string, hours: number, laborRate: number): EstimateLaborRow => ({
  ...costRow(key, label, quantity, unit, laborRate),
  hours,
  cost: hours * laborRate,
});

export function effectiveEstimateAssumptions(
  defaults: ProposalEstimateAssumptions,
  overrides: ProposalEstimateAssumptionOverrides,
): ProposalEstimateAssumptions {
  return { ...defaults, ...overrides };
}

export function validateEstimateAssumptions(value: ProposalEstimateAssumptions): string[] {
  const errors: string[] = [];
  const positiveKeys: Array<keyof ProposalEstimateAssumptions> = [
    'materialDensityLbPerCubicFoot', 'batchCapacityCubicFeet', 'poundsPerBatch', 'chipBagWeightPounds',
    'piecesPerSlab', 'laborRatePerHour', 'crewSize', 'hoursPerDay', 'shopCostPerDay',
    'resinGallonsPerBatch', 'resinCostPerGallon', 'hardenerResinRatio', 'hardenerCostPerGallon',
    'fillerBagsPerBatch', 'fillerCostPerBag', 'groutCoverageSfPerGallon', 'groutCostPerGallon',
    'sealerCoverageSfPerGallon', 'sealerCostPerGallon', 'blendHoursPerTwentyBags',
    'setupHoursPerSlab', 'pourHoursPerBatch', 'removeStageHoursPerSlab', 'gaugeSfPerHour',
    'grindSfPerHour', 'groutSfPerHour', 'removeGroutSfPerHour', 'sawCutLfPerHour',
    'edgeFinishLfPerHour', 'handlingItemsPerHour', 'cleanSealSfPerHour',
  ];
  for (const key of positiveKeys) {
    const current = value[key];
    if (!finite(current) || current <= 0) errors.push(`${key} must be greater than zero.`);
  }
  const nonnegativeKeys: Array<keyof ProposalEstimateAssumptions> = [
    'materialsMarkupPercent', 'freightMarkupPercent', 'laborMarkupPercent', 'shopMarkupPercent',
    'repFeePercent', 'difficultyFactorPercent', 'chipFreightPerBag', 'liquidFreightPerGallon',
    'fillerFreightPerBag', 'sealerFreightPerGallon',
  ];
  for (const key of nonnegativeKeys) {
    const current = value[key];
    if (!finite(current) || current < 0) errors.push(`${key} cannot be negative.`);
  }
  if (finite(value.hoursPerDay) && value.hoursPerDay > 24) errors.push('hoursPerDay cannot exceed 24.');
  return errors;
}

export function validateEstimateInputs(value: ProposalEstimateInputs): string[] {
  const errors: string[] = [];
  const numericInputs: Array<keyof Pick<
    ProposalEstimateInputs,
    | 'customerQuantity'
    | 'lengthInches'
    | 'widthInches'
    | 'riserHeightInches'
    | 'thicknessInches'
    | 'depthInches'
    | 'roughLengthInches'
    | 'roughWidthInches'
    | 'roughThicknessInches'
    | 'productionQuantityOverride'
  >> = [
    'customerQuantity', 'lengthInches', 'widthInches', 'riserHeightInches', 'thicknessInches',
    'depthInches', 'roughLengthInches', 'roughWidthInches', 'roughThicknessInches',
    'productionQuantityOverride',
  ];
  for (const key of numericInputs) {
    const current = value[key];
    if (current !== null && (!finite(current) || current < 0)) errors.push(`${key} cannot be negative or invalid.`);
  }
  if (value.chipBlend.length > 50) errors.push('Chip blend cannot contain more than 50 rows.');
  let percentageTotal = 0;
  for (const [index, row] of value.chipBlend.entries()) {
    if (!finite(row.percentage) || row.percentage < 0 || row.percentage > 100) {
      errors.push(`Chip blend row ${index + 1} percentage must be between 0 and 100.`);
    } else percentageTotal += row.percentage;
    if (!finite(row.unitCostPerBag) || row.unitCostPerBag < 0) {
      errors.push(`Chip blend row ${index + 1} cost cannot be negative or invalid.`);
    }
  }
  if (percentageTotal > 100) errors.push('Chip blend percentages cannot exceed 100%.');
  return errors;
}

function developedWidth(inputs: ProposalEstimateInputs) {
  if (inputs.geometryProfile === 'flat') return nonnegative(inputs.widthInches);
  if (inputs.geometryProfile === 'tread_riser') {
    const depth = nonnegative(inputs.depthInches);
    const riserHeight = nonnegative(inputs.riserHeightInches);
    return depth !== null && riserHeight !== null ? depth + riserHeight : null;
  }
  return nonnegative(inputs.widthInches) ?? (() => {
    const depth = nonnegative(inputs.depthInches);
    const riserHeight = nonnegative(inputs.riserHeightInches);
    return depth !== null && riserHeight !== null ? depth + riserHeight : null;
  })();
}

function applyRounding(value: number | null, mode: ProposalEstimateAssumptions['batchRounding']) {
  return value === null ? null : mode === 'whole_up' ? Math.ceil(value) : value;
}

export function calculateProposalEstimate(
  inputs: ProposalEstimateInputs,
  assumptions: ProposalEstimateAssumptions,
): ProposalEstimateOutputs {
  const errors = [...validateEstimateAssumptions(assumptions), ...validateEstimateInputs(inputs)];
  if (errors.length) throw new Error(errors.join(' '));

  const customerQuantity = nonnegative(inputs.customerQuantity);
  const length = nonnegative(inputs.lengthInches);
  const width = developedWidth(inputs);
  const thickness = nonnegative(inputs.thicknessInches);
  const calculatedQuantity = customerQuantity === null
    ? null
    : Math.ceil(customerQuantity / assumptions.piecesPerSlab) * assumptions.piecesPerSlab;
  const productionOverride = nonnegative(inputs.productionQuantityOverride);
  const effectiveQuantity = productionOverride ?? calculatedQuantity;
  const quantitySource = productionOverride !== null ? 'override' : calculatedQuantity !== null ? 'calculated' : 'unavailable';
  const slabCount = effectiveQuantity === null ? null : Math.ceil(effectiveQuantity / assumptions.piecesPerSlab);

  const pieceSquareFeet = length !== null && width !== null ? length * width / 144 : null;
  const pieceCubicFeet = length !== null && width !== null && thickness !== null ? length * width * thickness / 1728 : null;
  const customerSquareFeet = pieceSquareFeet !== null && customerQuantity !== null ? pieceSquareFeet * customerQuantity : null;
  const productionSquareFeet = pieceSquareFeet !== null && effectiveQuantity !== null ? pieceSquareFeet * effectiveQuantity : null;
  const customerCubicFeet = pieceCubicFeet !== null && customerQuantity !== null ? pieceCubicFeet * customerQuantity : null;
  const productionCubicFeet = pieceCubicFeet !== null && effectiveQuantity !== null ? pieceCubicFeet * effectiveQuantity : null;
  const customerLinearFeet = length !== null && customerQuantity !== null ? Math.ceil(length * customerQuantity / 12) : null;
  const productionLinearFeet = length !== null && effectiveQuantity !== null ? length * effectiveQuantity / 12 : null;

  const roughLength = nonnegative(inputs.roughLengthInches);
  const roughWidth = nonnegative(inputs.roughWidthInches);
  const roughThickness = nonnegative(inputs.roughThicknessInches);
  const roughSquareFeet = roughLength !== null && roughWidth !== null && slabCount !== null ? roughLength * roughWidth * slabCount / 144 : null;
  const roughCubicFeet = roughLength !== null && roughWidth !== null && roughThickness !== null && slabCount !== null
    ? roughLength * roughWidth * roughThickness * slabCount / 1728
    : null;
  const rawBatchCount = roughCubicFeet === null ? null : roughCubicFeet / assumptions.batchCapacityCubicFeet;
  const batchCount = applyRounding(rawBatchCount, assumptions.batchRounding);
  const wastePercent = roughCubicFeet !== null && productionCubicFeet !== null && productionCubicFeet > 0
    ? (roughCubicFeet / productionCubicFeet - 1) * 100
    : null;

  const chipPounds = batchCount === null ? null : batchCount * assumptions.poundsPerBatch;
  const chipBags = chipPounds === null ? null : chipPounds / assumptions.chipBagWeightPounds;
  const chipRows = chipBags === null ? [] : inputs.chipBlend.map((blend) => costRow(
    `chip-${blend.id}`,
    blend.color || 'Chip blend material',
    chipBags * Math.max(0, blend.percentage) / 100,
    `${assumptions.chipBagWeightPounds} lb bag`,
    Math.max(0, blend.unitCostPerBag),
  ));
  const resinGallons = batchCount === null ? 0 : batchCount * assumptions.resinGallonsPerBatch;
  const hardenerGallons = resinGallons / assumptions.hardenerResinRatio;
  const fillerBags = batchCount === null ? 0 : batchCount * assumptions.fillerBagsPerBatch;
  const groutGallons = roughSquareFeet === null ? 0 : roughSquareFeet / assumptions.groutCoverageSfPerGallon;
  const sealerGallons = roughSquareFeet === null ? 0 : roughSquareFeet / assumptions.sealerCoverageSfPerGallon;
  const materialRows = [
    ...chipRows,
    costRow('resin', inputs.resinColor || 'Epoxy resin', resinGallons, 'gal', assumptions.resinCostPerGallon),
    costRow('hardener', 'Epoxy hardener', hardenerGallons, 'gal', assumptions.hardenerCostPerGallon),
    costRow('filler', inputs.filler || 'Marble filler', fillerBags, 'bag', assumptions.fillerCostPerBag),
    costRow('grout', 'Pinhole grout', groutGallons, 'gal', assumptions.groutCostPerGallon),
    costRow('sealer', inputs.sealer || 'Top coat sealer', sealerGallons, 'gal', assumptions.sealerCostPerGallon),
  ];
  const materialTotal = sum(materialRows.map((row) => row.cost));

  const freightRows = [
    costRow('chips', 'Chip freight', chipBags ?? 0, 'bag', assumptions.chipFreightPerBag),
    costRow('liquids', 'Resin / hardener / grout freight', resinGallons + hardenerGallons + groutGallons, 'gal', assumptions.liquidFreightPerGallon),
    costRow('filler', 'Filler freight', fillerBags, 'bag', assumptions.fillerFreightPerBag),
    costRow('sealer', 'Sealer freight', sealerGallons, 'gal', assumptions.sealerFreightPerGallon),
  ];
  const freightTotal = sum(freightRows.map((row) => row.cost));

  const sawCutLinearFeet = roughLength !== null && roughWidth !== null && slabCount !== null
    ? ((roughLength * 3 + roughWidth * 2) / 12) * slabCount
    : 0;
  const edgeFinishLinearFeet = productionLinearFeet ?? 0;
  const laborRate = assumptions.laborRatePerHour;
  const laborRows: EstimateLaborRow[] = [
    laborRow('blend', 'Blend chips', chipBags ?? 0, 'bags', (chipBags ?? 0) / 20 * assumptions.blendHoursPerTwentyBags, laborRate),
    laborRow('setup', 'Set up and tear down forms', slabCount ?? 0, 'forms', (slabCount ?? 0) * assumptions.setupHoursPerSlab, laborRate),
    laborRow('pour', 'Pour', batchCount ?? 0, 'batches', (batchCount ?? 0) * assumptions.pourHoursPerBatch, laborRate),
    laborRow('remove', 'Remove and stage', slabCount ?? 0, 'forms', (slabCount ?? 0) * assumptions.removeStageHoursPerSlab, laborRate),
    laborRow('gauge', 'Gauge', roughSquareFeet ?? 0, 'sf', (roughSquareFeet ?? 0) / assumptions.gaugeSfPerHour, laborRate),
    laborRow('grind', 'Grind', roughSquareFeet ?? 0, 'sf', (roughSquareFeet ?? 0) / assumptions.grindSfPerHour, laborRate),
    laborRow('grout', 'Grout', roughSquareFeet ?? 0, 'sf', (roughSquareFeet ?? 0) / assumptions.groutSfPerHour, laborRate),
    laborRow('remove-grout', 'Remove grout', roughSquareFeet ?? 0, 'sf', (roughSquareFeet ?? 0) / assumptions.removeGroutSfPerHour, laborRate),
    laborRow('saw', 'Cut to size', sawCutLinearFeet, 'lf', sawCutLinearFeet / assumptions.sawCutLfPerHour, laborRate),
    laborRow('edge', 'Ease and polish edge', edgeFinishLinearFeet, 'lf', edgeFinishLinearFeet / assumptions.edgeFinishLfPerHour, laborRate),
    laborRow('handling', 'Handling', (effectiveQuantity ?? 0) * 2, 'items', (effectiveQuantity ?? 0) * 2 / assumptions.handlingItemsPerHour, laborRate),
    laborRow('clean-seal', 'Clean and apply sealer', productionSquareFeet ?? 0, 'sf', (productionSquareFeet ?? 0) / assumptions.cleanSealSfPerHour, laborRate),
  ];
  const baseHours = sum(laborRows.map((row) => row.hours));
  const difficultyHours = baseHours * assumptions.difficultyFactorPercent / 100;
  if (difficultyHours > 0) laborRows.push(laborRow('difficulty', 'Difficulty factor', baseHours, 'base hours', difficultyHours, laborRate));
  const totalHours = baseHours + difficultyHours;
  const laborTotal = totalHours * laborRate;

  const capacityHoursPerDay = assumptions.crewSize * assumptions.hoursPerDay;
  const calculatedShopDays = capacityHoursPerDay > 0 ? totalHours / capacityHoursPerDay : null;
  const effectiveShopDays = applyRounding(calculatedShopDays, assumptions.shopDayRounding);
  const shopTotal = (effectiveShopDays ?? 0) * assumptions.shopCostPerDay;

  const baseCost = materialTotal + freightTotal + laborTotal + shopTotal;
  const markupByCategory = {
    materials: materialTotal * assumptions.materialsMarkupPercent / 100,
    freight: freightTotal * assumptions.freightMarkupPercent / 100,
    labor: laborTotal * assumptions.laborMarkupPercent / 100,
    shop: shopTotal * assumptions.shopMarkupPercent / 100,
  };
  const totalMarkup = sum(Object.values(markupByCategory));
  const repFee = (baseCost + totalMarkup) * assumptions.repFeePercent / 100;
  const internalTotal = baseCost + totalMarkup + repFee;

  return {
    calculationVersion: PROPOSAL_ESTIMATE_CALCULATION_VERSION,
    geometry: {
      developedWidthInches: width,
      customerLinearFeet,
      productionLinearFeet,
      customerSquareFeet,
      productionSquareFeet,
      customerCubicFeet,
      productionCubicFeet,
      customerEstimatedWeightLb: customerCubicFeet === null ? null : customerCubicFeet * assumptions.materialDensityLbPerCubicFoot,
      productionEstimatedWeightLb: productionCubicFeet === null ? null : productionCubicFeet * assumptions.materialDensityLbPerCubicFoot,
    },
    production: {
      calculatedQuantity,
      effectiveQuantity,
      quantitySource,
      slabCount,
      roughSquareFeet,
      roughCubicFeet,
      wastePercent,
      batchCount,
    },
    materials: { chipPounds, chipBags, rows: materialRows, totalCost: materialTotal },
    freight: { rows: freightRows, totalCost: freightTotal },
    labor: { rows: laborRows, baseHours, difficultyHours, totalHours, totalCost: laborTotal },
    shop: { capacityHoursPerDay, calculatedDays: calculatedShopDays, effectiveDays: effectiveShopDays, totalCost: shopTotal },
    pricing: {
      baseCost,
      markupByCategory,
      totalMarkup,
      repFee,
      internalTotal,
      internalCalculatedUnitMetric: safeDivide(internalTotal, effectiveQuantity),
      perSquareFoot: safeDivide(internalTotal, productionSquareFeet),
      perLinearFoot: safeDivide(internalTotal, productionLinearFeet),
      perSlab: safeDivide(internalTotal, slabCount),
      perBatch: safeDivide(internalTotal, batchCount),
    },
  };
}
