import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { isComponent, isLetter, arity, EMPTY_MARKS, UNICODE_VERSION } from '../src/core/ids.js'
import { roots, searchParts } from '../src/core/decompose.js'
import { babelStoneAdapter } from '../src/adapter/babelstone.js'
import properties from '../data/unicode-properties.json'

const source = name => gunzipSync(readFileSync(new URL(`../data/unicode-18.0.0/${name}.gz`, import.meta.url))).toString()
it('matches Unicode 18 assigned graphic characters and the bundled allocations', () => {
  const invisible = new Set()
  for (const line of source('DerivedCoreProperties.txt').split('\n')) {
    const match = line.match(/^([0-9A-F]+)(?:\.\.([0-9A-F]+))?\s*; Default_Ignorable_Code_Point\b/)
    if (match) for (let cp = parseInt(match[1], 16); cp <= parseInt(match[2] ?? match[1], 16); cp++) invisible.add(cp)
  }
  const graphic = new Set()
  let start = 0
  for (const line of source('UnicodeData.txt').trim().split('\n')) {
    const [hex, name, category] = line.split(';'), point = parseInt(hex, 16)
    if (name.endsWith(', First>')) { start = point; continue }
    if (!/^[LMNPS]/.test(category) && category !== 'Co') continue
    for (let cp = name.endsWith(', Last>') ? start : point; cp <= point; cp++) graphic.add(cp)
  }
  const bundled = cp => cp >= 0x3D000 && cp <= 0x3FC3F || cp >= 0xA97D && cp <= 0xA97F || cp === 0xD7C7 || cp >= 0xD7FC && cp <= 0xD7FE
  const mismatches = []
  for (let cp = 0; cp <= 0x10FFFF; cp++) {
    const char = String.fromCodePoint(cp)
    const expected = (graphic.has(cp) && !invisible.has(cp) || bundled(cp))
      && !arity(char) && !EMPTY_MARKS.includes(char)
    if (isComponent(char) !== expected) mismatches.push(cp.toString(16))
  }
  expect(mismatches).toEqual([])
  expect(UNICODE_VERSION).toBe('18.0.0')
})
it('rebuilds identical properties from the pinned source snapshots', () => {
  const result = execFileSync('python3', ['-c', 'import sys,json;sys.path.insert(0,"scripts");from build_unicode_properties import build;print(json.dumps(build()))'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' })
  expect(JSON.parse(result)).toEqual(properties)
})
it('accepts recent scripts and kana in parsing and literal component search', async () => {
  const adapter = babelStoneAdapter({ table: new Map() })
  for (const cp of [0x18E00, 0x191A0, 0x18CD6, 0x1B123, 0x1B168, 0x1DF1F, 0x12550]) {
    const ch = String.fromCodePoint(cp)
    expect(isComponent(ch)).toBe(true)
    expect((await adapter.search(ch)).map(h => h.char)).toContain(ch)
  }
  for (const ch of ['\u{18E00}', '\u{1B123}', '\u{1AFF0}']) expect((await adapter.search(ch + '木')).map(h => h.char)).toContain(ch)
  expect(isLetter('\u{1DF1F}')).toBe(true)
  expect(isLetter('\u{18E00}')).toBe(false)
})

it('uses pinned ideographs in containing-character searches', () => {
  for (const char of ['\u{18E00}', '\u{191A0}']) expect(searchParts(roots(char + '木'), {})).toBe(char + '木')
})
