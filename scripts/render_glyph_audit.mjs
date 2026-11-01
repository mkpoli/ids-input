// bun scripts/render_glyph_audit.mjs REPORT_DIR [MAX_CARDS]
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { glyphAuditConfidence } from './lib/glyph-audit-confidence.mjs'

const directory = resolve(process.argv[2] ?? '')
if (!process.argv[2]) throw Error('Usage: bun scripts/render_glyph_audit.mjs REPORT_DIR [MAX_CARDS]')
const limit = process.argv[3] === undefined ? 60 : Number(process.argv[3])
if (!Number.isInteger(limit) || limit < 1) throw Error('MAX_CARDS must be a positive integer')
const report = JSON.parse(await readFile(join(directory, 'report.json'), 'utf8'))
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const priority = row => (row.flags.some(flag => flag.code === 'auto-cells-enclosure') ? 10 : 0) +
  (row.flags.some(flag => flag.code === 'disjoint-root-overlay') ? 5 : 0) +
  (row.flags.some(flag => flag.code === 'nonfinite-geometry') ? 5 : 0) + (1 - (row.raster?.iou ?? 1))
const suspects = report.rows.filter(row => row.flags.length || row.error).sort((a, b) => priority(b) - priority(a))
const picked = suspects.slice(0, limit)
const svg = (drawing, id) => {
  if (!drawing?.d) return '<div class="absent">No drawing</div>'
  const mask = drawing.cut ? `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"><rect width="1000" height="1000" fill="white"/><path d="${escape(drawing.cut)}" fill="black"/></mask></defs>` : ''
  return `<svg viewBox="0 0 1000 1000" aria-label="Glyph drawing">${mask}<path d="${escape(drawing.d)}" fill="currentColor"${mask ? ` mask="url(#${id})"` : ''}/></svg>`
}
const cards = await Promise.all(picked.map(async (row, index) => {
  const data = JSON.parse(await readFile(join(directory, `${row.id}.json`), 'utf8'))
  const code = row.char ? `U+${row.char.codePointAt(0).toString(16).toUpperCase()}` : 'Unencoded example'
  const confidence = row.confidence ?? glyphAuditConfidence(row, { style: report.style })
  return `<article id="case-${row.id}"><h2>${index + 1}. ${escape(row.char)} <small>${code}</small></h2><div class="sequence">${escape(row.sequence)}</div>
<div class="pair"><div><h3>Composed IDS</h3>${svg(data.drawn, `${row.id}-actual`)}</div><div><h3>Native reference</h3>${svg(data.native, `${row.id}-native`)}</div></div>
<p class="flags">${escape(row.flags.map(flag => flag.code).join(' · ') || row.error?.message)}</p>
<p>Overlap: ${Number.isFinite(row.raster?.iou) ? `${Math.round(row.raster.iou * 100)}%` : 'unavailable'} · <a href="${row.id}.json">Case data</a></p>
<p class="flags">Demo routing: ${escape(confidence.demoRouting)}${confidence.routes.length ? ` (${escape(confidence.routes.join(', '))})` : ''}. Dataset regions: ${escape(confidence.regions.join(', ') || 'unspecified')}.${confidence.ambiguousCharacter ? ' This sequence names multiple characters; reference identity is ambiguous.' : ''}</p>
<details><summary>Source attribution</summary><pre>${escape(JSON.stringify(row.attributions, null, 2))}</pre></details></article>`
}))
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Glyph layout audit</title>
<style>:root{color-scheme:light dark;font:15px system-ui;background:light-dark(#fff,#171719);color:light-dark(#202024,#eee)}body{margin:24px}h1{font-size:24px}header{max-width:1100px}a{color:light-dark(#2859a5,#8ab4f8)}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}article{border:1px solid light-dark(#ddd,#444);border-radius:10px;padding:14px;break-inside:avoid}h2{font-size:21px;margin:0 0 6px}small{font-size:13px;font-weight:400}h3{font-size:12px;font-weight:500;margin:8px 0}.sequence{min-height:38px;overflow-wrap:anywhere}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pair svg{width:100%;display:block}.absent{aspect-ratio:1;display:grid;place-items:center;color:gray}.flags{font-size:12px;min-height:30px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}details{font-size:12px}footer{margin-top:24px}@media(max-width:800px){main{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:500px){main{grid-template-columns:1fr}}</style>
<header><h1>Glyph layout audit · ${escape(report.style)}</h1><p>${report.catalogue.records.toLocaleString()} catalogue records; ${report.rows.length.toLocaleString()} / ${report.catalogue.candidates.toLocaleString()} risk candidates rendered. ${suspects.length} flagged cases or render errors. Showing ${picked.length}, ranked by structural flags and native overlap.</p><p>This scan calls the composer directly; the demo can substitute encoded glyphs before composition. Low overlap can reflect regional forms, alternative decompositions or fallback fonts. Box flags measure placement, and overlay checks require traceable operand ownership. Browser screenshots provide separate evidence. ${report.complete ? 'The selected structural-risk scan is complete.' : 'This scan is partial.'}</p><p><a href="report.json">Full machine-readable report</a></p></header><main>${cards.join('\n')}</main>
<footer><details><summary>Dataset sources and thresholds</summary><pre>${escape(JSON.stringify({ sources: report.sources, sourceHashes: report.sourceHashes, export: report.export?.base, thresholds: report.thresholds, scope: report.scope }, null, 2))}</pre></details></footer></html>`
await writeFile(join(directory, 'index.html'), html)
console.log(`Wrote ${picked.length} cards to ${join(directory, 'index.html')}`)
