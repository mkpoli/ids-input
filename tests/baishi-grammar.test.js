import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { openable, railroad, readGrammar, references, withoutComments } from '../demo/lib/railroad.js'

// The zi.tools IDS Extension grammar is published in English, Simplified and Traditional Chinese;
// the appendix page reads the English file and draws every diagram from it.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const FILES = ['data/baishi-ids.ebnf', 'data/baishi-ids.zh-Hans.ebnf', 'data/baishi-ids.zh-Hant.ebnf']
const [english, ...translations] = FILES.map(read)
/** The rules alone: comments out, whitespace collapsed. */
const rules = text => withoutComments(text).replace(/\s+/g, ' ').trim()

describe('the zi.tools IDS Extension grammar files', () => {
  it('hold the same rules in every language', () => {
    for (const text of translations) {
      expect(rules(text)).toBe(rules(english))
      expect([...readGrammar(text).keys()]).toEqual([...readGrammar(english).keys()])
    }
  })
  it('name every rule in ASCII and define every rule they name', () => {
    const grammar = readGrammar(english)
    expect(grammar.size).toBe(withoutComments(english).match(/^[a-z][a-z ]* =/gm)?.length ?? 0)
    for (const [name, rule] of grammar) {
      expect(name).toMatch(/^[a-z][a-z ]*$/)
      for (const ref of references(rule.expr)) expect(grammar.has(ref)).toBe(true)
    }
  })
  it('name the data version, the source document and the licence in every header', () => {
    for (const text of [english, ...translations]) {
      expect(text).toContain('2597437b928e8d530b7ae09cf53fe5ec7868569c')
      expect(text).toContain('（白式）IDS 延展语法导论')
      expect(text).toContain('zi.tools IDS Extension')
      expect(text).toContain('MIT')
    }
  })
  it('is what the page draws: the page reads the English file and offers all three', () => {
    const page = read('demo/Baishi.svelte')
    expect(page).toContain("from '../data/baishi-ids.ebnf?raw'")
    for (const file of FILES) expect(page).toContain(`from '../${file}?url'`)
  })
})

// The rules as checked on every row of yi-bai/ids at 2597437b928e8d530b7ae09cf53fe5ec7868569c
// (2026-10-31): the SHA-256 of their text with comments out and white space collapsed. A change to
// the rules of all three files together still has to change this.
const VERIFIED = '0de8aa750bc710b5c4c9e0f6e65d8789d2767aa609001463e6b814f25994c3c3'

describe('reading ISO/IEC 14977 strictly', () => {
  it('reads all three files, comments and all', () => {
    for (const text of [english, ...translations]) expect(readGrammar(text).size).toBe(45)
  })
  it('keeps the rules that were checked on the data', () => {
    expect(createHash('sha256').update(rules(english)).digest('hex')).toBe(VERIFIED)
  })
  it('refuses what it does not read', () => {
    expect(() => readGrammar('a = 3 * "x" ;')).toThrow()
    expect(() => readGrammar('a = "x" - "y" ;')).toThrow()
    expect(() => readGrammar('a = "x" ; b = ;')).toThrow()
    expect(() => readGrammar('a = "x" ; a = "y" ;')).toThrow()
    expect(() => readGrammar("(* an unclosed ' in a comment *) a = 'x' ;")).toThrow()
    expect(() => readGrammar('(* an unclosed ? in a comment *) a = "x" ;')).toThrow()
    expect(() => readGrammar('(* unclosed a = "x" ;')).toThrow()
  })
  it('reads strings and comments as ISO/IEC 14977 does', () => {
    expect(readGrammar('a = "(*", b ; b = \'*)\' ;').get('a')?.expr).toEqual({ t: 'seq', items: [{ t: 'term', text: '(*' }, { t: 'nt', text: 'b' }] })
    expect([...readGrammar('(* outer (* inner *) "quoted *)" *) a = "x" ;').keys()]).toEqual(['a'])
  })
})

describe('the railroad drawing of the grammar', () => {
  const grammar = readGrammar(english)
  it('draws every rule on its own, its boxes naming the rules it names', () => {
    for (const [name, rule] of grammar) {
      const { svg, width, height } = railroad(grammar, name)
      expect(width).toBeGreaterThan(0)
      expect(height).toBeGreaterThan(0)
      const named = [...svg.matchAll(/data-rule="([^"]+)"/g)].map(match => match[1])
      expect([...new Set(named)]).toEqual(references(rule.expr))
    }
  })
  it('opens the whole grammar from row and stops each recursion at a link', () => {
    const all = new Set(openable(grammar, 'row'))
    const { svg } = railroad(grammar, 'row', all)
    expect(svg).not.toContain('aria-expanded="false"')
    expect(svg).toContain('data-link=')
    expect(openable(grammar, 'row', all)).toEqual([])
  })
  it('opens one level at a time', () => {
    const first = openable(grammar, 'row', new Set())
    const boxes = [...railroad(grammar, 'row', new Set()).svg.matchAll(/data-path="([^"]+)"/g)].map(match => match[1])
    expect(first).toEqual(boxes)
    const second = openable(grammar, 'row', new Set(first))
    expect(second.every(path => path.split('/').length === 3)).toBe(true)
  })
})
