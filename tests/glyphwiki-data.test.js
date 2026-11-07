import { expect, it } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_LIMITS, extractGlyphWiki, parseGlyphData, parseReference, serializeGlyphWiki, sha256 } from '../scripts/lib/glyphwiki-data.mjs'

const source = { sourceUrl: 'https://glyphwiki.org/dump.tar.gz', sourceDate: '2026-11-07' }
const fixture = new URL('./fixtures/glyphwiki-target.api.jsonl', import.meta.url)
const stroke = '1:0:0:19:55:183:55'
const component = name => `99:0:0:0:0:200:200:${name}`
const row = (name, data = stroke) => ` ${name} | u3013 | ${data}\n`

async function withDump(text, run) {
  const directory = await mkdtemp(join(tmpdir(), 'glyphwiki-data-'))
  const path = join(directory, 'dump.txt')
  try { await writeFile(path, text); return await run(path, directory) }
  finally { await rm(directory, { recursive: true }) }
}
const extract = (path, options = {}) => extractGlyphWiki({ path, roots: ['root'], ...source, ...options })

it('freezes the real target v9 closure without historical dependency claims', async () => {
  const options = { roots: ['twedu-a00836-011@9'], format: 'api-jsonl', sourceUrl: 'https://glyphwiki.org/json?name=twedu-a00836-011%409' }
  const artifact = await extract(fixture, options)
  expect(artifact.nodes.map(node => [node.id, node.revision])).toEqual([
    ['twedu-a00836-011@9', '9'], ['u20120-t', '2'], ['u4e04-07', '1'],
    ['u4e37-jr', '2'], ['u4e5b-k', '1'], ['u53e3-t01', '7'], ['u540b-t04', '2'],
  ])
  expect(artifact.edges).toHaveLength(6)
  expect(artifact.edges.every(edge => edge.resolution === 'snapshot-unversioned')).toBe(true)
  const target = artifact.nodes[0]
  expect(target.related).toBe('U+2D260')
  expect(target.data).toBe('99:0:0:14:19:185:60:u20120-t$99:0:0:-6:34:209:272:u4e5b-k$99:0:0:6:3:194:129:u4e04-07$99:0:0:0:46:199:152:u4e37-jr$99:0:0:0:-36:200:204:u540b-t04')
  expect(target.records[1].component.placement).toEqual({ x1: '-6', y1: '34', x2: '209', y2: '272' })
  expect(target.records[4].component.placement.y1).toBe('-36')
  expect(artifact.statistics.passes).toBe(3)
  expect(artifact.provenance.input.sha256).toBe(sha256(await readFile(fixture)))
  for (const node of artifact.nodes) {
    expect(node.records.map(record => record.raw).join('$')).toBe(node.data)
    expect(node.dataSha256).toBe(sha256(node.data))
    expect(node.source.capture.responseSha256).toMatch(/^[0-9a-f]{64}$/)
  }
  expect(artifact.provenance.license.terms).toContain('複製、改変')
  expect(artifact.provenance.limitations.join(' ')).toContain('identical glyph shape')
  expect(serializeGlyphWiki(await extract(fixture, options))).toBe(serializeGlyphWiki(artifact))
  expect(serializeGlyphWiki(artifact)).toBe(await readFile(new URL('./fixtures/glyphwiki-target.components.json', import.meta.url), 'utf8'))
})

it('preserves numeric spelling, stretch tails, opaque strokes, and repeated placements', async () => {
  const data = '99:+010:-0:-6:034:209:272:child@2:0:050:-20$88:custom:opaque$99:0:0:0:0:200:200:child@2'
  const records = parseGlyphData(data)
  expect(records[0].component.stretch).toEqual({ fields1And2: ['+010', '-0'], fields8Onward: ['0', '050', '-20'] })
  expect(records[1]).toEqual({ index: 1, raw: '88:custom:opaque', fields: ['88', 'custom', 'opaque'] })
  expect(records.map(record => record.fields.join(':')).join('$')).toBe(data)
  await withDump(row('child@2') + row('root', data), async path => {
    const artifact = await extract(path)
    expect(artifact.nodes).toHaveLength(2)
    expect(artifact.edges.map(edge => edge.recordIndex)).toEqual([0, 2])
    expect(artifact.edges.every(edge => edge.resolution === 'explicit-revision')).toBe(true)
  })
})

