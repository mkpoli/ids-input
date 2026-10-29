import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
const data = JSON.parse(gunzipSync(readFileSync(new URL('../data/tangut-strokes.json.gz', import.meta.url))))

it('records the nominal stroke count of each Tangut ideograph', () => {
  const counts = data.values
  expect(data.source).toContain('TangutSources')
  expect(Object.keys(counts).length).toBeGreaterThan(6000)
  for (const [char, count] of [['𗀀', 6], ['𗀁', 7], ['𗀂', 8], ['𘟭', 14]]) expect([char, counts[char]]).toEqual([char, count])
  expect(Math.min(...Object.values(counts))).toBe(4)
  expect(Math.max(...Object.values(counts))).toBe(22)
})
