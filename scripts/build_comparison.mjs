// Rebuilds the comparison gallery's composer drawings and scores from the current composer export,
// keeping each entry's sequence, set and KAGE reference. `demo/lib/comparison.json` is a snapshot:
// rerun this after a composer change so the page shows the drawings the workshop makes now.
//
//   bun scripts/build_comparison.mjs [--out FILE] [--limit N]
//
// Each entry is drawn with a fresh source over one shared file cache, so a drawing does not depend
// on the entries before it. The three numbers are the page's: IoU of the ink at 256 px, F1 with a
// 4 px tolerance, and the L1 distance of the ink shares in a 3 × 3 grid.
import { readFileSync, writeFileSync } from 'node:fs'
import { compose, fromUrl } from '@han-compose/composer/loader'
import { COMPOSER_BASE } from '../demo/lib/composer.js'
import { count, grown, iou, pathMask } from '@han-compose/composer/geometry'

const args = process.argv.slice(2)
const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] }
const input = option('--in') ?? 'demo/lib/comparison.json'
const output = option('--out') ?? input
const limit = option('--limit') ? Number(option('--limit')) : Infinity
if (limit < Infinity && output === input) throw new Error('--limit needs a different --out: a sample cannot replace the gallery')
const SIZE = 256, TOLERANCE = 4

const data = JSON.parse(readFileSync(input, 'utf8'))
const bytes = new Map()
const fetchCached = async url => {
  if (!bytes.has(url)) {
    const response = await fetch(url)
    if (response.status === 404) bytes.set(url, null)
    else if (!response.ok) throw new Error(`${url}: ${response.status}`)
    else bytes.set(url, await response.arrayBuffer())
  }
  const body = bytes.get(url)
  return body ? new Response(body) : new Response(null, { status: 404 })
}
const fresh = () => fromUrl(COMPOSER_BASE, { fetch: fetchCached })

const KAGE_SCALE = 5
const expand = d => d.replace(/([ML])([^ML]*)/g, (_, command, body) => {
  const numbers = body.match(/-?\d+(?:\.\d+)?/g) ?? []
  const pairs = []
  for (let i = 0; i + 1 < numbers.length; i += 2) pairs.push(`${numbers[i]},${numbers[i + 1]}`)
  return command + pairs.join(' L')
})
const scale = (d, factor) => d.replace(/-?\d+(?:\.\d+)?/g, number => String(Number(number) * factor))
const mask = d => pathMask(d, SIZE)
const overlap = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) n += a[i] & b[i]; return n }

/** The ink shares of a mask in a 3 × 3 grid. */
function shares(mask) {
  const cells = new Array(9).fill(0)
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++)
    if (mask[y * SIZE + x]) cells[Math.floor(y * 3 / SIZE) * 3 + Math.floor(x * 3 / SIZE)]++
  const total = cells.reduce((a, b) => a + b, 0) || 1
  return cells.map(n => n / total)
}

/** `{ iou, f1, layout }` of a composer path against a KAGE drawing. */
function score(drawn, kage) {
  const a = mask(drawn), b = new Uint8Array(a.length)
  for (const path of kage) {
    const m = mask(scale(expand(path), KAGE_SCALE))
    for (let i = 0; i < m.length; i++) b[i] |= m[i]
  }
  const na = count(a), nb = count(b)
  const precision = overlap(a, grown(b, SIZE, TOLERANCE)) / Math.max(na, 1)
  const recall = overlap(b, grown(a, SIZE, TOLERANCE)) / Math.max(nb, 1)
  const gridA = shares(a), gridB = shares(b)
  let layout = 0
  for (let i = 0; i < 9; i++) layout += Math.abs(gridA[i] - gridB[i])
  return { iou: iou(a, b), f1: 2 * precision * recall / Math.max(precision + recall, 1e-9), layout }
}

const round = value => Number(value.toFixed(4))
const entries = []
let changed = 0, failed = 0
for (const [index, entry] of data.entries.slice(0, limit).entries()) {
  let drawn = null
  try { drawn = await compose(fresh(), entry.sequence) } catch (error) { failed++; console.error(`${entry.sequence}: ${error.message}`) }
  if (!drawn) { entries.push(entry); continue }
  const s = score(drawn.d, entry.kage)
  const next = { ...entry, f1: round(s.f1), iou: round(s.iou), layout: round(s.layout), ours: drawn.d }
  if (next.ours !== entry.ours) changed++
  entries.push(next)
  if ((index + 1) % 20 === 0) console.error(`${index + 1}/${Math.min(limit, data.entries.length)}: ${changed} drawings changed, ${failed} failed`)
}
const today = new Date()
const generatedAt = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const rebuilt = { ...data, generatedAt, dataset: { resolution: SIZE, tolerance: TOLERANCE }, entries }
writeFileSync(output, JSON.stringify(rebuilt))
console.error(`${entries.length} entries, ${changed} drawings changed, ${failed} failed; wrote ${output}`)
