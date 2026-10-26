// @ts-nocheck
// Shape-specific Noto forms. Keep the caller's IDS; encoded counterparts can vary by region.
import data from './component-forms.json' with { type: 'json' }
import constants from './constants.json' with { type: 'json' }
import { commands, makePart, mapped, partInk, placed, svgPath, union } from './geometry.js'

const styles = Object.fromEntries(Object.entries(data.forms).map(([style, forms]) => [style,
  new Map(Object.entries(forms).map(([text, groups]) => {
    const parts = groups.map(group => makePart(group.map(([ops, points]) => ({ ops: commands(ops), light: points, heavy: points }))))
    return [text, { parts, frame: union(parts.map(p => p.box)), ink: parts.reduce((n, p) => n + partInk(p), 0) }]
  }))]))
export const containsComponentForm = text => [...styles.sans.keys()].some(key => text.includes(key))
export const isGroupedForm = text => (styles.sans.get(text)?.parts.length ?? 0) > 1
export const isComponentForm = text => styles.sans.has(text)
export function componentRecord(text, style = 'sans') {
  const form = (styles[style] ?? styles.sans).get(text)
  return form ? { ink: form.ink, o: form.parts.reduce((n, p) => n + p.contours.length, 0) } : null
}
export function componentParts(text, region = constants.face, style = 'sans', atRoot = true) {
  const form = (styles[style] ?? styles.sans).get(text)
  if (!form) return null
  const { parts, frame, ink } = form
  // Preserve the source font's em and placement for standalone forms. A crop
  // such as 彀's upper-left component stays floating in that character space;
  // complete native glyphs retain their designed proportions and side bearings.
  // Nested forms use the description's contextual row/column allocation.
  const target = atRoot ? mapped(frame, constants.face, region) : region
  const origin = text === '⿰冫⿱丿丶' || text === '⿰冫⿾冫' ? 'four-dot repetition' : `Noto ${style === 'serif' ? 'Serif' : 'Sans'} CJK JP: ${text}`
  return parts.map(part => ({ ...placed(part, part.box, mapped(part.box, frame, target), ink, origin), fixed: true }))
}
export function componentDrawing(text, style = 'sans') {
  const parts = componentParts(text, constants.face, style)
  return parts ? { d: svgPath(parts), approximate: [] } : null
}
