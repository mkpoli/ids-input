import { sequenceOfPath } from '../src/core/address.js'

const SITE = 'https://ids.mkpo.li'
const TITLE = 'IDS Workshop — Ideographic Description Sequence Editor'
const BLURB = 'Build and edit ideographic description sequences (IDS), find Han characters by their parts, preview Han and Tangut forms, and export SVG or PNG images.'

/** @param {string} text */
const escapeHtml = text => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)

/** `index.html` with the tags a link preview and a crawler read, written for this sequence.
 *  @param {string} html @param {URL} url @param {string} sequence */
function address(html, url, sequence) {
  const title = escapeHtml(`${sequence} — IDS Workshop`)
  const blurb = escapeHtml(`${sequence} in the IDS Workshop: its parts, a preview of the composed character, and SVG or PNG export.`)
  const bare = `${SITE}/${encodeURIComponent(sequence)}`
  return html
    .replace(`<title>${TITLE}</title>`, `<title>${title}</title>`)
    .replace(`<meta property="og:title" content="${TITLE}">`, `<meta property="og:title" content="${title}">`)
    .replace(`<meta name="twitter:title" content="${TITLE}">`, `<meta name="twitter:title" content="${title}">`)
    .replace('<link rel="canonical" href="https://ids.mkpo.li/">', `<link rel="canonical" href="${bare}">`)
    .replace('<meta property="og:url" content="https://ids.mkpo.li/">', `<meta property="og:url" content="${bare}">`)
    .replace(`<meta name="description" content="${BLURB}">`, `<meta name="description" content="${blurb}">`)
    .replace(`<meta property="og:description" content="${BLURB}">`, `<meta property="og:description" content="${blurb}">`)
    .replace(`<meta name="twitter:description" content="${BLURB}">`, `<meta name="twitter:description" content="${blurb}">`)
    .replace(`<meta property="og:type" content="website">`, '<meta property="og:type" content="article">')
}

export default {
  /** @param {Request} request @param {{ ASSETS: { fetch(request: Request): Promise<Response> } }} env */
  async fetch(request, env) {
    const sequence = sequenceOfPath(new URL(request.url).pathname)
    if (!sequence) return env.ASSETS.fetch(request)
    const url = new URL(request.url)
    const page = await env.ASSETS.fetch(`${SITE}/index.html`)
    const body = address(await page.text(), url, sequence)
    return new Response(request.method === 'HEAD' ? null : body, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300',
        // A preview is not the page to index.
        ...(url.hostname.endsWith('.workers.dev') ? { 'x-robots-tag': 'noindex' } : {}),
      },
    })
  },
}
