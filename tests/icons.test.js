import { expect, test } from 'bun:test'
import { createIconDrawings } from '../demo/lib/icons.js'

test('a failed drawing is asked again', async () => {
  let calls = 0
  const draw = createIconDrawings(async () => {
    if (++calls === 1) throw new Error('temporary')
    return { d: 'M0 0L1 1' }
  })
  expect(await draw('⿰木口')).toBeNull()
  expect(await draw('⿰木口')).toEqual({ d: 'M0 0L1 1' })
  expect(calls).toBe(2)
})

test('a drawing is cached, and a waiting sequence is asked once', async () => {
  let calls = 0
  const draw = createIconDrawings(async () => { calls++; await Bun.sleep(1); return { d: 'M0 0' } })
  const [a, b] = await Promise.all([draw('⿱木林'), draw('⿱木林')])
  expect(a).toEqual(b)
  expect(await draw('⿱木林')).toEqual({ d: 'M0 0' })
  expect(calls).toBe(1)
})

test('an aborted request leaves the queue before it is drawn', async () => {
  const calls = []
  const draw = createIconDrawings(async (sequence) => {
    calls.push(sequence)
    await Bun.sleep(5)
    return { d: sequence }
  })
  const first = draw('⿰木口')
  const controller = new AbortController()
  const second = draw('⿱木林', { signal: controller.signal })
  controller.abort()
  expect(await second).toBeNull()
  expect(await first).toEqual({ d: '⿰木口' })
  expect(calls).toEqual(['⿰木口'])
})

test('an aborted drawing in progress answers null', async () => {
  const draw = createIconDrawings((sequence, { signal } = {}) => new Promise((resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
  }))
  const controller = new AbortController()
  const answer = draw('⿰木口', { signal: controller.signal })
  controller.abort()
  expect(await answer).toBeNull()
})
