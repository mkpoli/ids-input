// A page with something to show first holds the description tables back: `after` is the promise
// they and the search worker wait for.
import { expect, it } from 'bun:test'
import { babelStoneAdapter } from '../src/adapter/index.js'

const TABLE = '林\t⿰木木(GHTJKPV)\n'
const OVERWRITE = '⿰𦚏𳳳\t龍\ttest\n'
const pause = () => new Promise(resolve => setTimeout(resolve, 20))

it('holds the description tables until the promise settles, and no other file', async () => {
  const asked = []
  let release
  const after = new Promise(resolve => { release = resolve })
  const adapter = babelStoneAdapter({ ids: 'ids', overwrite: 'overwrite', after, worker: null,
    fetch: async url => { asked.push(url); return new Response(url === 'overwrite' ? OVERWRITE : TABLE) } })
  expect(await adapter.overwrite('⿰𦚏𳳳')).toEqual(['龍'])
  const found = adapter.encoded('⿰木木')
  await pause()
  expect(asked).toEqual(['overwrite'])
  release()
  expect(await found).toEqual(['林'])
  expect(asked).toEqual(['overwrite', 'ids'])
})

it('reads the tables after a promise that rejects', async () => {
  const adapter = babelStoneAdapter({ ids: 'ids', after: Promise.reject(new Error('nothing was drawn')), worker: null,
    fetch: async () => new Response(TABLE) })
  expect(await adapter.encoded('⿰木木')).toEqual(['林'])
})

it('starts the search worker once the promise settles', async () => {
  const posted = []
  /** @type {any} */
  const worker = { postMessage: message => posted.push(message), terminate() {} }
  let started = 0, release
  const after = new Promise(resolve => { release = resolve })
  const adapter = babelStoneAdapter({ ids: 'https://example.test/ids', after, worker: () => { started++; return worker },
    fetch: async () => new Response(TABLE) })
  const found = adapter.findByIds('⿰木木')
  await pause()
  expect(started).toBe(0)
  release()
  await pause()
  expect(started).toBe(1)
  expect(posted).toHaveLength(1)
  worker.onmessage({ data: { id: posted[0].id, result: [] } })
  expect(await found).toEqual([])
})
