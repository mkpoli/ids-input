import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { buildIdsIndex } from '../scripts/lib/ids-index.mjs'
import { unitsFor } from '../worker/render.js'

const read = name => JSON.parse(gunzipSync(readFileSync(new URL(`../data/${name}.json.gz`, import.meta.url))))

it('reads every description a row lists, and keeps the first character for each', () => {
  const { index, rows } = buildIdsIndex('# note\n鎶\t⿰釒哥(GTJV) ⿰金哥(K)\n㑖\t⿰釒哥(G)\n')
  expect(rows).toBe(2)
  expect(index).toEqual({ '⿰釒哥': '鎶', '⿰金哥': '鎶' })
})

it('names the characters of the editorial descriptions, behind the table', () => {
  const docs = [read('shuishu'), read('jurchen')]
  const { index } = buildIdsIndex('', docs)
  for (const { parts } of docs) for (const { part, ids } of parts) if (ids) expect(index[ids]).toBe(part)
  const held = buildIdsIndex('字\t⿰甲乙(G)\n', [{ parts: [{ part: '丙', ids: '⿰甲乙' }, { part: '丁', ids: null }] }])
  expect(held.index).toEqual({ '⿰甲乙': '字' })
})

it('names a described Jurchen character, which its card then draws whole', async () => {
  const sequence = '⿰\u{191C2}\u{18EB9}'
  expect(buildIdsIndex('', [read('jurchen')]).index[sequence]).toBe('\u{19075}')
  // A sequence that composes the character it names is one unit, not that character and its parts.
  expect(await unitsFor({}, sequence, null)).toEqual([sequence])
})
