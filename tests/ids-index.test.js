import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { buildIdsIndex } from '../scripts/lib/ids-index.mjs'
import { cardSvg } from '../worker/card.js'
import { isEditorial } from '../worker/editorial.js'
import { metaFor } from '../worker/page.js'
import { readWith } from '../worker/render.js'

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

it('names a described Jurchen character', () => {
  expect(buildIdsIndex('', [read('jurchen')]).index['⿰\u{191C2}\u{18EB9}']).toBe('\u{19075}')
})

it('reads a sequence with a character only when the index does not say it composes it', () => {
  expect(readWith('\u{19075}', '\u{19075}')).toBeNull()
  expect(readWith('講', null)).toBe('講')
  expect(readWith('警', '儆')).toBe('警')
  expect(readWith(null, null)).toBeNull()
})

it('marks only a description of a script no source decomposes as editorial', () => {
  expect(isEditorial('⿰\u{191C2}\u{18EB9}', '\u{19075}')).toBe(true)
  expect(isEditorial('⿱\u{1B500}\u{1B525}', '\u{1B309}')).toBe(true)
  expect(isEditorial('\u{19075}', '\u{19075}')).toBe(false)
  expect(isEditorial('⿰釒哥', '鎶')).toBe(false)
  expect(isEditorial('⿱艹半', null)).toBe(false)
})

it('says so on the card and in the page', () => {
  const sequence = '⿰\u{191C2}\u{18EB9}', char = '\u{19075}'
  expect(cardSvg({ sequence, char })).toContain('data-editorial="true"')
  expect(cardSvg({ sequence: '⿰釒哥', char: '鎶' })).not.toContain('data-editorial')
  const origin = 'https://ids.mkpo.li'
  expect(metaFor({ sequence, char, origin }).tags).toContain('The description is an editorial reading of the glyph.')
  expect(metaFor({ sequence: '⿰釒哥', char: '鎶', origin }).tags).not.toContain('editorial')
})
