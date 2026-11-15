import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { chainStrokes } from '../src/core/chain-shape.js'
import { COMPOSER_BASE } from '../demo/lib/composer.js'
import { LOCALES, appMessages } from '../demo/lib/locales.js'
import { LEGENDS, SECTIONS, SOURCE, entriesOf, focusOf, glyphsDrawn, quotations, tokenise } from '../demo/lib/baishi-cheatsheet.js'

const outlines = JSON.parse(readFileSync(new URL('../demo/lib/baishi-cheatsheet-outlines.json', import.meta.url), 'utf8'))
const cards = SECTIONS.flatMap(section => section.cards)

describe('reading a quotation of the zi.tools notation', () => {
  it('splits an entry into operators, parts with their tags and the list', () => {
    expect(tokenise('⿱宀J子.(J)').map(token => [token.text, token.kind, token.leaf])).toEqual([
      ['⿱', 'op', undefined], ['宀', 'part', 0], ['J', 'tag', 0], ['子', 'part', 1], ['.', 'tag', 1], ['(J)', 'list', undefined],
    ])
    expect(tokenise('{?0径}⿰彳圣(T)').map(token => token.kind)).toEqual(['prefix', 'op', 'part', 'part', 'list'])
    expect(tokenise('⿻[1:|b]𠃌⿱⿻𠃊.一.八d').map(token => token.text)).toEqual(['⿻', '[1:|b]', '𠃌', '⿱', '⿻', '𠃊', '.', '一', '.', '八', 'd'])
  })
  it('gives the katakana that take no tag none', () => {
    expect(tokenise('⿹コ乚.(.)').map(token => token.text)).toEqual(['⿹', 'コ', '乚', '.', '(.)'])
    expect(tokenise('⿼ユ.十.(.)').map(token => token.text)).toEqual(['⿼', 'ユ', '.', '十', '.', '(.)'])
  })
  it('reads a chain as one leaf, or stroke by stroke', () => {
    const whole = tokenise('⿻⿴#(-𠃌𠃊x0)⺀一.')
    expect(whole.filter(token => token.leaf !== undefined).map(token => [token.text, token.leaf])).toEqual([['-', 0], ['𠃌', 0], ['𠃊', 0], ['x0', 0], ['⺀', 1], ['一', 2], ['.', 2]])
    const strokes = tokenise('⿻⿴#(-𠃌𠃊x0)⺀一.', { strokes: true })
    expect(strokes.filter(token => token.leaf !== undefined).map(token => [token.text, token.leaf])).toEqual([['-', 0], ['𠃌', 0], ['𠃊', 1], ['x0', 1], ['⺀', 2], ['一', 3], ['.', 3]])
    expect(tokenise('#(HPHwg)', { strokes: true }).map(token => token.text)).toEqual(['#(', 'H', 'PHwg', ')'])
    expect(tokenise('#(-丨𠃍-一z)(.)').map(token => token.kind)).toEqual(['chain', 'mark', 'stroke', 'stroke', 'mark', 'stroke', 'close', 'chain', 'list'])
  })
  it('reads a row: the character, its entries and the alternative group', () => {
    const row = tokenise('三\t⿱一.二.\t⿱二.一.')
    expect(row.map(token => token.kind)).toEqual(['head', 'tab', 'op', 'part', 'tag', 'part', 'tag', 'tab', 'op', 'part', 'tag', 'part', 'tag'])
    expect(row.filter(token => token.kind === 'op').map(token => token.entry)).toEqual([0, 1])
    expect(entriesOf('十\t⿻丨一.(.);⿻丨一t(.t)')).toEqual(['⿻丨一.(.)', '⿻丨一t(.t)'])
    expect(tokenise('十\t⿻丨一.(.);⿻丨一t(.t)').at(-1)).toMatchObject({ text: '(.t)', entry: 1, at: 14 })
  })
  it('keeps every code point, in order', () => {
    for (const card of cards) for (const quote of card.quotes) {
      const tokens = tokenise(quote.text, { strokes: card.strokes })
      expect(tokens.map(token => token.text).join('')).toBe(quote.text)
      let at = 0
      for (const token of tokens) { expect(token.at).toBe(at); at += [...token.text].length }
    }
  })
  it('refuses what the notation does not write', () => {
    expect(() => tokenise('⿰木')).toThrow()
    expect(() => tokenise('⿰木目目')).toThrow()
    expect(() => tokenise('#(木)')).toThrow()
    for (const junk of ['⿰木)', '⿰木#', '⿰(木', '⿱a木']) expect(() => tokenise(junk)).toThrow()
  })
})

