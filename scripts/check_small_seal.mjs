// Offline provider audit. Writes a standalone gallery and machine-readable evidence.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSealCandidates } from './lib/seal-candidates.js'
import { parseIdsTable, mergeIdsTables } from '../src/adapter/babelstone.js'
import { readForms } from '../src/core/search.js'
import { parse, isNode } from '../src/core/ids.js'
import { roughLayout } from '../src/core/preview.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = process.argv[2]
if (!output) throw new Error('Usage: node scripts/check_small_seal.mjs OUTPUT_DIRECTORY')
const inputs = ['data/small-seal.json.gz', 'data/babelstone-ids.tsv.gz', 'data/yi-bai-ids.tsv.gz', 'data/component-forms.tsv', 'fonts/IDSSeal-Regular.woff2']
const bytes = await Promise.all(inputs.map(p => readFile(join(root,p))))
const hashes = Object.fromEntries(inputs.map((p,i)=>[p,createHash('sha256').update(bytes[i]).digest('hex')]))
const doc = JSON.parse(gunzipSync(bytes[0]))
const table = mergeIdsTables(parseIdsTable(gunzipSync(bytes[1]).toString()),parseIdsTable(gunzipSync(bytes[2]).toString()))
const engine = createSealCandidates(doc, table, readForms(bytes[3].toString()), inputs.slice(1,3).join(' + '))
const esc = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
function diagram(text) {
  const parsed=parse(text, {open:true})
  if(parsed.problem) return '<p>Unsupported IDS</p>'
  return '<svg viewBox="0 0 100 100" role="img" aria-label="Schematic component layout">'+roughLayout(parsed.tree).map(({char,box,flip,cut})=>{
    const [x,y,x1,y1]=box.map(n=>n*100),w=x1-x,h=y1-y
    const glyph=char ? `<text x="50" y="80" font-size="90" text-anchor="middle" class="seal">${esc(char)}</text>` : '<text x="50" y="65" text-anchor="middle" font-size="32">?</text>'
    return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="1" y="1" width="98" height="98" fill="none" stroke="#aaa" stroke-dasharray="2 3"/><g opacity="${cut?.35:1}" transform="translate(${flip[0]?100:0} ${flip[1]?100:0}) scale(${flip[0]?-1:1} ${flip[1]?-1:1})">${glyph}</g></svg>`
  }).join('')+'</svg>'
}
const rows = Object.keys(doc.modern).map(char=> {
  const row=engine.compare(char)
  const complete=row.candidates.filter(c=>!c.unmapped.length && !c.text.includes('⬚'))
  const unique=[...new Set(complete.map(c=>c.text))]
  const matches=unique.filter(text=>row.attested.includes(text))
  const status=row.attested.length ? matches.length ? 'source-match' : unique.length ? 'source-different' : 'source-only' : unique.length ? 'inferred' : row.candidates.length ? 'incomplete' : 'no-candidate'
  const errors=row.candidates.flatMap(c=>{
    const p=parse(c.text, {open:true}),leaves=[]
    const visit=t=>isNode(t)?t.parts.forEach(visit):leaves.push(t)
    visit(p.tree)
    return [p.problem?'invalid IDS':null, leaves.includes(char)?'self-reference':null].filter(Boolean)
  })
  return {...row,status,completeCount:unique.length,matches,errors}
})
const summary={forms:rows.length,candidates:rows.reduce((n,r)=>n+r.candidates.length,0),statuses:Object.fromEntries(['source-match','source-different','source-only','inferred','incomplete','no-candidate'].map(k=>[k,rows.filter(r=>r.status===k).length])),truncated:rows.filter(r=>r.truncated).length,structuralErrors:rows.reduce((n,r)=>n+r.errors.length,0)}
const report={format:1,generator:'cjk-to-seal/1',inputs:hashes,summary,rows}
await mkdir(output,{recursive:true})
await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n')
await copyFile(join(root,'fonts/IDSSeal-Regular.woff2'),join(output,'seal.woff2'))
await copyFile(join(root,'fonts/LICENSE-IDSSeal.txt'),join(output,'LICENSE-IDSSeal.txt'))
const cards=rows.map(r=> {
 const candidates=r.candidates.map((c,i)=>`<details ${i===0?'open':''}><summary>Candidate ${i+1} · ${c.unmapped.length?'incomplete':'fully mapped'}${r.attested.includes(c.text)?' · exact source match':''}</summary><div class="candidate">${diagram(c.text)}<div><p class="ids">${esc(c.text)}</p><p>From ${esc(c.modernChar)} ${esc(c.modernIds)} · ${esc(c.regions)}</p><p>${c.mappings.map(m=>`${esc(m.component)} → <span class="seal">${esc(m.selected??'?')}</span> (${m.via})`).join(' · ')}</p>${c.missingGlyphs.length?'<p>Unavailable component glyphs: '+esc(c.missingGlyphs.join(' '))+'</p>':''}</div></div></details>`).join('')
 return {status:r.status,search:[r.char,...r.modern,'U+'+r.char.codePointAt(0).toString(16).toUpperCase()].join(' '),html:`<article><header><h2>${esc(r.modern.join(' / '))} <small>U+${r.char.codePointAt(0).toString(16).toUpperCase()}</small></h2><span>${r.status}</span></header><div class="reference"><div>${r.glyphAvailable?'<div class="glyph seal">'+esc(r.char)+'</div>':'Reference glyph unavailable'}<p>Chen Changzhi reference</p></div><div><b>Jiguge source IDS</b><p class="ids">${r.attested.map(esc).join('<br>')||'No complete source IDS'}</p><p>${r.completeCount} distinct fully mapped candidates${r.truncated?' · enumeration capped':''}</p></div></div>${candidates||'<p>No inferred decomposition available.</p>'}<details><summary>Original source records</summary><pre>${esc(JSON.stringify(r.records,null,2))}</pre></details></article>`}
})
await writeFile(join(output,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>小篆 · provider data audit</title><style>
@font-face{font-family:Seal;src:url(seal.woff2)}*{box-sizing:border-box}body{margin:0;background:#f6f3ee;color:#252d2a;font:16px/1.5 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:28px}h1{font-size:32px;margin-bottom:8px}small{font-size:13px;color:#66716a}.seal,.ids{font-family:Seal,serif}.ids{font-size:24px;overflow-wrap:anywhere}.glyph{font-size:100px;line-height:1.3}.toolbar{position:sticky;top:0;background:#f6f3ee;padding:12px 0;z-index:1;display:flex;gap:10px;flex-wrap:wrap}input,select,button{font:inherit;padding:8px;border:1px solid #aaa;border-radius:5px;background:white}#gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,480px),1fr));gap:18px}article{background:white;padding:22px;border:1px solid #d7ddd5;border-radius:10px;min-width:0}header{display:flex;align-items:center;justify-content:space-between;gap:8px}h2{margin:0;font-size:24px}header span{font-size:12px;color:#4c6052}.reference,.candidate{display:flex;gap:24px;align-items:center}.reference>div:first-child{min-width:140px;text-align:center}.reference p,.candidate p{margin:8px 0}.candidate>svg{width:130px;height:130px;flex-shrink:0}.candidate>div{min-width:0}details{margin-top:16px;border-top:1px solid #eee;padding-top:10px}summary{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}a{color:#245b47}#count{margin:8px 0}@media(max-width:550px){main{padding:16px}.candidate{gap:10px}.candidate>svg{width:100px;height:100px}}
</style><main><h1>小篆 · provider data audit</h1><p>Reference glyphs beside decompositions inferred from modern CJK mappings. This is an offline dataset audit.</p><p>Schematics show component placement, not reconstructed historical glyphs. Fully mapped does not mean historically verified. Exact matches compare IDS strings with Jiguge records; the displayed font is the Chen Changzhi edition. Missing source IDS is not evidence of correctness.</p><p>${summary.forms} mapped forms · ${summary.candidates} candidates · ${summary.structuralErrors} syntax/self-reference errors. <a href="report.json">Download complete evidence (JSON)</a> · <a href="LICENSE-IDSSeal.txt">Glyph licence</a></p><div class="toolbar"><input id="query" aria-label="Find character or code point" placeholder="祖, 木, U+3D035"><select id="status" aria-label="Audit group"><option value="">All forms</option>${Object.entries(summary.statuses).map(([k,v])=>`<option value="${k}">${k} (${v})</option>`).join('')}</select><button id="prev">Previous</button><button id="next">Next</button></div><p id="count"></p><section id="gallery"></section></main><script>const cards=${JSON.stringify(cards).replace(/</g,'\\u003c')};let page=0;const size=20;const query=document.querySelector('#query'),status=document.querySelector('#status');function render(){const q=query.value.trim().toUpperCase(),filtered=cards.filter(c=>(!status.value||c.status===status.value)&&c.search.toUpperCase().includes(q));page=Math.max(0,Math.min(page,Math.ceil(filtered.length/size)-1));document.querySelector('#gallery').innerHTML=filtered.slice(page*size,(page+1)*size).map(c=>c.html).join('');document.querySelector('#count').textContent=filtered.length+' forms · page '+(page+1)+' / '+Math.max(1,Math.ceil(filtered.length/size));document.querySelector('#prev').disabled=!page;document.querySelector('#next').disabled=(page+1)*size>=filtered.length}query.oninput=status.onchange=()=>{page=0;render()};document.querySelector('#prev').onclick=()=>{page--;render()};document.querySelector('#next').onclick=()=>{page++;render()};render()</script></html>`)
console.log(JSON.stringify(summary,null,2))
if(summary.structuralErrors) process.exitCode=1
