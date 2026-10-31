// The browser composer's guards, on the small export of `fixtures/composer-export.js`, whose layout
// network is all zeros: two-operand nodes fall back to the composer's shares, which space and fit
// their parts with masks.
import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { createDrawer } from '../src/composer/client.js'
import { LIMITS, compose, createSource, size, sketch, svgBox, tooLarge } from '../src/composer/loader.js'
import { Composer } from '../src/composer/compose.js'
import { badge, groupParts, placeholder } from '../src/core/preview.js'
import { files, layout, ops, shards } from './fixtures/composer-export.js'
import notoRightEnclosure from './fixtures/noto-right-enclosure.json' with { type: 'json' }
import { parse } from '../src/core/ids.js'
import { drawnBox, makePart, placed } from '../src/composer/geometry.js'

const sourceOf = (fetched = []) => createSource(async name => {
  fetched.push(name)
  const body = files[name]
  return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
})
const SEQUENCES = ['⿰木口', '⿱口木', '⿴口木', '⿲木口木', '⿱⿰木木口', '⿾⿰木口', '㇯口木', '⿼口木']

// The fixture with one description the export draws whole, `𪱳`, so `separate` has a glyph to skip.
const hex = text => createHash('sha256').update(text).digest('hex')
const gShard = key => `g/${hex(key).slice(0, 3)}.json`
const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
const boxGlyph = ([x0, y0, x1, y1]) => ({ v: 1, b: [x0, y0, x1, y1],
  p: [['MLLL', int16([x0, y0, x1, y0, x1, y1, x0, y1].map(value => value * 4)), int16(Array(8).fill(0))]] })
const encodedSource = () => {
  const extra = new Map()
  const add = (key, record) => {
    const name = gShard(key), file = extra.get(name) ?? {}
    file[hex(key)] = record
    extra.set(name, gzipSync(JSON.stringify(file)))
  }
  add('⿰木口', { k: '⿰木口', e: '𪱳' })
  const glyph = boxGlyph([40, 40, 960, 960])
  add('𪱳', { k: '𪱳', G: glyph, ink: 3680, nl: 1, o: 1 })
  return createSource(async name => {
    const body = extra.get(name) ?? files[name]
    return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
  })
}

