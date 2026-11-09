// The project's curated descriptions lead the table; the source's spelling stays as an alternative.
import { expect, it } from 'bun:test'
import { babelStoneAdapter } from '../src/adapter/babelstone.js'

it('puts a curated description before the source it corrects', async () => {
  const source = new Map([['沀', [{ text: '⿰水予', sources: ['babelstone'] }]]])
  const adapter = babelStoneAdapter({
    table: source,
    project: 'https://example.test/ids-project.tsv',
    fetch: async () => new Response('沀\t⿰氵予\n'),
  })
  const table = await adapter.table()
  expect(table.get('沀')?.map(row => row.text)).toEqual(['⿰氵予', '⿰水予'])
})
