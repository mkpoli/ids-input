#!/usr/bin/env bun
import { writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { DEFAULT_LIMITS, extractGlyphWiki, serializeGlyphWiki } from './lib/glyphwiki-data.mjs'

const limitFlags = Object.fromEntries(Object.keys(DEFAULT_LIMITS).map(key => [key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), key]))
const help = `Usage: bun scripts/import_glyphwiki_components.mjs \\
  --input dump_newest_only.txt --glyph twedu-a00836-011 \\
  --source-url https://glyphwiki.org/dump.tar.gz --source-date YYYY-MM-DD \\
  --out components.json

Offline UTF-8 input only; unpack archives before use. Output must not exist.
Repeat --glyph for multiple roots; use name@revision for exact revisions.
--format dump (default) or api-jsonl (local API captures).
${Object.entries(limitFlags).map(([flag, key]) => `--${flag} ${DEFAULT_LIMITS[key]}`).join('\n')}
`

try {
  const { values } = parseArgs({ options: {
    input: { type: 'string' }, glyph: { type: 'string', multiple: true },
    'source-url': { type: 'string' }, 'source-date': { type: 'string' },
    out: { type: 'string' }, format: { type: 'string', default: 'dump' },
    help: { type: 'boolean' },
    ...Object.fromEntries(Object.keys(limitFlags).map(flag => [flag, { type: 'string' }])),
  }, strict: true, allowPositionals: false })
  if (values.help) process.stdout.write(help)
  else {
    for (const flag of ['input', 'glyph', 'source-url', 'source-date', 'out']) {
      if (!values[flag]) throw Error(`Missing --${flag}; use --help`)
    }
    const limits = {}
    for (const [flag, key] of Object.entries(limitFlags)) {
      if (values[flag] !== undefined) {
        if (!/^\d+$/.test(values[flag])) throw Error(`--${flag} requires an integer`)
        limits[key] = Number(values[flag])
      }
    }
    const artifact = await extractGlyphWiki({
      path: values.input, roots: values.glyph, sourceUrl: values['source-url'],
      sourceDate: values['source-date'], format: values.format, limits,
    })
    await writeFile(values.out, serializeGlyphWiki(artifact), { flag: 'wx' })
    process.stderr.write(`Extracted ${artifact.nodes.length} glyphs, ${artifact.edges.length} references in ${artifact.statistics.passes} scans.\n`)
  }
} catch (error) {
  process.stderr.write(`GlyphWiki import failed: ${error.message}\n`)
  process.exitCode = 1
}
