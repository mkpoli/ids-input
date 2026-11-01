import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { createSource } from '../../src/composer/loader.js'
import { unicodeSource } from '../../src/composer/unicode.js'

export function cachedAuditSource(base, cache, { maxDownloadBytes = 512 * 1024 * 1024, fetch: get = globalThis.fetch } = {}) {
  const root = base.endsWith('/') ? base : `${base}/`
  const digest = bytes => createHash('sha256').update(bytes).digest('hex')
  const directory = join(cache, digest(root).slice(0, 16))
  const hashes = new Map()
  let downloaded = 0, requested = 0
  const read = async name => {
    if (!/^(manifest\.json|layout\.json|[gp]\/[a-f0-9]{3}\.json)$/.test(name)) throw Error(`Unexpected export path: ${name}`)
    const path = join(directory, name)
    let bytes
    try { bytes = await readFile(path) } catch (error) {
      if (error.code !== 'ENOENT') throw error
      try { await readFile(`${path}.404`); hashes.set(name, null); return null } catch (missing) {
        if (missing.code !== 'ENOENT') throw missing
      }
      if (downloaded >= maxDownloadBytes) throw Error('Audit download budget exceeded; resume with the cache or a larger explicit budget.')
      const response = await get(root + name, { signal: AbortSignal.timeout(30000) })
      requested++
      await mkdir(dirname(path), { recursive: true })
      if (response.status === 404 && /^[gp]\//.test(name)) {
        await writeFile(`${path}.404`, '')
        hashes.set(name, null)
        return null
      }
      if (!response.ok) throw Error(`Export transport failure ${response.status}: ${root + name}`)
      bytes = Buffer.from(await response.arrayBuffer())
      downloaded += bytes.length
      await writeFile(path, bytes)
    }
    hashes.set(name, digest(bytes))
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  }
  return {
    create: () => {
      const fallback = createSource(read, { concurrency: 4 })
      const source = unicodeSource({ fallback, load: async key => {
        if (!/^unicode\/[a-f0-9]+$/.test(key)) throw Error(`Unexpected Unicode shard: ${key}`)
        const name = `data/unicode-outlines/${key.slice('unicode/'.length)}.json.gz`
        const bytes = await readFile(new URL(`../../${name}`, import.meta.url))
        hashes.set(name, digest(bytes))
        return JSON.parse(gunzipSync(bytes).toString())
      } })
      // Reference comparisons require the selected export's own glyph, not a fallback font.
      source.hasExportGlyph = key => Boolean(fallback.store().rec(key)?.G)
      return source
    },
    provenance: () => ({ base: root, downloadedBytes: downloaded, networkRequests: requested,
      files: Object.fromEntries([...hashes].sort(([a], [b]) => a.localeCompare(b))) }),
  }
}
