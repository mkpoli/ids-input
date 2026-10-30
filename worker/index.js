// @ts-nocheck
// Pages serves the workshop files; sequence links receive their own preview tags.
import { EXAMPLES } from '../demo/lib/examples.js'
import { shareHtml, routeFor } from './page.js'
import { cardResponse, characterOf } from './render.js'

const ORIGIN = 'https://ids.mkpo.li'
const failure = (message, status) => new Response(message, { status, headers: { 'cache-control': 'no-store' } })

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request)
    const route = routeFor(url, EXAMPLES[0].sequence)
    let response
    if (route.error) response = failure(route.error, route.status)
    else if (route.kind === 'asset') response = await env.ASSETS.fetch(request)
    else {
      try {
        if (route.kind === 'card') response = await cardResponse(env, ctx, route.sequence)
        else {
          const template = await env.ASSETS.fetch(new URL('/', url.origin))
          if (!template.ok) throw new Error('Page unavailable')
          const html = shareHtml(await template.text(), {
            sequence: route.sequence, char: await characterOf(env, route.sequence), origin: ORIGIN,
          })
          response = new Response(html, { headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'public, max-age=300',
            'x-og-sequence': encodeURIComponent(route.sequence),
          } })
        }
      } catch {
        response = failure('Preview unavailable', 500)
      }
    }
    // Functions responses do not inherit Pages' static _headers file.
    const headers = new Headers(response.headers)
    if (url.hostname !== 'ids.mkpo.li') headers.set('x-robots-tag', 'noindex')
    return new Response(request.method === 'HEAD' ? null : response.body, {
      status: response.status, statusText: response.statusText, headers,
    })
  },
}
