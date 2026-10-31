import { describe, expect, it } from 'bun:test'
import worker from '../worker/index.js'

const shell = await Bun.file(new URL('../demo/index.html', import.meta.url)).text()
/** @param {string} url */
const ask = async url => worker.fetch(new Request(url), {
  ASSETS: { fetch: async () => new Response(shell, { headers: { 'content-type': 'text/html' } }) },
})

describe('the worker’s head', () => {
  it('names the sequence in every tag a preview reads', async () => {
    const body = await (await ask('https://ids.mkpo.li/%E2%BF%B0%E6%9C%A8%E5%8F%A3')).text()
    expect(body).toContain('<title>⿰木口 — IDS Workshop</title>')
    expect(body).toContain('<meta property="og:title" content="⿰木口 — IDS Workshop">')
    expect(body).toContain('<link rel="canonical" href="https://ids.mkpo.li/%E2%BF%B0%E6%9C%A8%E5%8F%A3">')
    expect(body).toContain('<meta property="og:url" content="https://ids.mkpo.li/%E2%BF%B0%E6%9C%A8%E5%8F%A3">')
    expect(body.match(/The ideographic description sequence ⿰木口/g)?.length).toBe(3)
    expect(body).toContain('<meta name="description" content="The ideographic description sequence ⿰木口')
    expect(body).toContain('https://ids.mkpo.li/og/%E2%BF%B0%E6%9C%A8%E5%8F%A3.png')
    // A sequence still being typed is a sequence.
    expect(await (await ask('https://ids.mkpo.li/%E2%BF%B0%E6%9C%A8')).text()).toContain('<title>⿰木 — IDS Workshop</title>')
  })
  it('leaves the root, a file and a path that is no sequence with their own tags', async () => {
    for (const path of ['/', '/compare.html', '/Buy%20cheap'])
      expect((await ask(`https://ids.mkpo.li${path}`)).headers.get('content-type')).toBe('text/html')
    const junk = await ask('https://ids.mkpo.li/Buy%20cheap')
    expect(await junk.text()).not.toContain('— IDS Workshop</title>')
  })
  it('revalidates its HTML', async () => {
    const response = await ask('https://ids.mkpo.li/%E2%BF%B0%E6%9C%A8')
    expect(response.headers.get('cache-control')).toBe('max-age=0, must-revalidate')
  })
})
