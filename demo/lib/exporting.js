// The drawing in the output as a file: SVG, or PNG at a pixel size, on a background, in an ink, with
// a margin; the last settings kept per viewer.
import { drawingSvg } from '../../src/core/index.js'
import { scopesSvg } from '../../src/document/index.js'
import { load, save } from './storage.js'

/** @typedef {{ format: 'svg' | 'png', size: number, background: 'none' | 'white' | 'black' | 'custom', custom: string, ink: 'auto' | 'custom', inkColour: string, padding: number, placeholders: boolean }} ExportSettings */

/** @type {ExportSettings} */
export const DEFAULTS = { format: 'svg', size: 1024, background: 'none', custom: '#f4efe4', ink: 'auto', inkColour: '#1d1d21', padding: 0.06, placeholders: false }
export const SIZES = [256, 512, 1024, 2048]

/** @returns {ExportSettings} */
export const storedSettings = () => ({ ...DEFAULTS, ...load('export', {}) })
/** @param {ExportSettings} settings */
export const keepSettings = settings => save('export', settings)

/** The background colour, or null for none. @param {ExportSettings} s */
export const backgroundOf = s => s.background === 'none' ? null : s.background === 'white' ? '#ffffff' : s.background === 'black' ? '#000000' : s.custom

/** The ink: black on a light background, white on a dark one, unless chosen. @param {ExportSettings} s */
export function inkOf(s) {
  if (s.ink === 'custom') return s.inkColour
  const back = backgroundOf(s)
  if (!back) return '#000000'
  const [r, g, b] = [1, 3, 5].map(i => parseInt(back.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45 ? '#ffffff' : '#000000'
}

/** @param {import('../../src/adapter/types.js').Drawing} drawing @param {ExportSettings} s @param {number} [size] */
export const svgOf = (drawing, s, size = s.size) => drawingSvg(drawing, { background: backgroundOf(s), ink: inkOf(s), padding: s.padding, size, placeholders: s.placeholders })

/** @param {import('../../src/document/index.js').ScopeTree} scopes @param {ExportSettings} s @param {number} [size] */
export const scopedSvgOf = (scopes, s, size = s.size) => scopesSvg(scopes, { background: backgroundOf(s), ink: inkOf(s), padding: s.padding, size })

/** The SVG string as a PNG blob at its pixel size. @param {string} svg @param {number} size @returns {Promise<Blob>} */
async function pngOfSvg(svg, size) {
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size })
    canvas.getContext('2d')?.drawImage(image, 0, 0, size, size)
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG failed')), 'image/png'))
  } finally { URL.revokeObjectURL(url) }
}

/** The drawing as a PNG blob at its pixel size. @param {import('../../src/adapter/types.js').Drawing} drawing @param {ExportSettings} s @returns {Promise<Blob>} */
export const pngOf = (drawing, s) => pngOfSvg(svgOf(drawing, s), s.size)

/** The scoped drawing as a PNG blob at its pixel size. @param {import('../../src/document/index.js').ScopeTree} scopes @param {ExportSettings} s @returns {Promise<Blob>} */
export const scopedPngOf = (scopes, s) => pngOfSvg(scopedSvgOf(scopes, s), s.size)
