// @ts-nocheck
// An operator in the sequence set as its icon rather than as a character: the fonts in reach draw
// several of them as a bare box, the editor draws them all. Each part it places is a tinted block
// where the operator puts it, an enclosing part a thick stroke round its closed sides, so the open
// side shows as a gap; ⿾ and ⿿ show an F and what becomes of it. Drawn in a 24-unit square, as
// `IdsOperators` does, with the marks' changes in the accent.
const part = (...boxes) => boxes.map(([x0, y0, x1, y1]) => `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="1.5" fill="${INK_AT}" stroke="${INK}" stroke-width="1.25" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`).join('')
const INK = '#17171b', ACCENT = '#b3402c', INK_AT = 'rgba(23,23,27,0.22)'
const wrap = d => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>`
const mark = d => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>`
const accent = d => `<path d="${d}" fill="none" stroke="${ACCENT}" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>`
const axis = d => `<path d="${d}" fill="none" stroke="${ACCENT}" stroke-width="1.1" stroke-dasharray="2 1.6"/>`

/** @type {Record<string, string>} */
export const OPERATORS = {
  '⿰': part([3, 3, 10.75, 21], [13.25, 3, 21, 21]),
  '⿱': part([3, 3, 21, 10.75], [3, 13.25, 21, 21]),
  '⿲': part([2.5, 3, 8, 21], [9.25, 3, 14.75, 21], [16, 3, 21.5, 21]),
  '⿳': part([3, 2.5, 21, 8], [3, 9.25, 21, 14.75], [3, 16, 21, 21.5]),
  '⿴': wrap('M4 4H20V20H4Z') + part([8, 8, 16, 16]),
  '⿵': wrap('M4 21V4H20V21') + part([8, 8, 16, 21]),
  '⿶': wrap('M4 3V20H20V3') + part([8, 3, 16, 16]),
  '⿷': wrap('M21 4H4V20H21') + part([8, 8, 21, 16]),
  '⿼': wrap('M3 4H20V20H3') + part([3, 8, 16, 16]),
  '⿸': wrap('M21 4H4V21') + part([8, 8, 21, 21]),
  '⿹': wrap('M3 4H20V21') + part([3, 8, 16, 21]),
  '⿺': wrap('M4 3V20H21') + part([8, 3, 21, 16]),
  '⿽': wrap('M20 3V20H3') + part([3, 3, 16, 16]),
  '⿻': part([3, 3, 15, 15]) + `<rect x="9" y="9" width="12" height="12" rx="1.5" fill="rgba(179,64,44,0.22)" stroke="${ACCENT}" stroke-width="1.25" vector-effect="non-scaling-stroke"/>`,
  '⿾': mark('M9.5 5H4V19M4 11.5H8.5') + accent('M14.5 5H20V19M20 11.5H15.5') + axis('M12 2.5V21.5'),
  '⿿': mark('M8.5 3H3V12M3 7H7') + accent('M15.5 21H21V12M21 17H17') + accent('M11.5 3.2A8.8 8.8 0 0 1 20.6 10.5') + accent('M20.6 10.5l-2.5-2.3M20.6 10.5l1.6-3') + `<circle cx="12" cy="12" r="1.3" fill="${ACCENT}"/>`,
  '〾': part([5, 10, 19, 21]) + accent('M3.5 5.5q2.125-2.5 4.25 0t4.25 0 4.25 0 4.25 0'),
  '㇯': part([3, 3, 21, 21]) + `<rect x="8.5" y="8.5" width="9.5" height="9.5" rx="1" fill="${INK_AT}" stroke="${ACCENT}" stroke-width="1.4"/>` + accent('M10.75 13.25H15.75'),
}
