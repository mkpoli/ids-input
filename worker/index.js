import { sequenceOfPath } from '../src/core/address.js'
import { parse } from '../src/core/ids.js'

const SITE = 'https://ids.mkpo.li'
const TITLE = 'IDS Workshop — Ideographic Description Sequence Editor'
const BLURB = 'Build and edit ideographic description sequences (IDS), find Han characters by their parts, preview Han and Tangut forms, and export SVG or PNG images.'

/** @param {string} text */
const escapeHtml = text => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)

/** `index.html` with the tags a link preview and a crawler read, written for this sequence.
 *  @param {string} html @param {string} sequence */
function address(html, sequence) {
  const title = escapeHtml(`${sequence} — IDS Workshop`)
  const blurb = escapeHtml(`${sequence} in the IDS Workshop: its parts, a preview of the composed character, and SVG or PNG export.`)
  const bare = `${SITE}/${encodeURIComponent(sequence)}`
  return html
    .replace(`<title>${TITLE}</title>`, `<title>${title}</title>`)
    .replace(`<meta property="og:title" content="${TITLE}">`, `<meta property="og:title" content="${title}">`)
    .replace(`<meta name="twitter:title" content="${TITLE}">`, `<meta name="twitter:title" content="${title}">`)
    .replace(`<link rel="canonical" href="${SITE}/">`, `<link rel="canonical" href="${bare}">`)
    .replace(`<meta property="og:url" content="${SITE}/">`, `<meta property="og:url" content="${bare}">`)
    .replace(`<meta name="description" content="${BLURB}">`, `<meta name="description" content="${blurb}">`)
    .replace(`<meta property="og:description" content="${BLURB}">`, `<meta property="og:description" content="${blurb}">`)
    .replace(`<meta name="twitter:description" content="${BLURB}">`, `<meta name="twitter:description" content="${blurb}">`)
}

/** @typedef {{ ASSETS: { fetch: (request: Request | string) => Promise<Response> } }} Env */

export default {
  /** @param {Request} request @param {Env} env */
  async fetch(request, env) {
    // Only a sequence reads its own address. Anything else, junk paths included, belongs to the
    // asset layer, whose page keeps the root canonical.
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request)
    const url = new URL(request.url)
    const sequence = sequenceOfPath(url.pathname)
    if (!sequence || !parse(sequence, { open: true }).tree) return env.ASSETS.fetch(request)
    const page = await env.ASSETS.fetch(new URL('/index.html', url).href)
    const html = await page.text()
    if (!page.ok || !html.includes(`<title>${TITLE}</title>`)) return env.ASSETS.fetch(request)
    const head = address(html, sequence)
    return new Response(request.method === 'HEAD' ? null : head, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // The asset layer revalidates its HTML and this rewrite moves with a deploy.
        'cache-control': 'max-age=0, must-revalidate',
      },
    })
  },
}
