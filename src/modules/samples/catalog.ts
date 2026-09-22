import { searchPurchasingCatalog } from "@/modules/purchasing/catalog";
import type { PurchasingCatalogSuggestion } from "@/modules/purchasing/types";
import type { SampleBlendRow } from "./types";

/** Eligibility comes from structured classification, never the product name/query. */
export function sampleCatalogEligible(item: PurchasingCatalogSuggestion, role: SampleBlendRow["componentRole"]) {
  const fields = item.classification;
  if (!fields) return false;
  const classification = Object.values(fields).join(" ").toLowerCase().replace(/[^a-z0-9]+/g, " ");
  // Explicit component roles take precedence over a broad material family (e.g. epoxy).
  if (/\b(hardener|part b)\b/.test(classification)) return role === "hardener";
  if (/\bfiller\b/.test(classification)) return role === "filler";
  if (/\b(resin|epoxy)\b/.test(classification)) return role === "resin";
  if (/\b(aggregate|chip|marble|glass)\b/.test(classification)) return role === "aggregate";
  return role === "other" && /\b(other|misc|pigment|colorant)\b/.test(classification);
}

function nameMatchStrength(name: string, term: string) {
  const value = name.trim().toLocaleLowerCase();
  if (value === term) return 3;
  if (value.startsWith(term)) return 2;
  return value.includes(term) ? 1 : 0;
}

export async function searchSampleCatalog(term: string, role: SampleBlendRow["componentRole"]) {
  const query = term.trim().toLocaleLowerCase();
  const matches = await searchPurchasingCatalog(term, "", "", { allowShortQuery: true });
  if (!query) return matches.filter((item) => sampleCatalogEligible(item, role));
  // Eligibility determines the group; name strength ranks within each group.
  // Stable sorting retains the existing order for ties and never collapses offers.
  return matches.sort((a, b) =>
    Number(sampleCatalogEligible(b, role)) - Number(sampleCatalogEligible(a, role)) ||
    nameMatchStrength(b.materialName, query) - nameMatchStrength(a.materialName, query));
}
