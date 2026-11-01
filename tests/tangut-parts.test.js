import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

// The palette's index of Tangut outlines by key; the outlines themselves are the engine's.
const load = name => JSON.parse(gunzipSync(readFileSync(new URL(`../node_modules/@han-compose/composer/data/sources/${name}/outlines.json.gz`, import.meta.url))))

it('indexes every bundled Tangut outline exactly once', () => {
  const keys = JSON.parse(gunzipSync(readFileSync(new URL('../data/tangut-parts.json.gz', import.meta.url))))
  expect(new Set(keys).size).toBe(keys.length)
  expect(keys).toEqual(Object.keys(load('tangut').records))
  expect(keys).toContain('𗀀')
  expect(keys).toContain('⿰𘪡𘤊')
})
