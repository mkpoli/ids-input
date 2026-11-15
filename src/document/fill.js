// @ts-check
// A component's own fill. A layer without one draws in the document's ink, so a fill is a difference
// from that ink rather than a colour every layer must carry.
/** @typedef {{ type: 'solid', colour: string }} SolidFill */
/** @typedef {SolidFill} Fill */

/** A hex colour with an optional alpha channel, as SVG takes it. */
export const FILL_COLOUR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/** @param {unknown} value @returns {value is string} */
export const isFillColour = value => typeof value === 'string' && FILL_COLOUR.test(value)

/**
 * The paint a fill asks for, or the ink when it asks for none. A fill this module cannot read falls
 * back to the ink, as an unsafe colour does everywhere else in the export. The colour is opaque and
 * the alpha sits apart, so a renderer can composite a part's pieces as one before it fades them.
 * @param {Fill | null | undefined} fill @param {string} ink @returns {{ colour: string, opacity: number }}
 */
export function fillPaint(fill, ink) {
  if (!fill || fill.type !== 'solid' || !isFillColour(fill.colour)) return { colour: ink, opacity: 1 }
  const digits = fill.colour.slice(1).toLowerCase()
  const expanded = digits.length <= 4 ? [...digits].map(digit => digit + digit).join('') : digits
  const colour = `#${expanded.slice(0, 6)}`
  const opacity = expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1
  return { colour, opacity }
}

/**
 * The colour a fill asks for, alpha included, or `ink` when it asks for none.
 * @param {Fill | null | undefined} fill @param {string} ink @returns {string}
 */
export const fillColour = (fill, ink) => {
  const paint = fillPaint(fill, ink)
  return paint.opacity === 1 ? paint.colour : `${paint.colour}${Math.round(paint.opacity * 255).toString(16).padStart(2, '0')}`
}

/**
 * Add a fill's issues to `issues`, if it has any. A fill is a closed object: another type is a
 * different format version, not a hint to ignore.
 * @param {unknown} value @param {string} path @param {import('./model.js').Issue[]} issues
 * @returns {boolean}
 */
export function validateFill(value, path, issues) {
  const before = issues.length
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    issues.push({ path, message: 'fill must be an object' })
    return false
  }
  const fill = /** @type {Record<string, unknown>} */ (value)
  for (const key of Object.keys(fill)) {
    if (key !== 'type' && key !== 'colour') issues.push({ path: `${path}/${key}`, message: 'unknown field' })
  }
  if (fill.type !== 'solid') {
    issues.push({ path: `${path}/type`, message: 'fill type must be solid' })
    return false
  }
  if (!isFillColour(fill.colour)) issues.push({ path: `${path}/colour`, message: 'colour must be a hex colour with an optional alpha channel' })
  return issues.length === before
}
