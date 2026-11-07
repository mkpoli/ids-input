import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import extras from '../data/seal-extra-parts.json' with { type: 'json' }

// The palette's curated seal parts, and the outlines the engine holds for the seed-allocation block.
const read = name => JSON.parse(gunzipSync(readFileSync(new URL(`../data/${name}.json.gz`, import.meta.url))))
const outlines = () => JSON.parse(gunzipSync(readFileSync(new URL('../node_modules/@han-compose/composer/data/sources/small-seal/outlines.json.gz', import.meta.url))))

it('indexes all bundled seal outlines absent from the curated palette', () => {
  const curated = new Set(read('small-seal').parts.map(part => part.part))
  expect(extras).toEqual(Object.keys(outlines().records).filter(key => !curated.has(key)))
  expect(extras).toContain('⿱𽀀朿')
  expect(new Set(extras).size).toBe(extras.length)
})
