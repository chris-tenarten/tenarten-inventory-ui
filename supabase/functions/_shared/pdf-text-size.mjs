/** Shared preference contract; typography remains owned by each generator. */
export const PDF_TEXT_SIZES = Object.freeze(['compact', 'standard', 'large']);
export function normalizePdfTextSize(value) {
  return PDF_TEXT_SIZES.includes(value) ? value : 'standard';
}
