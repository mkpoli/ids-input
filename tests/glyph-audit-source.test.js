import { expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cachedAuditSource } from '../scripts/lib/glyph-audit-source.mjs'
import { files } from './fixtures/composer-export.js'
import { compose } from '../src/composer/loader.js'

it('pins source hashes and reuses an on-disk export cache', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'glyph-audit-cache-'))
  try {
    let fetched = 0
    const options = { fetch: async url => {
      fetched++
      const name = new URL(url).pathname.slice(1)
      return files[name] === undefined ? new Response(null, { status: 404 }) : new Response(files[name])
    } }
    const first = cachedAuditSource('https://fixture.invalid/', directory, options)
    await first.create().ready()
    expect(fetched).toBe(2)
    expect(first.provenance().files['manifest.json']).toMatch(/^[a-f0-9]{64}$/)
    const second = cachedAuditSource('https://fixture.invalid/', directory, { fetch: () => { throw Error('must use cache') } })
    await second.create().ready()
    expect(second.provenance().downloadedBytes).toBe(0)
    expect(second.provenance().files).toEqual(first.provenance().files)
  } finally { await rm(directory, { recursive: true }) }
})

it('loads bundled Unicode shards without treating fallback fonts as native references', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'glyph-audit-cache-'))
  try {
    const manager = cachedAuditSource('https://fixture.invalid/', directory, { fetch: async url => {
      const name = new URL(url).pathname.slice(1)
      return files[name] === undefined ? new Response(null, { status: 404 }) : new Response(files[name])
    } })
    const source = manager.create()
    const drawing = await compose(source, 'A')
    expect(drawing.d.length).toBeGreaterThan(0)
    expect(source.hasExportGlyph('A')).toBe(false)
    await compose(source, '木')
    expect(source.hasExportGlyph('木')).toBe(true)
    expect(manager.provenance().files['data/unicode-outlines/000.json.gz']).toMatch(/^[a-f0-9]{64}$/)
  } finally { await rm(directory, { recursive: true }) }
})

it('never records transport failure as an absent glyph shard', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'glyph-audit-cache-'))
  try {
    const manager = cachedAuditSource('https://fixture.invalid/', directory, { fetch: async () => new Response(null, { status: 503 }) })
    await expect(manager.create().ready()).rejects.toThrow('transport failure 503')
    expect(manager.provenance().files).toEqual({})
  } finally { await rm(directory, { recursive: true }) }
})
