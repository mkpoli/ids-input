import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'

export const DEFAULT_LIMITS = Object.freeze({
  maxInputBytes: 512 * 1024 * 1024,
  maxScanBytes: 2 * 1024 * 1024 * 1024,
  maxLineBytes: 64 * 1024,
  maxGlyphs: 256,
  maxDepth: 16,
  maxRecords: 8192,
  maxDataBytes: 1024 * 1024,
  maxOutputBytes: 16 * 1024 * 1024,
})

export const LICENSE = Object.freeze({
  name: 'GlyphWiki data and article license',
  url: 'https://glyphwiki.org/wiki/GlyphWiki:データ・記事のライセンス',
  evidenceUrl: 'https://sources.debian.org/src/thunderbird/1%3A78.8.0-1~deb10u1/layout/reftests/fonts/glyphwiki-license.txt/',
  terms: 'グリフウィキに登録されているグリフデータおよび記事は、誰もが自由に利用できることとします。複製、改変などの二次利用を認めるものとします。著作者表示も特に制限を設けません。新しいフォントのベースデータとして用いることや、そのままコピーしたものをフォントとして著作物とすることを妨げません。記事中に引用されている部分については、グリフウィキには著作権はありませんので引用元のライセンスを確認してください。',
  limitation: 'Japanese text reproduced by Debian; accompanying English translation dates to 2008-10-08. The current official license page returned HTTP 403 on 2026-11-07. No SPDX equivalence asserted.',
})

const SOURCES = [
  { url: 'https://glyphwiki.org/dump.tar.gz', author: 'GlyphWiki', accessed: '2026-11-07',
    evidence: 'HEAD and bytes 0-65535 only: gzip tar; first member dump_newest_only.txt, name | related | data table.',
    limitation: 'Mutable URL; archive remainder and historical member were not inspected.' },
  { url: 'https://ku6goma.appspot.com/gwv/data.html', author: 'くろごま', accessed: '2026-11-07',
    evidence: 'Type 99 component records have 8 or 11 fields; fields 1 and 2 carry stretch parameters (zero-based).',
    limitation: 'Third-party validator notes warn on 2017-05-10 that descriptions may be outdated.' },
  { url: 'https://raw.githubusercontent.com/ge9/kage-afdko-toolkit/master/README.md', author: 'ge9', accessed: '2026-11-07',
    evidence: 'The glyphwiki section describes newest-only and all-versions dumps, including omitted blanked historical revisions.',
    limitation: 'Third-party documentation at a mutable URL; no renderer code used.' },
]

export const sha256 = value => createHash('sha256').update(value).digest('hex')

export function parseReference(reference) {
  if (typeof reference !== 'string' || !/^[a-z0-9][a-z0-9_-]*(?:@[1-9][0-9]*)?$/.test(reference) || reference.length > 256) {
    throw Error(`Invalid glyph reference: ${String(reference).slice(0, 256)}`)
  }
  const [name, revision = null] = reference.split('@')
  return { name, revision }
}

export function parseGlyphData(data) {
  if (typeof data !== 'string' || !data || /\s/.test(data)) throw Error('Invalid or empty glyph data')
  return data.split('$').map((raw, index) => {
    if (!raw) throw Error('Empty stroke record')
    const fields = raw.split(':')
    const record = { index, raw, fields }
    if (/^0*99$/.test(fields[0])) {
      if (![8, 11].includes(fields.length)) throw Error(`Invalid component field count at record ${index}`)
      for (const i of [1, 2, 3, 4, 5, 6, ...fields.slice(8).map((_, j) => j + 8)]) {
        if (!/^[+-]?\d+$/.test(fields[i])) throw Error(`Invalid component numeric field ${i} at record ${index}`)
      }
      parseReference(fields[7])
      record.component = {
        reference: fields[7],
        placement: { x1: fields[3], y1: fields[4], x2: fields[5], y2: fields[6] },
        stretch: { fields1And2: fields.slice(1, 3), fields8Onward: fields.slice(8) },
      }
    }
    return record
  })
}

function limitsWith(overrides) {
  for (const key of Object.keys(overrides)) if (!Object.hasOwn(DEFAULT_LIMITS, key)) throw Error(`Unknown limit: ${key}`)
  const limits = { ...DEFAULT_LIMITS, ...overrides }
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < (key === 'maxDepth' ? 0 : 1)) throw Error(`Invalid limit: ${key}`)
  }
  // Keep traversal below the JavaScript call stack limit, even with explicit overrides.
  if (limits.maxDepth > 256) throw Error('maxDepth cannot exceed 256')
  return limits
}

