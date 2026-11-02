// @ts-check
// Compose a document's scoped drawing into SVG. Component cuts become a mask scoped to their
// component; operator unions become groups; ㇯ masks its first operand by the silhouette of its
// second. Layer transforms are already baked into the pieces by renderScopes.
import { EMOJI_CUT_MATRIX, EMOJI_SCALE, emojiPlace, emojiTransform } from '../core/preview.js'
/** @typedef {import('./render.js').Scope} Scope */
/** @typedef {import('./render.js').ScopeTree} ScopeTree */
/** @typedef {import('./transform.js').Piece} Piece */

/** @param {string} value */
const colour = value => /^#[0-9a-f]{3,8}$/i.test(value) ? value : '#000000'
/** @param {string} value */
const pathData = value => String(value).replace(/[\t\n\r]/g, ' ').replace(/[^MLHVCSQTAZmlhvcsqtaz0-9.,eE+\- ]/g, '')
/** @param {string} value */
const identifier = value => String(value).replace(/[^A-Za-z0-9_-]/g, '') || 'ids'

/** @param {Piece} piece @param {string} fill */
const path = (piece, fill) => `<path d="${pathData(piece.d)}" fill="${fill}" fill-rule="${piece.fillRule === 'evenodd' ? 'evenodd' : 'nonzero'}"/>`

/** @typedef {{ text: string, box: number[], flip?: [boolean, boolean], cut?: boolean, restored?: boolean }} EmojiItem */

/** An emoji as one SVG `<text>`, escaped and centred in its box at the size its font draws it, with any reflection.
 * @param {EmojiItem} item @param {string} [attribute] */
const emojiText = (item, attribute = '') => {
  const { x, y, size } = emojiPlace(item)
  const text = item.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const reflect = emojiTransform(item)
  return `<text${attribute}${reflect ? ` transform="${reflect}"` : ''} x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${size}" font-family="system-ui, sans-serif">${text}</text>`
}
/** @typedef {{ ink?: string, background?: string | null, size?: number, idPrefix?: string, padding?: number, slots?: number[][], emoji?: EmojiItem[] | null, cut?: string | null }} SvgOptions */
/** @typedef {{ defs: string, body: string, background: string, width: number, padding: number, span: number }} ScopedMarkup */

/**
 * Build the defs and body of a scoped drawing without the wrapping `<svg>`. A preview can inject
 * these into its own canvas SVG; `scopesSvg` wraps them for a standalone file. `ink` and
 * `background` are `#rgb`/`#rrggbb` colours; `size` is the pixel width and height of the 1000-unit
 * canvas. `idPrefix` keeps mask IDs distinct when several drawings share a page.
 * @param {ScopeTree} drawing @param {SvgOptions} [options]
 * @returns {ScopedMarkup}
 */
