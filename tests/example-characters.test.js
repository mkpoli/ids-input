// The workshop draws an example built on an operator the composer only approximates (⿾正) as the
// character the example names, without asking the corpus. That stands only while the corpus would
// answer the same: the first character it finds for the sequence, or none.
import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { APPROXIMATE } from '@han-compose/composer/compose'
import { smallSealAdapter } from '../src/adapter/index.js'
import { EXAMPLES } from '../demo/lib/examples.js'

const data = name => new URL(`../data/${name}`, import.meta.url)
// The files as the page fetches them: a .gz file arrives as the bytes it is.
const fetchLocal = async url => new Response(readFileSync(new URL(String(url))))

it('names for each approximate example the character the corpus answers first', async () => {
  const adapter = smallSealAdapter({ data: data('small-seal.json.gz'), shuishu: data('shuishu.json.gz'), jurchen: data('jurchen.json.gz'),
    ids: data('babelstone-ids.tsv.gz'), layers: data('tangut-layers.json.gz'), zitools: data('yi-bai-ids.tsv.gz'), chise: data('ids-corpus.json.gz'),
    project: data('ids-project.tsv.gz'), overwrite: data('ids-overwrites.tsv'), components: data('ids-components.tsv'), fetch: fetchLocal, worker: null })
  const approximate = EXAMPLES.filter(({ sequence }) => !sequence.includes('[') && APPROXIMATE.some(operator => sequence.includes(operator)))
  expect(approximate.length).toBeGreaterThan(0)
  expect(approximate[0].sequence).toBe(EXAMPLES[0].sequence)
  for (const { sequence, char } of approximate) {
    const [named] = await adapter.encoded(sequence)
    expect([sequence, named ?? '']).toEqual([sequence, char])
  }
}, 60_000)