async function* lines(path, limits, budget, result) {
  const file = await stat(path)
  if (!file.isFile()) throw Error('Input must be a regular local file')
  if (file.size > limits.maxInputBytes) throw Error('maxInputBytes exceeded')
  const hash = createHash('sha256')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let pending = Buffer.alloc(0), size = 0, line = 0
  for await (const chunk of createReadStream(path, { highWaterMark: 64 * 1024 })) {
    size += chunk.length
    budget.bytes += chunk.length
    if (size > limits.maxInputBytes) throw Error('maxInputBytes exceeded')
    if (budget.bytes > limits.maxScanBytes) throw Error('maxScanBytes exceeded')
    hash.update(chunk)
    const bytes = pending.length ? Buffer.concat([pending, chunk]) : chunk
    let start = 0, end
    while ((end = bytes.indexOf(10, start)) !== -1) {
      if (end - start > limits.maxLineBytes) throw Error('maxLineBytes exceeded')
      yield { text: decoder.decode(bytes.subarray(start, end)).replace(/\r$/, ''), line: ++line }
      start = end + 1
    }
    pending = Buffer.from(bytes.subarray(start))
    if (pending.length > limits.maxLineBytes) throw Error('maxLineBytes exceeded')
  }
  if (pending.length) yield { text: decoder.decode(pending).replace(/\r$/, ''), line: ++line }
  result.bytes = size
  result.sha256 = hash.digest('hex')
}

function dumpRow(text) {
  const trimmed = text.trim()
  if (!trimmed || /^name\s*\|\s*related\s*\|\s*data$/.test(trimmed) || /^[-+]+$/.test(trimmed) || /^\(\d+ rows?\)$/.test(trimmed)) return null
  const fields = text.split('|')
  if (fields.length !== 3) throw Error('Expected name | related | data dump row')
  const [reference, related, data] = fields.map(field => field.trim())
  const { name, revision } = parseReference(reference)
  return { keys: [reference], name, revision, related, data }
}

function isUtcTimestamp(value) {
  if (typeof value !== 'string') return false
  const match = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,3}))?Z$/.exec(value)
  if (!match) return false
  const time = Date.parse(value)
  const canonical = `${match[1]}.${(match[2] ?? '').padEnd(3, '0')}Z`
  return Number.isFinite(time) && new Date(time).toISOString() === canonical
}

function apiRow(text) {
  if (!text.trim()) return null
  const capture = JSON.parse(text)
  const { name, revision } = parseReference(capture.requested)
  const expected = new URL('https://glyphwiki.org/json')
  expected.searchParams.set('name', capture.requested)
  if (capture.url !== expected.href || !isUtcTimestamp(capture.retrievedAt)) {
    throw Error('Invalid API capture URL or UTC retrieval time')
  }
  if (typeof capture.body !== 'string') throw Error('API capture requires the raw JSON response body')
  const response = JSON.parse(capture.body)
  const version = String(response.version)
  if (response.name !== name || !['string', 'number'].includes(typeof response.version) || !/^[1-9][0-9]*$/.test(version) || (typeof response.version === 'number' && !Number.isSafeInteger(response.version)) || (revision !== null && revision !== version)) {
    throw Error(`API name/revision mismatch: ${capture.requested}`)
  }
  if (typeof response.related !== 'string' || typeof response.data !== 'string') throw Error('Invalid API glyph response')
  return {
    keys: [...new Set([capture.requested, `${name}@${version}`])], name, revision: version,
    related: response.related, data: response.data,
    capture: { url: capture.url, retrievedAt: capture.retrievedAt, responseSha256: sha256(capture.body) },
  }
}

function validateGraph(roots, nodes, maxDepth) {
  const active = new Set(), heights = new Map()
  function visit(id, depth) {
    if (active.has(id)) throw Error(`Component cycle: ${[...active, id].join(' -> ')}`)
    if (depth > maxDepth) throw Error(`maxDepth exceeded at ${id}`)
    if (heights.has(id)) {
      if (depth + heights.get(id) > maxDepth) throw Error(`maxDepth exceeded through ${id}`)
      return heights.get(id)
    }
    active.add(id)
    let height = 0
    for (const record of nodes.get(id).records) {
      if (record.component) height = Math.max(height, 1 + visit(record.component.reference, depth + 1))
    }
    active.delete(id)
    heights.set(id, height)
    return height
  }
  for (const root of roots) visit(root, 0)
}

