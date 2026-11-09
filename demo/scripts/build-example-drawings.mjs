#!/usr/bin/env bun
// Rebuild demo/lib/example-drawings.json: every starter example composed once using bundled outlines or the export at
// COMPOSER_BASE, so the demo opens an example without waiting for the composer. Run it whenever
// COMPOSER_BASE changes; tests/example-drawings.test.js fails until the file matches the export.
//
//   bun run build:example-drawings
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { hasTangut, tangutSource } from '../../src/composer/tangut.js'
import { hasBopomofo, bopomofoSource } from '../../src/composer/bopomofo.js'
import { hasSmallSeal, smallSealSource } from '../../src/composer/small-seal.js'
import { hasShuishu, shuishuSource } from '../../src/composer/shuishu.js'
import { hasJurchen, jurchenSource } from '../../src/composer/jurchen.js'
import { onlyBundled } from '../../src/composer/local.js'
import { bundledSource } from '../../src/composer/bundled.js'
import { compose, fromUrl } from '../../src/composer/loader.js'
import { EXAMPLES, EXAMPLE_GROUPS } from '../lib/examples.js'
import { COMPOSER_BASE } from '../lib/composer.js'

const DRAFTED = new Map(EXAMPLE_GROUPS.filter(group => ['sign', 'erjian'].includes(group.key))
  .flatMap(group => group.examples.map(example => [example.sequence, group.key])))
const source = fromUrl(COMPOSER_BASE)
// Examples whose parts are all bundled draw from a local source. `onlyBundled` also says yes to a
// whole sequence that matches a component form, then skips its parts, so the export stays behind
// the source for the character's own glyph.
const bundled = bundledSource({ load: async () => ({ records: {} }), matches: () => false, fallback: source })
const loadTangut = async () => JSON.parse(gunzipSync(readFileSync(new URL('../../data/tangut-outlines.json.gz', import.meta.url))))
const tangut = tangutSource({ load: loadTangut })
const mixed = tangutSource({ load: loadTangut, fallback: source })
const loadShuishu = async () => JSON.parse(gunzipSync(readFileSync(new URL('../../data/shuishu-outlines.json.gz', import.meta.url))))
const loadJurchen = async () => JSON.parse(gunzipSync(readFileSync(new URL('../../data/jurchen-outlines.json.gz', import.meta.url))))
const loadBopomofo = async () => JSON.parse(gunzipSync(readFileSync(new URL('../../data/bopomofo-outlines.json.gz', import.meta.url))))
const bopomofoSources = new Map()
await source.ready()

// 黃金萬兩 sets 黃 above 金, and 黃 ends in two dots that sit in the gap between them.
// The print the example follows joins the two: 金's roof takes the dots' place. Drop the
// dots from 黃's own outline and let the roof meet the body it belongs to.
const JOINED_DOTS = '⿱黄⿱金⿱田⿵冂山'

// The stored drawings run y down, and a viewer that flips y shows them upside down.
function inkBox(d) {
  const nums = (String(d).match(/-?\d+\.?\d*/g) || []).map(Number)
  const xs = nums.filter((_, i) => i % 2 === 0)
  const ys = nums.filter((_, i) => i % 2 === 1)
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
}

function inkExtent(d) {
  const nums = (String(d).match(/-?\d+\.?\d*/g) || []).map(Number)
  const ys = nums.filter((_, i) => i % 2 === 1)
  return [Math.min(...ys), Math.max(...ys)]
}

