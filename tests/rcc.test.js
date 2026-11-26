import { describe, expect, it } from 'bun:test'
import { EXAMPLES } from '../demo/lib/examples.js'
import { RCC_ORIGIN, matchRcc, parseRccMatches, rccCode, rccUrl } from '../demo/lib/rcc.js'

describe('RCC codes and links', () => {
  it('formats record ids as R+XXXX and grows past four hex digits', () => {
    expect(rccCode(1)).toBe('R+0001')
    expect(rccCode(161)).toBe('R+00A1')
    expect(rccCode(2097)).toBe('R+0831')
    expect(rccCode(0x10000)).toBe('R+10000')
  })

  it('builds localized entry URLs with an English fallback', () => {
    expect(rccUrl(2097)).toBe(`${RCC_ORIGIN}/en/entry/2097`)
    expect(rccUrl(2097, 'ja')).toBe(`${RCC_ORIGIN}/ja/entry/2097`)
    expect(rccUrl(2097, 'zh-Hant')).toBe(`${RCC_ORIGIN}/zh-Hant/entry/2097`)
    expect(rccUrl(2097, 'zh-Hans')).toBe(`${RCC_ORIGIN}/zh-Hans/entry/2097`)
    expect(rccUrl(2097, 'ko')).toBe(`${RCC_ORIGIN}/ko/entry/2097`)
    expect(rccUrl(2097, 'vi')).toBe(`${RCC_ORIGIN}/vi/entry/2097`)
    expect(rccUrl(2097, 'fr')).toBe(`${RCC_ORIGIN}/en/entry/2097`)
  })

  it('filters malformed rows, deduplicates and sorts matches by id', () => {
    expect(parseRccMatches([
      { id: 2097, ids: '⿱艹半' },
      { id: 0 },
      { id: -3 },
      { id: 1.5 },
      { id: '2097' },
      null,
      { id: 1579, ids: '⿰舟ラ', cover_key: 'a.webp' },
      { id: 2097, ids: 'duplicate' },
    ])).toEqual([
      { id: 1579, ids: '⿰舟ラ', layout: null, cover_key: 'a.webp' },
      { id: 2097, ids: '⿱艹半', layout: null, cover_key: null },
    ])
    expect(parseRccMatches(null)).toEqual([])
  })

  it('queries /api/match, caches successful responses and ignores failures', async () => {
    let calls = 0
    /** @type {string[]} */
    const urls = []
    const store = new Map()
    const okFetch = async (/** @type {string | URL | Request} */ url) => {
      calls++
      urls.push(String(url))
      return new Response(JSON.stringify([{ id: 2097, ids: '⿱艹半', layout: null, cover_key: null }]), { status: 200 })
    }
    expect(await matchRcc('木', { fetch: okFetch, cache: store })).toEqual([])
    expect(calls).toBe(0)

    const first = await matchRcc('⿱艹半', { fetch: okFetch, cache: store })
    expect(first).toEqual([{ id: 2097, ids: '⿱艹半', layout: null, cover_key: null }])
    expect(urls).toEqual([`${RCC_ORIGIN}/api/match?ids=${encodeURIComponent('⿱艹半')}`])

    const second = await matchRcc('⿱艹半', { fetch: okFetch, cache: store })
    expect(second).toEqual(first)
    expect(calls).toBe(1)

    let failedCalls = 0
    const failFetch = async () => {
      failedCalls++
      throw new Error('offline')
    }
    expect(await matchRcc('⿰舟ラ', { fetch: failFetch, cache: store })).toEqual([])
    expect(await matchRcc('⿰舟ラ', { fetch: failFetch, cache: store })).toEqual([])
    expect(failedCalls).toBe(2)

    let httpErrorCalls = 0
    const errorFetch = async () => {
      httpErrorCalls++
      return new Response('server error', { status: 500 })
    }
    expect(await matchRcc('⿲木十木', { fetch: errorFetch, cache: store })).toEqual([])
    expect(await matchRcc('⿲木十木', { fetch: errorFetch, cache: store })).toEqual([])
    expect(httpErrorCalls).toBe(2)

    const controller = new AbortController()
    controller.abort()
    const abortFetch = async (/** @type {string | URL | Request} */ _url, /** @type {RequestInit | undefined} */ init) => {
      if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      return new Response(JSON.stringify([{ id: 1608 }]), { status: 200 })
    }
    expect(await matchRcc('⿰車ト', { fetch: abortFetch, signal: controller.signal, cache: store })).toEqual([])
    expect(await matchRcc('⿰車ト', { fetch: abortFetch, cache: store })).toEqual([{ id: 1608, ids: null, layout: null, cover_key: null }])
  })

  it('assigns RCC ids only to unencoded examples', () => {
    const withRcc = EXAMPLES.filter(example => example.rcc !== undefined)
    expect(withRcc.length).toBeGreaterThan(0)
    for (const example of withRcc) {
      expect(example.char, example.sequence).toBe('')
      expect(Number.isInteger(example.rcc) && example.rcc > 0, example.sequence).toBe(true)
    }
  })
})
