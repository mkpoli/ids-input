import { describe, expect, it } from 'bun:test'
import { STRUCTURE_TEMPLATES, STRUCTURE_TEMPLATE_METADATA } from '../src/core/templates.js'
import { normalizeStructure } from '../scripts/build_structure_templates.mjs'
import { isDescription, nextEmpty, parse, place, write } from '../src/core/ids.js'
import { roughLayout } from '../src/core/preview.js'
import { insertAt } from '../src/svelte/insertion.js'

const grid = STRUCTURE_TEMPLATES.find(item => item.id === 'grid').sequence

describe('structure templates', () => {
  it('offer distinct two- to four-slot layouts with no fixed components', () => {
    expect(new Set(STRUCTURE_TEMPLATES.map(item => item.id)).size).toBe(54)
    const layouts = STRUCTURE_TEMPLATES.map(item => {
      const parsed = parse(item.sequence, { open: true })
      expect(parsed.problem).toBeUndefined()
      const leaves = roughLayout(parsed.tree)
      expect(leaves.every(leaf => leaf.char === null)).toBe(true)
      expect(leaves).toHaveLength(item.slots)
      expect([2, 3, 4]).toContain(item.slots)
      return normalizeStructure(parsed.tree)
    })
    expect(new Set(layouts).size).toBe(layouts.length)
  })
  it('rank layouts by slot count, then distinct-character frequency', () => {
    for (let i = 1; i < STRUCTURE_TEMPLATES.length; i++) {
      const before = STRUCTURE_TEMPLATES[i - 1], after = STRUCTURE_TEMPLATES[i]
      expect(before.slots <= after.slots).toBe(true)
      if (before.slots === after.slots) expect(before.count >= after.count).toBe(true)
    }
    expect(STRUCTURE_TEMPLATE_METADATA.threshold).toBe(50)
    expect(STRUCTURE_TEMPLATE_METADATA.statistics.coveredCharacters).toBe(98556)
    expect(STRUCTURE_TEMPLATES.every(item => item.examples.every(char => typeof char === 'string' && [...char].length === 1))).toBe(true)
  })
  it('fills all four grid slots independently while preserving the adjacent component', () => {
    let tree = parse('⿰木⬚', { open: true }).tree
    let chosen
    ;({ tree, chosen } = place(tree, [1], parse(grid, { open: true }).tree))
    expect(chosen).toEqual([1, 0, 0])
    for (const char of '日月水火') ({ tree, chosen } = place(tree, chosen, char))
    expect(write(tree)).toBe('⿰木⿱⿰日月⿰水火')
    expect(nextEmpty(tree)).toBeNull()
    expect(isDescription(write(tree))).toBe(true)
  })
  it('inserts an open template at the caret without losing the following component', () => {
    const text = '⿱⬚木'
    const result = insertAt(parse(text, { open: true }).tree, text, 1, parse(grid, { open: true }).tree)
    expect(write(result.tree)).toBe('⿱⿱⿰⬚⬚⿰⬚⬚木')
    expect(result.path).toEqual([0])
  })
})
