const text = (value) => value == null ? "" : String(value);

export function wrapMeasuredPdfText(value, width, size, measureText) {
  const lines = [];
  for (const paragraph of text(value).split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let current = "";
    const tokens = paragraph.split(/\s+/).filter(Boolean).flatMap((token) => {
      if (measureText(token, size) <= width) return [token];
      const pieces = [];
      let piece = "";
      for (const character of token) {
        const candidate = piece + character;
        if (piece && measureText(candidate, size) > width) {
          pieces.push(piece);
          piece = character;
        } else piece = candidate;
      }
      if (piece) pieces.push(piece);
      return pieces;
    });
    for (const token of tokens) {
      const candidate = current ? `${current} ${token}` : token;
      if (current && measureText(candidate, size) > width) {
        lines.push(current);
        current = token;
      } else current = candidate;
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

export function measuredPdfBlockHeight(lines, lineHeight, padding = 0, minimum = 0) {
  return Math.max(minimum, lines.length * lineHeight + padding);
}

export function chunkPdfLines(lines, limit) {
  const size = Math.max(1, Math.floor(limit));
  const chunks = [];
  for (let index = 0; index < lines.length; index += size) chunks.push(lines.slice(index, index + size));
  return chunks.length ? chunks : [[""]];
}
