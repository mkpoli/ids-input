import { expect, test } from 'bun:test'
import { createDrawingOrder } from '../demo/lib/drawing-order.js'

const settle = () => Bun.sleep(1)

test('a drawing asked for while the main one loads starts when it is done', async () => {
  const order = createDrawingOrder()
  /** @type {string[]} */
  const drawn = []
  const draw = order.after(async sequence => { drawn.push(sequence); return sequence })
  order.hold(true)
  const answer = draw('⿰木口')
  await settle()
  expect(drawn).toEqual([])
  order.hold(false)
  expect(await answer).toBe('⿰木口')
  expect(drawn).toEqual(['⿰木口'])
})

test('a drawing asked for with nothing loading starts at once', async () => {
  const order = createDrawingOrder()
  const draw = order.after(async sequence => sequence)
  expect(await draw('⿱艹木')).toBe('⿱艹木')
})

test('a drawing waits again when the main one loads anew before its turn', async () => {
  const order = createDrawingOrder()
  let calls = 0
  const draw = order.after(async () => ++calls)
  order.hold(true)
  const answer = draw('⿰亻哥')
  order.hold(false)
  order.hold(true)
  await settle()
  expect(calls).toBe(0)
  order.hold(false)
  expect(await answer).toBe(1)
})

test('a drawing aborted while it waits never starts', async () => {
  const order = createDrawingOrder()
  let calls = 0
  const draw = order.after(async () => ++calls)
  const controller = new AbortController()
  order.hold(true)
  const answer = draw('⿰木口', { signal: controller.signal })
  controller.abort()
  order.hold(false)
  expect(answer).rejects.toThrow()
  await settle()
  expect(calls).toBe(0)
})
