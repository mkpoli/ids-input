// Render review images with the card's fonts and prepared workshop drawings.
// OG_REVIEW_SCALE=2 writes the high-resolution review set to shots/og-redesign/2x/.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { Resvg } from '@cf-wasm/resvg/node'
import { cardSvg } from '../worker/card.js'
import { facesFor } from '../worker/fonts.js'
import examples from '../demo/lib/example-drawings.json'
import { compose } from '../src/composer/loader.js'
import { sourceFor } from '../src/composer/source.js'
import { COMPOSER_BASE } from '../demo/lib/composer.js'

const root = new URL('../', import.meta.url)
const scale = Number(process.env.OG_REVIEW_SCALE ?? 1)
if (![1, 2].includes(scale)) throw new Error('OG_REVIEW_SCALE must be 1 or 2')
const env = { ASSETS: { async fetch(url) {
  try { return new Response(await readFile(new URL(`dist${new URL(url).pathname}`, root))) }
  catch { return new Response('', { status: 404 }) }
} } }
const out = new URL(`shots/og-redesign/${scale === 2 ? '2x/' : ''}`, root)
await mkdir(out, { recursive: true })
const index = JSON.parse(gunzipSync(await readFile(new URL('dist/og/data/ids-index.json.gz', root))).toString())
async function render(name, sequence, drawing = null, char = null, theme = 'light') {
  const { buffers, familyOf } = await facesFor(env, sequence + (char ?? ''))
  const svg = cardSvg({ sequence, drawing, char, familyOf, theme })
  const renderer = await Resvg.async(svg, { fitTo: { mode: 'zoom', value: scale }, font: { fontBuffers: buffers, loadSystemFonts: false, defaultFontFamily: 'Noto Sans CJK JP' } })
  try {
    const image = renderer.render()
    try { await writeFile(new URL(`${encodeURIComponent(name)}.png`, out), image.asPng()) }
    finally { image.free() }
  } finally { renderer.free() }
  console.log(name)
}
const choices = ['⿰釒哥', '⿾正', '⿰木子', '⿺辶⿳穴⿰月⿰⿲⿱幺長⿱言馬⿱幺長刂心', '⿱苦⿲⿰⿹耳舌鼻⿳⿸⿹平惡意眼⿰淨𭰏⿰⿱女子身', Object.keys(examples.drawings).find(key => !examples.drawings[key].char)]
for (const sequence of choices) {
  let drawing = examples.drawings[sequence]?.drawn
  if (!drawing) {
    const source = sourceFor(sequence, { base: COMPOSER_BASE })
    await source.ready()
    drawing = await compose(source, sequence, { separate: false, fontStyle: 'sans' })
  }
  for (const theme of ['light', 'dark']) await render(`${sequence}-${theme}`, sequence, drawing, index[sequence] ?? null, theme)
}
for (const [name, sequence] of [['operators', '⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽⿾⿿〾㇯'], ['long', '⿰'.repeat(80) + '木']]) await render(name, sequence)
