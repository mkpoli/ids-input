import { describe, expect, it } from 'bun:test'
import { composerPreview } from '../src/composer/index.js'
import { roughLayout, runPreview } from '../src/core/preview.js'

// A worker that answers each drawing when told to, and notes when it is ended.
class FakeWorker {
  static made = []
  constructor() { this.posted = []; this.ended = false; FakeWorker.made.push(this) }
  postMessage(message) { this.posted.push(message) }
  terminate() { this.ended = true }
  answer(data) { this.onmessage?.({ data }) }
}
const preview = () => { FakeWorker.made = []; return composerPreview({ base: 'https://example.org/composer/v1', worker: () => new FakeWorker() }) }

describe('the composer preview', () => {
  it('draws in a worker from the export at its base, hearing the sketch first', async () => {
    const draw = preview(), sketches = []
    const drawing = draw('⿰木⬚', { onSketch: leaves => sketches.push(leaves) })
    const [worker] = FakeWorker.made
    expect(worker.posted[0]).toMatchObject({ sequence: '⿰木⬚', base: 'https://example.org/composer/v1/' })
    worker.answer({ id: worker.posted[0].id, sketch: [{ index: 0, box: [0, 0, 500, 1000], empty: false }] })
    worker.answer({ id: worker.posted[0].id, drawn: { d: 'M0 0Z', slots: [{ index: 0, box: [500, 0, 500, 1000] }] } })
    expect(await drawing).toEqual({ d: 'M0 0Z', slots: [{ index: 0, box: [500, 0, 500, 1000] }] })
    expect(sketches).toHaveLength(1)
  })
  it('answers a sequence it has drawn before from memory, sketch included', async () => {
    const draw = preview(), sketches = []
    const first = draw('⿱木林', { onSketch: leaves => sketches.push(leaves) })
    const [worker] = FakeWorker.made
    const sketch = [{ index: 0, box: [0, 0, 500, 1000], empty: false }]
    worker.answer({ id: worker.posted[0].id, sketch })
    worker.answer({ id: worker.posted[0].id, drawn: { d: 'M0 0Z' } })
    expect(await first).toEqual({ d: 'M0 0Z' })
    expect(await draw('⿱木林', { onSketch: leaves => sketches.push(leaves) })).toEqual({ d: 'M0 0Z' })
    expect(worker.posted).toHaveLength(1)
    expect(sketches).toEqual([sketch, sketch])
  })
  it('warms the worker on the export before the first drawing', async () => {
    const draw = preview()
    draw.warm()
    const [worker] = FakeWorker.made
    expect(worker.posted[0]).toMatchObject({ warm: true, base: 'https://example.org/composer/v1/' })
    worker.answer({ id: worker.posted[0].id, warm: true })
    const drawing = draw('⿱木口')
    expect(FakeWorker.made).toHaveLength(1)
    worker.answer({ id: worker.posted.at(-1).id, drawn: { d: 'M2 2Z' } })
    expect(await drawing).toEqual({ d: 'M2 2Z' })
  })
  it('asks the worker to separate every operand when told to', async () => {
    FakeWorker.made = []
    const draw = composerPreview({ base: 'https://example.org/composer/v1', separate: true, worker: () => new FakeWorker() })
    draw('⿱木口')
    const [worker] = FakeWorker.made
    expect(worker.posted[0]).toMatchObject({ sequence: '⿱木口', separate: true })
  })
  it('refuses a description larger than it draws without asking the worker', async () => {
    const draw = preview()
    const error = await draw('⿰木'.repeat(9) + '口').catch(e => e)
    expect(error.name).toBe('TooLargeError')
    expect(FakeWorker.made).toHaveLength(0)
  })
  it('rejects as aborted when its signal aborts, and as failed with the reason the worker gives', async () => {
    const draw = preview(), controller = new AbortController()
    const drawing = draw('⿰木口', { signal: controller.signal })
    controller.abort()
    expect((await drawing.catch(e => e)).name).toBe('AbortError')
    expect(FakeWorker.made[0].ended).toBe(true)
    const failing = draw('⿱木口')
    const worker = FakeWorker.made[1]
    worker.answer({ id: worker.posted[0].id, error: 'manifest.json: Failed to fetch' })
    expect((await failing.catch(e => e)).message).toBe('manifest.json: Failed to fetch')
  })
  it('lets an aborted older drawing leave the newer one alone', async () => {
    const draw = preview(), old = new AbortController()
    const first = draw('⿰木口', { signal: old.signal })
    const second = draw('⿱木口')
    expect((await first.catch(e => e)).name).toBe('AbortError')
    old.abort()
    const worker = FakeWorker.made.at(-1)
    worker.answer({ id: worker.posted.at(-1).id, drawn: { d: 'M1 1Z' } })
    expect(await second).toEqual({ d: 'M1 1Z' })
  })
})

it('draws Tangut after an invalid Han warmup while still rejecting Han requests', async () => {
  FakeWorker.made = []
  const draw = composerPreview({ base: 'http://[', worker: () => new FakeWorker() })
  draw.warm()
  expect(FakeWorker.made).toHaveLength(0)
  const request = draw('⿰𘠀𘠁')
  const worker = FakeWorker.made[0]
  worker.answer({ id: worker.posted[0].id, drawn: { d: 'M0 0Z' } })
  expect(await request).toEqual({ d: 'M0 0Z' })
  expect((await draw('⿰木口').catch(error => error)).name).toBe('UnavailableError')
})

