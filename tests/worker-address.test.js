import { describe, expect, it } from 'bun:test'
import worker from '../worker/index.js'

const shell = await Bun.file(new URL('../demo/index.html', import.meta.url)).text()
const assets = {
  /** @param {Request | string} request */
  fetch: async request => {
    const path = new URL(typeof request === 'string' ? request : request.url).pathname
    if (path === '/' || path === '/index.html') return new Response(shell, { headers: { 'content-type': 'text/html' } })
    return new Response('missing', { status: 404 })
  },
}
const ask = (url, init) => worker.fetch(new Request(url, init), { ASSETS: assets })
const navigate = url => ask(url, { headers: { 'sec-fetch-mode': 'navigate' } })

describe('a path that names a sequence', () => {
  it('names it in every tag a preview reads', async () => {
    const response = await ask('https://ids.mkpo.li/%E2%BF%B0%E6%9C%A8%E5%8F%A3')
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain('<title>⿰木口 — IDS Workshop</title>')
    expect(body).toContain('<meta property="og:title" content="⿰木口 — IDS Workshop">')
    expect(body).toContain('<link rel="canonical" href="https://ids.mkpo.li/%E2%BF%B0%E6%9C%A8%E5%8F%A3">')
    expect(body).toContain('<meta property="og:url" content="https://ids.mkpo.li/%E2%BF%B0%E6%9C%A8%E5%8F%A3">')
    expect(body).toContain('<meta property="og:image:alt" content="The sequence ⿰木口 composed">')
    expect(body.match(/The ideographic description sequence ⿰木口/g)?.length).toBe(3)
    expect(body).toContain('<meta name="description" content="The ideographic description sequence ⿰木口')
    expect(body).toContain('https://ids.mkpo.li/og/%E2%BF%B0%E6%9C%A8%E5%8F%A3.png')
  })
  it('serves the empty slot a link written before ⬚ carries', async () => {
    expect((await ask('https://ids.mkpo.li/%E2%BF%B0%EF%BC%8B%E5%8F%A3')).status).toBe(200)
  })
  it('serves a sequence still being typed', async () => {
    expect(await (await ask('https://ids.mkpo.li/%E2%BF%B0%E6%9C%A8')).text()).toContain('<title>⿰木 — IDS Workshop</title>')
  })
  it('revalidates its HTML', async () => {
    const response = await ask('https://ids.mkpo.li/%E2%BF%B0%E6%9C%A8')
    expect(response.headers.get('cache-control')).toBe('max-age=0, must-revalidate')
  })
})

describe('a path that names no sequence', () => {
  it('answers 404 with the text and a way to open it as a draft', async () => {
    const response = await navigate('https://ids.mkpo.li/Buy%20cheap')
    expect(response.status).toBe(404)
    const body = await response.text()
    expect(body).toContain('<code>Buy cheap</code>')
    expect(body).toContain('href="https://ids.mkpo.li/?ids=Buy+cheap"')
    expect(body).toContain('<meta name="robots" content="noindex">')
    expect(body).not.toContain('og:title')
  })
  it('treats a word as a miss, not as a sequence attempt', async () => {
    for (const path of ['/admin', '/wp-login.php', '/Buy']) {
      const response = await navigate(`https://ids.mkpo.li${path}`)
      expect(response.status).toBe(404)
    }
    expect(await (await navigate('https://ids.mkpo.li/admin')).text()).toContain('No page or file lives here.')
  })
  it('reads the text at the root whether or not it parses', async () => {
    const response = await ask('https://ids.mkpo.li/?ids=Buy+cheap')
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<link rel="canonical" href="https://ids.mkpo.li/?ids=Buy%20cheap">')
  })
  it('answers HEAD without a body', async () => {
    const response = await ask('https://ids.mkpo.li/Buy%20cheap', { method: 'HEAD' })
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('')
  })
  it('sends text in a sequence’s letters to the editor rather than to a miss', async () => {
    for (const [path, text] of [['%E6%9C%A8%E5%8F%A3', '木口'], ['%E2%AC%9A', '⬚'], ['%E2%BF%B0%E6%9C%A8%E5%8F%A3%E5%8F%A3', '⿰木口口']]) {
      const response = await ask(`https://ids.mkpo.li/${path}`)
      expect(response.status).toBe(303)
      expect(response.headers.get('location')).toBe(`https://ids.mkpo.li/?ids=${encodeURIComponent(text).replace(/%20/g, '+')}`)
    }
  })
  it('keeps the root tags when a token carries the document', async () => {
    const response = await navigate('https://ids.mkpo.li/Buy%20cheap?doc=abc')
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain('<title>IDS Workshop — Ideographic Description Sequence Editor</title>')
    expect(body).toContain('<link rel="canonical" href="https://ids.mkpo.li/">')
  })
})

describe('what the asset layer owns', () => {
  it('passes the root, a file and a deeper path through', async () => {
    expect((await ask('https://ids.mkpo.li/')).status).toBe(200)
    for (const path of ['/compare.html', '/robots.txt', '/deep/deeper'])
      expect((await ask(`https://ids.mkpo.li${path}`)).status).toBe(404)
  })
  it('forwards a sequence the path rule cannot carry to any client', async () => {
    const response = await ask('https://ids.mkpo.li/%E2%BF%B0.%E5%8F%A3')
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://ids.mkpo.li/?ids=%E2%BF%B0.%E5%8F%A3')
  })
  it('decodes a miss once, for the page and for the draft', async () => {
    const body = await (await navigate('https://ids.mkpo.li/deep/%E6%B7%B1%E3%81%84')).text()
    expect(body).toContain('<code>deep/深い</code>')
    expect(body).toContain('ids=deep%2F%E6%B7%B1%E3%81%84')
  })
  it('gives a navigated miss the page, and a fetched one the bare 404', async () => {
    const navigated = await navigate('https://ids.mkpo.li/deep/deeper')
    expect(navigated.status).toBe(404)
    expect(await navigated.text()).toContain('<code>deep/deeper</code>')
    expect((await ask('https://ids.mkpo.li/assets/nope.js')).status).toBe(404)
  })
})
