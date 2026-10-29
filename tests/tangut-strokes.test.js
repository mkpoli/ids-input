import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
const data = JSON.parse(gunzipSync(readFileSync(new URL('../data/tangut-strokes.json.gz', import.meta.url))))

it('records the stroke count of each Tangut character in the list', () => {
  const counts = data.values
  expect(data.sources.ideographs).toContain('TangutSources')
  expect(data.sources.components).toContain('Counted')
  expect(data.sources.descriptions).toContain('Summed')
  expect(Object.keys(counts)).toHaveLength(13052)
  for (const [char, count] of [['𗀀', 6], ['𗀁', 7], ['𗀂', 8], ['𘟭', 14]]) expect([char, counts[char]]).toEqual([char, count])
  for (const [char, count] of [['𘠀', 1], ['𘠤', 2], ['𘫱', 13]]) expect([char, counts[char]]).toEqual([char, count])
  for (const [key, count] of [['⿱𘠀⿰𘢰𘠆', 6], ['⿱𘠀⿵𘠒𘡯', 7], ['⿰𘪡𘤊', 14]]) expect([key, counts[key]]).toEqual([key, count])
  expect(Math.min(...Object.values(counts))).toBe(1)
  expect(Math.max(...Object.values(counts))).toBe(22)
})
