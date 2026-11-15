// The compiled UCV and NUCV lists keep the source's entries, forms and example characters.
import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'

const data = JSON.parse(await readFile(new URL('../data/ucv.json', import.meta.url), 'utf8'))
const outlines = JSON.parse(gunzipSync(await readFile(new URL('../data/ucv-forms.json.gz', import.meta.url))).toString('utf8'))
const entry = (/** @type {string} */ id) => data.entries.find((/** @type {{ id: string }} */ row) => row.id === id)

it('keeps every entry of both lists', () => {
  const kinds = data.entries.map((/** @type {{ kind: string }} */ row) => row.kind)
  expect(kinds.filter((/** @type {string} */ kind) => kind === 'unifiable')).toHaveLength(599)
  expect(kinds.filter((/** @type {string} */ kind) => kind === 'not-unifiable')).toHaveLength(14)
  expect(new Set(data.entries.map((/** @type {{ id: string }} */ row) => row.id)).size).toBe(613)
})

it('places each entry in a group the source names', () => {
  const groups = new Set(data.groups.flatMap((/** @type {{ id: string, subgroups: { id: string }[] }} */ group) => [group.id, ...group.subgroups.map(sub => sub.id)]))
  for (const row of data.entries) if (row.kind === 'unifiable') expect(groups.has(row.group)).toBe(true)
})

it('reads the forms, the criterion and the example characters of an entry', () => {
  expect(entry('321')).toEqual({
    id: '321', kind: 'unifiable', level: 1, group: 'j-3',
    forms: [{ glyph: 'u540c-08', of: '同' }, { glyph: 'u540c-08-var-001', of: '同' }, { glyph: 'cdp-8de1' }],
    // The source writes the third form as a private-use character of the CDP font.
    components: '同\u{F693}', jis: '148',
    unified: ['爂', '爨', '釁'],
    compatibility: [['爨', '\u{2F920}']],
    disunified: [['𦦝', '𦦧'], ['𦦞', '𦦡']],
  })
})

it('names a coded form by its character and a described one by its description', () => {
  expect(entry('1').forms).toEqual([{ glyph: 'u58ec', text: '壬' }, { glyph: 'u58ec-t', of: '壬' }, { glyph: 'u738b', text: '王' }, { glyph: 'u2123c', text: '𡈼' }])
  expect(entry('323').forms[1].glyph).toBe('u66f7-var-002')
  expect(data.entries.flatMap((/** @type {{ forms: { text?: string }[] }} */ row) => row.forms).some((/** @type {{ text?: string }} */ form) => form.text?.startsWith('⿱'))).toBe(true)
})

it('records the chart an example is shown from and a list that trails off', () => {
  expect(entry('1').charts['𢗖']).toBe('ucs2003')
  expect(entry('1').unifiedMore).toBe(true)
  expect(entry('1').unified).not.toContain('…')
})

it('draws nearly every form', () => {
  const names = new Set(data.entries.flatMap((/** @type {{ forms: { glyph: string }[] }} */ row) => row.forms.map(form => form.glyph)))
  const absent = [...names].filter(name => !outlines[name])
  expect(names.size).toBe(1606)
  expect(absent.length).toBeLessThanOrEqual(11)
  expect(outlines['u540c-08']).toMatch(/^M[\d. ]+L/)
})

it('keeps every review link and the characters a single form appears in', () => {
  expect(data.entries.flatMap((/** @type {{ review?: string[] }} */ row) => row.review ?? [])).toHaveLength(232)
  expect(entry('325').single[0]).toEqual({ char: '間', examples: ['墹', '𣊺', '𤩎', '𥼴', '𦗬', '𧒄', '𧢑', '𩴦'] })
})

it('keeps a count the source writes in words apart from the example characters', () => {
  expect(entry('402').single).toEqual([{ char: '网', examples: [], count: 'About 10' }, { char: '罒', examples: [], count: 'More than 300' }])
  const examples = data.entries.flatMap((/** @type {any} */ row) => [row.unified ?? [], row.compatibility ?? [], row.disunified ?? [], row.sourceSeparations ?? [], (row.single ?? []).map((/** @type {any} */ single) => single.examples)]).flat(3)
  expect(examples.filter((/** @type {string} */ char) => /** @type {number} */ (char.codePointAt(0)) < 128)).toEqual([])
})

