import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { CHEATSHEET_SECTIONS, SECTIONS, ruleId, sectionHref } from '../demo/lib/baishi-sections.js'
import { readGrammar } from '../demo/lib/railroad.js'

// The specification (/baishi) and the cheatsheet (/baishi-cheatsheet) share their section anchors
// through demo/lib/baishi-sections.js; a link from either page has to land on an anchor there.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const spec = read('demo/Baishi.svelte')
const rules = [...readGrammar(read('data/baishi-ids.ebnf')).keys()]
/** The rules the specification shows, each as a block whose id is the rule's anchor. */
const shown = [...spec.matchAll(/\{@render grammar\(\[([^\]]*)\]\)\}/g)].flatMap(match => [...match[1].matchAll(/'([^']+)'/g)].map(one => one[1]))
/** Literal ids in the specification's markup. */
const literal = new Set([...spec.matchAll(/\bid="([a-zA-Z][\w-]*)"/g)].map(match => match[1]))
const specIds = new Set([...literal, ...shown.map(ruleId)])

describe('the shared section anchors', () => {
  it('are every rule of the grammar, in kebab case, then the other constructs and the prose', () => {
    const ruleSections = SECTIONS.filter(section => section.rule)
    expect(ruleSections.map(section => section.rule).sort()).toEqual([...rules].sort())
    for (const section of ruleSections) expect(section.id).toBe(/** @type {string} */ (section.rule).replaceAll(' ', '-'))
    expect(new Set(SECTIONS.map(section => section.id)).size).toBe(SECTIONS.length)
    expect(SECTIONS[0]).toEqual({ id: 'row', rule: 'row', parent: null, title: null })
    for (const section of SECTIONS) if (section.parent) expect(SECTIONS.some(one => one.id === section.parent)).toBe(true)
  })
  it('each exist on the specification, every rule shown there once', () => {
    expect(new Set(shown).size).toBe(shown.length)
    for (const section of SECTIONS) expect(specIds.has(section.id)).toBe(true)
  })
  it('are what the specification links to on the cheatsheet', () => {
    const ids = new Set(SECTIONS.map(section => section.id))
    for (const id of CHEATSHEET_SECTIONS) expect(ids.has(id)).toBe(true)
    // Links go through the cheat snippet, which shows only anchors the cheatsheet has.
    for (const match of spec.matchAll(/\{@render cheat\('([\w-]+)'\)\}/g)) expect(ids.has(match[1])).toBe(true)
  })
  it('make links that name the page and the anchor', () => {
    expect(sectionHref('cheatsheet', 'stroke-chain')).toBe('./baishi-cheatsheet.html#stroke-chain')
    expect(sectionHref('spec', 'row')).toBe('./baishi.html#row')
  })
})
