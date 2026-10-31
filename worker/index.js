// @ts-nocheck
// Static assets serve the workshop; sequence links receive their own preview tags, and a path that
// names no sequence gets a page that says so.
import { OPERATORS, isComponent, isSelector, parse } from '../src/core/ids.js'
import { EXAMPLES } from '../demo/lib/examples.js'
import { shareHtml, routeFor } from './page.js'
import { cardResponse, characterOf } from './render.js'

const ORIGIN = 'https://ids.mkpo.li'
const failure = (message, status) => new Response(message, { status, headers: { 'cache-control': 'no-store' } })

const OPERATOR = new Set(OPERATORS.map(([operator]) => operator))
const SLOTS = new Set(['⬚', '？', '?'])

/** @param {string} text */
const escapeHtml = text => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)

/** @param {string} sequence */
const reads = sequence => Boolean(parse(sequence, { open: true }).tree)

/** Whether the text is spelt in a sequence's own letters, even where it does not parse: an older
 *  link, or a draft's address, which is worth opening rather than a miss.
 *  @param {string} text */
const spells = text => [...text].every(char => OPERATOR.has(char) || SLOTS.has(char) || isSelector(char) || isComponent(char))

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

/** The page a path that names no sequence gets: the text, and a way to open it as a draft.
 *  @param {URL} url @param {string} text */
function notFound(url, text) {
  const shown = escapeHtml(text)
  const draft = new URL(url)
  draft.pathname = '/'
  draft.searchParams.set('ids', text)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="light dark">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<title>${shown} — no such sequence · IDS Workshop</title>
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
  <h1>No sequence at this address</h1>
  <p><code>${shown}</code></p>
  <p>An ideographic description sequence reads as its own path, like <code>⿰木口</code>. This text is not one, so nothing opened it.</p>
  <p><a href="${escapeHtml(draft.href)}">Open it as a draft</a> · <a href="/">The workshop</a></p>
</main>
</body>
</html>
`
}

/** @param {Request} request @param {string} text @param {string} status */
const render = (request, text, status) => new Response(request.method === 'HEAD' ? null : text, {
  status: Number(status),
  headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'max-age=0, must-revalidate',
  },
})

/** @typedef {{ ASSETS: { fetch: (request: Request | string) => Promise<Response> } }} Env */

/** A miss: the asset layer's answer, or this page where a reader would argue with a bare 404.
 *  @param {Request} request @param {Env} env @param {URL} url */
async function miss(request, env, url) {
  const text = url.pathname.slice(1)
  // `/⿰.口` is a sequence the path rule reads as a file, so the page would call it no sequence.
  if (reads(text)) return new Response(null, { status: 303, headers: { location: draftOf(url, text).href } })
  const response = await env.ASSETS.fetch(request)
  if (response.status !== 404 || request.headers.get('sec-fetch-mode') !== 'navigate') return response
  return render(request, notFound(url, text), '404')
}

/** The editor's address for the text, whatever the path it came from. @param {URL} url @param {string} text */
function draftOf(url, text) {
  const draft = new URL(url)
  draft.pathname = '/'
  draft.searchParams.set('ids', text)
  return draft
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
        response = render(request, await plain.text(), String(plain.status))
      // Text in a sequence's letters but not a sequence: an older link or a draft. It belongs in
      // the editor, and a redirect leaves the address it came from readable.
      } else if (spells(route.sequence)) response = new Response(null, { status: 303, headers: { location: draftOf(url, route.sequence).href } })
      else response = render(request, notFound(url, route.sequence), '404')
    } else {
      try {
        if (route.kind === 'card') response = await cardResponse(env, ctx, route.sequence)
        else {
          const template = await env.ASSETS.fetch(new URL('/index.html', url.origin).href)
          if (!template.ok) throw new Error('Page unavailable')
          const html = await template.text()
          if (!html.includes(`<title>IDS Workshop — Ideographic Description Sequence Editor</title>`)) response = render(request, notFound(url, route.sequence), '404')
          else {
            const head = shareHtml(html, { sequence: route.sequence, char: await characterOf(env, route.sequence), origin: ORIGIN })
            response = new Response(head, { headers: {
              'content-type': 'text/html; charset=utf-8',
              'cache-control': 'max-age=0, must-revalidate',
              'x-og-sequence': encodeURIComponent(route.sequence),
            } })
          }
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
