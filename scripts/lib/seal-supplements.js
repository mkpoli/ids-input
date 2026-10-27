// Curated provider crosswalks stay separate from the source-backed IDS table.
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'

const digest = bytes => createHash('sha256').update(bytes).digest('hex')
export async function loadSealSupplements(doc) {
  const base = new URL('../data/small-seal/', import.meta.url)
  const raw = await readFile(new URL('supplements.json', base))
  const manifest = JSON.parse(raw)
  if (manifest.format !== 1) throw new Error('Unsupported seal supplement format')
  const unicode = await readFile(new URL('../../data/seal-sources.txt.gz', import.meta.url))
  const chise = await readFile(new URL('../../data/small-seal-sources.tar.gz', import.meta.url))
  const lines = gunzipSync(unicode).toString().split('\n')
  const modern = {...doc.modern}, parts = [...doc.parts], sources = [...(doc.paletteSources ?? [])]
  const glyphs = new Map()
  const inputs = {'scripts/data/small-seal/supplements.json': digest(raw)}
  for (const entry of manifest.entries) {
    if (!/^[\u{3D000}-\u{3FC3F}]$/u.test(entry.char) || !/^u[0-9A-F]+\.svg$/.test(entry.glyph)) throw new Error('Invalid seal supplement')
    if (digest(unicode) !== entry.unicodeEvidence.sha256 || digest(chise) !== entry.chiseEvidence.archiveSha256) throw new Error('Seal supplement source checksum mismatch')
    const line = `U+${entry.char.codePointAt(0).toString(16).toUpperCase()}\tkSEAL_MCJK\t${entry.unicodeEvidence.value}`
    if (!lines.includes(line) || !entry.modern.includes(String.fromCodePoint(parseInt(entry.unicodeEvidence.value,16)))) throw new Error('Missing Unicode crosswalk evidence')
    const svg = await readFile(new URL(entry.glyph,base))
    if (digest(svg) !== entry.glyphSha256) throw new Error('Seal supplement glyph checksum mismatch')
    inputs['scripts/data/small-seal/'+entry.glyph] = digest(svg)
    inputs['data/seal-sources.txt.gz'] = digest(unicode)
    inputs['data/small-seal-sources.tar.gz'] = digest(chise)
    modern[entry.char] = [...new Set([...(modern[entry.char] ?? []),...entry.modern])]
    if (!parts.some(p=>p.part===entry.char)) parts.push({part:entry.char,kind:'seal',uses:0,strokes:null,first:null})
    sources.push(entry)
    glyphs.set(entry.char,{file:entry.glyph,bytes:svg})
  }
  return {doc:{...doc,modern,parts,paletteSources:sources},glyphs,inputs}
}
