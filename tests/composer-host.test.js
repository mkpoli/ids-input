import { describe, expect, it } from 'bun:test'

import worker, { composerFile } from '../composer/src/index.js'

/** An R2 binding over a Map, with the three fields the Worker reads. */
const store = (files) => ({ COMPOSER: { get: async key => {
  const value = files.get(key)
  return value === undefined ? null : { body: value.body, size: value.body.length, httpEtag: `"${key}"` }
} } })
const bytes = (text) => new TextEncoder().encode(text)
const call = (path, files, method = 'GET') => worker.fetch(new Request(`https://composer.test${path}`, { method }), store(files))

const exportFiles = () => new Map([
  ['versions.json', { body: bytes('["v1-serif-f6"]') }],
  ['v1-serif-f6/manifest.json', { body: bytes('{"format":6}') }],
  ['v1-serif-f6/g/65c.json', { body: new Uint8Array([0x1f, 0x8b, 8]) }],
  ['v1-serif-f6/OFL.txt', { body: bytes('SIL') }],
])

describe('the composer export Worker', () => {
  it('serves an export file with the type its reader expects', async () => {
    const manifest = await call('/v1-serif-f6/manifest.json', exportFiles())
    expect(manifest.status).toBe(200)
    expect(manifest.headers.get('content-type')).toBe('application/json')
    expect(manifest.headers.get('cache-control')).toContain('immutable')

    // A shard is gzip bytes under a .json name: sent as bytes, so nothing decodes them twice.
    const shard = await call('/v1-serif-f6/g/65c.json', exportFiles())
    expect(shard.headers.get('content-type')).toBe('application/octet-stream')
    expect((await call('/v1-serif-f6/OFL.txt', exportFiles())).headers.get('content-type')).toContain('text/plain')
  })

  it('lists the versions with the export files, on a cache a publish can overtake', async () => {
    const versions = await call('/versions', exportFiles())
    expect(versions.status).toBe(200)
    expect(await versions.json()).toEqual(['v1-serif-f6'])
    // The list changes with a publish, so it is not kept for a year like a version's own files.
    expect(versions.headers.get('cache-control')).not.toContain('immutable')
  })

  it('answers a version it does not hold and a path that names no file', async () => {
    expect((await call('/v2-serif-f6/manifest.json', exportFiles())).status).toBe(404)
    expect((await call('/v1-serif-f6/manifest.json.gz', exportFiles())).status).toBe(404)
    expect((await call('/nofile', exportFiles())).status).toBe(404)
    expect((await call('/versions.json', exportFiles())).status).toBe(404)
    expect((await call('/v1-serif-f6/../../secrets.json', exportFiles())).status).toBe(404)
  })

  it('lets any site read an export, and answers a preflight', async () => {
    const file = await call('/v1-serif-f6/manifest.json', exportFiles())
    expect(file.headers.get('access-control-allow-origin')).toBe('*')
    const options = await call('/v1-serif-f6/manifest.json', exportFiles(), 'OPTIONS')
    expect(options.status).toBe(204)
    expect(options.headers.get('access-control-allow-methods')).toContain('GET')
  })

  it('answers a head without a body, and refuses anything else', async () => {
    const head = await call('/v1-serif-f6/manifest.json', exportFiles(), 'HEAD')
    expect(head.status).toBe(200)
    expect(await head.text()).toBe('')
    expect((await call('/v1-serif-f6/manifest.json', exportFiles(), 'POST')).status).toBe(405)
  })

  it('reports a store it cannot read as unavailable rather than missing', async () => {
    const broken = { COMPOSER: { get: async () => { throw new Error('R2 down') } } }
    const response = await worker.fetch(new Request('https://composer.test/v1-serif-f6/manifest.json'), broken)
    expect(response.status).toBe(503)
  })

  it('keeps a file of the export out of reach when the path is not one it names', async () => {
    expect(await composerFile(store(exportFiles()), '/v1-serif-f6/../v1-serif-f6/manifest.json')).toBeNull()
    expect(await composerFile(store(exportFiles()), '/v1-serif-f6/not-json')).toBeNull()
  })
})
