import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { chainStrokes } from '../src/core/chain-shape.js'
import { COMPOSER_BASE } from '../demo/lib/composer.js'
import { LOCALES, appMessages } from '../demo/lib/locales.js'
import { readGrammar } from '../demo/lib/railroad.js'
import {
  GROUP_LABELS, SHEET, SOURCE, STROKE_LETTERS, anchorsOf, bareOf, cardsOf, componentsWritten, composedDrawn, contoursOf, entriesOf, focusOf, glyphsDrawn, idsOf, kindOf, quotations, tokenise,
} from '../demo/lib/baishi-cheatsheet.js'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const outlines = JSON.parse(read('../demo/lib/baishi-cheatsheet-outlines.json'))
const grammar = readGrammar(read('../data/baishi-ids.ebnf'))
const cards = cardsOf()
/** What a token writes, with its kind and the leaf it belongs to. */
const brief = tokens => tokens.map(token => [token.text, token.kind, token.leaf])

describe('reading a quotation of the zi.tools notation', () => {
  it('makes a component and its identifier one token, and an operator and its bracket one', () => {
    expect(brief(tokenise('⿱宀J子.(J)'))).toEqual([['⿱', 'op', undefined], ['宀J', 'part', 0], ['子.', 'part', 1], ['(J)', 'list', undefined]])
    expect(tokenise('⿱宀J子.(J)')[1].stretches.map(stretch => [stretch.text, stretch.role, stretch.at])).toEqual([['宀', 'char', 1], ['J', 'tag', 2]])
    expect(tokenise('{?0径}⿰彳圣(T)').map(token => token.kind)).toEqual(['prefix', 'op', 'part', 'part', 'list'])
    expect(tokenise('⿻[1:|b]𠃌⿱⿻𠃊.一.八d').map(token => token.text)).toEqual(['⿻[1:|b]', '𠃌', '⿱', '⿻', '𠃊.', '一.', '八d'])
    expect(tokenise('⿻[1:|b]𠃌⿱⿻𠃊.一.八d')[0].stretches.map(stretch => stretch.role)).toEqual(['op', 'mod'])
  })
  it('gives the katakana that take no tag none', () => {
    expect(tokenise('⿹コ乚.(.)').map(token => token.text)).toEqual(['⿹', 'コ', '乚.', '(.)'])
    expect(tokenise('⿰亻⿱ユ.矢.(.)').map(token => token.text)).toEqual(['⿰', '亻', '⿱', 'ユ.', '矢.', '(.)'])
  })
  it('reads a chain as one leaf, or stroke by stroke, a stroke with its marks one token', () => {
    const whole = tokenise('⿻⿴#(-𠃌𠃊x0)⺀一.')
    expect(whole.filter(token => token.leaf !== undefined).map(token => [token.text, token.leaf])).toEqual([['-𠃌', 0], ['𠃊x0', 0], ['⺀', 1], ['一.', 2]])
    const strokes = tokenise('⿻⿴#(-𠃌𠃊x0)⺀一.', { strokes: true })
    expect(strokes.filter(token => token.leaf !== undefined).map(token => [token.text, token.leaf])).toEqual([['-𠃌', 0], ['𠃊x0', 1], ['⺀', 2], ['一.', 3]])
    expect(strokes.find(token => token.text === '𠃊x0')?.stretches.map(stretch => stretch.role)).toEqual(['stroke', 'mark'])
    expect(strokes.filter(token => token.kind === 'stroke').map(token => token.order)).toEqual([0, 1])
    expect(tokenise('#(HPHwg)', { strokes: true }).map(token => token.text)).toEqual(['#(', 'H', 'PHwg', ')'])
    expect(tokenise('#(-丨𠃍-一z)(.)').map(token => token.kind)).toEqual(['open', 'stroke', 'stroke', 'stroke', 'close', 'shut', 'list'])
  })
  it('places every operator and operand in the entry\'s tree, and names the leaves under an operator', () => {
    const tokens = tokenise('⿻⿺𠃊.凵y一.(.)')
    expect(tokens.filter(token => token.path).map(token => [token.text, token.path.join('.')])).toEqual([['⿻', ''], ['⿺', '0'], ['𠃊.', '0.0'], ['凵y', '0.1'], ['一.', '1']])
    expect(tokens[0].leaves).toEqual([0, 1, 2])
    expect(tokens[1].leaves).toEqual([0, 1])
    // A long line breaks between the operands of the entry's first operator.
    expect(tokens.map(token => token.top)).toEqual([0, 0, 0, 0, 1, 1])
    const chain = tokenise('⿳一.⿰#(丨-一𠃑)#(𠃑-一丨)一.(.)')
    expect(chain.filter(token => token.kind === 'open').map(token => [token.path.join('.'), token.chain, token.leaves])).toEqual([['1.0', 0, [1]], ['1.1', 1, [2]]])
  })
  it('reads a row: the character, its entries and the alternative group', () => {
    const row = tokenise('三\t⿱一.二.\t⿱二.一.')
    expect(row.map(token => token.kind)).toEqual(['head', 'tab', 'op', 'part', 'part', 'tab', 'op', 'part', 'part'])
    expect(row.filter(token => token.kind === 'op').map(token => token.entry)).toEqual([0, 1])
    expect(entriesOf('十\t⿻丨一.(.);⿻丨一t(.t)')).toEqual(['⿻丨一.(.)', '⿻丨一t(.t)'])
    expect(tokenise('十\t⿻丨一.(.);⿻丨一t(.t)').at(-1)).toMatchObject({ text: '(.t)', entry: 1, at: 14 })
  })
  it('keeps every code point, in order', () => {
    for (const card of cards) for (const quote of card.quotes) {
      const stretches = tokenise(quote.text, { strokes: quote.strokes }).flatMap(token => token.stretches)
      expect(stretches.map(stretch => stretch.text).join('')).toBe(quote.text)
      let at = 0
      for (const stretch of stretches) { expect(stretch.at).toBe(at); at += [...stretch.text].length }
    }
  })
  it('refuses what the notation does not write', () => {
    for (const junk of ['⿰木', '⿰木目目', '#(木)', '⿰木)', '⿰木#', '⿰(木', '⿱a木']) expect(() => tokenise(junk)).toThrow()
  })
  it('gives the composer an entry without its tags, and none with a chain or a bracket', () => {
    expect(bareOf(tokenise('{?0径}⿰彳圣(T)'), 0)).toBe('⿰彳圣')
    expect(bareOf(tokenise('十\t⿻丨一.(.);⿻丨一t(.t)'), 1)).toBe('⿻丨一')
    expect(bareOf(tokenise('⿻[:-1]丨日'), 0)).toBeNull()
    expect(bareOf(tokenise('#(H)(.)'), 0)).toBeNull()
  })
  it('tells the kinds of identifier apart as the grammar does', () => {
    expect(['.', 'J', 'qq222', 'q3162', 'm', 'r', 't', '..p', 'jgh'].map(kindOf)).toEqual(['default', 'source', 'analogy', 'ucv', 'mirror', 'position', 'style', 'style', 'other'])
    expect(idsOf('⿻乚一(.,T)')).toEqual(['.', 'T'])
    // The brackets of a chain are its own: only what follows them is a list.
    expect(idsOf('#(S)')).toEqual([])
    expect(idsOf('#(H)(.)')).toEqual(['.'])
    expect(idsOf('⿱一.亅')).toEqual([])
  })
})