it('streams table headers, CRLF, trailers and a final unterminated row', async () => {
  const text = ` name | related | data\r\n------+---------+--------\r\n${row('leaf')}${row('root', component('leaf'))}(2 rows)`
  await withDump(text, async path => {
    const artifact = await extract(path)
    expect(artifact.provenance.input.bytes).toBe(Buffer.byteLength(text))
    expect(artifact.statistics.scannedBytes).toBe(Buffer.byteLength(text) * 2)
    expect(artifact.nodes[0].revision).toBeNull()
    expect(artifact.nodes[0].revisionEvidence).toBe('unavailable')
  })
})

it('is deterministic across root order and duplicate root arguments', async () => {
  await withDump(row('root') + row('other'), async path => {
    const first = await extract(path, { roots: ['other', 'root', 'other'] })
    const second = await extract(path, { roots: ['root', 'other'] })
    expect(serializeGlyphWiki(first)).toBe(serializeGlyphWiki(second))
  })
})

it('never substitutes a latest row or highest historical revision', async () => {
  await withDump(row('root', component('child@2')) + row('child') + row('child@3'), async path => {
    await expect(extract(path)).rejects.toThrow('Missing glyph/revision: child@2')
  })
  await withDump(row('root', component('child')) + row('child@2') + row('child@3'), async path => {
    await expect(extract(path)).rejects.toThrow('Missing glyph/revision: child;')
  })
  await withDump(row('root'), async path => {
    await expect(extract(path, { roots: ['root@9'] })).rejects.toThrow('Missing glyph/revision: root@9')
  })
})

it('rejects missing dependencies, duplicate selected rows and cycles', async () => {
  for (const [text, error] of [
    [row('root', component('absent')), 'Missing glyph/revision'],
    [row('root') + row('root'), 'Duplicate input record'],
    [row('root', component('root')), 'Component cycle'],
    [row('root', component('child')) + row('child', component('root')), 'Component cycle'],
  ]) await withDump(text, path => expect(extract(path)).rejects.toThrow(error))
})

it('limits longest dependency paths through shared nodes, with roots at depth zero', async () => {
  const text = row('root', `${component('a')}$${component('z')}`) + row('a', component('leaf')) + row('z', component('a')) + row('leaf')
  await withDump(text, async path => {
    await expect(extract(path, { limits: { maxDepth: 2 } })).rejects.toThrow('maxDepth exceeded')
    expect((await extract(path, { limits: { maxDepth: 3 } })).nodes).toHaveLength(4)
  })
  await withDump(row('root'), async path => {
    expect((await extract(path, { limits: { maxDepth: 0 } })).nodes).toHaveLength(1)
  })
})

it('enforces every byte, graph, record and scan budget', async () => {
  const text = row('root', component('child')) + row('child')
  await withDump(text, async path => {
    for (const [key, value] of Object.entries({
      maxInputBytes: Buffer.byteLength(text) - 1, maxScanBytes: Buffer.byteLength(text),
      maxLineBytes: 8, maxGlyphs: 1, maxDepth: 0, maxRecords: 1, maxDataBytes: 1, maxOutputBytes: 1,
    })) await expect(extract(path, { limits: { [key]: value } })).rejects.toThrow(key)
    for (const key of Object.keys(DEFAULT_LIMITS)) {
      await expect(extract(path, { limits: { [key]: -1 } })).rejects.toThrow('Invalid limit')
    }
    await expect(extract(path, { limits: { maxDepth: 257 } })).rejects.toThrow('maxDepth cannot exceed')
    await expect(extract(path, { limits: { surprise: 1 } })).rejects.toThrow('Unknown limit')
  })
})

it('bounds lines across stream chunks and rejects invalid UTF-8', async () => {
  await withDump('a'.repeat(131072), path => expect(extract(path)).rejects.toThrow('maxLineBytes exceeded'))
  await withDump(Buffer.from([0xff, 10]), path => expect(extract(path)).rejects.toThrow())
})

it('rejects malformed refs, components, tables and unsupported input formats', async () => {
  for (const name of ['../root', 'root@0', 'root@-1', 'root@1@2', 'Root', 'root@01']) expect(() => parseReference(name)).toThrow('Invalid glyph reference')
  for (const data of ['', `${stroke}$`, '99:0:0:0:0:200:200:', '99:NaN:0:0:0:200:200:child', `${component('child')}:0`, '99:0:0:0:0:200:200:child:0:0:']) expect(() => parseGlyphData(data)).toThrow()
  await withDump('broken row\n', path => expect(extract(path)).rejects.toThrow('Input line 1'))
  await withDump(row('root'), async (path, directory) => {
    await expect(extract(path, { format: 'tar.gz' })).rejects.toThrow('Unknown input format')
    await expect(extract(path, { sourceDate: '2026-02-31' })).rejects.toThrow('sourceDate')
    await expect(extract(path, { sourceUrl: 'file:///tmp/source' })).rejects.toThrow('sourceUrl')
    await expect(extract(directory)).rejects.toThrow('regular local file')
    await expect(extract(path, { limits: { toString: 1 } })).rejects.toThrow('Unknown limit')
  })
})