export function scopesMarkup(drawing, { ink = '#000000', background = null, size = 1000, idPrefix = 'ids', padding = 0, slots = [], emoji = null, cut = '' } = {}) {
  const fill = ink === 'currentColor' ? 'currentColor' : colour(ink), back = background === null ? null : colour(background)
  const width = Math.max(1, Math.round(Number.isFinite(size) ? size : 1000))
  const pad = Math.round(Math.max(0, Math.min(Number.isFinite(padding) ? padding : 0, 0.5)) * 1000 * 100) / 100
  const span = 1000 + 2 * pad
  const prefix = identifier(idPrefix)
  const clipId = `${prefix}-clip`
  const defs = [`<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><rect x="0" y="0" width="1000" height="1000"/></clipPath>`]
  let count = 0
  /** @param {string} id */
  const mask = id => `mask="url(#${id})"`

  /** @param {import('./render.js').ComponentScope} scope */
  function componentMask(scope) {
    const id = `${prefix}-m${++count}`
    defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"><rect width="1000" height="1000" fill="#000000"/>${scope.positive.map(piece => path(piece, '#ffffff')).join('')}${scope.negative.map(piece => path(piece, '#000000')).join('')}</mask>`)
    return id
  }
  /** @param {import('./render.js').ComponentScope} scope */
  function componentInk(scope) {
    if (!scope.negative.length) return scope.positive.map(piece => path(piece, fill)).join('')
    return `<rect x="0" y="0" width="1000" height="1000" fill="${fill}" ${mask(componentMask(scope))}/>`
  }
  /** An emoji, drawn as text in the frame the source placed it in. @param {{ text: string, matrix: number[] }} placed */
  function textInk(placed) {
    const [a, b, c, d, e, f] = placed.matrix.map(Number)
    if ([a, b, c, d, e, f].some(value => !Number.isFinite(value))) return ''
    const text = placed.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // The frame is the box the emoji stands in, and the glyph is drawn as the preview draws it there.
    return `<text transform="matrix(${a} ${b} ${c} ${d} ${e} ${f}) translate(500 500) scale(${EMOJI_SCALE}) translate(-500 -500)" x="500" y="500" text-anchor="middle" dominant-baseline="central" font-size="1000" font-family="system-ui, sans-serif" fill="${fill}">${text}</text>`
  }
  /** @param {Scope} scope @param {string} tone @returns {string} */
  function silhouette(scope, tone = '#ffffff') {
    if (scope.kind === 'slot') return ''
    // A text is solid ink: its silhouette is the text itself.
    if (scope.kind === 'text') return textInk(scope.text)
    if (scope.kind === 'component') {
      if (!scope.negative.length) return scope.positive.map(piece => path(piece, tone)).join('')
      return `<g ${mask(componentMask(scope))}><rect width="1000" height="1000" fill="${tone}"/></g>`
    }
    if (scope.kind === 'group') return scope.child ? silhouette(scope.child, tone) : ''
    if (scope.op === '㇯' && scope.children.length >= 2) {
      const [first, second] = scope.children
      if (first.kind === 'slot') return ''
      if (second.kind === 'slot') return silhouette(first, tone)
      return `<g ${mask(subtractMask(second))}>${silhouette(first, tone)}</g>`
    }
    return `<g>${scope.children.map(child => silhouette(child, tone)).join('')}</g>`
  }
  /** A mask that is white outside `scope` and black inside it. @param {Scope} scope */
  function subtractMask(scope) {
    const id = `${prefix}-m${++count}`
    defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"><rect width="1000" height="1000" fill="#ffffff"/>${silhouette(scope, '#000000')}</mask>`)
    return id
  }
  /** @param {Scope} scope @returns {string} */
  function render(scope) {
    if (scope.kind === 'slot') return ''
    if (scope.kind === 'text') return textInk(scope.text)
    if (scope.kind === 'component') return componentInk(scope)
    if (scope.kind === 'group') return scope.child ? render(scope.child) : ''
    if (scope.op === '㇯' && scope.children.length >= 2) {
      const [first, second] = scope.children
      if (first.kind === 'slot') return ''
      if (second.kind === 'slot') return render(first)
      return `<g ${mask(subtractMask(second))}>${render(first)}</g>`
    }
    return `<g>${scope.children.map(render).join('')}</g>`
  }

  const body = drawing.root ? render(drawing.root) : ''
  const backgroundRect = back ? `<rect x="${-pad}" y="${-pad}" width="${span}" height="${span}" fill="${back}"/>` : ''
  /** @param {number[]} box */
  const slotRect = box => {
    const [x, y, width, height] = box.slice(0, 4).map(Number)
    if ([x, y, width, height].some(value => !Number.isFinite(value)) || width <= 0 || height <= 0) return ''
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="18" fill="none" stroke="${fill}" stroke-width="5" stroke-dasharray="12 8" opacity="0.55"/>`
  }
  const slotsMarkup = slots.map(slotRect).join('')
  // Emoji are text in the page's font, which the composer leaves to the page. Cut ones only erase:
  // they join a mask the ink takes and stay out of the visible pass.
  const all = emoji ?? []
  const cutEmoji = all.filter(item => item.cut), shownEmoji = all.filter(item => !item.cut)
  const cutPath = pathData(cut ?? '')
  let emojiMask = ''
  if (cutEmoji.length || cutPath) {
    const id = `${prefix}-emoji`
    defs.push(`<filter id="${id}-cut" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${EMOJI_CUT_MATRIX}"/></filter>`)
    defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"><rect width="1000" height="1000" fill="#ffffff"/>${cutPath ? `<path d="${cutPath}" fill="#000000"/>` : ''}${cutEmoji.map(item => emojiText(item, ` filter="url(#${id}-cut)"`)).join('')}</mask>`)
    emojiMask = ` mask="url(#${id})"`
  }
  // A restored emoji is put back by a nested subtraction and keeps clear of the mask.
  const emojiMarkup = shownEmoji.map(item => {
    const text = emojiText(item)
    return emojiMask && !item.restored ? `<g${emojiMask}>${text}</g>` : text
  }).join('')
  const clipped = `<g clip-path="url(#${clipId})"><g${emojiMask}>${body}</g>${emojiMarkup}${slotsMarkup}</g>`
  return { defs: defs.length ? `<defs>${defs.join('')}</defs>` : '', body: `${backgroundRect}${clipped}`, background: back ?? '', width, padding: pad, span }
}

/**
 * Write a scoped drawing as one SVG document. @param {ScopeTree} drawing @param {SvgOptions} [options]
 * @returns {string}
 */
export function scopesSvg(drawing, options = {}) {
  const { defs, body, width, padding, span } = scopesMarkup(drawing, options)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-padding} ${-padding} ${span} ${span}" width="${width}" height="${width}">${defs}${body}</svg>`
}
