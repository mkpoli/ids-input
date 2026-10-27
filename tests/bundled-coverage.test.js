import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { hasBundledGlyph } from '../src/composer/bundled-coverage.js'
import { bundledSource } from '../src/composer/bundled.js'
import { onlyBundled } from '../src/composer/local.js'

it('indexes the exact scalar outlines in each dedicated bundle', () => {
  for (const name of ['tangut', 'bopomofo', 'small-seal']) {
    const { records } = JSON.parse(gunzipSync(readFileSync(new URL(`../data/${name}-outlines.json.gz`, import.meta.url))))
    const expected = new Set(Object.entries(records).filter(([key, rec]) => [...key].length === 1 && rec.G?.p?.length).map(([key]) => key))
    for (let cp = 0; cp <= 0x10FFFF; cp++) {
      const char = String.fromCodePoint(cp)
      if (hasBundledGlyph(name, char) !== expected.has(char)) throw Error(`${name}: wrong coverage at ${cp.toString(16)}`)
    }
  }
})

it('does not claim missing Tangut, Small Seal or variation sequences work offline', () => {
  for (const sequence of [String.fromCodePoint(0x18D09), String.fromCodePoint(0x18D80), String.fromCodePoint(0x3FC3F), '𗀀\u{E0100}']) {
    expect(onlyBundled(sequence)).toBe(false)
  }
  expect(onlyBundled('⿰𗀀𗀁')).toBe(true)
})

it('lets absent bundled keys reach the fallback with their host metadata', async () => {
  const native = { G: { p: [[1]] } }, fallbackRecord = { G: { p: [[2]] } }
  const calls = []
  const fallback = { ready: async () => {}, filesOf: keys => { calls.push(keys); return new Set(keys) },
    load: async () => {}, store: () => ({ rec: () => fallbackRecord, hosts: () => ['host'], places: () => ['L'], missing: new Set() }) }
  const source = bundledSource({ load: async () => ({ records: { '𗀀': native } }), matches: () => true, fallback })
  await source.ready()
  source.filesOf(['𗀀', '𘶀'])
  expect(calls).toEqual([['𘶀']])
  const store = source.store()
  expect(store.rec('𗀀')).toBe(native)
  expect(store.rec('𘶀')).toBe(fallbackRecord)
  expect(store.hosts('𘶀', 'L')).toEqual(['host'])
  expect(store.places('𘶀')).toEqual(['L'])
})
