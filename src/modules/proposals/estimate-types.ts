export type EstimateGeometryProfile = 'flat' | 'tread_riser' | 'custom';
export type EstimateRoundingMode = 'fractional' | 'whole_up';

export type EstimateChipBlendRow = {
  id: string;
  color: string;
  percentage: number;
  size: string;
  materialType: string;
  vendor: string;
  unitCostPerBag: number;
};

export type ProposalEstimateInputs = {
  geometryProfile: EstimateGeometryProfile;
  customerQuantity: number | null;
  lengthInches: number | null;
  widthInches: number | null;
  riserHeightInches: number | null;
  thicknessInches: number | null;
  depthInches: number | null;
  roughLengthInches: number | null;
  roughWidthInches: number | null;
  roughThicknessInches: number | null;
  productionQuantityOverride: number | null;
  finish: string;
  sealer: string;
  resinColor: string;
  filler: string;
  colorPlate: string;
  chipBlend: EstimateChipBlendRow[];
};

export type ProposalEstimateAssumptions = {
  materialDensityLbPerCubicFoot: number;
  batchCapacityCubicFeet: number;
  poundsPerBatch: number;
  chipBagWeightPounds: number;
  piecesPerSlab: number;
  laborRatePerHour: number;
  crewSize: number;
  hoursPerDay: number;
  shopCostPerDay: number;
  materialsMarkupPercent: number;
  freightMarkupPercent: number;
  laborMarkupPercent: number;
  shopMarkupPercent: number;
  repFeePercent: number;
  difficultyFactorPercent: number;
  batchRounding: EstimateRoundingMode;
  shopDayRounding: EstimateRoundingMode;
  resinGallonsPerBatch: number;
  resinCostPerGallon: number;
  hardenerResinRatio: number;
  hardenerCostPerGallon: number;
  fillerBagsPerBatch: number;
  fillerCostPerBag: number;
  groutCoverageSfPerGallon: number;
  groutCostPerGallon: number;
  sealerCoverageSfPerGallon: number;
  sealerCostPerGallon: number;
  chipFreightPerBag: number;
  liquidFreightPerGallon: number;
  fillerFreightPerBag: number;
  sealerFreightPerGallon: number;
  blendHoursPerTwentyBags: number;
  setupHoursPerSlab: number;
  pourHoursPerBatch: number;
  removeStageHoursPerSlab: number;
  gaugeSfPerHour: number;
  grindSfPerHour: number;
  groutSfPerHour: number;
  removeGroutSfPerHour: number;
  sawCutLfPerHour: number;
  edgeFinishLfPerHour: number;
  handlingItemsPerHour: number;
  cleanSealSfPerHour: number;
};

export type ProposalEstimateAssumptionOverrides = Partial<ProposalEstimateAssumptions>;

export type EstimateCostRow = {
  key: string;
  label: string;
  quantity: number;
  unit: string;
  unitCost: number;
  cost: number;
};

export type EstimateLaborRow = EstimateCostRow & {
  hours: number;
};

export type ProposalEstimateOutputs = {
  calculationVersion: 'proposal-estimate-v2';
  geometry: {
    developedWidthInches: number | null;
    customerLinearFeet: number | null;
    productionLinearFeet: number | null;
    customerSquareFeet: number | null;
    productionSquareFeet: number | null;
    customerCubicFeet: number | null;
    productionCubicFeet: number | null;
    customerEstimatedWeightLb: number | null;
    productionEstimatedWeightLb: number | null;
  };
  production: {
    calculatedQuantity: number | null;
    effectiveQuantity: number | null;
    quantitySource: 'calculated' | 'override' | 'unavailable';
    slabCount: number | null;
    roughSquareFeet: number | null;
    roughCubicFeet: number | null;
    wastePercent: number | null;
    batchCount: number | null;
  };
  materials: {
    chipPounds: number | null;
    chipBags: number | null;
    rows: EstimateCostRow[];
    totalCost: number;
  };
  freight: {
    rows: EstimateCostRow[];
    totalCost: number;
  };
  labor: {
    rows: EstimateLaborRow[];
    baseHours: number;
    difficultyHours: number;
    totalHours: number;
    totalCost: number;
  };
  shop: {
    capacityHoursPerDay: number;
    calculatedDays: number | null;
    effectiveDays: number | null;
    totalCost: number;
  };
  pricing: {
    baseCost: number;
    markupByCategory: {
      materials: number;
      freight: number;
      labor: number;
      shop: number;
    };
    totalMarkup: number;
    repFee: number;
    internalTotal: number;
    internalCalculatedUnitMetric: number | null;
    perSquareFoot: number | null;
    perLinearFoot: number | null;
    perSlab: number | null;
    perBatch: number | null;
  };
};

export type ProposalEstimate = {
  proposalId: string;
  defaultsVersionId: string;
  calculationVersion: string;
  defaultsVersion: number;
  defaultAssumptions: ProposalEstimateAssumptions;
  assumptionOverrides: ProposalEstimateAssumptionOverrides;
  effectiveAssumptions: ProposalEstimateAssumptions;
  inputs: ProposalEstimateInputs;
  outputs: ProposalEstimateOutputs;
  createdAt: string;
  updatedAt: string;
};

export type ProposalEstimatingDefaults = {
  id: string;
  version: number;
  calculationVersion: string;
  assumptions: ProposalEstimateAssumptions;
  createdAt: string;
  createdByName: string;
};