describe('the cheatsheet\'s cards', () => {
  it('have ids of their own', () => {
    expect(new Set(cards.map(card => card.id)).size).toBe(cards.length)
  })
  it('mark text that is in the quotation', () => {
    for (const card of cards) for (const quote of card.quotes) {
      for (const [from, to] of focusOf(quote)) { expect(from).toBeGreaterThanOrEqual(0); expect(to).toBeLessThanOrEqual([...quote.text].length); expect(to).toBeGreaterThan(from) }
    }
  })
  it('draw something for every quotation', () => {
    for (const card of cards) for (const quote of card.quotes) expect(quote.glyphs.some(Boolean), `${card.id} ${quote.text}`).toBe(true)
  })
  it('mark the second TAB of a row with an alternative group', () => {
    for (const id of ['row-alternative', 'worked-che']) {
      const [quote] = cards.find(card => card.id === id).quotes
      expect(focusOf(quote).map(([from, to]) => [...quote.text].slice(from, to).join('')), id).toEqual(['\t'])
      expect(focusOf(quote)[0][0], id).toBe([...quote.text].lastIndexOf('\t'))
    }
  })
  it('colour as many parts as an entry writes, four at most', () => {
    for (const card of cards) for (const quote of card.quotes) {
      const tokens = tokenise(quote.text, { strokes: quote.strokes })
      for (const [entry, glyph] of quote.glyphs.entries()) {
        if (!glyph || glyph === 'composed' || !glyph.parts) continue
        const slots = new Set(tokens.filter(token => token.entry === entry && token.leaf !== undefined).map(token => quote.slots?.[token.leaf] ?? token.leaf))
        expect([...slots].sort(), `${card.id} ${quote.text}`).toEqual(glyph.parts.map((_, slot) => slot))
        expect(glyph.parts.length).toBeLessThanOrEqual(4)
        // A chain's joins are one for each stroke.
        if (glyph.joins) expect(glyph.joins.length).toBe(tokens.filter(token => token.entry === entry && token.kind === 'stroke').length)
      }
      if (quote.slots) expect(quote.slots.length).toBe(new Set(tokens.filter(token => token.leaf !== undefined).map(token => token.leaf)).size)
    }
  })
  it('name a label and a description every catalogue has', () => {
    const keys = [
      ...SHEET.map(section => `cheatsheet.section.${section.label}`), ...Object.values(GROUP_LABELS).map(name => `cheatsheet.${name}`),
      ...cards.flatMap(card => [card.label && `cheatsheet.label.${card.label}`, card.hint && `cheatsheet.hint.${card.hint}`]),
      ...SHEET.flatMap(section => (section.groups ?? []).flatMap(group => (group.legends ?? []).flatMap(legend => [`cheatsheet.label.${legend.id}`, `cheatsheet.hint.${legend.id}`]))),
      ...['default', 'source', 'style', 'position', 'ucv', 'analogy', 'mirror', 'other'].filter(kind => kind !== 'default').map(kind => `cheatsheet.tip.list.${kind}`),
      'cheatsheet.tip.operator.1', 'cheatsheet.tip.operator.2', 'cheatsheet.tip.operator.3', 'cheatsheet.tip.tag.source', 'cheatsheet.tip.tag.style', 'cheatsheet.tip.tag.other',
    ].filter(Boolean)
    for (const [code] of LOCALES) for (const key of keys) expect(appMessages(code)[key], `${code} ${key}`).toBeString()
  })
  it('show rules the grammar has', () => {
    for (const section of SHEET) for (const level of [section, ...(section.groups ?? [])]) for (const rule of level.rules ?? []) expect(grammar.has(rule), rule).toBe(true)
  })
})

