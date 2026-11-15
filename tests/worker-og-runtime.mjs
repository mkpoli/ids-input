// Run after build:site: node tests/worker-og-runtime.mjs
// Exercises the actual bundled Worker and WASM without a listening development server.
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { fromSequence, shareDocument } from '../src/document/index.js'
import { CARD_VERSION } from '../worker/card-version.js'

if (process.versions.bun) throw new Error('Run this workerd test with node; Bun does not support its Undici dispatcher')

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const directory = resolve(dist, '../dist-worker')
const modules = await Promise.all((await readdir(directory)).filter(name => /\.(js|wasm)$/.test(name)).sort((a, b) => (a === 'index.js' ? -1 : b === 'index.js' ? 1 : a.localeCompare(b))).map(async name => ({
  type: name.endsWith('.wasm') ? 'CompiledWasm' : 'ESModule',
  path: resolve(directory, name),
  contents: await readFile(resolve(directory, name)),
})))
/** The Worker over the built site, which answers 404 for the path `withheld`. @param {string | null} [withheld] */
const runtimeOver = (withheld = null) => new Miniflare(convertV4MiniflareOptions({ workers: [{
  name: 'og', modules, modulesRoot: directory, compatibilityDate: '2026-10-30',
  serviceBindings: { ASSETS: async request => {
    const path = decodeURIComponent(new URL(request.url).pathname)
    const file = resolve(dist, '.' + (path === '/' ? '/index.html' : path))
    if (!file.startsWith(dist) || path === withheld) return new Response(null, { status: 404 })
    try {
      return new Response(await readFile(file), { headers: { 'content-type': ({
        '.html': 'text/html', '.svg': 'image/svg+xml', '.js': 'application/javascript',
      })[extname(file)] ?? 'application/octet-stream' } })
    } catch { return new Response(null, { status: 404 }) }
  } },
}] }))
const runtime = runtimeOver()
try {
  const page = await runtime.dispatchFetch('https://ids.mkpo.li/%E2%BF%B0%E9%87%92%E5%93%A5')
  assert.equal(page.status, 200)
  assert.equal(page.headers.get('x-robots-tag'), null)
  const html = await page.text()
  assert.match(html, /og:url" content="https:\/\/ids.mkpo.li\/%E2%BF%B0%E9%87%92%E5%93%A5"/)
  assert.ok(html.includes(`og:image" content="https://ids.mkpo.li/og/%E2%BF%B0%E9%87%92%E5%93%A5.png?v=${CARD_VERSION}"`))
  const query = await runtime.dispatchFetch('https://branch-ids-input-workshop.mkpoli.workers.dev/?ids=a%2Fb')
  assert.equal(query.status, 200)
  assert.equal(query.headers.get('x-robots-tag'), 'noindex')
  assert.match(await query.text(), /https:\/\/ids.mkpo.li\/\?ids=a%2Fb/)
  const head = await runtime.dispatchFetch('https://ids.mkpo.li/木', { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
  const icon = await runtime.dispatchFetch('https://ids.mkpo.li/favicon.svg')
  assert.equal(icon.headers.get('content-type'), 'image/svg+xml')
  for (const [path, status] of [['/' + '木'.repeat(201), 414], ['/bad%ZZ', 400], ['/?ids=%0A', 400]]) {
    const answer = await runtime.dispatchFetch('https://ids.mkpo.li' + path)
    assert.equal(answer.status, status)
    assert.equal(answer.headers.get('cache-control'), 'no-store')
  }
  const image = await runtime.dispatchFetch('https://ids.mkpo.li/og/%E2%BF%B0%E9%87%92%E5%93%A5.png')
  assert.equal(image.status, 200, await (image.status === 200 ? Promise.resolve('') : image.text()))
  assert.equal(image.headers.get('content-type'), 'image/png')
  const png = Buffer.from(await image.arrayBuffer())
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(png.readUInt32BE(16), 1200)
  assert.equal(png.readUInt32BE(20), 630)

  const document = fromSequence('⿰木口')
  document.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 200, 0] }]
  document.title = 'Moved 木'
  const token = shareDocument(document)
  assert.ok(token, 'the document carries a share token')
  const docPage = await runtime.dispatchFetch(`https://ids.mkpo.li/%E2%BF%B0%E6%9C%A8%E5%8F%A3?doc=${token}`)
  assert.equal(docPage.status, 200)
  const docHtml = await docPage.text()
  assert.match(docHtml, /<title>Moved 木 — IDS Workshop<\/title>/)
  assert.ok(docHtml.includes(`og:url" content="https://ids.mkpo.li/%E2%BF%B0%E6%9C%A8%E5%8F%A3?doc=${token}"`))
  assert.ok(docHtml.includes(`og:image" content="https://ids.mkpo.li/og/%E2%BF%B0%E6%9C%A8%E5%8F%A3.png?v=${CARD_VERSION}&amp;doc=${token}"`))
  const plainImage = await runtime.dispatchFetch('https://ids.mkpo.li/og/%E2%BF%B0%E6%9C%A8%E5%8F%A3.png')
  assert.equal(plainImage.status, 200)
  assert.equal(plainImage.headers.get('x-og-card'), 'sequence')
  const plainPng = Buffer.from(await plainImage.arrayBuffer())
  const docImage = await runtime.dispatchFetch(`https://ids.mkpo.li/og/%E2%BF%B0%E6%9C%A8%E5%8F%A3.png?doc=${token}`)
  assert.equal(docImage.status, 200)
  assert.equal(docImage.headers.get('x-og-card'), 'document')
  const docPng = Buffer.from(await docImage.arrayBuffer())
  assert.equal(docPng.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(docPng.readUInt32BE(16), 1200)
  assert.equal(docPng.readUInt32BE(20), 630)
  assert.notEqual(Buffer.compare(docPng, plainPng), 0, 'the document card is not the sequence card')
  const flat = fromSequence('⿰木口')
  flat.title = 'Moved 木'
  const flatImage = await runtime.dispatchFetch(`https://ids.mkpo.li/og/%E2%BF%B0%E6%9C%A8%E5%8F%A3.png?doc=${shareDocument(flat)}`)
  assert.equal(flatImage.status, 200)
  assert.equal(flatImage.headers.get('x-og-card'), 'document')
  assert.notEqual(Buffer.compare(docPng, Buffer.from(await flatImage.arrayBuffer())), 0, 'the layer transform changes the document card')

  // A numbered component draws with its Sans cut, so a deployment without the cuts draws another card.
  const numbered = `https://ids.mkpo.li/og/${encodeURIComponent('⿰\u{F2A9}口')}.png`
  const cutImage = await runtime.dispatchFetch(numbered)
  assert.equal(cutImage.status, 200)
  const cutPng = Buffer.from(await cutImage.arrayBuffer())
  const bare = runtimeOver('/og/data/numbered-sans-outlines.json.gz')
  try {
    const bareImage = await bare.dispatchFetch(numbered)
    assert.equal(bareImage.status, 200)
    assert.notEqual(Buffer.compare(cutPng, Buffer.from(await bareImage.arrayBuffer())), 0, 'a numbered component is drawn with its Sans cut')
  } finally { await bare.dispose() }

  // A component form fills a leaf that the bundled-only source would draw as one part; the card
  // must still find a scoped document rather than fall back to the sequence.
  const filledSequence = '⿰⿱文厂⿱文厂'
  const filled = fromSequence(filledSequence)
  filled.root.children[0].transform = [{ type: 'affine', matrix: [1, 0, 0, 1, 200, 0] }]
  filled.title = 'Filled form'
  const filledToken = shareDocument(filled)
  const filledImage = await runtime.dispatchFetch(`https://ids.mkpo.li/og/${encodeURIComponent(filledSequence)}.png?doc=${filledToken}`)
  assert.equal(filledImage.status, 200)
  assert.equal(filledImage.headers.get('x-og-card'), 'document')
  console.log(`Worker runtime passed; resvg PNG ${png.length} bytes, document cards ${docPng.length} and ${Buffer.from(await filledImage.arrayBuffer()).length} bytes, 1200 × 630`)
} finally { await runtime.dispose() }
