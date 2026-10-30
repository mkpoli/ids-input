// Render local review images with the same card layout, fonts and prepared workshop drawings.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { Resvg } from '@cf-wasm/resvg/node'
import { cardSvg } from '../worker/card.js'
import { facesFor } from '../worker/fonts.js'
import examples from '../demo/lib/example-drawings.json'
import { compose } from '../src/composer/loader.js'
import { sourceFor } from '../src/composer/source.js'
import { COMPOSER_BASE } from '../demo/lib/composer.js'

const root = new URL('../', import.meta.url)
const env = { ASSETS: { async fetch(url) {
  try { return new Response(await readFile(new URL(`dist${new URL(url).pathname}`, root))) }
  catch { return new Response('', { status: 404 }) }
} } }
const out = new URL('shots/og-redesign/', root)
await mkdir(out, { recursive: true })
const choices = ['⿰釒哥', '⿾正', '⿰木子', Object.keys(examples.drawings).find(key => !examples.drawings[key].char)]
for (const sequence of choices) {
  let example = examples.drawings[sequence]
  if (!example) {
    const source = sourceFor(sequence, { base: COMPOSER_BASE })
    await source.ready()
    example = { drawn: await compose(source, sequence, { separate: false, fontStyle: 'sans' }), char: sequence === '⿰釒哥' ? '鎶' : '杍' }
  }
  for (const theme of ['light', 'dark']) {
    const { buffers, familyOf } = await facesFor(env, sequence + (example.char ?? ''))
    const svg = cardSvg({ sequence, drawing: example.drawn, char: example.char, familyOf, theme })
    const render = await Resvg.async(svg, { font: { fontBuffers: buffers, loadSystemFonts: false, defaultFontFamily: 'Noto Sans CJK JP' } })
    await writeFile(new URL(`${encodeURIComponent(sequence)}-${theme}.png`, out), render.render().asPng())
    render.free()
    console.log(sequence, theme)
  }
}
for (const [name, sequence] of [['operators', '⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽⿾⿿〾㇯'], ['long', '⿰'.repeat(80) + '木']]) {
  const { buffers, familyOf } = await facesFor(env, sequence)
  const svg = cardSvg({ sequence, familyOf })
  const render = await Resvg.async(svg, { font: { fontBuffers: buffers, loadSystemFonts: false, defaultFontFamily: 'Noto Sans CJK JP' } })
  await writeFile(new URL(`${name}.png`, out), render.render().asPng())
  render.free()
}
