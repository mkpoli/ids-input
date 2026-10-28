import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { paletteRows } from '../src/adapter/babelstone.js'
import { UNICODE_VERSION } from '../src/core/unicode.js'
import { isOtherScript, partScript } from '../src/core/scripts.js'
const read = name => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url)))
const gz = name => JSON.parse(gunzipSync(readFileSync(new URL(`../data/${name}`, import.meta.url))))

it('indexes additional scripts, symbols and mixed descriptions without changing the existing script groups', () => {
  const groups = gz('script-parts.json.gz'), index = read('script-parts-index.json')
  const metadata = read('script-parts-metadata.json')
  expect(metadata.unicode).toBe(UNICODE_VERSION)
  const seen = new Set(), mismatched = []
  for (const { id, count } of index) {
    expect(isOtherScript(id)).toBe(true)
    expect(groups[id]).toHaveLength(count)
    for (const key of groups[id]) { expect(seen.has(key)).toBe(false); seen.add(key); if (partScript(key) !== id) mismatched.push(key) }
  }
  expect(mismatched).toEqual([])
  for (const [first, last] of read('unicode-coverage.json')) for (let cp = first; cp <= last; cp++) {
    const char = String.fromCodePoint(cp)
    if (isOtherScript(partScript(char))) expect(seen.has(char)).toBe(true)
  }
  for (const row of [...paletteRows(read('ids-parts.json')), ...gz('small-seal.json.gz').parts]) {
    if (isOtherScript(partScript(row.part))) expect(seen.has(row.part)).toBe(true)
  }
  for (const [group, char] of [['Hebr', 'א'], ['Arab', 'ش'], ['Deva', 'अ'], ['Hira', 'あ'], ['Kana', 'ア'], ['symbols', '◇'], ['mixed', '⿱㇒⿻日丿']]) expect(groups[group]).toContain(char)
  for (const id of ['han', 'latin', 'cyrillic', 'hangul', 'bopomofo', 'tangut', 'seal', 'strokes']) expect(groups[id]).toBeUndefined()
})