it('checks captured API revisions and accepts a numeric revision or a string', async () => {
  const captured = JSON.parse((await readFile(fixture, 'utf8')).split('\n')[1])
  await withDump(JSON.stringify(captured), async path => {
    expect((await extract(path, { roots: ['u20120-t@2'], format: 'api-jsonl' })).nodes[0].revision).toBe('2')
  })
  for (const changed of [
    { ...captured, requested: 'u20120-t@9', url: 'https://glyphwiki.org/json?name=u20120-t%409' },
    { ...captured, url: 'https://example.invalid/' },
    { ...captured, body: '{}' },
    { ...captured, body: JSON.stringify({ ...JSON.parse(captured.body), version: [2] }) },
    { ...captured, retrievedAt: 'unknown' },
  ]) await withDump(JSON.stringify(changed), path => expect(extract(path, { roots: ['u20120-t'], format: 'api-jsonl' })).rejects.toThrow('Input line 1'))
})

it('validates UTC capture timestamps without calendar or time normalization', async () => {
  const captured = JSON.parse((await readFile(fixture, 'utf8')).split('\n')[1])
  const options = { roots: ['u20120-t'], format: 'api-jsonl' }
  for (const retrievedAt of [
    '2026-02-31T00:00:00Z', '2026-02-29T00:00:00Z', '2026-04-31T00:00:00Z',
    '2026-00-01T00:00:00Z', '2026-13-01T00:00:00Z', '2026-01-00T00:00:00Z',
    '2026-11-07T24:00:00Z', '2026-11-07T25:00:00Z', '2026-11-07T00:60:00Z',
    '2026-11-07T00:00:60Z', '2026-11-07T00:00Z', '2026-11-07T00:00:00z',
    '2026-11-07T00:00:00+00:00', '2026-11-07 00:00:00Z',
    '2026-11-07T00:00:00.Z', '2026-11-07T00:00:00.1234Z',
  ]) await withDump(JSON.stringify({ ...captured, retrievedAt }), path => expect(extract(path, options)).rejects.toThrow('UTC retrieval time'))
  for (const retrievedAt of [
    '2024-02-29T23:59:59Z', '2026-11-07T00:00:00Z', '2026-11-07T00:00:00.0Z',
    '2026-11-07T00:00:00.1Z', '2026-11-07T00:00:00.12Z', '2026-11-07T00:00:00.123Z',
  ]) await withDump(JSON.stringify({ ...captured, retrievedAt }), async path => {
    expect((await extract(path, options)).nodes[0].source.capture.retrievedAt).toBe(retrievedAt)
  })
})

it('writes a standalone artifact via CLI and leaves existing outputs untouched', async () => {
  await withDump(row('root'), async (path, directory) => {
    const out = join(directory, 'components.json')
    const args = [process.execPath, 'scripts/import_glyphwiki_components.mjs', '--input', path, '--glyph', 'root', '--source-url', source.sourceUrl, '--source-date', source.sourceDate, '--out', out]
    const first = Bun.spawnSync(args)
    expect(first.exitCode).toBe(0)
    const saved = await readFile(out, 'utf8')
    expect(JSON.parse(saved).roots).toEqual(['root'])
    const second = Bun.spawnSync(args)
    expect(second.exitCode).toBe(1)
    expect(await readFile(out, 'utf8')).toBe(saved)
    expect(Bun.spawnSync([...args, '--unknown']).exitCode).toBe(1)
    expect(Bun.spawnSync([...args, '--max-depth', 'Infinity']).exitCode).toBe(1)
  })
})

it('creates no output when dependency closure fails', async () => {
  await withDump(row('root', component('absent')), async (path, directory) => {
    const out = join(directory, 'missing.json')
    const result = Bun.spawnSync([process.execPath, 'scripts/import_glyphwiki_components.mjs', '--input', path, '--glyph', 'root', '--source-url', source.sourceUrl, '--source-date', source.sourceDate, '--out', out])
    expect(result.exitCode).toBe(1)
    await expect(readFile(out)).rejects.toThrow('ENOENT')
  })
})