// 黃金萬兩 sets 黃 above 金, and 黃 ends in two dots that sit in the gap between them. The
// print the example follows joins the two: 金's roof takes the dots' place. Drop the dots
// from 黃's own outline, then lift 金 and 萬 until the roof meets 黃's body.
function joinHuangToJin(drawn) {
  const huang = drawn?.parts?.find(p => String(p.origin).startsWith('glyph '))
  const jin = drawn?.parts?.find(p => String(p.origin).startsWith('host 鑫'))
  if (!huang || !jin) return drawn
  const subpaths = String(huang.d).split('M').filter(s => s.trim())
  const kept = subpaths.filter(s => {
    const nums = (s.match(/-?\d+\.?\d*/g) || []).map(Number)
    const xs = nums.filter((_, i) => i % 2 === 0)
    const ys = nums.filter((_, i) => i % 2 === 1)
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    // The dots are the two wide, short strokes along 黃's bottom edge.
    return !(y0 > 330 && y1 < 460 && x1 - x0 > 180)
  })
  if (kept.length === subpaths.length) return drawn
  huang.d = 'M' + kept.join('M')
  const huangBottom = inkExtent(huang.d)[1]
  const jinTop = inkExtent(jin.d)[0]
  const lift = jinTop - huangBottom
  if (lift > 0) {
    const raised = new Set(['host 鑫', 'Noto Sans CJK: ⿳艹田⿵冂山'])
    for (const part of drawn.parts) {
      if (!raised.has(String(part.origin)) || part === huang) continue
      part.d = String(part.d).replace(/(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g,
        (m, x, y) => `${x} ${(Number(y) - lift).toFixed(3)}`)
    }
  }
  drawn.d = drawn.parts.map(p => p.d).join('')
  return drawn
}


// 萬 opens with 艹, and 金's bottom sits on the same line in this stack: the shared stroke is
// drawn once, by 金. Drop 艹's bar from 萬's own outline so the two do not double up.
function dropCao(drawn) {
  const part = drawn?.parts?.find(p => String(p.origin).startsWith('Noto Sans CJK: ⿳艹田⿵冂山'))
  if (!part) return drawn
  const subs = String(part.d).split('M').filter(s => s.trim())
  const kept = subs.filter(s => {
    const nums = (s.match(/-?\d+\.?\d*/g) || []).map(Number)
    const ys = nums.filter((_, i) => i % 2 === 1)
    // 艹's bar is the wide stroke above 田's box.
    return !(Math.max(...ys) < 690 && Math.min(...ys) > 600)
  })
  if (kept.length === subs.length) return drawn
  part.d = 'M' + kept.join('M')
  drawn.d = drawn.parts.map(p => p.d).join('')
  return drawn
}


// 萬 is the base of the stack. Give it the height the stack needs, keep a gap under 金, and
// narrow it to 金's width so it does not stand wider than the components above it. The paths
// are absolute, so each command's points can be transformed without touching the letters.
function transformPath(d, map) {
  let out = ''
  const re = /([MLQCZ])([^MLQCZ]*)/g
  let m
  while ((m = re.exec(d))) {
    const [cmd, args] = [m[1], m[2]]
    if (cmd === 'Z') { out += 'Z'; continue }
    const nums = (args.match(/-?\d+\.?\d*/g) || []).map(Number)
    const pts = []
    for (let i = 0; i < nums.length; i += 2) {
      const [x, y] = map(nums[i], nums[i + 1])
      pts.push(`${x.toFixed(3)} ${y.toFixed(3)}`)
    }
    out += cmd + pts.join(' ')
  }
  return out
}

function fitWanToStack(drawn) {
  const jin = drawn?.parts?.find(p => String(p.origin).startsWith('host 鑫'))
  const wans = (drawn?.parts ?? []).filter(p => String(p.origin).startsWith('Noto Sans CJK: ⿱田⿵冂山'))
  if (!jin || wans.length === 0) return drawn
  const boxes = wans.map(p => inkBox(p.d))
  const jinBox = inkBox(jin.d)
  const top = Math.min(...boxes.map(b => b[2]))
  const bottom = Math.max(...boxes.map(b => b[3]))
  const left = Math.min(...boxes.map(b => b[0]))
  const right = Math.max(...boxes.map(b => b[1]))
  const height = bottom - top
  const width = right - left
  if (!(height > 0 && width > 0)) return drawn
  const GAP = 20
  const ky = 300 / height
  const kx = (jinBox[1] - jinBox[0]) / width
  const cx = (left + right) / 2
  const jx = (jinBox[0] + jinBox[1]) / 2
  for (const part of wans) {
    part.d = transformPath(part.d, (x, y) => [jx + (x - cx) * kx, jinBox[3] + GAP + (y - top) * ky])
  }
  drawn.d = drawn.parts.map(p => p.d).join('')
  return drawn
}

const drawings = {}
const failed = []
for (const example of EXAMPLES) {
  try {
    const local = onlyBundled(example.sequence)
    let selected = hasTangut(example.sequence) ? (local ? tangut : mixed) : (local ? bundled : source)
    if (hasBopomofo(example.sequence)) {
      if (!bopomofoSources.has(selected)) bopomofoSources.set(selected, bopomofoSource({ load: loadBopomofo, fallback: selected }))
      selected = bopomofoSources.get(selected)
    }
    if (hasSmallSeal(example.sequence)) selected = smallSealSource({load: async () => JSON.parse(gunzipSync(readFileSync(new URL('../../data/small-seal-outlines.json.gz', import.meta.url)))), fallback: selected})
    if (hasShuishu(example.sequence)) selected = shuishuSource({ load: loadShuishu, fallback: selected })
    if (hasJurchen(example.sequence)) selected = jurchenSource({ load: loadJurchen, fallback: selected })
    // A draft form names the character it stood for, not the one its parts spell out: the examples of
    // the sign and the 二简字 group are drawn from the description, so the thumbnail matches the editor.
    const drafted = (DRAFTED.get(example.sequence) ?? null) !== null
    const drawn = await compose(selected, drafted ? example.sequence : example.char || example.sequence)
    if (example.sequence === JOINED_DOTS) { joinHuangToJin(drawn); fitWanToStack(drawn) }
    drawings[example.sequence] = { char: example.char, drawn }
    console.log(`drew ${example.char || example.sequence}`)
  } catch (error) {
    failed.push({ sequence: example.sequence, char: example.char, name: error?.name, message: String(error?.message ?? error) })
    console.log(`skipped ${example.char || example.sequence}: ${error?.name ?? 'Error'}: ${error?.message ?? error}`)
  }
}
const manifest = source.manifest
const data = {
  base: COMPOSER_BASE,
  composer: {
    commit: manifest?.composer?.commit ?? null,
    style: manifest?.composer?.style ?? null,
    layout_sha256: manifest?.composer?.layout_sha256 ?? null,
  },
  drawings,
  failed,
}
const out = new URL('../lib/example-drawings.json', import.meta.url)
writeFileSync(out, JSON.stringify(data, null, 1) + '\n')
console.log(`${Object.keys(drawings).length} drawings, ${failed.length} skipped, ${JSON.stringify(data).length} bytes -> demo/lib/example-drawings.json`)
