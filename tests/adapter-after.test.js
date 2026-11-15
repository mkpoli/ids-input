// A page with something to show first holds the description tables back: `after` is the promise
// they and the worker that reads them wait for.
import { expect, it } from 'bun:test'
import { babelStoneAdapter } from '../src/adapter/index.js'

const TABLE = '林\t⿰木木(GHTJKPV)\n'
const OVERWRITE = '⿰𦚏𳳳\t龍\ttest\n'
const pause = () => new Promise(resolve => setTimeout(resolve, 20))

it('holds the four description tables until the promise settles, and no other file', async () => {
  const asked = []
  let release
  const after = new Promise(resolve => { release = resolve })
  const adapter = babelStoneAdapter({ ids: 'ids', zitools: 'zitools', project: 'project', overwrite: 'overwrite', after, worker: null,
    fetch: async url => { asked.push(url); return new Response(url === 'overwrite' ? OVERWRITE : url === 'ids' ? TABLE : '') } })
  expect(await adapter.overwrite('⿰𦚏𳳳')).toEqual(['龍'])
  const found = adapter.encoded('⿰木木')
  await pause()
  expect(asked).toEqual(['overwrite'])
  release()
  expect(await found).toEqual(['林'])
  expect(asked.sort()).toEqual(['ids', 'overwrite', 'project', 'zitools'])
})

it('holds the merged catalogue with them', async () => {
  const asked = []
  let release
  const after = new Promise(resolve => { release = resolve })
  const adapter = babelStoneAdapter({ ids: 'ids', chise: 'chise', after, worker: null,
    fetch: async url => { asked.push(url); return new Response(url === 'ids' ? TABLE : '', { status: url === 'ids' ? 200 : 404 }) } })
  const found = adapter.encoded('⿰木木').catch(() => 'failed')
  await pause()
  expect(asked).toEqual([])
  release()
  await found
  expect(asked.sort()).toEqual(['chise', 'ids'])
})

it('reads the tables once the promise rejects, and not before', async () => {
  const asked = []
  let refuse
  const after = new Promise((_, reject) => { refuse = reject })
  const adapter = babelStoneAdapter({ ids: 'ids', after, worker: null, fetch: async url => { asked.push(url); return new Response(TABLE) } })
  const found = adapter.encoded('⿰木木')
  await pause()
  expect(asked).toEqual([])
  refuse(new Error('nothing was drawn'))
  expect(await found).toEqual(['林'])
})

it('starts the table worker once the promise settles', async () => {
  const posted = []
  /** @type {any} */
  const worker = { postMessage: message => posted.push(message), terminate() {} }
  let started = 0, release
  const after = new Promise(resolve => { release = resolve })
  const adapter = babelStoneAdapter({ ids: 'https://example.test/ids', after, worker: () => { started++; return worker } })
  const found = adapter.findByIds('⿰木木')
  await pause()
  expect(started).toBe(0)
  release()
  await pause()
  expect(started).toBe(1)
  // Its files, then the question.
  expect(posted).toHaveLength(2)
  worker.onmessage({ data: { id: posted[1].id, result: [] } })
  expect(await found).toEqual([])
})
