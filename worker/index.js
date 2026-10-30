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
/** A sequence as the card can take it: without the controls XML and headers refuse, and cut by code point. */
const limit = text => [...text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')].slice(0, LONGEST).join('')

const decoded = text => {
  try { return decodeURIComponent(text) } catch { return null }
}

// The page a share link wraps, read once per isolate.
let template = null
const templateOf = async (env, origin) => template ??= env.ASSETS.fetch(new URL('/', origin))
  .then(async answer => { if (!answer.ok) throw new Error(`the page answered ${answer.status}`); return answer.text() })
  .catch(error => { template = null; throw error })

/** A card, or a plain 500 the cache does not keep when the render fails. @param {any} env @param {any} ctx @param {string} sequence */
const cardOrError = (env, ctx, sequence) => cardResponse(env, ctx, sequence)
  .catch(error => new Response(`Card failed: ${error?.message ?? error}`, { status: 500, headers: { 'cache-control': 'no-store' } }))

async function share(env, request, url, sequence) {
  const html = await templateOf(env, url.origin)
  const answer = new Response(request.method === 'HEAD' ? null : shareHtml(html, { sequence, char: await characterOf(env, sequence), origin: url.origin }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-og-sequence': encodeURIComponent(sequence) },
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
    if (url.pathname === '/og' || url.pathname === '/og/') return cardOrError(env, ctx, DEFAULT)
    if (url.pathname === '/og/default.png') return cardOrError(env, ctx, DEFAULT)
    if (url.pathname === '/s') return Response.redirect(new URL('/', url).href, 302)

    const card = /^\/og\/(.+)\.png$/.exec(url.pathname)
    if (card) {
      const sequence = decoded(card[1])
      if (sequence === null) return new Response('Bad sequence', { status: 400 })
      return cardOrError(env, ctx, limit(sequence))
    }

    const link = /^\/s\/(.*)$/.exec(url.pathname)
    if (link) {
      const sequence = decoded(link[1].replace(/\/$/, ''))
      if (sequence === null) return new Response('Bad sequence', { status: 400 })
      if (!sequence) return Response.redirect(new URL('/', url).href, 302)
      return share(env, request, url, limit(sequence))
    }

    return env.ASSETS.fetch(request)
  },
}
