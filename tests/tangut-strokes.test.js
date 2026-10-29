import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
const data = JSON.parse(gunzipSync(readFileSync(new URL('../data/tangut-strokes.json.gz', import.meta.url))))

it('records the nominal stroke count of each Tangut ideograph and component', () => {
  const counts = data.values
  expect(data.sources.ideographs).toContain('TangutSources')
  expect(data.sources.components).toContain('Counted')
  expect(Object.keys(counts)).toHaveLength(6945)
  for (const [char, count] of [['𗀀', 6], ['𗀁', 7], ['𗀂', 8], ['𘟭', 14]]) expect([char, counts[char]]).toEqual([char, count])
  for (const [char, count] of [['𘠀', 1], ['𘠤', 2], ['𘫱', 13]]) expect([char, counts[char]]).toEqual([char, count])
  expect(Math.min(...Object.values(counts))).toBe(1)
  expect(Math.max(...Object.values(counts))).toBe(22)
})