it('reads a group title the source quotes either way', () => {
  for (const group of data.groups) expect(group.en).toBeTruthy()
})

it('marks the forms no source draws, and gives every other textless form an outline record', () => {
  const forms = data.entries.flatMap((/** @type {{ forms: { glyph: string, text?: string, undrawn?: boolean }[] }} */ row) => row.forms)
  expect(new Set(forms.filter((/** @type {{ undrawn?: boolean }} */ form) => form.undrawn).map((/** @type {{ glyph: string }} */ form) => form.glyph)).size).toBe(11)
  for (const form of forms) expect(Boolean(form.undrawn)).toBe(!outlines[form.glyph])
  const { records } = JSON.parse(gunzipSync(readFileSync(new URL('../data/ucv-outlines.json.gz', import.meta.url))).toString('utf8'))
  const wanted = new Set(forms.filter((/** @type {{ text?: string, undrawn?: boolean }} */ form) => !form.text && !form.undrawn).map((/** @type {{ glyph: string }} */ form) => `&GW-${form.glyph};`))
  expect(new Set(Object.keys(records))).toEqual(wanted)
  expect(wanted.size).toBe(632)
  const record = records['&GW-u58ec-t;']
  expect(record.k).toBe('&GW-u58ec-t;')
  expect(record.o).toBe(record.G.p.length)
  // Inside the em, top at 880: the 200-unit square scaled by five.
  expect(record.G.b[0]).toBeGreaterThanOrEqual(0)
  expect(record.G.b[2]).toBeLessThanOrEqual(1000)
  expect(record.G.b[1]).toBeGreaterThanOrEqual(-120)
  expect(record.G.b[3]).toBeLessThanOrEqual(880)
  for (const [ops, light, delta] of record.G.p) {
    expect(ops).toMatch(/^ML+$/)
    expect(Buffer.from(light, 'base64').length).toBe(ops.length * 4)
    expect(Buffer.from(delta, 'base64').every((/** @type {number} */ byte) => byte === 0)).toBe(true)
  }
})

it('dates each batch of outlines fetched from GlyphWiki', () => {
  expect(data.source.glyphs.fetched).toHaveLength(1)
  expect(data.source.glyphs.fetched[0].date).toBe('2026-11-13')
  expect(data.source.glyphs.fetched[0].names).toHaveLength(134)
})

it('tells a counter from a stroke that overlaps another', async () => {
  const { counters, polygonsOf } = await import('../scripts/lib/outline.mjs')
  const square = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ size) => `M${x} ${y}L${x + size} ${y}L${x + size} ${y + size}L${x} ${y + size}Z`
  const reversed = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ size) => `M${x} ${y}L${x} ${y + size}L${x + size} ${y + size}L${x + size} ${y}Z`
  // A shape, a counter cut from it, and a shape inside the counter.
  expect(counters(polygonsOf(square(0, 0, 100) + reversed(20, 20, 60) + square(40, 40, 20)))).toEqual([false, true, false])
  // Strokes that overlap are both ink, however each is wound, and so is one drawn inside another.
  expect(counters(polygonsOf(square(0, 0, 100) + reversed(50, 50, 100)))).toEqual([false, false])
  expect(counters(polygonsOf(square(0, 0, 100) + square(20, 20, 60)))).toEqual([false, false])
  // A polygon that touches the edge of the one around it is a stroke meeting it, not a counter.
  expect(counters(polygonsOf(square(0, 0, 100) + reversed(0, 20, 60)))).toEqual([false, false])
  // Nor is one whose corners are all inside a hollowed shape while it crosses the hollow.
  expect(counters(polygonsOf('M0 0L100 0L100 30L30 30L30 70L100 70L100 100L0 100Z' + 'M60 10L60 90L80 90L80 10Z'))).toEqual([false, false])
})

