import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
const load = name => JSON.parse(gunzipSync(readFileSync(new URL(`../data/${name}.json.gz`, import.meta.url))))
it('indexes every bundled Tangut outline exactly once', () => {
  const keys = load('tangut-parts')
  expect(new Set(keys).size).toBe(keys.length)
  expect(keys).toEqual(Object.keys(load('tangut-outlines').records))
  expect(keys).toContain('𗀀')
  expect(keys).toContain('⿰𘪡𘤊')
})