describe('the links between the cheatsheet and the specification', async () => {
  const { CHEATSHEET_SECTIONS, SECTIONS, sectionHref } = await import('../demo/lib/baishi-sections.js').catch(() => ({ CHEATSHEET_SECTIONS: null, SECTIONS: null, sectionHref: null }))
  it('give the cheatsheet an anchor for every section the specification links to', () => {
    // The shared module reads the grammar through the bundler; its list is read from its source where that fails.
    const wanted = CHEATSHEET_SECTIONS ?? [...read('../demo/lib/baishi-sections.js').match(/CHEATSHEET_SECTIONS = [^[]*\[([\s\S]*?)\]\)/)[1].matchAll(/'([^']+)'/g)].map(match => match[1])
    expect(wanted.length).toBeGreaterThan(30)
    expect(new Set(anchorsOf()).size).toBe(anchorsOf().length)
    expect([...anchorsOf()].sort()).toEqual([...wanted].sort())
  })
  it('link the cheatsheet only to anchors the specification has', () => {
    // Every anchor of the sheet is a rule of the grammar in kebab case or one of the module's named constructs.
    const source = read('../demo/lib/baishi-sections.js')
    const named = new Set([...source.matchAll(/\{ id: '([^']+)'/g)].map(match => match[1]))
    const ids = SECTIONS ? new Set(SECTIONS.map(section => section.id)) : new Set([...[...grammar.keys()].map(rule => rule.replaceAll(' ', '-')), ...named])
    for (const id of anchorsOf()) expect(ids.has(id), id).toBe(true)
    if (sectionHref) expect(sectionHref('spec', 'stroke-chain')).toBe('./baishi.html#stroke-chain')
  })
  it('renders each anchor once on the page', () => {
    const page = read('../demo/BaishiCheatsheet.svelte')
    // Sections, groups and cards take their ids from the sheet: the page writes no anchor of its own but the worked examples' and the sources'.
    expect([...page.matchAll(/\bid="([a-z-]+)"/g)].map(match => match[1]).sort()).toEqual(['cheatsheet-tip', 'sources'])
    for (const expression of ['id={section.id}', 'id={group.id}', 'id={item.anchors?.[0]}', '<span {id} class="anchor">']) expect(page).toContain(expression)
    expect(page).toContain("sectionHref('spec', section.id)")
    expect(page).toContain("sectionHref('spec', group.id)")
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
  it('hold exactly the characters and the sequences the cards draw', () => {
    expect(Object.keys(outlines.glyphs).sort()).toEqual(glyphsDrawn().sort())
    expect(Object.keys(outlines.composed).sort()).toEqual(composedDrawn().sort())
    for (const contours of [...Object.values(outlines.glyphs), ...Object.values(outlines.components), ...Object.values(outlines.composed)]) for (const contour of contours) expect(contour).toMatch(/^M[-\d. MLQCZ]+Z$/)
  })
  it('draw a composed sequence part by part', () => {
    for (const [sequence, parts] of Object.entries(outlines.composed)) expect(parts.length, sequence).toBe([...sequence].filter(char => !/[⿰-⿿㇯]/u.test(char)).length)
  })
  it('keep a written component\'s outline and row only for components the cards write', () => {
    const written = new Set(componentsWritten())
    for (const char of [...Object.keys(outlines.components), ...Object.keys(outlines.rows)]) expect(written.has(char), char).toBe(true)
    expect(outlines.rows['子']).toBe('⿻了.一.(.);⿻了.一t(t)')
  })
  it('have every contour of a coloured glyph in a part, a whole contour in one part only', () => {
    for (const card of cards) for (const glyph of card.quotes.flatMap(quote => quote.glyphs)) {
      if (!glyph || glyph === 'composed' || !glyph.parts) continue
      const pieces = [...glyph.parts.flat(), ...(glyph.rest ?? [])]
      const whole = pieces.filter(piece => typeof piece === 'number')
      expect(contoursOf(pieces).sort((a, b) => a - b), `${card.id} ${glyph.char}`).toEqual(outlines.glyphs[glyph.char].map((_, index) => index))
      expect(new Set(whole).size, `${card.id} ${glyph.char}`).toBe(whole.length)
    }
  })
  it('spell each stroke letter as a chain the page can read', () => {
    for (const [letters, stroke] of STROKE_LETTERS) expect(chainStrokes(`#(${letters})`)?.strokes.map(part => part.stroke).join(''), stroke).toBe(letters)
  })
})