describe('the cheatsheet\'s cards', () => {
  it('have ids of their own', () => {
    expect(new Set(cards.map(card => card.id)).size).toBe(cards.length)
  })
  it('underline text that is in the quotation', () => {
    for (const card of cards) for (const quote of card.quotes) {
      for (const [from, to] of focusOf(quote)) { expect(from).toBeGreaterThanOrEqual(0); expect(to).toBeLessThanOrEqual([...quote.text].length); expect(to).toBeGreaterThan(from) }
    }
  })
  it('colour as many parts as an entry writes, four at most', () => {
    for (const card of cards) for (const quote of card.quotes) {
      const tokens = tokenise(quote.text, { strokes: card.strokes })
      for (const [entry, glyph] of (quote.glyphs ?? []).entries()) {
        if (!glyph?.parts) continue
        const leaves = new Set(tokens.filter(token => token.entry === entry && token.leaf !== undefined).map(token => quote.slots?.[token.leaf] ?? token.leaf))
        // A glyph may show only the part an entry is about: 子 inside 孩.
        expect([...leaves].sort()).toEqual(glyph.parts.map((_, slot) => slot))
        expect(glyph.parts.length).toBeLessThanOrEqual(4)
      }
      if (quote.slots) expect(quote.slots.length).toBe(new Set(tokens.filter(token => token.leaf !== undefined).map(token => token.leaf)).size)
      if (quote.chain) expect(chainStrokes(/#\([^)]*\)/u.exec(quote.text)?.[0] ?? '')?.strokes.length).toBeLessThanOrEqual(4)
    }
  })
  it('name a label and a hint every catalogue has', () => {
    const keys = [
      ...SECTIONS.map(section => `cheatsheet.section.${section.id}`),
      ...cards.flatMap(card => [card.label && `cheatsheet.label.${card.label}`, card.hint && `cheatsheet.hint.${card.hint}`]),
      ...Object.values(LEGENDS).flat().flatMap(legend => [`cheatsheet.label.${legend.id}`, `cheatsheet.hint.${legend.id}`]),
    ].filter(Boolean)
    for (const [code] of LOCALES) for (const key of keys) expect(appMessages(code)[key], `${code} ${key}`).toBeString()
  })
})

describe('the prepared outlines', () => {
  it('come from the composer export the demo uses and the data the cards quote', () => {
    expect(outlines.base).toBe(COMPOSER_BASE)
    expect(outlines.composer.style).toBe('sans')
    expect(outlines.data).toEqual({ commit: SOURCE.commit, sha256: SOURCE.sha256 })
  })
  it('were built from the quotations the cards make now', () => {
    expect(outlines.quotations).toEqual(quotations())
  })
  it('hold exactly the characters the cards draw', () => {
    expect(Object.keys(outlines.glyphs).sort()).toEqual(glyphsDrawn().sort())
    for (const contours of Object.values(outlines.glyphs)) for (const contour of contours) expect(contour).toMatch(/^M[-\d. LQCZ]+Z$/)
  })
  it('have every contour of a coloured glyph in one part', () => {
    for (const card of cards) for (const glyph of card.quotes.flatMap(quote => quote.glyphs ?? [])) {
      if (!glyph?.parts) continue
      const named = [...glyph.parts.flat(), ...(glyph.rest ?? [])].sort((a, b) => a - b)
      expect(named, `${card.id} ${glyph.char}`).toEqual(outlines.glyphs[glyph.char].map((_, index) => index))
    }
  })
})
