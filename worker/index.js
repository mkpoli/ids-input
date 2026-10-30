// @ts-nocheck
// The site's edge: share links (`/s/<sequence>`) answer with the app's page and the sequence's
// preview tags, `/og/<sequence>.png` answers with the card image, and everything else is the built
// workshop at `dist`.
import { EXAMPLES } from '../demo/lib/examples.js'
import { shareHtml } from './page.js'
import { cardResponse, characterOf } from './render.js'

/** The sequence the home page previews. */
const DEFAULT = EXAMPLES[0].sequence
/** The longest sequence a share link carries into a card. */
const LONGEST = 200

const decoded = text => {
  try { return decodeURIComponent(text) } catch { return null }
}

// The page a share link wraps, read once per isolate.
let template = null
const templateOf = async (env, origin) => template ??= await env.ASSETS.fetch(new URL('/', origin))
  .then(answer => answer.text())

async function share(env, request, url, sequence) {
  const html = await templateOf(env, url.origin)
  const answer = new Response(request.method === 'HEAD' ? null : shareHtml(html, { sequence, char: await characterOf(env, sequence), origin: url.origin }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-og-sequence': sequence },
  })
  return answer
}

export default {
  /**
   * @param {Request} request
   * @param {{ ASSETS: { fetch: (request: Request) => Promise<Response> } }} env
   * @param {{ waitUntil: (work: Promise<any>) => void }} ctx
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request)
    if (url.pathname === '/og' || url.pathname === '/og/') return cardResponse(env, ctx, DEFAULT)
    if (url.pathname === '/og/default.png') return cardResponse(env, ctx, DEFAULT)
    if (url.pathname === '/s') return Response.redirect(new URL('/', url).href, 302)

    const card = /^\/og\/(.+)\.png$/.exec(url.pathname)
    if (card) {
      const sequence = decoded(card[1])
      if (sequence === null) return new Response('Bad sequence', { status: 400 })
      return cardResponse(env, ctx, sequence.slice(0, LONGEST))
    }

    const link = /^\/s\/(.*)$/.exec(url.pathname)
    if (link) {
      const sequence = decoded(link[1].replace(/\/$/, ''))
      if (sequence === null) return new Response('Bad sequence', { status: 400 })
      if (!sequence) return Response.redirect(new URL('/', url).href, 302)
      return share(env, request, url, sequence.slice(0, LONGEST))
    }

    return env.ASSETS.fetch(request)
  },
}