describe('the composer', () => {
  it('places a lower-right enclosure fallback above and left of its closed sides', async () => {
    const source = sourceOf()
    await source.ready()
    const composer = new Composer(source.store())
    composer.room = () => null
    composer.fit = () => false
    composer.node = (child, target) => [{ target }]
    for (const region of [[0, 0, 1000, 1000], [100, 200, 600, 700]]) {
      const [, inner] = composer.shares('⿽', ['木', '口'], region)
      expect((inner.target[0] + inner.target[2]) / 2).toBeLessThan((region[0] + region[2]) / 2)
      expect((inner.target[1] + inner.target[3]) / 2).toBeGreaterThan((region[1] + region[3]) / 2)
    }
  })

  it('keeps the fallback above the centre when an enclosing glyph leaves no detected room', async () => {
    const source = sourceOf()
    await source.ready()
    await source.load(Object.keys(files).filter(name => name.includes('/')))
    const composer = new Composer(source.store())
    const [outer, inner] = composer.compose('⿽永木')
    expect(composer.room('⿽', [outer], composer.face)).toBeNull()
    expect((inner.target[1] + inner.target[3]) / 2).toBeGreaterThan((composer.face[1] + composer.face[3]) / 2)
  })

  it('keeps the ink of an enclosed part in the upper-left fallback after fitting', async () => {
    // Noto Sans CJK JP outlines, SIL OFL 1.1 (fonts/OFL-NotoSansCJK.txt), as exported by han-compose.
    const input = { ...files, ...shards('g', Object.entries(notoRightEnclosure)) }
    const source = createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
    const originalRoom = Composer.prototype.room
    Composer.prototype.room = function (op, ...args) { return op === '⿽' ? null : originalRoom.call(this, op, ...args) }
    try {
      const drawing = await compose(source, '⿽十⺀', { separate: true })
      expect(drawing.parts.map(part => part.origin)).toEqual(['glyph 十', 'glyph ⺀'])
      const [, inner] = drawing.parts
      // SVG coordinates have y down: both dots must stay above and left of the centre.
      expect(inner.box[0] + inner.box[2]).toBeLessThan(500)
      expect(inner.box[1] + inner.box[3]).toBeLessThan(500)
    } finally {
      Composer.prototype.room = originalRoom
    }
  })

  it('renders the four-mouth grid by row while keeping the original leaf order', async () => {
    const glyph = gzipSync(JSON.stringify({ [hex('㗊')]: { k: '㗊', G: boxGlyph([40, 80, 920, 960]), ink: 3520, nl: 1, o: 1 } }))
    const source = createSource(async name => {
      const body = name === gShard('㗊') ? glyph : files[name]
      return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
    })
    const columns = '⿰⿱口口⿱口口', rows = '⿱⿰口口⿰口口'
    const inkOnly = drawing => ({ ...drawing, parts: drawing.parts.map(({ leaf, ...part }) => part) })
    for (const separate of [false, true]) {
      for (const wrap of [grid => grid, grid => `⿱木${grid}`, grid => `⿴${grid}木`, grid => `⿴${grid}⬚`, grid => `⿴${grid}⿱木⬚`]) {
        expect(inkOnly(await compose(source, wrap(columns), { separate })))
          .toEqual(inkOnly(await compose(source, wrap(rows), { separate })))
      }
    }
    expect(inkOnly(await compose(sourceOf(), columns))).toEqual(inkOnly(await compose(sourceOf(), rows)))
    const colSketch = await sketch(source, columns), rowSketch = await sketch(source, rows)
    expect(colSketch.map(leaf => leaf.box)).toEqual([0, 2, 1, 3].map(i => rowSketch[i].box))
    const grid = await compose(source, columns, { separate: true })
    expect(grid.parts).toEqual((await compose(source, '㗊', { separate: true })).parts)
    expect((await compose(source, columns)).parts).toEqual((await compose(source, '㗊')).parts)
    const enclosed = await compose(source, `⿴${columns}木`, { separate: true })
    expect(groupParts(enclosed.parts, await sketch(source, `⿴${columns}木`)).map(group => group.parts))
      .toEqual([[0], [3], [1], [4], [2]])
    const composer = new Composer(source.store())
    expect(composer.parse(columns)).toEqual(['⿰', ['⿱', '口', '口'], ['⿱', '口', '口']])
    expect(composer.repeatedGrid(composer.parse('⿰⿱木口⿱口口'))).toBeNull()
    composer.predict = (op, kids) => {
      const split = JSON.stringify(kids[1]) === JSON.stringify(composer.parse(columns)) ? 800 : 600
      return [[0, split, 1000, 1000], [0, 0, 1000, split]]
    }
    const nestedColumns = composer.sketch(`⿱木${columns}`), nestedRows = composer.sketch(`⿱木${rows}`)
    expect(nestedColumns.map(leaf => leaf.box)).toEqual([0, 1, 3, 2, 4].map(i => nestedRows[i].box))

    const store = source.store()
    for (const wrap of [grid => grid, grid => `⿱木${grid}`]) {
      const lookup = new Composer({ ...store, rec: key => key === wrap(columns) ? { e: '木' }
        : key === wrap(rows) ? { e: '口' } : store.rec(key) })
      expect(lookup.compose(wrap(columns)).map(part => part.origin)).toEqual([wrap(columns) === columns ? 'glyph 㗊' : 'glyph 口'])
      expect(lookup.compose(wrap(columns))).toEqual(lookup.compose(wrap(rows)))
    }
  })

  it('opens split enclosures while preserving editor leaf indices', async () => {
    const extra = new Map()
    for (const ch of [...'彳亍氵弓鬲士冖一殳米几方𠂉其亠𧘇果𤣩王文辛言隹糸𨸏匕頁吅𠦝𠆢羽犬禾']) {
      extra.set(gShard(ch), gzipSync(JSON.stringify({ [hex(ch)]: {
        k: ch, G: boxGlyph([100, 0, 300, 800]), ink: 2000, nl: 1, o: 1,
      } })))
    }
    const source = createSource(async name => {
      const body = extra.get(name) ?? files[name]
      return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
    })
    const inkOnly = drawing => ({ ...drawing, parts: drawing.parts.map(({ leaf, ...part }) => part) })
    for (const inner of ['氵', '⬚', '⿱木⬚', '⿴行⬚']) {
      for (const separate of [false, true]) {
        expect(inkOnly(await compose(source, `⿴行${inner}`, { separate })))
          .toEqual(inkOnly(await compose(source, `⿲彳${inner}亍`, { separate })))
      }
    }
    for (const [outer, render, component] of [
      ['⿸𭤨', inner => `⿰方⿱𠂉${inner}`, '其'],
      ['⿴衣', inner => `⿳亠${inner}𧘇`, '果'],
      ['⿴弜', inner => `⿲弓${inner}弓`, '米'],
      ['⿴玨', inner => `⿲𤣩${inner}王`, '文'],
      ['⿴辡', inner => `⿲辛${inner}辛`, '言'],
      ['⿴雔', inner => `⿲隹${inner}隹`, '言'],
      ['⿴𨺅', inner => `⿲𨸏${inner}⿾𨸏`, '木'],
      ['⿹頃', inner => `⿰⿱匕${inner}頁`, '禾'],
      ['⿴㗊', inner => `⿳吅${inner}吅`, '犬'],
      ['⿸倝', inner => `⿰𠦝⿱𠆢${inner}`, '羽'],
      ['⿶𩰲', inner => `⿱⿲弓${inner}弓鬲`, '米'],
      ['⿹𣪊', inner => `⿰⿱⿳士冖一${inner}殳`, '几'],
    ]) {
      for (const inner of [component, '⬚', '⿱木⬚', '⿴行⬚']) {
        for (const separate of [false, true]) {
          expect(inkOnly(await compose(source, outer + inner, { separate })))
            .toEqual(inkOnly(await compose(source, render(inner), { separate })))
        }
        const leaves = await sketch(source, outer + inner)
        const drawing = await compose(source, outer + inner, { separate: true })
        expect(groupParts(drawing.parts, leaves)).not.toBeNull()
        expect(leaves.map(leaf => leaf.index)).toEqual(leaves.map((_, index) => index))
        expect(leaves.filter(leaf => leaf.empty)).toHaveLength(inner.includes('⬚') ? 1 : 0)
      }
      const leaves = await sketch(source, outer + component)
      expect(leaves).toHaveLength(2)
      const original = new Composer(source.store()).parse(outer + component)
      expect(original).toEqual([[...outer][0], [...outer][1], component])
    }
    for (const inner of ['木', '⬚', '⿴行⬚']) {
      const sequence = `⿴⿰𨸏⿾𨸏${inner}`
      const drawing = await compose(source, sequence, { separate: true })
      expect(inkOnly(drawing)).toEqual(inkOnly(await compose(source, `⿲𨸏${inner}⿾𨸏`, { separate: true })))
      const leaves = await sketch(source, sequence)
      expect(groupParts(drawing.parts, leaves)).not.toBeNull()
      expect(leaves.map(leaf => leaf.index)).toEqual(leaves.map((_, i) => i))
    }
    expect((await compose(source, '⿴𨺅木')).approximate).toEqual(['⿾'])
    // A zi.tools modifier is kept with the description; the layout draws the description alone.
    expect((await compose(source, '⿴[1]𨺅木')).approximate).toEqual(['⿾', '⿴'])
    const leaves = await sketch(source, '⿴行氵')
    const explicit = await sketch(source, '⿲彳氵亍')
    expect(leaves).toHaveLength(2)
    expect(leaves[1]).toEqual({ ...explicit[1], index: 1 })
    const drawn = await compose(source, '⿴行氵', { separate: true })
    expect(groupParts(drawn.parts, leaves)?.map(group => group.parts)).toEqual([[0, 2], [1]])
    const empty = await sketch(source, '⿴行⬚')
    expect(empty[1]).toEqual({ ...leaves[1], empty: true })
    const composer = new Composer(source.store())
    composer.compose('⿴𨺅木')
    expect([...composer.approximate]).toEqual(['⿾'])
    composer.compose('木')
    expect([...composer.approximate]).toEqual([])
    expect(composer.parse('⿴行氵')).toEqual(['⿴', '行', '氵'])
    expect(composer.respelled(['⿴', '口', '木'])).toEqual(['⿴', '口', '木'])
    expect(composer.respelled(['⿵', '行', '木'])).toEqual(['⿵', '行', '木'])
    expect(composer.respelled(['⿸', '㫃', '其'])).toEqual(['⿸', '㫃', '其'])
  })
  it('draws the same whether its files arrive at once or as it asks for them', async () => {
    const lazy = sourceOf(), eager = sourceOf()
    await eager.ready()
    await eager.load(Object.keys(files).filter(name => name.includes('/')))
    for (const sequence of SEQUENCES) {
      const a = await compose(lazy, sequence), b = await compose(eager, sequence)
      expect(a.d.length).toBeGreaterThan(20)
      expect(a).toEqual(b)
    }
  })
  it('keeps loading files a drawing asks for across many rounds', async () => {
    // A rare composition can ask for a new wave of host records for many rounds. The fake names
    // stand for those waves; they read as empty shards, and the drawing itself needs only the fixture.
    const base = sourceOf()
    let rounds = 0
    const source = Object.create(base)
    source.store = () => {
      const store = base.store()
      if (rounds < 20) store.missing.add(`g/round-${rounds++}.json`)
      return store
    }
    const drawn = await compose(source, '⿱木口')
    expect(drawn).toEqual(await compose(sourceOf(), '⿱木口'))
    expect(rounds).toBe(20)
  })
  it('draws a dense description no character spells in cells', async () => {
    const sequence = '⿱⿰⿰木口⿰木口⿰⿰木口⿰木口'
    const drawn = await compose(sourceOf(), sequence)
    expect(drawn.cells).toBe(true)
    expect(drawn.parts).toHaveLength(8)
    expect(drawn.parts.map(part => part.leaf)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(drawn.parts.every(part => part.origin.startsWith('cells '))).toBe(true)
    // Each part sits in its own cell: positive sizes, inside the face, and no two boxes overlap.
    for (const [x, y, width, height] of drawn.parts.map(part => part.box)) {
      expect(width).toBeGreaterThan(0)
      expect(height).toBeGreaterThan(0)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(x + width).toBeLessThanOrEqual(1000)
      expect(y + height).toBeLessThanOrEqual(1000)
    }
    for (let i = 0; i < drawn.parts.length; i++) {
      for (let j = i + 1; j < drawn.parts.length; j++) {
        const [x, y, width, height] = drawn.parts[i].box, [u, v, w, h] = drawn.parts[j].box
        expect(Math.max(0, Math.min(x + width, u + w) - Math.max(x, u))
          * Math.max(0, Math.min(y + height, v + h) - Math.max(y, v))).toBe(0)
      }
    }
    // Reading order places the top operand above the bottom one.
    const top = drawn.parts.find(part => part.leaf === 0), bottom = drawn.parts.find(part => part.leaf === 4)
    expect(top.box[1] + top.box[3]).toBeLessThanOrEqual(bottom.box[1])
    expect((await compose(sourceOf(), sequence, { layout: 'composed' })).cells).toBeUndefined()
    expect((await compose(sourceOf(), '⿰木口')).cells).toBeUndefined()
  })
  it('draws in cells at eight leaves, and reads across and down in tree order', async () => {
    const chain = n => '⿱木' + '⿰木'.repeat(n - 2) + '口'
    expect((await compose(sourceOf(), chain(7))).cells).toBeUndefined()
    expect((await compose(sourceOf(), chain(8))).cells).toBe(true)
    const across = await compose(sourceOf(), '⿰木口', { layout: 'cells' })
    expect(across.parts[0].box[0] + across.parts[0].box[2]).toBeLessThanOrEqual(across.parts[1].box[0])
    for (const sequence of ['⿲木口木', '⿳木口木', '⿹木口']) {
      const cells = await compose(sourceOf(), sequence, { layout: 'cells' })
      expect(cells.parts).toHaveLength(sequence === '⿲木口木' || sequence === '⿳木口木' ? 3 : 2)
    }
  })
  it('gives a single top part less height, and balances the cell drawing', async () => {
    const chain = n => '⿱木' + '⿰木'.repeat(n - 2) + '口'
    const tall = await compose(sourceOf(), chain(8))
    const top = tall.parts.find(part => part.leaf === 0)
    expect(top.box[3]).toBeLessThan(350)
    expect(top.box[2]).toBeGreaterThan(750)
    expect(Array.isArray(tall.stroke)).toBe(true)
    expect(tall.stroke).toHaveLength(2)
    // A top subtree of several leaves keeps half the height.
    const multi = await compose(sourceOf(), '⿱⿰⿰木口⿰木口⿰口木', { layout: 'cells' })
    const first = multi.parts.find(part => part.leaf === 0)
    expect(first.box[3]).toBeGreaterThan(400)
  })
  it('stacks an enclosure in a narrow cell and throws when forced with a modifier', async () => {
    const narrow = await compose(sourceOf(), '⿰木⿹木口', { layout: 'cells' })
    const outer = narrow.parts.find(part => part.leaf === 1), inner = narrow.parts.find(part => part.leaf === 2)
    expect(outer.box[1] + outer.box[3]).toBeLessThanOrEqual(inner.box[1])
    // A side enclosure's inner part is shorter, and a three-row middle is narrower.
    const side = await compose(sourceOf(), '⿸木口', { layout: 'cells' })
    expect(side.parts[1].box[3]).toBeLessThan(side.parts[0].box[3] * 0.8)
    const rows = await compose(sourceOf(), '⿳木口木', { layout: 'cells' })
    expect(rows.parts[1].box[2]).toBeLessThan(rows.parts[0].box[2] * 0.9)
    // An empty slot has no ink to weigh with, so its axis keeps even leaf shares.
    const slots = await compose(sourceOf(), '⿱木⿲⬚木⬚', { layout: 'cells' })
    expect(slots.parts.find(part => part.leaf === 2).box[2]).toBeLessThan(400)
    expect(slots.slots.every(slot => slot.box[2] < 400)).toBe(true)
    const modified = '⿱⿴[1]木口⿲⿰木口⿰木口⿰木口'
    await expect(compose(sourceOf(), modified, { layout: 'cells' })).rejects.toThrow('modified operators')
  })
  it('keeps the composer for marks, exclusions and approximate operators, and forces cells only when asked', async () => {
    const sequence = '⿱⿰⿰木口⿰木口⿰⿰木口⿰木口'
    expect((await compose(sourceOf(), `${sequence}ˊ`)).cells).toBeUndefined()
    expect((await compose(sourceOf(), sequence, { exclude: ['永'] })).cells).toBeUndefined()
    const modified = '⿱⿴[1]木口⿲⿰木口⿰木口⿰木口'
    expect((await compose(sourceOf(), modified)).cells).toBeUndefined()
    await expect(compose(sourceOf(), `${sequence}ˊ`, { layout: 'cells' })).rejects.toThrow('loose marks')
  })
  it('keeps the reading order of cell leaves around an empty slot', async () => {
    const drawn = await compose(sourceOf(), '⿱⿰⿰木⬚⿰木口⿰⿰木口⿰木口')
    expect(drawn.cells).toBe(true)
    expect(drawn.parts.map(part => part.leaf)).toEqual([0, 2, 3, 4, 5, 6, 7])
    expect(drawn.slots).toHaveLength(1)
    expect(drawn.slots[0].index).toBe(0)
  })
  it('names the operators it draws beyond the composer, and credits KanjiVG only for its pieces', async () => {
    const source = sourceOf()
    expect((await compose(source, '⿾⿰木口')).approximate).toEqual(['⿾'])
    expect((await compose(source, '㇯⿼口木木')).approximate).toEqual(['㇯', '⿼'])
    const plain = await compose(source, '⿰木口')
    expect(plain.approximate).toEqual([])
    expect(plain.kanjivg).toBe(false)
  })
  it('writes each placed part as its own path, and unfolds a description drawn whole when asked', async () => {
    const whole = await compose(encodedSource(), '⿰木口')
    expect(whole.parts).toHaveLength(1)
    expect(whole.parts[0]).toMatchObject({ origin: 'glyph 𪱳', cut: false })
    expect(whole.parts[0].d.length).toBeGreaterThan(20)
    const split = await compose(encodedSource(), '⿰木口', { separate: true })
    expect(split.parts.map(part => part.origin)).toEqual(['glyph 木', 'glyph 口'])
    expect(split.d).toBe(split.parts.map(part => part.d).join(''))
    expect(await compose(encodedSource(), '⿰木口', { separate: true })).toEqual(split)
  })
  it('draws nothing larger than its limits', async () => {
    const chain = n => '⿰木'.repeat(n) + '口'
    const nest = n => n ? ['⿰', '木', nest(n - 1)] : '口'
    expect(LIMITS).toEqual({ nodes: 24, depth: 8 })
    expect(size({ op: '⿰', parts: ['木', { op: '⿱', parts: ['口', null] }] })).toEqual({ nodes: 2, depth: 2 })
    expect(tooLarge(nest(8))).toBe(false)
    expect(tooLarge(nest(9))).toBe(true)
    const biang = parse('⿺辶⿳穴⿰月⿰⿲⿱幺長⿱言馬⿱幺長刂心').tree
    expect(size(biang)).toEqual({ nodes: 8, depth: 6 })
    expect(tooLarge(biang)).toBe(false)
    const wide = { op: '⿲', parts: Array.from({ length: 5 }, () => ({ op: '⿲', parts: Array.from({ length: 3 }, () => ({ op: '⿰', parts: ['木', '口'] })) })) }
    expect(size(wide)).toEqual({ nodes: 21, depth: 3 })
    expect(tooLarge(wide)).toBe(false)
    expect(tooLarge({ op: '⿲', parts: [wide, wide, '口'] })).toBe(true)
    await expect(compose(sourceOf(), chain(9))).rejects.toThrow('larger than a preview draws')
  })
  it('fails when its manifest is missing or a file cannot be fetched', async () => {
    await expect(compose(createSource(async () => { throw new Error('manifest.json: 404') }), '⿰木口')).rejects.toThrow('404')
    const broken = createSource(async name => name === 'manifest.json' || name === 'layout.json' ? new Uint8Array(Buffer.from(files[name])).buffer : Promise.reject(new Error('network down')))
    await expect(compose(broken, '⿰木口')).rejects.toThrow('network down')
  })
  it('asks for at most ten files at once', async () => {
    let open = 0, most = 0
    const source = createSource(async name => {
      open++; most = Math.max(most, open)
      await Bun.sleep(5)
      open--
      const body = files[name]
      return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
    })
    await source.ready()
    await source.load(Array.from({ length: 20 }, (_, i) => `g/${i.toString(16).padStart(3, '0')}.json`))
    expect(most).toBe(10)
  })
})

// A worker that answers each drawing when told to, and notes when it is ended.
class FakeWorker {
  static made = []
  constructor() { this.posted = []; this.ended = false; FakeWorker.made.push(this) }
  postMessage(message) { this.posted.push(message) }
  terminate() { this.ended = true }
  answer(data) { this.onmessage?.({ data }) }
}

describe('the drawer', () => {
  it('ends the worker of a drawing a newer sequence replaces, and drops its late answer', async () => {
    FakeWorker.made = []
    const drawer = createDrawer(() => new FakeWorker(), 'https://example.org/composer/v/')
    const first = drawer.draw('⿰木口')
    const [one] = FakeWorker.made
    expect(one.posted[0]).toMatchObject({ sequence: '⿰木口', base: 'https://example.org/composer/v/' })
    const second = drawer.draw('⿱木口')
    expect(await first).toEqual({ status: 'cancelled' })
    expect(one.ended).toBe(true)
    const two = FakeWorker.made[1]
    one.answer({ id: one.posted[0].id, drawn: { d: 'M0 0Z' } })
    two.answer({ id: two.posted[0].id, drawn: { d: 'M1 1Z' } })
    expect(await second).toEqual({ status: 'composed', drawn: { d: 'M1 1Z' } })
  })
  it('reports a failed drawing, and a cancelled one', async () => {
    FakeWorker.made = []
    const drawer = createDrawer(() => new FakeWorker(), '/b/')
    const failing = drawer.draw('⿰木口')
    const [worker] = FakeWorker.made
    worker.answer({ id: worker.posted[0].id, error: 'No glyph or sequence draws 㐀.' })
    expect(await failing).toEqual({ status: 'failed', error: 'No glyph or sequence draws 㐀.' })
    const crashed = drawer.draw('⿱木口')
    worker.onerror({ message: 'boom', preventDefault() {} })
    expect(await crashed).toEqual({ status: 'failed', error: 'boom' })
    const left = drawer.draw('⿲木口木')
    drawer.cancel()
    expect(await left).toEqual({ status: 'cancelled' })
    expect(FakeWorker.made.every(w => w.ended)).toBe(true)
  })
})

describe('the preview badge', () => {
  it('says composing, preview, approximate, final, failed or too large', () => {
    expect(badge('loading')).toEqual({ label: 'loading', params: {} })
    expect(badge('capped')).toEqual({ label: 'tooLarge', params: {} })
    expect(badge('failed')).toEqual({ label: 'failed', params: {} })
    expect(badge('composed', { approximate: [] })).toEqual({ label: 'draft', params: {} })
    expect(badge('composed', { approximate: ['⿾', '㇯'] })).toEqual({ label: 'approximate', params: { ops: '⿾ ㇯' } })
    expect(badge('composed', { cells: true })).toEqual({ label: 'cells', params: {} })
    expect(badge('composed', { cells: true, approximate: ['⿼'] })).toEqual({ label: 'approximate', params: { ops: '⿼' } })
    expect(badge('final')).toEqual({ label: 'final', params: {} })
  })
})

// A layout that puts the two operands of ⿰ in fixed boxes, whatever they are: the network's weights
// are zero and its last biases are the boxes, in thousandths.
const LEFT = [40, -80, 440, 840], RIGHT = [560, -80, 960, 840]
const fixed = { ...layout, seeds: [[{ shape: [ops.length + 2 * 81, 8], data: Buffer.alloc(2 * (ops.length + 162) * 8).toString('base64') },
  Buffer.from(Float32Array.from([...LEFT, ...RIGHT].map(v => v / 1000)).buffer).toString('base64')]] }
const fixedSource = () => createSource(async name => {
  const body = name === 'layout.json' ? JSON.stringify(fixed) : files[name]
  return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
})

// Boxes to a hundredth of a unit: the layout's boxes come through float32 weights.
const near = box => box.map(v => Math.round(v * 100) / 100)
const nearSlots = slots => slots.map(s => ({ ...s, box: near(s.box) }))

describe('a host-less export', () => {
  // The serif export carries no host list: its records and layout are there, but no part is cut
  // from another character. Its learned boxes would stretch whole glyphs into component shapes, so
  // the composer lays every sequence out by its plain shares.
  const hostless = bytes => createSource(async name => {
    if (name === 'layout.json') return new Uint8Array(Buffer.from(JSON.stringify(fixed))).buffer
    if (name === 'manifest.json') {
      const manifest = JSON.parse(files['manifest.json'])
      return new Uint8Array(Buffer.from(JSON.stringify({ ...manifest, files: { ...manifest.files, hosts: { bytes } } }))).buffer
    }
    const body = files[name]
    return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
  })

  it('takes the plain shares for a node the host-place index leaves out', async () => {
    // A hosted export names the places it carries lists for; ⿰木口 has none of them.
    const source = createSource(async name => {
      if (name === 'layout.json') return new Uint8Array(Buffer.from(JSON.stringify(fixed))).buffer
      if (name === 'manifest.json') {
        const manifest = JSON.parse(files['manifest.json'])
        return new Uint8Array(Buffer.from(JSON.stringify({ ...manifest,
          files: { ...manifest.files, hosts: { bytes: 1, places: ['L\t口'] } } }))).buffer
      }
      const body = files[name]
      return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
    })
    const [left] = (await compose(source, '⿰木口')).parts
    expect(left.box[3]).toBeGreaterThan(900)
  })

  it('narrows a left part to the share the learned boxes give it', async () => {
    const narrow = { ...layout, seeds: [[{ shape: [ops.length + 2 * 81, 8], data: Buffer.alloc(2 * (ops.length + 162) * 8).toString('base64') },
      Buffer.from(Float32Array.from([40, -80, 360, 840, 420, -80, 960, 840].map(v => v / 1000)).buffer).toString('base64')]] }
    const source = createSource(async name => {
      if (name === 'layout.json') return new Uint8Array(Buffer.from(JSON.stringify(narrow))).buffer
      const body = name === 'manifest.json'
        ? JSON.stringify({ ...JSON.parse(files['manifest.json']), files: { ...JSON.parse(files['manifest.json']).files, hosts: { bytes: 0 } } })
        : files[name]
      return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
    })
    const [left, right] = (await compose(source, '⿰木口')).parts
    expect(left.box[2]).toBeLessThan(right.box[2] * 0.8)
    expect(left.box[3]).toBeCloseTo(right.box[3], 0)
  })

  it('lays a sequence out by its plain shares', async () => {
    const boxes = async bytes => (await compose(hostless(bytes), '⿰木口')).parts.map(part => part.box)
    const [plain, learned] = [await boxes(0), await boxes(1)]
    // The split follows the learned boxes at x 560; the glyphs fill the full height instead of the
    // learned part boxes, and stay apart.
    expect(learned[1][0]).toBeCloseTo(560, 0)
    expect(plain[1][0]).toBeCloseTo(563, 0)
    expect(plain[0][3]).toBeGreaterThan(learned[0][3] + 100)
    expect(plain[0][0] + plain[0][2]).toBeLessThan(plain[1][0])
    // The sketch the editor shows before a drawing arrives follows the same layout.
    const boxesOf = async bytes => (await sketch(hostless(bytes), '⿰木口')).map(leaf => leaf.box)
    expect((await boxesOf(1))[1][0]).toBeCloseTo(560, 0)
    expect((await boxesOf(0))[1][0]).toBeLessThan(540)
  })
})

describe('a character the export has no glyph for', () => {
  it('is drawn from its sequence and reported as missing', async () => {
    const hex = text => createHash('sha256').update(text).digest('hex')
    const extra = { [hex('甲')]: { k: '甲', s: '⿰木口' } }
    const name = `g/${hex('甲').slice(0, 3)}.json`
    const source = createSource(async file => {
      if (file === name) return new Uint8Array(gzipSync(JSON.stringify(extra))).buffer
      const body = files[file]
      return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
    })
    const drawn = await compose(source, '⿰甲木')
    expect(drawn.missing).toEqual(['甲'])
    expect(drawn.origins).toContain('glyph 口')
  })
})

describe('an empty slot', () => {
  it('composes: the filled parts as the whole sequence draws them, the slot a placeholder in its box', async () => {
    const source = fixedSource()
    const open = await compose(source, '⿰木⬚'), whole = await compose(source, '⿰木口')
    expect(open.d.length).toBeGreaterThan(20)
    expect(open.origins).toEqual(['glyph 木'])
    expect(open.parts[0].box).toEqual(whole.parts[0].box)
    expect(nearSlots(open.slots)).toEqual([{ index: 0, box: svgBox(RIGHT) }])
    expect(whole.slots).toEqual([])
    expect(open.stroke).toHaveLength(2)
  })
  it('is numbered in reading order, nested or not, and a tree of empty slots draws no ink', async () => {
    const source = fixedSource()
    const drawn = await compose(source, '⿰⬚⿱口⬚')
    expect(drawn.slots.map(s => s.index)).toEqual([0, 1])
    expect(near(drawn.slots[0].box)).toEqual(svgBox(LEFT))
    const empty = await compose(source, '⿰⬚⬚')
    expect(empty.d).toBe('')
    expect(empty.slots.map(s => near(s.box))).toEqual([svgBox(LEFT), svgBox(RIGHT)])
    expect((await compose(source, '⬚')).slots).toHaveLength(1)
  })
  it('stands where the layout puts it before anything is drawn', async () => {
    const leaves = await sketch(fixedSource(), '⿰木⬚')
    expect(nearSlots(leaves)).toEqual([{ index: 0, box: svgBox(LEFT), empty: false }, { index: 1, box: svgBox(RIGHT), empty: true }])
  })
  it('changes sides under ⿾ and ⿿ as the drawing does', async () => {
    const source = fixedSource()
    for (const op of ['⿾', '⿿']) {
      const leaves = await sketch(source, `${op}⿰木⬚`), drawn = await compose(source, `${op}⿰木⬚`)
      expect(near(leaves[1].box)).toEqual(near(drawn.slots[0].box))
      // The slot moves to the left, and 木 to the right.
      const [x, , w] = drawn.slots[0].box
      expect(x + w).toBeLessThan(drawn.parts[0].box[0] + 1)
      expect(x + w).toBeLessThan(520)
    }
  })
  it('is drawn as a rounded box inset by half a stroke, its dots a stroke apart', () => {
    const p = placeholder([100, 100, 400, 800], 80)
    expect(p).toMatchObject({ x: 140, y: 140, width: 320, height: 720 })
    expect(p.gap).toBeGreaterThan(p.dot)
    expect(p).not.toHaveProperty('plus')
  })
})


describe('the cover bar', () => {
  const rect = (x0, y0, x1, y1) => {
    const light = new Float64Array([x0, y0, x1, y0, x1, y1, x0, y1])
    return { ops: [], light, heavy: light.slice(), width: null }
  }
  const part = (...boxes) => {
    const p = makePart(boxes.map(([x0, y0, x1, y1]) => rect(x0, y0, x1, y1)))
    return placed(p, p.box, p.box, 0, 'test')
  }

  it('narrows and centres the top bar under 宀', () => {
    const cover = part([100, 500, 900, 700])
    const lower = part([50, 400, 950, 480], [480, 80, 520, 400], [50, 0, 950, 80])
    const donor = lower.part
    // Both masters are shared by placements; give the heavy master a distinct outline.
    donor.contours[0].heavy[0] -= 10
    const original = structuredClone(donor), sibling = placed(donor, donor.box, donor.box, 0, 'sibling')
    Composer.prototype.fitUnderCover.call(null, '⿱', ['宀', 'X'], [[cover], [lower]])
    expect(donor).toEqual(original)
    expect(sibling.part).toBe(donor)
    expect(lower.part.contours[0].light).not.toBe(donor.contours[0].light)
    expect(lower.part.contours[0].heavy).not.toBe(donor.contours[0].heavy)
    const bar = lower.part.contours[0].light
    let min = Infinity, max = -Infinity
    for (let i = 0; i < bar.length; i += 2) { min = Math.min(min, bar[i]); max = Math.max(max, bar[i]) }
    expect(max - min).toBeCloseTo(0.72 * 800)
    expect((max + min) / 2).toBeCloseTo(500)
  })

  const coverSource = () => {
    const cover = boxGlyph([100, 500, 900, 700])
    const lower = { ...boxGlyph([50, 0, 950, 480]), p: [
      ...boxGlyph([50, 400, 950, 480]).p,
      ...boxGlyph([480, 80, 520, 400]).p,
      ...boxGlyph([50, 0, 950, 80]).p,
    ] }
    const input = { ...files, ...shards('g', [
      ['宀', { k: '宀', G: cover, ink: 2000, nl: 1, o: 1 }],
      ['王', { k: '王', G: lower, ink: 4000, nl: 3, o: 3 }],
    ]) }
    return createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
  }

  it('renders a cover stack repeatedly from the same cached source', async () => {
    const source = coverSource()
    const first = await compose(source, '⿱宀王', { separate: true })
    expect(first.parts.map(p => p.origin)).toEqual(['glyph 宀', 'glyph 王'])
    expect(await compose(source, '⿱宀王', { separate: true })).toEqual(first)
    expect(await compose(source, '⿱宀王', { separate: true })).toEqual(first)
  })

  it('keeps other drawings from a shared source unchanged after a cover stack', async () => {
    const source = coverSource()
    const alone = await compose(source, '王')
    const stack = await compose(source, '⿱口王', { separate: true })
    await compose(source, '⿱宀王', { separate: true })
    expect(await compose(source, '王')).toEqual(alone)
    expect(await compose(source, '⿱口王', { separate: true })).toEqual(stack)
  })

  it('narrows 宇’s first lower bar under 宀', () => {
    const cover = part([80, 700, 842, 900])
    const lower = part([135, 564, 873, 636], [57, 336, 944, 408], [475, 408, 525, 636])
    Composer.prototype.fitUnderCover.call(null, '⿱', ['宀', '于'], [[cover], [lower]])
    const bar = lower.part.contours[0].light
    let min = Infinity, max = -Infinity
    for (let i = 0; i < bar.length; i += 2) { min = Math.min(min, bar[i]); max = Math.max(max, bar[i]) }
    expect(max - min).toBeCloseTo(0.72 * 762)
    expect((max + min) / 2).toBeCloseTo(461)
  })

  it('keeps a mid-height bar under a cover', () => {
    const cover = part([100, 500, 900, 700])
    const lower = part([50, 200, 950, 280], [480, 0, 520, 480])
    Composer.prototype.fitUnderCover.call(null, '⿱', ['宀', 'X'], [[cover], [lower]])
    const bar = lower.part.contours[0].light
    expect(bar[0]).toBe(50)
    expect(bar[2]).toBe(950)
  })
})

describe('the leading component under a cover', () => {
  const rect = (x0, y0, x1, y1) => {
    const light = new Float64Array([x0, y0, x1, y0, x1, y1, x0, y1])
    return { ops: [], light, heavy: light.slice(), width: null }
  }
  const part = (branch, ...boxes) => {
    const p = makePart(boxes.map(([x0, y0, x1, y1]) => rect(x0, y0, x1, y1)))
    return { ...placed(p, p.box, p.box, 0, 'test'), branch: [branch] }
  }
  const cover = () => part(0, [100, 500, 900, 700])
  // A net: a closed rectangle whose ink reaches both its sides along its top.
  const net = branch => part(branch, [50, 300, 950, 360], [50, 160, 110, 360], [890, 160, 950, 360], [50, 160, 950, 220])
  const clear = (child, ...lower) =>
    Composer.prototype.clearUnderCover.call({ partial: false, topOperand: Composer.prototype.topOperand },
      '⿱', ['宀', child], [[cover()], lower])
  const span = placedPart => [placedPart.target[0], placedPart.target[2]]

  it('narrows a flat-topped leading component to the cover’s bar width, keeping its height', () => {
    const head = net(0), base = part(1, [50, 0, 950, 60])
    const tall = head.target[3] - head.target[1]
    clear(['⿱', '罒', '一'], head, base)
    expect(span(head)[1] - span(head)[0]).toBeCloseTo(0.72 * 800)
    expect((span(head)[0] + span(head)[1]) / 2).toBeCloseTo(500)
    expect(head.target[3] - head.target[1]).toBeCloseTo(tall)
    expect(head.target[3]).toBeCloseTo(360)
  })

  it('leaves a base bar below the leading component as it was drawn', () => {
    const head = net(0), base = part(1, [50, 0, 950, 60])
    clear(['⿱', '罒', '一'], head, base)
    expect(span(base)).toEqual([50, 950])
  })

  it('leaves a leading component whose top does not reach its sides alone', () => {
    // 王: bars stacked inside the component's width, the top one the shortest.
    const head = part(0, [250, 300, 750, 360], [150, 160, 850, 220], [50, 20, 950, 80])
    const base = part(1, [50, 0, 950, 60])
    clear(['⿱', '王', '一'], head, base)
    expect(span(head)).toEqual([50, 950])
  })

  it('leaves a child drawn as one piece alone', () => {
    const whole = net(0)
    clear('𪟊', whole)
    expect(span(whole)).toEqual([50, 950])
  })

  it('narrows a mirrored part where it is drawn, not where its target sits', () => {
    const head = net(0), base = part(1, [50, 0, 950, 60])
    // A mirror centred away from the component, so its drawn box and its target differ.
    head.flips = [{ x: true, y: false, about: [300, 0] }]
    clear(['⿱', '⿾罒', '一'], head, base)
    const drawn = drawnBox(head)
    expect(drawn[2] - drawn[0]).toBeCloseTo(0.72 * 800)
    expect((drawn[0] + drawn[2]) / 2).toBeCloseTo(500)
  })

  it('leaves a row alone, which has no single leading component', () => {
    const head = net(0), other = part(1, [500, 0, 950, 600])
    clear(['⿰', '爿', '罒'], head, other)
    expect(span(head)).toEqual([50, 950])
  })
})


describe('a child contained by its cover', () => {
  const rect = (x0, y0, x1, y1) => {
    const light = new Float64Array([x0, y0, x1, y0, x1, y1, x0, y1])
    return { ops: [], light, heavy: light.slice(), width: null }
  }
  const part = (...boxes) => {
    const p = makePart(boxes.map(([x0, y0, x1, y1]) => rect(x0, y0, x1, y1)))
    return placed(p, p.box, p.box, 0, 'test')
  }
  // 宀: ink from 100 to 900, its side strokes reaching down to 500.
  const cover = () => part([100, 500, 900, 700])
  const contain = (op, children, groups) =>
    Composer.prototype.containUnderCover.call({ partial: false }, op, children, groups)
  const span = p => [p.target[0], p.target[2]]

  it('brings a child rising beside the cover’s side strokes in to the cover’s ink', () => {
    // A column standing up past the cover's left edge, as the 爿 of 㝲 does.
    const leg = part([20, 300, 120, 650]), rest = part([400, 300, 980, 650])
    contain('⿱', ['宀', ['⿰', '爿', '罒']], [[cover()], [leg, rest]])
    // 980 is the farthest from the middle, 480 out; it comes in to 420, the cover's half plus 5%.
    const factor = 420 / 480
    expect(span(leg)[0]).toBeCloseTo(500 + (20 - 500) * factor)
    expect(span(rest)[1]).toBeCloseTo(500 + (980 - 500) * factor)
  })

  it('keeps the child’s height and the middle it is centred on', () => {
    const leg = part([20, 300, 120, 650]), rest = part([400, 300, 980, 650])
    contain('⿱', ['宀', ['⿰', '爿', '罒']], [[cover()], [leg, rest]])
    expect(leg.target[1]).toBe(300)
    expect(rest.target[3]).toBe(650)
    expect((span(leg)[0] + span(rest)[1]) / 2).toBeCloseTo(500)
  })

  it('leaves ink that only spreads below the side strokes, as the foot of 木 in 宋 does', () => {
    const splay = part([400, 300, 600, 480], [20, 0, 980, 60])
    contain('⿱', ['宀', '木'], [[cover()], [splay]])
    expect(span(splay)).toEqual([20, 980])
  })

  it('leaves a child that reaches less than a twentieth past the cover', () => {
    const near = part([90, 300, 910, 650])
    contain('⿱', ['宀', '口'], [[cover()], [near]])
    expect(span(near)).toEqual([90, 910])
  })

  it('leaves a child already standing inside the cover', () => {
    const inside = part([300, 300, 700, 650])
    contain('⿱', ['宀', '子'], [[cover()], [inside]])
    expect(span(inside)).toEqual([300, 700])
  })

  it('contains under a cover lower in a stack as well as under the first', () => {
    const top = part([100, 800, 900, 900]), lower = part([20, 300, 980, 650])
    contain('⿳', ['艹', '冖', '帚'], [[top], [cover()], [lower]])
    expect(span(lower)[0]).toBeGreaterThan(20)
    expect(span(lower)[1]).toBeLessThan(980)
  })

  it('contains a mirrored part where it is drawn, not where its target sits', () => {
    const wide = part([20, 300, 980, 650])
    wide.flips = [{ x: true, y: false, about: [300, 0] }]
    contain('⿱', ['宀', '⿾X'], [[cover()], [wide]])
    // Drawn from −380 to 580: 880 out from the middle on the left, brought in to 420.
    const factor = 420 / 880, drawn = drawnBox(wide)
    expect(drawn[0]).toBeCloseTo(80)
    expect(drawn[2]).toBeCloseTo(500 + 80 * factor)
  })
})


describe('the foot of a stack under a cover', () => {
  const rect = (x0, y0, x1, y1) => {
    const light = new Float64Array([x0, y0, x1, y0, x1, y1, x0, y1])
    return { ops: [], light, heavy: light.slice(), width: null }
  }
  const part = (branch, gap, ...boxes) => {
    const p = makePart(boxes.map(([x0, y0, x1, y1]) => rect(x0, y0, x1, y1)))
    return { ...placed(p, p.box, p.box, 0, 'test'), branch: [branch], gap }
  }
  // A tail rising to a point, as the 𧘇 cut from 袁 does: no ink reaching its sides along its top.
  const tail = (branch, gap, y0, y1) => part(branch, gap, [460, y0, 540, y1], [200, y0, 800, y0 + 60])
  const join = (...lower) => Composer.prototype.joinUnderCover.call({ partial: false }, '⿱', ['宀', ['⿳', '罒', '一', '𧘇']], [[part(0, 0, [100, 500, 900, 700])], lower])
  const top = p => p.target[3]

  it('grows a tail its donor drew overlapping up to the bar above it', () => {
    const bar = part(1, 48, [50, 400, 950, 460]), foot = tail(2, -36, 0, 340)
    join(bar, foot)
    expect(top(foot)).toBe(400)
    expect(foot.target[1]).toBe(0)
  })

  it('leaves a foot its donor drew clear of its neighbour', () => {
    const bar = part(1, 48, [50, 400, 950, 460]), foot = tail(2, 30, 0, 340)
    join(bar, foot)
    expect(top(foot)).toBe(340)
  })

  it('leaves a flat-topped foot, as the base 一 of 𡩬 is', () => {
    const bar = part(1, 48, [50, 400, 950, 460]), base = part(2, -30, [50, 280, 950, 340])
    join(bar, base)
    expect(top(base)).toBe(340)
  })

  it('leaves a foot that already reaches what it hangs from', () => {
    const bar = part(1, 48, [50, 400, 950, 460]), foot = tail(2, -36, 0, 420)
    join(bar, foot)
    expect(top(foot)).toBe(420)
  })

  it('leaves a child drawn as a single operand', () => {
    const whole = tail(0, -36, 0, 340)
    join(whole)
    expect(top(whole)).toBe(340)
  })

  it('leaves a child drawn as a row, whose operands run across rather than down', () => {
    // ⿰: operand 0 is the left column, operand 1 the right, so neither hangs from the other.
    const left = part(0, 0, [50, 600, 450, 900])
    const right = { ...tail(1, -36, 100, 500), branch: [1] }
    Composer.prototype.joinUnderCover.call({ partial: false },
      '⿱', ['宀', ['⿰', 'X', 'Y']], [[part(0, 0, [100, 500, 900, 700])], [left, right]])
    expect(top(right)).toBe(500)
  })
})