/** Reopens a local UTF-8 file for each dependency frontier; never accesses the network. */
export async function extractGlyphWiki({ path, roots, sourceUrl, sourceDate, format = 'dump', limits: overrides = {} }) {
  const limits = limitsWith(overrides)
  if (!['dump', 'api-jsonl'].includes(format)) throw Error(`Unknown input format: ${format}`)
  if (!Array.isArray(roots) || !roots.length) throw Error('At least one root is required')
  roots = [...new Set(roots)].sort()
  roots.forEach(parseReference)
  if (roots.length > limits.maxGlyphs) throw Error('maxGlyphs exceeded')
  if (!['https:', 'http:'].includes(new URL(sourceUrl).protocol)) throw Error('sourceUrl must be an HTTP(S) provenance URL')
  if (typeof sourceDate !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(sourceDate) || !Number.isFinite(Date.parse(sourceDate)) || new Date(sourceDate).toISOString().slice(0, 10) !== sourceDate) throw Error('sourceDate must be YYYY-MM-DD')
  const nodes = new Map(), requested = new Set(roots), budget = { bytes: 0 }
  let pending = roots, depth = 0, input, passes = 0, dataBytes = 0, recordsCount = 0
  while (pending.length) {
    if (depth > limits.maxDepth) throw Error('maxDepth exceeded')
    const wanted = new Set(pending), found = new Map(), current = {}
    for await (const { text, line } of lines(path, limits, budget, current)) {
      let row
      try { row = format === 'dump' ? dumpRow(text) : apiRow(text) }
      catch (error) { throw Error(`Input line ${line}: ${error.message}`) }
      if (!row) continue
      for (const id of row.keys.filter(key => wanted.has(key))) {
        if (found.has(id)) throw Error(`Duplicate input record: ${id}`)
        dataBytes += Buffer.byteLength(row.data)
        if (dataBytes > limits.maxDataBytes) throw Error('maxDataBytes exceeded')
        const records = parseGlyphData(row.data)
        recordsCount += records.length
        if (recordsCount > limits.maxRecords) throw Error('maxRecords exceeded')
        found.set(id, {
          id, name: row.name, revision: row.revision,
          revisionEvidence: row.capture ? 'api-response' : row.revision ? 'dump-name-suffix' : 'unavailable',
          related: row.related, data: row.data, dataSha256: sha256(row.data), records,
          source: { url: `https://glyphwiki.org/wiki/${encodeURIComponent(row.name + (row.revision ? `@${row.revision}` : ''))}`,
            inputLine: line, ...(row.capture ? { capture: row.capture } : {}) },
        })
      }
    }
    passes++
    if (input && (current.sha256 !== input.sha256 || current.bytes !== input.bytes)) throw Error('Input changed between scans')
    input = current
    const missing = pending.filter(id => !found.has(id))
    if (missing.length) throw Error(`Missing glyph/revision: ${missing.join(', ')}; exact references are required`)
    for (const id of pending) nodes.set(id, found.get(id))
    const next = new Set()
    for (const id of pending) {
      for (const record of nodes.get(id).records) {
        const ref = record.component?.reference
        if (!ref || requested.has(ref)) continue
        requested.add(ref)
        if (requested.size > limits.maxGlyphs) throw Error('maxGlyphs exceeded')
        next.add(ref)
      }
    }
    pending = [...next].sort()
    depth++
  }
  validateGraph(roots, nodes, limits.maxDepth)
  const orderedNodes = [...nodes.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const edges = orderedNodes.flatMap(node => node.records.filter(record => record.component).map(record => ({
    from: node.id, to: record.component.reference, recordIndex: record.index,
    resolution: parseReference(record.component.reference).revision === null ? 'snapshot-unversioned' : 'explicit-revision',
  })))
  const artifact = {
    format: 'glyphwiki-components', version: 1, roots,
    provenance: {
      sourceUrl, sourceDate, input: { format, ...input }, license: { ...LICENSE }, sources: SOURCES.map(source => ({ ...source })),
      limitations: [
        'Unversioned references resolve within this input snapshot; they do not establish historical dependency revisions.',
        'Bare dump names carry no revision number. Explicit @revision requests never fall back to bare names or another revision.',
        'Related Unicode values are source metadata, not assertions of identical glyph shape.',
        'Coordinates and stretch fields are uninterpreted source strings; no outlines, stroke expansion, or rendering is supplied.',
        'Provenance URLs, dates and API capture metadata are supplied by the input owner; hashes establish byte identity, not authenticity.',
      ],
    },
    limits, statistics: { passes, scannedBytes: budget.bytes, dataBytes, records: recordsCount },
    nodes: orderedNodes, edges,
  }
  serializeGlyphWiki(artifact)
  return artifact
}

export function serializeGlyphWiki(artifact) {
  const json = `${JSON.stringify(artifact, null, 2)}\n`
  if (Buffer.byteLength(json) > artifact.limits.maxOutputBytes) throw Error('maxOutputBytes exceeded')
  return json
}
