import { expect, it } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

it('keeps empty references unscorable and exposes reference ambiguity in the gallery', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'glyph-audit-report-'))
  try {
    const row = { id: 'sample', char: '木', sequence: '⿻木木', flags: [{ code: 'tiny-part' }],
      attributions: [], raster: { iou: null }, confidence: { demoRouting: 'unverified', routes: [], regions: [], ambiguousCharacter: true } }
    await writeFile(join(directory, 'report.json'), JSON.stringify({ style: 'sans', rows: [row], catalogue: { records: 1, candidates: 1 }, complete: true, sources: [] }))
    await writeFile(join(directory, 'sample.json'), JSON.stringify({ ...row, drawn: { d: 'M0 0H10V10Z' } }))
    execFileSync(process.execPath, ['scripts/render_glyph_audit.mjs', directory])
    const html = await readFile(join(directory, 'index.html'), 'utf8')
    expect(html).toContain('Overlap: unavailable')
    expect(html).not.toContain('Overlap: 0%')
    expect(html).toContain('This sequence names multiple characters')
  } finally { await rm(directory, { recursive: true }) }
})

it('rejects Serif evidence before launching a browser with the default Sans face', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'glyph-audit-report-'))
  try {
    await writeFile(join(directory, 'report.json'), JSON.stringify({ style: 'serif' }))
    const result = spawnSync(process.execPath, ['scripts/check_glyph_audit_preview.mjs', directory, 'https://example.invalid'], { encoding: 'utf8' })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('supports Sans reports only')
  } finally { await rm(directory, { recursive: true }) }
})
