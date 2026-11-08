// @ts-nocheck
// The page a share link answers with: the app's own HTML, with the sequence in the title and in the
// tags a preview is built from. Browsers run the app from it as they run it from the home page.

import { sequenceOfPath } from '../src/core/address.js'
import { parse } from '../src/core/ids.js'
import { CARD_VERSION } from './card-version.js'
import { isEditorial } from './editorial.js'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

/** The code point of `char`, written `U+93B6`. @param {string} char */
/** @param {string} char */
export const codePoint = char => [...char].map(unit => `U+${(unit.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ')

/** The workshop's sequence URL: the path, or `?ids=` for text the path cannot carry, `.` and `/`
 *  included and text the IDS parser rejects. A share link builds its address the same way.
 *  @param {string} sequence */
export const pathOf = sequence => !sequence ? '/' : (/[./]/.test(sequence) || !parse(sequence, { open: true }).tree)
  ? `/?ids=${encodeURIComponent(sequence)}` : `/${encodeURIComponent(sequence)}`

const RESERVED = new Set(['embed', 'compare', 'engines', 'sources', 'open-data', 'design', 'index', 'og'])
const bad = (error, status = 400) => ({ error, status })

/** Classify requests without loading fonts or rendering. Bounds never truncate a sequence. */
export function routeFor(url, defaultSequence) {
  if (url.href.length > 16384) return bad('Link too long', 414)
  let sequence, kind
  if (url.pathname === '/og' || url.pathname === '/og/' || url.pathname === '/og/default.png') {
    sequence = defaultSequence
    kind = 'card'
  } else {
    const card = /^\/og\/([^/]+)\.png$/.exec(url.pathname)
    if (card) {
      try { sequence = decodeURIComponent(card[1]) } catch { return bad('Bad sequence') }
      kind = 'card'
    } else if (url.pathname === '/') {
      sequence = url.searchParams.get('ids')
      if (!sequence) return { kind: 'asset' }
      kind = 'page'
    } else {
      try { decodeURIComponent(url.pathname) } catch { return bad('Bad sequence') }
      sequence = sequenceOfPath(url.pathname)
      if (!sequence || RESERVED.has(sequence)) return { kind: 'asset' }
      kind = 'page'
    }
  }
  if ([...sequence].length > 200) return bad('Sequence too long', 414)
  if (/\p{Cc}/u.test(sequence)) return bad('Bad sequence')
  return { kind, sequence }
}

/**
 * The title, description, tags and image of a shared sequence or document. `char` is the character
 * the card draws and names, so the page and its image say the same thing; `doc` is the document
 * token, and `documentTitle` the title it carries.
 * @param {{ sequence: string, char: string | null, origin: string, doc?: string | null, documentTitle?: string | null }} share
 */
export function metaFor({ sequence, char, origin, doc = '', documentTitle = null }) {
  const url = new URL(pathOf(sequence), origin)
  if (doc) url.searchParams.set('doc', doc)
  const image = new URL(`/og/${encodeURIComponent(sequence)}.png`, origin)
  image.searchParams.set('v', CARD_VERSION)
  if (doc) image.searchParams.set('doc', doc)
  const named = documentTitle || (char ? `${sequence} = ${char} (${codePoint(char)})` : sequence)
  const title = `${named} — IDS Workshop`
  const description = documentTitle
    ? `The IDS document ${documentTitle} (${sequence}), shared from IDS Workshop.`
    : doc
      ? `The ideographic description sequence ${sequence}, shared as a document from IDS Workshop.`
      : char
        ? `The ideographic description sequence ${sequence} composes ${char} (${codePoint(char)}).${isEditorial(sequence, char) ? ' The description is an editorial reading of the glyph.' : ''} Drawn by IDS Workshop.`
        : `The ideographic description sequence ${sequence}, composed by IDS Workshop.`
  return {
    title,
    tags: [
      `<meta name="description" content="${escaped(description)}">`,
      `<link rel="canonical" href="${escaped(url.href)}">`,
      `<meta property="og:type" content="article">`,
      `<meta property="og:site_name" content="IDS Workshop">`,
      `<meta property="og:url" content="${escaped(url.href)}">`,
      `<meta property="og:title" content="${escaped(title)}">`,
      `<meta property="og:description" content="${escaped(description)}">`,
      `<meta property="og:image" content="${escaped(image.href)}">`,
      `<meta property="og:image:type" content="image/png">`,
      `<meta property="og:image:width" content="${OG_WIDTH}">`,
      `<meta property="og:image:height" content="${OG_HEIGHT}">`,
      `<meta property="og:image:alt" content="${escaped(documentTitle ? `The IDS document ${documentTitle}, the sequence ${sequence}` : doc ? `The sequence ${sequence} shared as a document` : char ? `The sequence ${sequence} composed as ${char} (${codePoint(char)})` : `The sequence ${sequence} composed`)}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${escaped(title)}">`,
      `<meta name="twitter:description" content="${escaped(description)}">`,
      `<meta name="twitter:image" content="${escaped(image.href)}">`,
    ].join('\n    '),
  }
}

const escaped = text => text.replace(/[&<>"']/g, mark => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[mark])

// The home page's own wording, and the tags replaced on the share page.
const REPLACED = [
  /<title>[\s\S]*?<\/title>/,
  /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
  /<meta name="description"[^>]*>/,
  /<link rel="canonical"[^>]*>/,
  /<meta property="og:[^"]*"[^>]*>/g,
  /<meta name="twitter:[^"]*"[^>]*>/g,
]
/** @param {string} html */
const stripped = html => REPLACED.reduce((out, pattern) => out.replace(pattern, ''), html)
  .replace(/(\n[ \t]*){3,}/g, '\n')

/**
 * The home page with `share`'s title and tags in place of its own.
 * @param {string} template The served `index.html`.
 * @param {{ sequence: string, char: string | null, origin: string }} share
 */
export function shareHtml(template, share) {
  const { title, tags } = metaFor(share)
  // A function, so a `$` in a sequence is not read as a replacement pattern.
  return stripped(template)
    .replace('</head>', () => `  <title>${escaped(title)}</title>\n    ${tags}\n  </head>`)
}
