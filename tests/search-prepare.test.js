// The search index can be built in slices, for a thread with other callers to answer between them.
import { expect, it } from 'bun:test'
import { createSearch } from '../src/core/search.js'

const TABLE = ['林\t⿰木木', '森\t⿱木林', '相\t⿰木目', '想\t⿱相心', '淋\t⿰氵林'].join('\n')

it('builds the index in slices with a turn of the event loop between them, and builds the same index', async () => {
  const table = new Map(TABLE.split('\n').map(line => { const [char, text] = line.split('\t'); return [char, [text]] }))
  const whole = createSearch(table), sliced = createSearch(table)
  let turns = 0
  await sliced.prepare({ slice: 0, pause: async () => { turns++ } })
  expect(turns).toBeGreaterThan(1)
  for (const query of ['木', '木 目', '⿰木？', '林 心']) expect(sliced.search(query)).toEqual(whole.search(query))
  // A search that arrives between two slices finishes the index itself.
  const interrupted = createSearch(table)
  /** @type {unknown} */
  let between
  await interrupted.prepare({ slice: 0, pause: async () => { between ??= interrupted.search('木 目') } })
  expect(between).toEqual(whole.search('木 目'))
  expect(interrupted.search('林 心')).toEqual(whole.search('林 心'))
})
