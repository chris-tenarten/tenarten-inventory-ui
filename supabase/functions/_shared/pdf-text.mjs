const punctuation = new Map([
  ["\u2018", "'"], ["\u2019", "'"], ["\u201A", "'"], ["\u201B", "'"],
  ["\u201C", '"'], ["\u201D", '"'], ["\u201E", '"'], ["\u201F", '"'],
  ["\u2013", "-"], ["\u2014", "-"], ["\u2212", "-"],
  ["\u2026", "..."], ["\u2022", "*"], ["\u00B7", " | "],
]);

const winAnsiExtras = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6,
  0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c,
  0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
]);

const supportedByStandardPdfFont = (character) => {
  const code = character.codePointAt(0) ?? 0;
  return character === "\n" || (code >= 0x20 && code <= 0x7e) ||
    (code >= 0xa0 && code <= 0xff) || winAnsiExtras.has(code);
};

const standardFontFallback = (character) => {
  const decomposed = character.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return [...decomposed].filter(supportedByStandardPdfFont).join("");
};

export function normalizePdfText(value) {
  const normalized = String(value ?? "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00a0\u2007\u202f]+/g, " ")
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "")
    .replace(/[\u2018\u2019\u201a\u201b\u201c\u201d\u201e\u201f\u2013\u2014\u2212\u2026\u2022\u00b7]/g, character => punctuation.get(character) ?? character)
    .split("\n")
    .map(line => line.replace(/ {2,}/g, " ").trimEnd())
    .join("\n");

  return [...normalized].map(character =>
    supportedByStandardPdfFont(character) ? character : standardFontFallback(character)
  ).join("");
}
