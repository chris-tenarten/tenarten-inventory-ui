import type { ProposalEstimateAssumptions } from './estimate-types';

export type NumericEstimateAssumptionKey = {
  [Key in keyof ProposalEstimateAssumptions]: ProposalEstimateAssumptions[Key] extends number ? Key : never
}[keyof ProposalEstimateAssumptions];

export type EstimateRoundingAssumptionKey = 'batchRounding' | 'shopDayRounding';
export type EstimateAssumptionKey = NumericEstimateAssumptionKey | EstimateRoundingAssumptionKey;
export type EstimateAssumptionGroup = 'production' | 'materials' | 'labor' | 'freightShop' | 'pricing';

type BaseDefinition = {
  key: EstimateAssumptionKey;
  label: string;
  group: EstimateAssumptionGroup;
  helper?: string;
};

export type EstimateNumberAssumptionDefinition = BaseDefinition & {
  key: NumericEstimateAssumptionKey;
  kind: 'number';
  unit: string;
  min: number;
  max?: number;
  step: number;
};

export type EstimateRoundingAssumptionDefinition = BaseDefinition & {
  key: EstimateRoundingAssumptionKey;
  kind: 'rounding';
};

export type EstimateAssumptionDefinition = EstimateNumberAssumptionDefinition | EstimateRoundingAssumptionDefinition;

