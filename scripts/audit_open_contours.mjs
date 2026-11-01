// Count the points an export stores torn: a point the light master writes twice, the copies of it
// grown apart at heavy. A contour's closing return and a sharp corner are both written that way, and
// han-compose#46 grows each copy once, so nothing should come out torn. Run it against a local export
// before uploading it, and against the published one to see what clients still read:
//   bun scripts/audit_open_contours.mjs EXPORT_DIR_OR_URL KEYS_FILE [SUFFIX]
// `KEYS_FILE` is a JSON list of keys (han-compose `export-web` records the letters and digits of
// `web_export.letters`). Nothing should come out torn once han-compose grows a duplicated point once.
import { readFile } from 'node:fs/promises'
import { hexOf } from '../src/composer/sha256.js'
import { unpack } from '../src/composer/loader.js'

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
    const implied = ops.endsWith('*')
    const pairs = []
    for (let i = 1; i < n; i++)
      if (!(i === n - 1 && implied) && lo[2 * i] === lo[2 * (i - 1)] && lo[2 * i + 1] === lo[2 * (i - 1) + 1]) pairs.push([i, i - 1])
    if (!implied && n >= 2 && lo[0] === lo[lo.length - 2] && lo[1] === lo[lo.length - 1]) pairs.push([n - 1, 0])
    for (const [at, first] of pairs) {
      closed++
      const gap = Math.hypot((lo[2 * at] + d[2 * at]) - (lo[2 * first] + d[2 * first]), (lo[2 * at + 1] + d[2 * at + 1]) - (lo[2 * first + 1] + d[2 * first + 1])) / 4
      if (gap > 0.01) { torn++; if (gap > worst) { worst = gap; worstKey = key } }
    }
  }
}
console.log(JSON.stringify({ keys: keys.length, closed, torn, worst: +worst.toFixed(2), worstKey }))
if (torn) process.exitCode = 1
