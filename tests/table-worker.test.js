// What reads the description tables is answered by the worker, which hosts an adapter of its own:
// the page parses no table, and the answers are the ones this thread would give.
import { expect, it } from 'bun:test'
import { babelStoneAdapter } from '../src/adapter/index.js'
import { answer } from '../src/adapter/table-worker.js'

const TABLE = ['林\t⿰木木(GHTJKPV)', '森\t⿱木林(GHTJKPV)', '相\t⿰木目(GHTJKPV)', '想\t⿱相心(GHTJKPV)', '淋\t⿰氵林(GHTJKPV)', ''].join('\n')
const PROJECT = '淋\t⿰水林\n'
const at = (/** @type {string} */ text) => `data:text/plain,${encodeURIComponent(text)}`
const FILES = { ids: at(TABLE), project: at(PROJECT) }

/** A worker on this thread: each message goes to the worker's own handler, each answer comes back in a later turn. */
function loopback() {
  /** @type {any[]} */
  const posted = []
  /** @type {any} */
  const worker = { posted, terminated: false, terminate() { worker.terminated = true },
    postMessage(/** @type {any} */ message) {
      posted.push(message)
      answer(structuredClone(message)).then(reply => { if (reply && !worker.terminated) worker.onmessage?.({ data: structuredClone(reply) }) })
    } }
  return worker
}

it('answers what reads the tables as this thread would, and the page downloads none of them', async () => {
  // The worker's adapter runs on this thread here: a table the page read as well would be downloaded twice.
  /** @type {string[]} */
  const downloaded = []
  const realFetch = globalThis.fetch
  globalThis.fetch = /** @type {typeof fetch} */ (async (url, init) => { downloaded.push(String(url)); return realFetch(url, init) })
  const worker = loopback()
  const page = babelStoneAdapter({ ...FILES, worker: () => worker })
  const answers = [await page.structure('森'), await page.encoded('⿱⿰木目心'), await page.findByIds('木 目', { limit: 9 }),
    await page.findByStructure('⿰木？', { limit: 9 }), await page.findSimilar('⿰木目', { limit: 9 }), await page.containing('林'), await page.table()]
  expect((await page.structure('淋')).map(sequence => sequence.text)).toEqual(['⿰水林', '⿰氵林'])
  expect(await page.encoded('⿰木木')).toEqual(['林'])
  globalThis.fetch = realFetch
  expect(downloaded.sort()).toEqual([FILES.ids, FILES.project].sort())
  const here = babelStoneAdapter({ ...FILES, worker: null })
  expect(answers).toEqual([await here.structure('森'), await here.encoded('⿱⿰木目心'), await here.findByIds('木 目', { limit: 9 }),
    await here.findByStructure('⿰木？', { limit: 9 }), await here.findSimilar('⿰木目', { limit: 9 }), await here.containing('林'), await here.table()])
  expect(answers[2].hits.length).toBeGreaterThan(0)
  // The files go once, before the first question; each question names a method and its arguments.
  expect(worker.posted[0]).toEqual({ files: expect.objectContaining(FILES) })
  expect(worker.posted[1]).toEqual({ id: 1, method: 'structure', args: ['森'] })
  expect(worker.posted.filter((/** @type {any} */ message) => message.files)).toHaveLength(1)
})

it('keeps the signal on the page: an answer nobody waits for is dropped', async () => {
  const page = babelStoneAdapter({ ...FILES, worker: loopback })
  const gone = new AbortController()
  const asked = page.encoded('⿰木木', { signal: gone.signal })
  gone.abort()
  await expect(asked).rejects.toThrow()
  expect(await page.encoded('⿰木木')).toEqual(['林'])
})

it('answers a host that passes its own table or its own fetch on this thread', async () => {
  const worker = loopback()
  const given = babelStoneAdapter({ table: new Map([['林', [{ text: '⿰木木', regions: '' }]]]), worker: () => worker })
  expect(await given.encoded('⿰木木')).toEqual(['林'])
  const fetched = babelStoneAdapter({ ids: 'ids.tsv', worker: () => worker, fetch: async () => new Response(TABLE) })
  expect(await fetched.encoded('⿰木木')).toEqual(['林'])
  expect(worker.posted).toEqual([])
})

it('reports what the worker could not do, and gives the next worker its files', async () => {
  /** @type {any[]} */
  const made = []
  const page = babelStoneAdapter({ ...FILES, worker: () => { const worker = loopback(); made.push(worker); return worker } })
  const broken = babelStoneAdapter({ ...FILES, chise: at('not a catalogue'), worker: loopback })
  await expect(broken.structure('林')).rejects.toThrow()
  expect(await answer({ id: 7, method: 'nothing', args: [] })).toEqual({ id: 7, error: expect.any(String) })
  expect(await page.structure('林')).toHaveLength(1)
  // A worker that fails is replaced on the next question.
  made[0].onerror({ preventDefault() {} })
  expect(made[0].terminated).toBe(true)
  expect(await page.encoded('⿰木木')).toEqual(['林'])
  expect(made).toHaveLength(2)
  expect(made[1].posted[0]).toEqual({ files: expect.objectContaining(FILES) })
})
