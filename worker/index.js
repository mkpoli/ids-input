// @ts-nocheck
// Static assets serve the workshop; sequence links receive their own preview tags.
import { parse } from '../src/core/ids.js'
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
    else if (route.kind === 'asset' || (route.kind === 'page' && url.pathname !== '/' && !parse(route.sequence, { open: true }).tree)) response = await env.ASSETS.fetch(request)
    else {
      try {
        if (route.kind === 'card') response = await cardResponse(env, ctx, route.sequence)
        else {
          const template = await env.ASSETS.fetch(new URL('/index.html', url.origin))
          if (!template.ok) throw new Error('Page unavailable')
          const html = shareHtml(await template.text(), {
            sequence: route.sequence, char: await characterOf(env, route.sequence), origin: ORIGIN,
          })
          response = new Response(html, { headers: {
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
