// @ts-check
/** Common two-, three- and four-part layouts. Each slot is independently editable. */
export const STRUCTURE_TEMPLATES = [
  { id: 'pairRow', sequence: '⿰⬚⬚' },
  { id: 'pairColumn', sequence: '⿱⬚⬚' },
  { id: 'tripleRow', sequence: '⿲⬚⬚⬚' },
  { id: 'tripleColumn', sequence: '⿳⬚⬚⬚' },
  { id: 'pyramid', sequence: '⿱⬚⿰⬚⬚' },
  { id: 'invertedPyramid', sequence: '⿱⿰⬚⬚⬚' },
  { id: 'leftPair', sequence: '⿰⿱⬚⬚⬚' },
  { id: 'rightPair', sequence: '⿰⬚⿱⬚⬚' },
  { id: 'grid', sequence: '⿱⿰⬚⬚⿰⬚⬚' },
  { id: 'fourRow', sequence: '⿰⿰⬚⬚⿰⬚⬚' },
  { id: 'fourColumn', sequence: '⿱⿱⬚⬚⿱⬚⬚' },
  { id: 'topTriple', sequence: '⿱⿲⬚⬚⬚⬚' },
  { id: 'bottomTriple', sequence: '⿱⬚⿲⬚⬚⬚' },
  { id: 'leftTriple', sequence: '⿰⿳⬚⬚⬚⬚' },
  { id: 'rightTriple', sequence: '⿰⬚⿳⬚⬚⬚' },
  { id: 'middleColumn', sequence: '⿲⬚⿱⬚⬚⬚' },
  { id: 'middleRow', sequence: '⿳⬚⿰⬚⬚⬚' },
].map(template => ({ ...template, slots: [...template.sequence].filter(char => char === '⬚').length }))
