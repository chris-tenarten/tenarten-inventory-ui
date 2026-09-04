import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizePdfText } from "../supabase/functions/_shared/pdf-text.mjs";

const excelPaste = "Jos\u00e9\u00a0Garc\u00eda\tAcme\u200b  Terrazzo\r\nSuite 120\u0007";
assert.equal(normalizePdfText(excelPaste), "José García Acme Terrazzo\nSuite 120");
assert.equal(normalizePdfText("‘Quoted’ “name” – phase — two…"), "'Quoted' \"name\" - phase - two...");
assert.equal(normalizePdfText("François · Muñoz & Co."), "François | Muñoz & Co.");
assert.equal(normalizePdfText("ordinary punctuation: #42, $5.00 (net-30)!"), "ordinary punctuation: #42, $5.00 (net-30)!");
assert.doesNotMatch(normalizePdfText(excelPaste), /\?/);

const [purchaseOrder, proposal, sample] = await Promise.all([
  readFile(new URL("../supabase/functions/generate-purchase-order-pdf/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/generate-proposal-pdf/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/generate-sample-pdf/index.ts", import.meta.url), "utf8"),
]);
for (const source of [purchaseOrder, proposal, sample]) {
  assert.match(source, /normalizePdfText/);
  assert.doesNotMatch(source, /replace\(\/\[\^\\x20-\\x7e\\n\]\/g,['"]\?['"]\)/);
}

console.log("Generator PDF text normalization checks passed.");
