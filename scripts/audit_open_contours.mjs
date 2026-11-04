// Count the contours an export stores torn at their start: the heavy master's first point apart from
// its last, where the light master repeats its first point as its last. Run it against a local export
// before uploading it, and against the published one to see what clients still read:
//   bun scripts/audit_open_contours.mjs EXPORT_DIR_OR_URL KEYS_FILE [SUFFIX]
// `KEYS_FILE` is a JSON list of keys (han-compose `export-web` records the letters and digits of
// `web_export.letters`). Nothing should come out torn once han-compose grows a duplicated point once.
import { readFile } from 'node:fs/promises'
import { hexOf } from '@han-compose/composer/sha256'
import { unpack } from '@han-compose/composer/loader'

const [base, listFile, suffix = ''] = process.argv.slice(2)
if (!base || !listFile) throw Error('Usage: bun scripts/audit_open_contours.mjs EXPORT_DIR_OR_URL KEYS_FILE [SUFFIX]')
const keys = JSON.parse(await readFile(listFile, 'utf8'))
const shards = new Map()
for (const key of keys) {
  const name = `g/${hexOf(key).slice(0, 3)}.json`
  shards.set(name, (shards.get(name) ?? 0) + 1)
}
const cache = new Map()
const read = async name => {
  if (cache.has(name)) return cache.get(name)
  const job = (async () => {
    const url = `${base}/${name}${suffix}`
    if (/^https?:/.test(url)) {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${url}: ${response.status}`)
      return response.arrayBuffer()
    }
    const bytes = await readFile(url)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  })()
  cache.set(name, job)
  return job
}
let closed = 0, torn = 0, worst = 0, worstKey = ''

const records = new Set()
for (const name of shards.keys()) {
  records.add(name)
}
const loaded = new Map()
{
  const queue = [...records]
  const worker = async () => {
    while (queue.length) {
      const name = queue.pop()
      try {
        loaded.set(name, JSON.parse(await unpack(await read(name))))
      } catch (error) {
        if (error instanceof TypeError) { queue.push(name); await new Promise(r => setTimeout(r, 250)) } else if (error.message.includes(': 404')) loaded.set(name, {})
        else throw error
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
}
for (const key of keys) {
  const file = loaded.get(`g/${hexOf(key).slice(0, 3)}.json`)
  const rec = file?.[hexOf(key)]
  const g = rec?.G
  if (!g?.p) continue
  for (const [ops, light, delta] of g.p) {
    const lb = Buffer.from(light, 'base64'), db = Buffer.from(delta, 'base64')
    const lo = new Int16Array(lb.buffer, lb.byteOffset, lb.length / 2)
    const d = new Int16Array(db.buffer, db.byteOffset, db.length / 2)
    const n = lo.length / 2
    if (n < 4 || ops.endsWith('*')) continue
    if (lo[0] !== lo[lo.length - 2] || lo[1] !== lo[lo.length - 1]) continue
    closed++
    const hx0 = lo[0] + d[0], hy0 = lo[1] + d[1]
    const hx1 = lo[lo.length - 2] + d[lo.length - 2], hy1 = lo[lo.length - 1] + d[lo.length - 1]
    const gap = Math.hypot(hx0 - hx1, hy0 - hy1) / 4
    if (gap > 0.01) { torn++; if (gap > worst) { worst = gap; worstKey = key } }
  }
}
console.log(JSON.stringify({ keys: keys.length, closed, torn, worst: +worst.toFixed(2), worstKey }))
if (torn) process.exitCode = 1
