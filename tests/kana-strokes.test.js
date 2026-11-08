import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
const read = () => JSON.parse(gunzipSync(readFileSync(new URL('../data/kana-strokes.json.gz', import.meta.url))))

it('counts the strokes of every kana KanjiVG draws', () => {
  const data = read(), keys = data.keys, strokes = data.strokes
  expect(strokes).toHaveLength(keys.length)
  expect(keys.length).toBeGreaterThan(170)
  // Hiragana then katakana, in code-point order, one entry each.
  expect(keys.every((key, index) => [...key].length === 1 && (!index || keys[index - 1].codePointAt(0) < key.codePointAt(0)))).toBe(true)
  expect(keys.every(key => (key >= '\u3041' && key <= '\u3096') || (key >= '\u30a1' && key <= '\u30fa'))).toBe(true)
  const count = key => strokes[keys.indexOf(key)]
  for (const [key, value] of [['あ', 3], ['い', 2], ['う', 2], ['ア', 2], ['イ', 2], ['ウ', 3], ['カ', 2], ['キ', 3], ['フ', 1], ['ノ', 1]]) expect([key, count(key)]).toEqual([key, value])
  expect(Math.min(...strokes)).toBeGreaterThan(0)
  expect(Math.max(...strokes)).toBeLessThan(10)
  expect(data.revision).toMatch(/^[0-9a-f]{40}$/)
})
