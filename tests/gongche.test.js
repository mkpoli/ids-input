import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { NOTES, REGIONAL_NOTES, MODIFIERS, ENCODED, notation, selectionFrom, selectionUrl } from '../demo/lib/gongche.js'
import { parse, write } from '../src/core/ids.js'
import { parseIdsTable } from '../src/adapter/babelstone.js'

it('composes every offered note and modifier as a complete IDS', () => {
  for (const note of [...NOTES, ...REGIONAL_NOTES]) for (const part of MODIFIERS) {
    const item = notation(note, part)
    expect(parse(item.sequence, { open: true }).problem).toBeUndefined()
    expect(write(parse(item.sequence, { open: true }).tree)).toBe(item.sequence)
    if (part === '') expect(item.char).toBe(note)
  }
  expect(notation('木', '亻')).toBeNull()
  expect(notation('工', '木')).toBeNull()
})

it('uses exact corpus decompositions for encoded counterparts', () => {
  const corpus = parseIdsTable(gunzipSync(readFileSync(new URL('../data/babelstone-ids.tsv.gz', import.meta.url))).toString())
  for (const [sequence, char] of Object.entries(ENCODED)) {
    expect([...char]).toHaveLength(1)
    expect(corpus.get(char).some(item => item.text === sequence)).toBe(true)
  }
  expect(notation('工', '亻')).toMatchObject({ char: '仜', codepoint: 'U+4EDC' })
  expect(notation('工', '⿰氵氵')).toMatchObject({ char: '', sequence: '⿰⿰氵氵工' })
})

it('round-trips page selections and rejects unsupported URL values', () => {
  for (const note of [...NOTES, ...REGIONAL_NOTES]) for (const part of MODIFIERS) {
    const chosen = notation(note, part)
    const url = new URL(selectionUrl(chosen, 'https://example.test/gongche/#stale'))
    expect(url.pathname).toBe('/gongche/')
    expect(url.hash).toBe('')
    expect(selectionFrom(url.search)).toEqual(chosen)
  }
  expect(selectionFrom('?note=%3Cscript%3E&part=亻')).toEqual(notation('工', '⿰氵氵'))
})
