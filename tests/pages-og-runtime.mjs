// Run after build:site: node tests/pages-og-runtime.mjs
// Exercises the actual bundled Pages worker and WASM without a listening development server.
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'

if (process.versions.bun) throw new Error('Run this workerd test with node; Bun does not support its Undici dispatcher')

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const directory = resolve(dist, '_worker.js')
const modules = await Promise.all((await readdir(directory)).sort((a, b) => (a === 'index.js' ? -1 : b === 'index.js' ? 1 : a.localeCompare(b))).map(async name => ({
  type: name.endsWith('.wasm') ? 'CompiledWasm' : 'ESModule',
  path: resolve(directory, name),
  contents: await readFile(resolve(directory, name)),
})))
const runtime = new Miniflare(convertV4MiniflareOptions({ workers: [{
  name: 'og', modules, modulesRoot: directory, compatibilityDate: '2026-08-01',
  serviceBindings: { ASSETS: async request => {
    const path = decodeURIComponent(new URL(request.url).pathname)
    const file = resolve(dist, '.' + (path === '/' ? '/index.html' : path))
    if (!file.startsWith(dist)) return new Response(null, { status: 404 })
    try {
      return new Response(await readFile(file), { headers: { 'content-type': ({
        '.html': 'text/html', '.svg': 'image/svg+xml', '.js': 'application/javascript',
      })[extname(file)] ?? 'application/octet-stream' } })
    } catch { return new Response(null, { status: 404 }) }
  } },
}] }))
try {
  const page = await runtime.dispatchFetch('https://ids.mkpo.li/%E2%BF%B0%E9%87%92%E5%93%A5')
  assert.equal(page.status, 200)
  assert.equal(page.headers.get('x-robots-tag'), null)
  const html = await page.text()
  assert.match(html, /og:url" content="https:\/\/ids.mkpo.li\/%E2%BF%B0%E9%87%92%E5%93%A5"/)
  assert.match(html, /og:image" content="https:\/\/ids.mkpo.li\/og\/%E2%BF%B0%E9%87%92%E5%93%A5.png"/)
  const query = await runtime.dispatchFetch('https://branch.ids-input-workshop.pages.dev/?ids=a%2Fb')
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
  console.log(`Pages worker runtime passed; resvg PNG ${png.length} bytes, 1200 × 630`)
} finally { await runtime.dispose() }