it('keeps the counters of a form open in its outline record', () => {
  const { records } = JSON.parse(gunzipSync(readFileSync(new URL('../data/ucv-outlines.json.gz', import.meta.url))).toString('utf8'))
  // The second form of 凹 (UCV #438) is one shape with two counters.
  const windings = (/** @type {string} */ key) => records[key].G.p.map((/** @type {[string, string]} */ [, light]) => {
    const bytes = Buffer.from(light, 'base64')
    let sum = 0
    for (let i = 0; i < bytes.length; i += 4) {
      const next = (i + 4) % bytes.length
      sum += bytes.readInt16LE(i) * bytes.readInt16LE(next + 2) - bytes.readInt16LE(next) * bytes.readInt16LE(i + 2)
    }
    return Math.sign(sum)
  })
  expect(windings('&GW-cdp-885b-var-006;')).toEqual([1, -1, -1])
  // A form drawn as strokes has every polygon wound one way.
  const strokes = windings('&GW-u58ec-t;')
  expect(strokes.length).toBeGreaterThan(1)
  expect(new Set(strokes)).toEqual(new Set([1]))
})

it('draws every textless form in Gothic too, from stroke data that draws its recorded outline', () => {
  const read = (/** @type {string} */ name) => JSON.parse(gunzipSync(readFileSync(new URL(`../data/${name}`, import.meta.url))).toString('utf8'))
  const mincho = read('ucv-outlines.json.gz').records, sans = read('ucv-outlines-sans.json.gz').records, strokes = read('ucv-strokes.json.gz')
  expect(Object.keys(sans).sort()).toEqual(Object.keys(mincho).sort())
  for (const key of Object.keys(sans)) {
    const name = key.slice('&GW-'.length, -1)
    const kept = strokes.forms[name]
    expect(kept.same).toBeGreaterThanOrEqual(strokes.source.same)
    expect(strokes.glyphs[`${name}@${kept.version}`]).toBeTruthy()
  }
  // Every part a kept glyph names is kept with it.
  for (const data of Object.values(strokes.glyphs)) {
    for (const line of /** @type {string} */ (data).split('$')) {
      const fields = line.split(':')
      if (fields[0] === '99') expect(strokes.glyphs[fields[7]]).toBeTruthy()
    }
  }
  // Two masters: the heavy one moves the points of the light one.
  const record = sans['&GW-u58ec-t;']
  expect(record.k).toBe('&GW-u58ec-t;')
  expect(record.G.b[0]).toBeGreaterThanOrEqual(0)
  expect(record.G.b[2]).toBeLessThanOrEqual(1000)
  const delta = Buffer.from(record.G.p[0][2], 'base64')
  expect(delta.some(byte => byte !== 0)).toBe(true)
  expect(Buffer.from(record.G.p[0][1], 'base64').length).toBe(delta.length)
  // The Mincho record of the same form has one.
  expect(Buffer.from(mincho['&GW-u58ec-t;'].G.p[0][2], 'base64').some(byte => byte !== 0)).toBe(false)
  // Every contour is the same stroke at each weight the engine draws, from 0.6 of the masters'
  // difference below the light one to the heavy one: it keeps its points and never turns inside out.
  for (const [key, form] of Object.entries(sans)) {
    for (const [ops, light, change] of /** @type {{ G: { p: [string, string, string][] } }} */ (form).G.p) {
      const at = Buffer.from(light, 'base64'), by = Buffer.from(change, 'base64')
      expect(by.length).toBe(at.length)
      expect(ops.length).toBe(at.length / 4)
      const turn = (/** @type {number} */ weight) => {
        let sum = 0
        const point = (/** @type {number} */ i) => [at.readInt16LE(i) + by.readInt16LE(i) * weight, at.readInt16LE(i + 2) + by.readInt16LE(i + 2) * weight]
        for (let i = 0; i < at.length; i += 4) { const [x, y] = point(i), [nx, ny] = point((i + 4) % at.length); sum += x * ny - nx * y }
        return Math.sign(sum)
      }
      if (turn(0) !== 1 || turn(-0.6) !== 1 || turn(1) !== 1) throw new Error(`${key}: a contour turns over between weights`)
    }
  }
})
