// The browser composer's guards, on the small export of `fixtures/composer-export.js`, whose layout
// network is all zeros: two-operand nodes fall back to the composer's shares, which space and fit
// their parts with masks.
import { describe, expect, it } from 'bun:test'
import { createDrawer } from '../src/composer/client.js'
import { LIMITS, compose, createSource, size, sketch, svgBox, tooLarge } from '../src/composer/loader.js'
import { badge, placeholder } from '../src/core/preview.js'
import { files, layout, ops } from './fixtures/composer-export.js'

const sourceOf = (fetched = []) => createSource(async name => {
  fetched.push(name)
  const body = files[name]
  return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
})
const SEQUENCES = ['⿰木口', '⿱口木', '⿴口木', '⿲木口木', '⿱⿰木木口', '⿾⿰木口', '㇯口木', '⿼口木']

describe('the composer', () => {
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
  it('draws nothing larger than its limits', async () => {
    const chain = n => '⿰木'.repeat(n) + '口'
    expect(LIMITS).toEqual({ nodes: 12, depth: 4 })
    expect(size({ op: '⿰', parts: ['木', { op: '⿱', parts: ['口', null] }] })).toEqual({ nodes: 2, depth: 2 })
    expect(tooLarge(['⿰', '木', ['⿰', '木', ['⿰', '木', ['⿰', '木', '口']]]])).toBe(false)
    expect(tooLarge(['⿰', '木', ['⿰', '木', ['⿰', '木', ['⿰', '木', ['⿰', '木', '口']]]]])).toBe(true)
    const wide = { op: '⿲', parts: Array.from({ length: 3 }, () => ({ op: '⿲', parts: Array.from({ length: 3 }, () => ({ op: '⿰', parts: ['木', '口'] })) })) }
    expect(size(wide)).toEqual({ nodes: 13, depth: 3 })
    expect(tooLarge(wide)).toBe(true)
    await expect(compose(sourceOf(), chain(5))).rejects.toThrow('larger than a preview draws')
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
