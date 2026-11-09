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
  expect(keys.every(key => (key >= '\u3041' && key <= '\u3096') || (key >= '\u30a1' && key <= '\u30fa') || (key >= '\u31f0' && key <= '\u31ff') || (key >= '\uff66' && key <= '\uff9d'))).toBe(true)
  const count = key => strokes[keys.indexOf(key)]
  for (const [key, value] of [['あ', 3], ['い', 2], ['う', 2], ['ア', 2], ['イ', 2], ['ウ', 3], ['カ', 2], ['キ', 3], ['フ', 1], ['ノ', 1], ['マ', 2]]) expect([key, count(key)]).toEqual([key, value])
  // Halfwidth katakana take the count of the kana they decompose to.
  for (const [key, value] of [['ｱ', 2], ['ｦ', 3], ['ﾏ', 2], ['ﾝ', 2]]) expect([key, count(key)]).toEqual([key, value])
  // The Ainu small katakana take the count of the letter their Unicode name gives.
  for (const [key, value] of [['ㇰ', 2], ['ㇱ', 3], ['ㇷ', 1], ['ㇹ', 4], ['ㇿ', 3]]) expect([key, count(key)]).toEqual([key, value])
  // Every kana in the two ranges is drawn: 176, not 175. A kana lost to a parse or a lost
  // connection is a silent gap, so the count is pinned.
  expect(keys.length).toBe(247)
  expect(Math.min(...strokes)).toBeGreaterThan(0)
  expect(Math.max(...strokes)).toBeLessThan(10)
  expect(data.revision).toMatch(/^[0-9a-f]{40}$/)
})
