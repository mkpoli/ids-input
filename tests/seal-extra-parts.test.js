import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import extras from '../data/seal-extra-parts.json' with { type: 'json' }
const data = name => JSON.parse(gunzipSync(readFileSync(new URL(`../data/${name}.json.gz`, import.meta.url))))
it('indexes all bundled seal outlines absent from the curated palette', () => {
  const curated = new Set(data('small-seal').parts.map(part => part.part))
  expect(extras).toEqual(Object.keys(data('small-seal-outlines').records).filter(key => !curated.has(key)))
  expect(extras).toContain('⿱𽀀朿')
  expect(new Set(extras).size).toBe(extras.length)
})
