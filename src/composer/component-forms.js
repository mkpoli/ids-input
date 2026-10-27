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
  const origin = text === '⿰冫⿱丿丶' || text === '⿰冫⿾冫' ? 'four-dot repetition' : `Noto ${style === 'serif' ? 'Serif' : 'Sans'} CJK: ${text}`
  return parts.map(part => ({ ...placed(part, part.box, mapped(part.box, frame, target), ink, origin), fixed: true }))
}
export function componentDrawing(text, style = 'sans') {
  const parts = componentParts(text, constants.face, style)
  return parts ? { d: svgPath(parts), approximate: [] } : null
}

/** A native contextual cut fitted to a caller's placement, with its own stroke weights. */
export function componentPosition(name, target, style = 'sans', designHeight = null) {
  let part = positions[style]?.get(name)
  if (part && name === '儿:under-bar' && designHeight !== null) part = weightedLegs(part, target, style, designHeight)
  return part ? { ...placed(part, part.box, target, partInk(part), `Noto ${style} ${name}`), fixed: true } : null
}

/** Restore vertical stroke weight after compressing 元's legs, preserving the sweep's tapered tip. */
function weightedLegs(part, target, style, height) {
  const sourceHeight = part.box[3] - part.box[1]
  const [native, desired] = style === 'serif' ? [62, 42] : [71, 60]
  const amount = Math.max(0, desired - native * height / sourceHeight) * sourceHeight / height / 2
  if (!amount) return part
  const sx = (target[2] - target[0]) / (part.box[2] - part.box[0])
  const sy = (target[3] - target[1]) / sourceHeight
  const contours = part.contours.map(contour => {
    const pts = contour.light, n = pts.length / 2
    let signed = 0
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; signed += pts[i*2] * pts[j*2+1] - pts[j*2] * pts[i*2+1] }
    const left = Math.max(...Array.from({ length: n }, (_, i) => pts[i*2])) < 500
    const points = Array.from(pts)
    for (let i = 0; i < n; i++) {
      const prev = (i + n - 1) % n, next = (i + 1) % n
      const dx = (pts[next*2] - pts[prev*2]) * sx, dy = (pts[next*2+1] - pts[prev*2+1]) * sy
      const normal = -Math.sign(signed) * dx / (Math.hypot(dx, dy) || 1)
      const taper = left ? Math.max(0, Math.min(1, (pts[i*2] - 85) / 170)) : 1
      let y = pts[i*2+1] + amount * normal * taper
      // Do not push the hook's inner edge above its upright-to-foot bend.
      const bend = style === 'serif' ? 37 : 51
      if (!left && pts[i*2+1] < bend && y > pts[i*2+1])
        y = Math.min(y, Math.max(pts[i*2+1], bend - 12))
      points[i*2+1] = Math.max(part.box[1], Math.min(part.box[3], y))
    }
    return { ...contour, light: points, heavy: points }
  })
  return makePart(contours, part.box.slice())
}

export const componentPositionBox = (name, style = 'sans') => positions[style]?.get(name)?.box ?? null
