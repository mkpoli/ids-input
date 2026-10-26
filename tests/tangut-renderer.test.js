import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { tangutSource, onlyTangut } from '../src/composer/tangut.js'
import { compose, createSource, sketch } from '../src/composer/loader.js'
import { drawingSvg } from '../src/core/index.js'
import { files } from './fixtures/composer-export.js'

const outlines = JSON.parse(gunzipSync(readFileSync(new URL('../data/tangut-outlines.json.gz', import.meta.url))))
const source = () => tangutSource({ load: async () => outlines })

it('draws both Tangut examples from their designed outlines without a Han export', async () => {
  const local = source()
  for (const [sequence, char] of [['⿱𘠀⿰𘢰𘠆', '𗀀'], ['⿰𘫿𘫿', '𘴅']]) {
    const drawn = await compose(local, sequence)
    expect(drawn.d).toBe((await compose(local, char)).d)
    expect(drawn.d.length).toBeGreaterThan(500)
    expect(drawn.kanjivg).toBe(false)
    const svg = drawingSvg(drawn)
    expect(svg).toContain('<path')
    expect(svg).not.toContain('<text')
    expect(svg).not.toMatch(/NaN|Infinity/)
  }
})

it('composes edited Tangut descriptions, sketches empty slots and draws every operator', async () => {
  const local = source()
  const left = await compose(local, '⿰𘠀𘠁')
  const above = await compose(local, '⿱𘠀𘠁')
  expect(left.origins).toEqual(['glyph 𘠀', 'glyph 𘠁'])
  expect(left.d).not.toBe(above.d)
  expect((await sketch(local, '⿰𘠀⬚')).map(leaf => leaf.empty)).toEqual([false, true])
  const draft = await compose(local, '⿰𘠀⬚')
  expect(draft.slots).toHaveLength(1)
  expect(draft.d).not.toBe('')
  for (const sequence of ['⿲𘠀𘠁𘠂', '⿳𘠀𘠁𘠂', '⿾𘠁', '⿿𘠁', '〾𘠁',
    ...[...'⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽㇯'].map(op => `${op}𘠒𘠁`)]) {
    const drawn = await compose(local, sequence)
    expect(drawn.d.length).toBeGreaterThan(10)
    expect(drawn.d).not.toMatch(/NaN|Infinity/)
    if (sequence.startsWith('㇯')) expect(drawn.cut.length).toBeGreaterThan(0)
  }
})

it('uses Han data for mixed descriptions while keeping Tangut outlines local', async () => {
  const reads = []
  // Shards contain gzip bytes, unlike the manifest and layout strings.
  const remote = createSource(async name => {
    reads.push(name)
    const file = files[name]
    return file ? typeof file === 'string' ? new TextEncoder().encode(file).buffer : Uint8Array.from(file).buffer : null
  })
  const mixed = tangutSource({ load: async () => outlines, fallback: remote })
  const drawn = await compose(mixed, '⿰木𘠁')
  expect(drawn.origins).toContain('glyph 木')
  expect(drawn.origins).toContain('glyph 𘠁')
  expect(onlyTangut('⿰木𘠁')).toBe(false)
  expect(onlyTangut('⿰𘠀⬚')).toBe(true)
  expect(onlyTangut('⿰𘠀？')).toBe(false)
  expect(reads).toContain('manifest.json')
})

it('retries a failed outline load and reports unavailable glyphs', async () => {
  let calls = 0
  const local = tangutSource({ load: async () => { if (++calls === 1) throw new Error('offline'); return outlines } })
  await expect(local.ready()).rejects.toThrow('offline')
  await expect(compose(local, '⿰𘠀𘠁')).resolves.toHaveProperty('d')
  await expect(compose(local, '⿰𘠀\u{18DF2}')).rejects.toThrow('No glyph')
})

it('separates Tangut operands for layout adjustment', async () => {
  const drawn = await compose(source(), '⿱𘠀⿰𘢰𘠆', { separate: true })
  expect(drawn.parts).toHaveLength(3)
  expect(drawn.parts.every(part => part.d.length > 0)).toBe(true)
  expect(drawn.origins).toEqual(['glyph 𘠀', 'glyph 𘢰', 'glyph 𘠆'])
})
