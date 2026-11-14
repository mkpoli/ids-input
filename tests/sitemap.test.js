import { describe, expect, it } from 'bun:test'
import { EXAMPLES } from '../demo/lib/examples.js'
import { sitemapXml } from '../scripts/build-sitemap.mjs'
import { pathOf, routeFor } from '../worker/page.js'
import worker from '../worker/index.js'

const ORIGIN = 'https://ids.mkpo.li'
const PAGES = ['/compare', '/engines', '/sources', '/open-data', '/unencoded', '/ucv', '/normalization', '/components', '/history']
const locs = [...sitemapXml().matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])

describe('the sitemap', () => {
  it('lists every page once', () => {
    expect(new Set(locs).size).toBe(locs.length)
    for (const path of ['/', ...PAGES]) expect(locs).toContain(`${ORIGIN}${path}`)
  })
  it('lists every starter sequence at the path its share link uses', () => {
    const listed = new Set(locs)
    for (const { sequence } of EXAMPLES) expect(listed.has(`${ORIGIN}${pathOf(sequence)}`)).toBe(true)
  })
  it('lists nothing the worker would answer with an error or the 404 page', () => {
    for (const loc of locs) expect(routeFor(new URL(loc), EXAMPLES[0].sequence).error).toBeUndefined()
  })
})

const shell = await Bun.file(new URL('../demo/index.html', import.meta.url)).text()
// A comparison or catalogue page is the shell with its own entry script; the build writes it
// beside the shell.
const comparison = path => path === '/' ? shell : shell.replace('./main.js', `.${path}.js`)

describe('the worker’s answer to a listed path', () => {
  const assets = {
    /** @param {Request | string} request */
    fetch: async request => {
      const path = new URL(typeof request === 'string' ? request : request.url).pathname
      if (path === '/' || path === '/index.html' || PAGES.includes(path))
        return new Response(comparison(PAGES.includes(path) ? path : '/'), { headers: { 'content-type': 'text/html' } })
      // Rendered cards and the drawing stylesheet are made in the worker from the account's assets,
      // so only their status is asserted here; anything else is a miss.
      if (path.startsWith('/og/')) return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { headers: { 'content-type': 'image/png' } })
      if (path.startsWith('/assets/')) return new Response('', { headers: { 'content-type': 'text/css' } })
      return new Response('missing', { status: 404 })
    },
  }
  it('is 200, since a sitemap lists no redirect', async () => {
    for (const loc of locs) {
      const response = await worker.fetch(new Request(loc), { ASSETS: assets }, {})
      expect(response.status).toBe(200)
    }
  })
})

it('points each page’s canonical at the URL the sitemap lists', async () => {
  for (const path of PAGES) {
    expect(await Bun.file(new URL(`../demo${path}.html`, import.meta.url)).text())
      .toContain(`<link rel="canonical" href="${ORIGIN}${path}">`)
  }
})
