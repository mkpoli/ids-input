import { describe, expect, it } from 'bun:test'
import { composerPreview } from '../src/composer/index.js'
import { roughLayout } from '../src/svelte/preview.js'

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
    const drawing = draw('⿰木＋', { onSketch: leaves => sketches.push(leaves) })
    const [worker] = FakeWorker.made
    expect(worker.posted[0]).toMatchObject({ sequence: '⿰木＋', base: 'https://example.org/composer/v1/' })
    worker.answer({ id: worker.posted[0].id, sketch: [{ index: 0, box: [0, 0, 500, 1000], empty: false }] })
    worker.answer({ id: worker.posted[0].id, drawn: { d: 'M0 0Z', slots: [{ index: 0, box: [500, 0, 500, 1000] }] } })
    expect(await drawing).toEqual({ d: 'M0 0Z', slots: [{ index: 0, box: [500, 0, 500, 1000] }] })
    expect(sketches).toHaveLength(1)
  })
  it('refuses a description larger than it draws without asking the worker', async () => {
    const draw = preview()
    const error = await draw('⿰木⿰木⿰木⿰木⿰木口').catch(e => e)
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

describe('a composer base that is no URL', () => {
  it('makes each drawing fail, leaving the page running', async () => {
    const draw = composerPreview({ base: 'http://[', worker: () => new FakeWorker() })
    const error = await draw('⿰木口').catch(e => e)
    expect(error).toBeInstanceOf(TypeError)
  })
})
