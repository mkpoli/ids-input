import { describe, expect, it } from 'bun:test'
import { EXAMPLES } from '../demo/lib/examples.js'
import { sitemapXml } from '../scripts/build-sitemap.mjs'
import { pathOf, routeFor } from '../worker/page.js'
import worker from '../worker/index.js'
import { LOCALE_CODES, LOCALIZED_PATHS, alternates, localeUrl, localizedHtml, pageMeta } from '../worker/locale.js'

const ORIGIN = 'https://ids.mkpo.li'
const PAGES = ['/compare', '/font-compare', '/font-mixer', '/engines', '/sources', '/open-data', '/unencoded', '/component-atlas', '/ucv', '/normalization', '/baishi', '/baishi-cheatsheet', '/baishi-railroad', '/components', '/history']
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

describe('a page with a reading in every language', () => {
  const xml = sitemapXml()
  it('is listed at each reading’s address, every entry naming all the readings', () => {
    for (const path of LOCALIZED_PATHS) {
      for (const code of LOCALE_CODES) {
        const entry = xml.split('<url>').find(block => block.includes(`<loc>${localeUrl(ORIGIN, path, code)}</loc>`))
        expect(entry, `${path} ${code}`).toBeDefined()
        for (const [hreflang, href] of alternates(ORIGIN, path))
          expect(entry).toContain(`<xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}"/>`)
      }
    }
  })
  it('leaves a page written in English alone at one address', () => {
    for (const path of ['/engines', '/open-data']) {
      expect(LOCALIZED_PATHS).not.toContain(path)
      expect(locs.filter(loc => loc.startsWith(`${ORIGIN}${path}`))).toEqual([`${ORIGIN}${path}`])
    }
  })
  it('names its language, title, description and address in the reading `?lang=` asks for', async () => {
    const page = await Bun.file(new URL('../demo/sources.html', import.meta.url)).text()
    const html = localizedHtml(page, '/sources', 'ja', ORIGIN)
    const meta = pageMeta('/sources', 'ja')
    expect(html).toContain('<html lang="ja">')
    expect(html).toContain(`<title>${meta?.title}</title>`)
    expect(html).toContain(`<meta name="description" content="${meta?.description}">`)
    expect(html).toContain(`<meta property="og:description" content="${meta?.description}">`)
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/sources?lang=ja">`)
    expect(html).toContain(`<meta property="og:url" content="${ORIGIN}/sources?lang=ja">`)
    expect(meta?.title).not.toBe(pageMeta('/sources', 'en')?.title)
    expect(meta?.description).not.toBe(pageMeta('/sources', 'en')?.description)
  })
  it('keeps the bare address for English and for a language it does not have', async () => {
    const page = await Bun.file(new URL('../demo/sources.html', import.meta.url)).text()
    for (const wanted of [null, 'en', 'xx']) {
      const html = localizedHtml(page, '/sources', wanted, ORIGIN)
      expect(html).toContain('<html lang="en">')
      expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/sources">`)
      for (const [hreflang, href] of alternates(ORIGIN, '/sources'))
        expect(html).toContain(`<link rel="alternate" hreflang="${hreflang}" href="${href}">`)
    }
  })
  it('describes each page in English as its file does', async () => {
    for (const path of ['/', ...PAGES]) {
      const file = await Bun.file(new URL(`../demo${path === '/' ? '/index' : path}.html`, import.meta.url)).text()
      const described = /name="description" content="([^"]*)"/.exec(file)?.[1]
      expect(pageMeta(path, 'en')?.description, path).toBe(described)
    }
  })
  it('has a description of its own in every language', () => {
    for (const path of LOCALIZED_PATHS) {
      const english = pageMeta(path, 'en')?.description
      for (const code of LOCALE_CODES.filter(code => code !== 'en')) expect(pageMeta(path, code)?.description, `${path} ${code}`).not.toBe(english)
    }
  })
})