describe('the rough layout', () => {
  it('splits rows and columns evenly, encloses, and mirrors what ⿾ holds', () => {
    expect(roughLayout({ op: '⿰', parts: ['木', null] }).map(l => l.box)).toEqual([[0, 0, 0.5, 1], [0.5, 0, 1, 1]])
    expect(roughLayout({ op: '⿳', parts: ['一', '二', null] }).map(l => l.box[1])).toEqual([0, 1 / 3, 2 / 3])
    const [outer, inner] = roughLayout({ op: '⿴', parts: ['口', null] })
    expect(outer.box).toEqual([0, 0, 1, 1])
    expect(inner.char).toBeNull()
    const [left] = roughLayout({ op: '⿾', parts: [{ op: '⿰', parts: ['木', '口'] }] })
    expect(left).toMatchObject({ char: '木', box: [0.5, 0, 1, 1], flip: [true, false] })
    expect(roughLayout(null)).toEqual([{ char: null, box: [0, 0, 1, 1], flip: [false, false], cut: false }])
  })
})

describe('an export that cannot be read', () => {
  it('is unavailable, not a failed drawing: a base that is no URL, or a manifest the worker could not load', async () => {
    const draw = composerPreview({ base: 'http://[', worker: () => new FakeWorker() })
    expect((await draw('⿰木口').catch(e => e)).name).toBe('UnavailableError')
    const reach = preview()
    const asked = reach('⿰木口')
    const [worker] = FakeWorker.made
    worker.answer({ id: worker.posted[0].id, error: 'manifest.json: 404', unavailable: true })
    expect((await asked.catch(e => e)).name).toBe('UnavailableError')
    const fails = reach('⿱木口')
    const next = FakeWorker.made.at(-1)
    next.answer({ id: next.posted.at(-1).id, error: 'No glyph or sequence draws 㐀.' })
    expect((await fails.catch(e => e)).name).toBe('Error')
  })
})

describe('a preview turn', () => {
  const later = value => new Promise(resolve => setTimeout(() => resolve(value), 1))
  const run = (text, asking) => new Promise(resolve => {
    const seen = []
    runPreview(text, { signal: new AbortController().signal, ...asking }, patch => seen.push(patch))
    setTimeout(() => resolve(seen), 20)
  })
  it('with only a final image, shows nothing for an incomplete description or a missing image', async () => {
    const drawing = () => later('https://example.org/a.svg')
    expect(await run('⿰木⬚', { drawing })).toEqual([{ step: 'idle' }])
    expect(await run('⿰木口', { drawing: () => later(null) })).toEqual([{ step: 'idle' }])
    expect(await run('⿰木口', { drawing: () => Promise.reject(new Error('down')) })).toEqual([{ step: 'idle' }])
    expect(await run('⿰木口', { drawing })).toEqual([{ step: 'final', url: 'https://example.org/a.svg' }])
  })
  it('prefers a final image to a drawing, and says when a drawing fails or is too large', async () => {
    const preview = () => later({ d: 'M0 0Z' })
    expect(await run('⿰木口', { preview, drawing: () => Promise.resolve('u') })).toEqual([{ step: 'final', url: 'u' }])
    expect(await run('⿰木⬚', { preview, drawing: () => Promise.resolve('u') })).toEqual([{ step: 'composed', drawn: { d: 'M0 0Z' } }])
    expect(await run('⿰木口', { preview: () => Promise.reject(new Error('x')) })).toEqual([{ step: 'failed' }])
    expect(await run('⿰木口', { preview: () => Promise.reject(Object.assign(new Error('x'), { name: 'TooLargeError' })) })).toEqual([{ step: 'capped' }])
    expect(await run('⿰木口', { preview: () => Promise.reject(Object.assign(new Error('x'), { name: 'UnavailableError' })) })).toEqual([{ step: 'unavailable' }])
  })
  it('hands nothing over once aborted', async () => {
    const controller = new AbortController(), seen = []
    runPreview('⿰木口', { signal: controller.signal, preview: () => later({ d: 'M0 0Z' }) }, patch => seen.push(patch))
    controller.abort()
    await later()
    await later()
    expect(seen).toEqual([])
  })
})


it('places emoji sequences in their slots while retaining real empty slots', async () => {
  const draw = preview()
  const result = draw('⿲👩🏽‍💻⬚木')
  const [worker] = FakeWorker.made
  expect(worker.posted[0].sequence).toBe('⿲⬚⬚木')
  worker.answer({ id: worker.posted[0].id, drawn: { d: 'M0 0Z', slots: [{ index: 0, box: [0, 0, 300, 1000] }, { index: 1, box: [300, 0, 300, 1000] }] } })
  expect(await result).toMatchObject({ emoji: [{ text: '👩🏽‍💻', box: [0, 0, 300, 1000] }], slots: [{ index: 0, box: [300, 0, 300, 1000] }] })
})

it('rejects emoji transformations without rejecting unrelated transformed components', async () => {
  const draw = preview()
  await expect(draw('⿾👩🏽‍💻')).rejects.toThrow('Emoji cannot yet be mirrored')
  const result = draw('⿰⿾木👩🏽‍💻')
  const [worker] = FakeWorker.made
  worker.answer({ id: worker.posted[0].id, drawn: { d: 'M0 0Z', slots: [{ index: 0, box: [500, 0, 500, 1000] }] } })
  expect((await result).emoji[0].text).toBe('👩🏽‍💻')
})