export const estimateAssumptionDefinitions: EstimateAssumptionDefinition[] = [
  { key: 'materialDensityLbPerCubicFoot', label: 'Material Density', group: 'production', kind: 'number', unit: 'lb/ft³', min: 0.001, step: 0.1 },
  { key: 'batchCapacityCubicFeet', label: 'Batch Capacity', group: 'production', kind: 'number', unit: 'ft³/batch', min: 0.000001, step: 0.000001 },
  { key: 'poundsPerBatch', label: 'Pounds / Batch', group: 'production', kind: 'number', unit: 'lb', min: 0.001, step: 0.1 },
  { key: 'chipBagWeightPounds', label: 'Chip Bag Weight', group: 'production', kind: 'number', unit: 'lb/bag', min: 0.001, step: 0.1 },
  { key: 'piecesPerSlab', label: 'Pieces / Slab', group: 'production', kind: 'number', unit: 'pieces', min: 0.001, step: 1 },
  { key: 'batchRounding', label: 'Batch Rounding', group: 'production', kind: 'rounding' },

  { key: 'resinGallonsPerBatch', label: 'Resin / Batch', group: 'materials', kind: 'number', unit: 'gal', min: 0.001, step: 0.01 },
  { key: 'resinCostPerGallon', label: 'Resin Cost', group: 'materials', kind: 'number', unit: '$/gal', min: 0.001, step: 0.01 },
  { key: 'hardenerResinRatio', label: 'Resin : Hardener Ratio', group: 'materials', kind: 'number', unit: ': 1', min: 0.001, step: 0.01 },
  { key: 'hardenerCostPerGallon', label: 'Hardener Cost', group: 'materials', kind: 'number', unit: '$/gal', min: 0.001, step: 0.01 },
  { key: 'fillerBagsPerBatch', label: 'Filler / Batch', group: 'materials', kind: 'number', unit: 'bags', min: 0.001, step: 0.01 },
  { key: 'fillerCostPerBag', label: 'Filler Cost', group: 'materials', kind: 'number', unit: '$/bag', min: 0.001, step: 0.01 },
  { key: 'groutCoverageSfPerGallon', label: 'Grout Coverage', group: 'materials', kind: 'number', unit: 'sf/gal', min: 0.001, step: 0.1 },
  { key: 'groutCostPerGallon', label: 'Grout Cost', group: 'materials', kind: 'number', unit: '$/gal', min: 0.001, step: 0.01 },
  { key: 'sealerCoverageSfPerGallon', label: 'Sealer Coverage', group: 'materials', kind: 'number', unit: 'sf/gal', min: 0.001, step: 0.1 },
  { key: 'sealerCostPerGallon', label: 'Sealer Cost', group: 'materials', kind: 'number', unit: '$/gal', min: 0.001, step: 0.01 },

  { key: 'laborRatePerHour', label: 'Labor Rate', group: 'labor', kind: 'number', unit: '$/MH', min: 0.001, step: 0.01 },
  { key: 'blendHoursPerTwentyBags', label: 'Chip Blending', group: 'labor', kind: 'number', unit: 'hr/20 bags', min: 0.001, step: 0.01 },
  { key: 'setupHoursPerSlab', label: 'Form Setup / Tear Down', group: 'labor', kind: 'number', unit: 'hr/slab', min: 0.001, step: 0.01 },
  { key: 'pourHoursPerBatch', label: 'Pour', group: 'labor', kind: 'number', unit: 'hr/batch', min: 0.001, step: 0.01 },
  { key: 'removeStageHoursPerSlab', label: 'Remove / Stage', group: 'labor', kind: 'number', unit: 'hr/slab', min: 0.001, step: 0.01 },
  { key: 'gaugeSfPerHour', label: 'Gauge Productivity', group: 'labor', kind: 'number', unit: 'sf/hr', min: 0.001, step: 0.01 },
  { key: 'grindSfPerHour', label: 'Grind Productivity', group: 'labor', kind: 'number', unit: 'sf/hr', min: 0.001, step: 0.01 },
  { key: 'groutSfPerHour', label: 'Grout Productivity', group: 'labor', kind: 'number', unit: 'sf/hr', min: 0.001, step: 0.01 },
  { key: 'removeGroutSfPerHour', label: 'Remove Grout Productivity', group: 'labor', kind: 'number', unit: 'sf/hr', min: 0.001, step: 0.01 },
  { key: 'sawCutLfPerHour', label: 'Saw Cutting Productivity', group: 'labor', kind: 'number', unit: 'lf/hr', min: 0.001, step: 0.01 },
  { key: 'edgeFinishLfPerHour', label: 'Edge Finishing Productivity', group: 'labor', kind: 'number', unit: 'lf/hr', min: 0.001, step: 0.01 },
  { key: 'handlingItemsPerHour', label: 'Handling Productivity', group: 'labor', kind: 'number', unit: 'items/hr', min: 0.001, step: 0.01 },
  { key: 'cleanSealSfPerHour', label: 'Clean / Seal Productivity', group: 'labor', kind: 'number', unit: 'sf/hr', min: 0.001, step: 0.01 },
  { key: 'difficultyFactorPercent', label: 'Difficulty Factor', group: 'labor', kind: 'number', unit: '%', min: 0, step: 0.1 },

  { key: 'chipFreightPerBag', label: 'Chip Freight', group: 'freightShop', kind: 'number', unit: '$/bag', min: 0, step: 0.01 },
  { key: 'liquidFreightPerGallon', label: 'Liquid Freight', group: 'freightShop', kind: 'number', unit: '$/gal', min: 0, step: 0.01 },
  { key: 'fillerFreightPerBag', label: 'Filler Freight', group: 'freightShop', kind: 'number', unit: '$/bag', min: 0, step: 0.01 },
  { key: 'sealerFreightPerGallon', label: 'Sealer Freight', group: 'freightShop', kind: 'number', unit: '$/gal', min: 0, step: 0.01 },
  { key: 'crewSize', label: 'Crew Size', group: 'freightShop', kind: 'number', unit: 'people', min: 0.001, step: 1 },
  { key: 'hoursPerDay', label: 'Hours / Day', group: 'freightShop', kind: 'number', unit: 'hr', min: 0.001, max: 24, step: 0.1 },
  { key: 'shopCostPerDay', label: 'Shop Cost / Day', group: 'freightShop', kind: 'number', unit: '$/day', min: 0.001, step: 0.01 },
  { key: 'shopDayRounding', label: 'Shop Day Rounding', group: 'freightShop', kind: 'rounding' },

  { key: 'materialsMarkupPercent', label: 'Materials Markup', group: 'pricing', kind: 'number', unit: '%', min: 0, step: 0.1 },
  { key: 'freightMarkupPercent', label: 'Freight Markup', group: 'pricing', kind: 'number', unit: '%', min: 0, step: 0.1 },
  { key: 'laborMarkupPercent', label: 'Labor Markup', group: 'pricing', kind: 'number', unit: '%', min: 0, step: 0.1 },
  { key: 'shopMarkupPercent', label: 'Shop Markup', group: 'pricing', kind: 'number', unit: '%', min: 0, step: 0.1 },
  { key: 'repFeePercent', label: 'Rep Fee', group: 'pricing', kind: 'number', unit: '%', min: 0, step: 0.1 },
];

export const estimateAssumptionsByGroup = (group: EstimateAssumptionGroup) =>
  estimateAssumptionDefinitions.filter((definition) => definition.group === group);
