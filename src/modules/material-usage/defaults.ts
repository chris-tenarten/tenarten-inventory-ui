import { MaterialUsageLine, MaterialUsageReport } from "./types";
import { localDateKey } from "./daily-status";

export function createDefaultMaterialLines(): MaterialUsageLine[] {
  return [
    {
      materialType: "Resin",
      manufacturer: "",
      materialName: "",
      quantity: null,
      unit: "",
      plate: "",
      notes: "",
    },
    {
      materialType: "Hardener",
      manufacturer: "",
      materialName: "",
      quantity: null,
      unit: "",
      plate: "",
      notes: "",
    },
    {
      materialType: "Filler",
      manufacturer: "",
      materialName: "",
      quantity: null,
      unit: "",
      plate: "",
      notes: "",
    },
    {
      materialType: "Chip Blend",
      manufacturer: "",
      materialName: "Chip Blend A",
      quantity: null,
      unit: "",
      plate: "",
      notes: "",
    },
    {
      materialType: "Chip Blend",
      manufacturer: "",
      materialName: "Chip Blend B",
      quantity: null,
      unit: "",
      plate: "",
      notes: "",
    },
    {
      materialType: "Miscellaneous",
      manufacturer: "",
      materialName: "",
      quantity: null,
      unit: "",
      plate: "",
      notes: "",
    },
  ];
}

export function createBlankMaterialUsageReport(): MaterialUsageReport {
  return {
    jobId: null,
    unlistedJobName: "",

    reportDate: localDateKey(),

    workOrder: "",

    terrazzoType: "",

    notes: "",

    lines: createDefaultMaterialLines(),
  };
}
