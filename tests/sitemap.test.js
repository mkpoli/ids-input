import { describe, expect, it } from 'bun:test'
import { EXAMPLES } from '../demo/lib/examples.js'
import { pathOf, routeFor } from '../worker/page.js'
import worker from '../worker/index.js'

const ORIGIN = 'https://ids.mkpo.li'
const xml = await (async () => {
  const { execFileSync } = await import('node:child_process')
  execFileSync('bun', ['scripts/build-sitemap.mjs'], { cwd: new URL('..', import.meta.url).pathname })
  return Bun.file(new URL('../dist/sitemap.xml', import.meta.url)).text()
})()
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])

const PAGES = ['/compare', '/engines']

describe('the sitemap', () => {
  it('lists every page once', () => {
    expect(new Set(locs).size).toBe(locs.length)
    for (const path of ['/', '/compare', '/engines']) expect(locs).toContain(`${ORIGIN}${path}`)
  })
  it('lists every starter sequence at the path its share link uses', () => {
    const listed = new Set(locs)
    for (const { sequence } of EXAMPLES) expect(listed.has(`${ORIGIN}${pathOf(sequence)}`)).toBe(true)
    expect(locs.length).toBe(EXAMPLES.length + 3)
  })
  it('lists nothing the worker would answer with an error or the 404 page', () => {
    for (const loc of locs) expect(routeFor(new URL(loc), EXAMPLES[0].sequence).error).toBeUndefined()
  })
})

const shell = await Bun.file(new URL('../demo/index.html', import.meta.url)).text()

describe('the worker’s answer to a listed path', () => {
  const assets = {
    /** @param {Request | string} request */
    fetch: async request => {
      const path = new URL(typeof request === 'string' ? request : request.url).pathname
      if (path === '/' || path === '/index.html') return new Response(shell, { headers: { 'content-type': 'text/html' } })
      // A comparison page is the same shell with its own entry script.
      if (PAGES.includes(path)) return new Response(shell, { headers: { 'content-type': 'text/html' } })
      // Rendered cards and the drawing stylesheet are made in the worker from the account's assets,
      // so only their status is asserted here; anything else is a miss.
      if (path.startsWith('/og/')) return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { headers: { 'content-type': 'image/png' } })
      if (path.startsWith('/assets/')) return new Response('', { headers: { 'content-type': 'text/css' } })
      return new Response('missing', { status: 404 })
    },
  }
  it('is never the 404 page', async () => {
    for (const loc of locs) {
      const response = await worker.fetch(new Request(loc), { ASSETS: assets }, {})
      expect([200, 303]).toContain(response.status)
    }
  })
})
