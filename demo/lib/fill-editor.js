// The fill picker's colour arithmetic: RGB and hex in, HSV and alpha for the picker, and back.
// Values are clamped, so a dragged thumb near an edge never writes NaN into a document.

/** A colour as the picker holds it: hue in degrees, saturation and value 0–1, alpha 0–1.
 *  @typedef {{ h: number, s: number, v: number, a: number }} Hsva */
/** @typedef {{ r: number, g: number, b: number, a: number }} Rgba */

/** @param {number} value @param {number} low @param {number} high */
const clamp = (value, low, high) => Math.min(high, Math.max(low, Number.isFinite(value) ? value : low))

/** Read a hex or `rgb()`/`rgba()` colour, opaque black when it cannot be read.
 *  @param {string | null | undefined} value @returns {Rgba} */
export function readRgba(value) {
  const text = String(value ?? '').trim()
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text)
  if (hex) {
    let digits = hex[1]
    if (digits.length === 3 || digits.length === 4) digits = [...digits].map(digit => digit + digit).join('')
    const at = i => parseInt(digits.slice(i, i + 2), 16)
    return { r: at(0), g: at(2), b: at(4), a: digits.length === 8 ? at(6) / 255 : 1 }
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i.exec(text)
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : Number(rgb[4])
    return { r: clamp(Number(rgb[1]), 0, 255), g: clamp(Number(rgb[2]), 0, 255), b: clamp(Number(rgb[3]), 0, 255), a: clamp(alpha, 0, 1) }
  }
  return { r: 0, g: 0, b: 0, a: 1 }
}

/** @param {Rgba} rgba @returns {Hsva} */
export function toHsva({ r, g, b, a }) {
  const red = clamp(r, 0, 255) / 255, green = clamp(g, 0, 255) / 255, blue = clamp(b, 0, 255) / 255
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue), span = max - min
  let h = 0
  if (span > 0) {
    if (max === red) h = ((green - blue) / span) % 6
    else if (max === green) h = (blue - red) / span + 2
    else h = (red - green) / span + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : span / max, v: max, a: clamp(a, 0, 1) }
}

/** @param {Hsva} hsva @returns {Rgba} */
export function toRgba({ h, s, v, a }) {
  const hue = ((h % 360) + 360) % 360 / 60
  const saturation = clamp(s, 0, 1), value = clamp(v, 0, 1)
  const chroma = value * saturation
  const x = chroma * (1 - Math.abs(hue % 2 - 1))
  const m = value - chroma
  const [red, green, blue] = hue < 1 ? [chroma, x, 0] : hue < 2 ? [x, chroma, 0] : hue < 3 ? [0, chroma, x]
    : hue < 4 ? [0, x, chroma] : hue < 5 ? [x, 0, chroma] : [chroma, 0, x]
  return { r: Math.round((red + m) * 255), g: Math.round((green + m) * 255), b: Math.round((blue + m) * 255), a: clamp(a, 0, 1) }
}

/** A colour for a document fill: six digits when opaque, eight when translucent.
 *  @param {Hsva} hsva @returns {string} */
export function fillColourOf(hsva) {
  const { r, g, b, a } = toRgba(hsva)
  const hex = [r, g, b].map(value => value.toString(16).padStart(2, '0')).join('')
  const alpha = Math.round(clamp(a, 0, 1) * 255).toString(16).padStart(2, '0')
  return alpha === 'ff' ? `#${hex}` : `#${hex}${alpha}`
}

/** The six-digit part of a colour, for the hex field. @param {Hsva} hsva */
export function hexOf(hsva) {
  const { r, g, b } = toRgba(hsva)
  return `#${[r, g, b].map(value => value.toString(16).padStart(2, '0')).join('')}`
}

/** The alpha as a whole percentage. @param {Hsva} hsva */
export const percentOf = hsva => Math.round(clamp(hsva.a, 0, 1) * 100)

/** The colour under a semi-transparent fill, as `rgb(...)`, for the alpha track. @param {Hsva} hsva */
export function rgbOf(hsva) {
  const { r, g, b } = toRgba(hsva)
  return `rgb(${r} ${g} ${b})`
}

export { clamp }
