import { mount } from 'svelte'
import IdsSearch from '../../src/svelte/IdsSearch.svelte'

// Three hits whose character counts are 4, 8 and 12, so a stroke count keeps exactly one.
const hits = [
  { char: '木', sequence: '⿻十八', spans: [], score: 0 },
  { char: '林', sequence: '⿰木木', spans: [], score: 1 },
  { char: '森', sequence: '⿱木林', spans: [], score: 2 },
]
const adapter = {
  findByIds: async (query, { limit = 60 } = {}) => ({ hits: hits.slice(0, limit), total: hits.length }),
}
mount(IdsSearch, { target: document.querySelector('#fixture'), props: { adapter, query: '木', locale: 'en' } })
