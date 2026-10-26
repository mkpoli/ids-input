// @ts-nocheck
// Original outlines for the four-dot repetition component (氺 without the central hook).
// Both IDS spellings share one drawing; groups retain the written leaves for adjustment.
import { commands, fitted, makePart, mapped, partInk, placed, svgPath, union } from './geometry.js'
import constants from './constants.json' with { type: 'json' }

export const REPETITION = '⿰冫⿱丿丶'
export const REPETITION_MIRRORED = '⿰冫⿾冫'
export const isRepetition = text => text === REPETITION || text === REPETITION_MIRRORED
export const containsRepetition = text => text.includes(REPETITION) || text.includes(REPETITION_MIRRORED)
const contour = (ops, points) => ({ ops: commands(ops), light: points, heavy: points })
const upper = contour('MQ2Q2Q2Q2', [90, 550, 270, 515, 414, 400, 455, 356, 422, 330, 390, 303, 354, 350, 238, 468, 90, 550])
const lower = contour('MQ2Q2Q2', [60, 80, 252, 155, 442, 278, 318, 142, 116, 10, 84, -6, 60, 80])
const mirror = c => contour('M' + c.ops.slice(1).map(([, n]) => `Q${n}`).join(''), c.light.map((v, i) => i % 2 ? v : 1000 - v))
const rightUpper = mirror(upper), rightLower = mirror(lower)
const left = makePart([upper, lower]), right = makePart([rightUpper, rightLower])
const frame = union([left.box, right.box])
const ink = partInk(left) + partInk(right)
const forms = new Map([
  [REPETITION, [left, makePart([rightUpper]), makePart([rightLower])]],
  [REPETITION_MIRRORED, [left, right]],
])

export const repetitionInk = ink
export const repetitionRecord = { ink, o: 4, nl: 4 }
export function repetitionParts(text, region = constants.face) {
  const parts = forms.get(text)
  if (!parts) return null
  // Fit the whole four-dot figure once, keeping its open centre and wide proportions.
  const target = fitted(frame, region, 1)
  return parts.map(part => placed(part, part.box, mapped(part.box, frame, target), ink, 'four-dot repetition'))
}

export function repetitionDrawing(text) {
  const parts = repetitionParts(text)
  return parts ? { d: svgPath(parts), approximate: [] } : null
}
