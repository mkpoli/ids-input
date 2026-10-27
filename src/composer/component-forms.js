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
const positions = Object.fromEntries(Object.entries(data.positions ?? {}).map(([style, entries]) => [style,
  new Map(Object.entries(entries).map(([name, group]) => [name,
    makePart(group.map(([ops, points]) => ({ ops: commands(ops), light: points, heavy: points })))]))]))
// Kureedo's brush forms are the export's own; the bundled Sans forms must not replace them.
const forms = style => style === 'kaisho' ? null : (styles[style] ?? styles.sans)
export const containsComponentForm = text => [...styles.sans.keys()].some(key => text.includes(key))
export const isGroupedForm = text => (styles.sans.get(text)?.parts.length ?? 0) > 1
export const isComponentForm = text => styles.sans.has(text)
export function componentRecord(text, style = 'sans') {
  const form = forms(style)?.get(text)
  return form ? { ink: form.ink, o: form.parts.reduce((n, p) => n + p.contours.length, 0) } : null
}
export function componentParts(text, region = constants.face, style = 'sans', atRoot = true) {
  const form = forms(style)?.get(text)
  if (!form) return null
  const { parts, frame, ink } = form
  // Preserve the source font's em and placement for standalone forms. A crop
  // stays floating in that character space;
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

/** A native contextual cut fitted to a caller's placement, with its own stroke weights. */
export function componentPosition(name, target, style = 'sans') {
  const part = positions[style]?.get(name)
  return part ? { ...placed(part, part.box, target, partInk(part), `Noto ${style} ${name}`), fixed: true } : null
}

export const componentPositionBox = (name, style = 'sans') => positions[style]?.get(name)?.box ?? null
