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
