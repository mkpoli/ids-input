// @ts-nocheck
// Static assets serve the workshop; sequence links receive their own preview tags, and a path that
// names no sequence gets a page that says so.
import { EMPTY_MARKS, OPERATORS, UNKNOWN, isComponent, isSelector, parse } from '../src/core/ids.js'
import { EXAMPLES } from '../demo/lib/examples.js'
import { shareHtml, routeFor } from './page.js'
import { cardResponse, characterOf } from './render.js'

const ORIGIN = 'https://ids.mkpo.li'
const failure = (message, status) => new Response(message, { status, headers: { 'cache-control': 'no-store' } })

// A sequence's own letters: operators, the marks a draft leaves for an empty slot, selectors.
const LETTER = new Set([...OPERATORS.map(([operator]) => operator), ...EMPTY_MARKS, UNKNOWN])
const IDEOGRAPH = /\p{Script=Han}|\p{Script=Tangut}/u

/** @param {string} text */
const escapeHtml = text => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)

/** @param {string} sequence */
const reads = sequence => Boolean(parse(sequence, { open: true }).tree)

/** Whether the text is spelt in a sequence's own letters, even where it does not parse: an older
 *  link, or a draft's address, which is worth opening rather than a miss. An operator, a slot or a
 *  selector says so on its own; ideographs only count where the whole text is spelt in them.
 *  @param {string} text */
function spells(text) {
  const chars = [...text]
  if (!chars.length) return false
  if (!chars.every(char => LETTER.has(char) || isSelector(char) || isComponent(char))) return false
  return chars.some(char => LETTER.has(char)) || chars.every(char => IDEOGRAPH.test(char))
}

/** The page a path that names no sequence gets: the text, and a way to open it as a draft.
 *  @param {URL} url @param {string} text @param {boolean} doomed  whether the text itself reads as
 *  a sequence attempt, which the copy then addresses */
function notFound(url, text, doomed = false) {
  const shown = escapeHtml(text)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="light dark">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<title>${shown} — not found · IDS Workshop</title>
<style>
  :root { color-scheme: light dark; font-family: "Noto Sans CJK JP", "Hiragino Sans", "Yu Gothic", system-ui, sans-serif; }
  *, *::before, *::after { box-sizing: border-box; }
  body { display: grid; place-content: center; min-height: 100dvh; margin: 0; padding: 2rem; line-height: 1.5; }
  main { display: grid; gap: 1rem; }
  p { margin: 0; max-width: 34em; color: color-mix(in srgb, CanvasText 70%, Canvas); }
  code { font-size: 1.6em; overflow-wrap: anywhere; color: CanvasText; }
  h1 { margin: 0; font-size: 1.1rem; font-weight: 600; }
  a { color: inherit; }
</style>
</head>
<body>
<main>
  <h1>Nothing at this address</h1>
  <p><code>${shown}</code></p>
  ${doomed
    ? '<p>An ideographic description sequence reads as its own path, like <code>⿰木口</code>. This text is not one, so nothing opened it.</p>'
    : '<p>No page or file lives here.</p>'}
  <p><a href="${escapeHtml(draft(url, text).href)}">Open it as a draft</a> · <a href="/">The workshop</a></p>
</main>
</body>
</html>
`
}

/** @param {Request} request @param {string} text @param {number} status */
const render = (request, text, status) => new Response(request.method === 'HEAD' ? null : text, {
  status,
  headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'max-age=0, must-revalidate',
  },
})

/** @typedef {{ ASSETS: { fetch: (request: Request | string) => Promise<Response> } }} Env */

/** The segment a path holds, decoded, or the raw path where it will not decode.
 *  @param {string} pathname */
function textOf(pathname) {
  try {
    return decodeURIComponent(pathname.slice(1))
  } catch {
    return pathname.slice(1)
  }
}

/** @param {URL} url @param {string} text */
const draft = (url, text) => {
  const target = new URL(url)
  target.pathname = '/'
  target.searchParams.set('ids', text)
  return target
}

/** A miss: the asset layer's answer, or, for a reader, the editor where the text is a sequence the
 *  path rule cannot carry, and this page otherwise.
 *  @param {Request} request @param {Env} env @param {URL} url */
async function miss(request, env, url) {
  const text = textOf(url.pathname)
  // `/⿰.口` is a sequence the path rule reads as a file, so the page would call it no sequence.
  if (reads(text)) return new Response(null, { status: 303, headers: { location: draft(url, text).href } })
  const response = await env.ASSETS.fetch(request)
  if (response.status !== 404 || request.headers.get('sec-fetch-mode') !== 'navigate') return response
  return render(request, notFound(url, text, spells(text)), 404)
}

export default {
  /** @param {Request} request @param {Env} env */
  async fetch(request, env, ctx) {
    // The root, files and deeper paths belong to the asset layer, whose page keeps the root
    // canonical. A path that names a sequence reads its own address.
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request)
    const url = new URL(request.url)
    const route = routeFor(url, EXAMPLES[0].sequence)
    let response
    if (route.error) response = failure(route.error, route.status)
    else if (route.kind === 'asset') response = url.pathname === '/' ? await env.ASSETS.fetch(request) : await miss(request, env, url)
    else if (route.kind === 'page' && !reads(route.sequence)) {
      // A token carries its own document, whatever the address says, but the address is its
      // subject only where it parses, so the shell keeps the root canonical.
      if (url.searchParams.has('doc')) {
        const plain = await env.ASSETS.fetch(new URL('/index.html', url.origin).href)
        response = render(request, await plain.text(), plain.status)
      // Text in a sequence's letters but not a sequence: an older link or a draft. It belongs in
      // the editor, and a redirect leaves the address it came from readable.
      } else if (spells(route.sequence)) response = new Response(null, { status: 303, headers: { location: draft(url, route.sequence).href } })
      else response = render(request, notFound(url, route.sequence), 404)
    } else {
      try {
        if (route.kind === 'card') response = await cardResponse(env, ctx, route.sequence)
        else {
          const template = await env.ASSETS.fetch(new URL('/index.html', url.origin).href)
          if (!template.ok) throw new Error('Page unavailable')
          const html = await template.text()
          if (!html.includes('<title>IDS Workshop — Ideographic Description Sequence Editor</title>')) response = render(request, notFound(url, route.sequence), 404)
          else response = new Response(shareHtml(html, {
            sequence: route.sequence, char: await characterOf(env, route.sequence), origin: ORIGIN,
          }), { headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'max-age=0, must-revalidate',
            'x-og-sequence': encodeURIComponent(route.sequence),
          } })
        }
      } catch {
        response = failure('Preview unavailable', 500)
      }
    }
    // Dynamic responses need their own indexing policy.
    const headers = new Headers(response.headers)
    if (url.hostname !== 'ids.mkpo.li') headers.set('x-robots-tag', 'noindex')
    return new Response(request.method === 'HEAD' ? null : response.body, {
      status: response.status, statusText: response.statusText, headers,
    })
  },
}
