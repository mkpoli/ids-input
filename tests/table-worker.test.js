// What reads the description tables is answered by the worker, which hosts an adapter of its own:
// the page parses no table, and the answers are the ones this thread would give.
import { expect, it } from 'bun:test'
import { babelStoneAdapter } from '../src/adapter/index.js'
import { answer } from '../src/adapter/table-worker.js'
import { turn } from '../src/core/search.js'

const TABLE = ['林\t⿰木木(GHTJKPV)', '森\t⿱木林(GHTJKPV)', '相\t⿰木目(GHTJKPV)', '想\t⿱相心(GHTJKPV)', '淋\t⿰氵林(GHTJKPV)', ''].join('\n')
const PROJECT = '淋\t⿰水林\n'
const at = (/** @type {string} */ text) => `data:text/plain,${encodeURIComponent(text)}`
const FILES = { ids: at(TABLE), project: at(PROJECT) }

/** A worker on this thread: each message reaches the worker's own handler in a later turn of the
 * event loop, and each answer comes back in a later one, as between two threads. */
function loopback() {
  /** @type {any[]} */
  const posted = []
  /** @type {any} */
  const worker = { posted, terminated: false, terminate() { worker.terminated = true },
    postMessage(/** @type {any} */ message) {
      posted.push(message)
      const sent = structuredClone(message)
      turn().then(() => answer(sent)).then(async reply => {
        await turn()
        if (reply && !worker.terminated) worker.onmessage?.({ data: structuredClone(reply) })
      })
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

it('answers a description search that waited for the index before the similar search asked ahead of it', async () => {
  const page = babelStoneAdapter({ ...FILES, worker: loopback })
  /** @type {string[]} */
  const answered = []
  await Promise.all([
    page.findSimilar('⿰木目', { limit: 9 }).then(() => answered.push('similar')),
    page.findByIds('木 目', { limit: 9 }).then(() => answered.push('ids')),
  ])
  expect(answered).toEqual(['ids', 'similar'])
})

it('stands the index build aside while questions keep arriving', async () => {
  // Enough characters that the index takes several slices.
  const many = Array.from({ length: 40000 }, (_, i) => `${String.fromCodePoint(0x20000 + i)}\t⿰⿱木${String.fromCodePoint(0x4E00 + i % 20000)}${String.fromCodePoint(0x4E00 + i % 977)}`).join('\n')
  const page = babelStoneAdapter({ ids: at(`${TABLE}${many}\n`), worker: loopback })
  await page.structure('林')
  let found = false
  const search = page.findByIds('木 目', { limit: 9 }).then(result => { found = true; return result })
  // One question after another, each asked on the answer before: all are answered before the search.
  let answers = 0
  for (let i = 0; i < 40; i++) { await page.structure('森'); if (!found) answers++ }
  expect(answers).toBe(40)
  expect((await search).hits.map(hit => hit.char)).toContain('相')
})
