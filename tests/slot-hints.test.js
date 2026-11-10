import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { isComponent, parse, OPERATORS } from '../src/core/ids.js'
import { hintsAt, SLOT_HINTS, SLOT_HINT_METADATA, slotHints } from '../src/core/hints.js'
import { auditSlots, buildSlotHints, TOP } from '../scripts/build_slot_hints.mjs'
import { readBundledSources } from '../scripts/build_structure_templates.mjs'

const descriptions = (...texts) => texts.map(text => ({ text, regions: '' }))

describe('slot hints', () => {
  it('lists every operator and as many slots as it takes', () => {
    const catalog = JSON.parse(readFileSync(new URL('../src/core/slot-hints.json', import.meta.url), 'utf8'))
    expect(catalog.operators.map(item => item.op)).toEqual(OPERATORS.map(([op]) => op))
    for (const [op, arity] of OPERATORS) {
      const entry = catalog.operators.find(item => item.op === op)
      expect(entry.slots).toHaveLength(arity)
      for (const slot of entry.slots) {
        expect(slot.hints.length).toBeLessThanOrEqual(TOP)
        expect(slot.total).toBeGreaterThanOrEqual(slot.hints.length)
        for (let i = 1; i < slot.hints.length; i++) expect(slot.hints[i - 1][1]).toBeGreaterThanOrEqual(slot.hints[i][1])
        expect(slot.hints.every(([part, count]) => [...part].length === 1 && isComponent(part) && count > 0)).toBe(true)
      }
    }
    expect(SLOT_HINTS.size).toBe(OPERATORS.length)
    expect(SLOT_HINT_METADATA.statistics.slots).toBe(35)
    expect(SLOT_HINT_METADATA.statistics.hintEntries).toBe(415)
    expect(SLOT_HINT_METADATA.statistics.coveredCharacters).toBe(101290)
  })
  it('offers the components the examples in the request name', () => {
    const left = slotHints('⿰', 0).map(([part]) => part)
    expect(left).toContain('木')
    expect(left).toContain('忄')
    expect(left).toContain('土')
    const bottom = slotHints('⿱', 1).map(([part]) => part)
    expect(bottom).toContain('心')
    expect(bottom).toContain('灬')
  })
  it('counts a character once per slot and component across alternative descriptions', () => {
    const table = new Map([
      ['甲', descriptions('⿰木口', '⿰木木')],
      ['乙', descriptions('⿰木口')],
      ['丙', descriptions('⿱木口')],
      ['A', descriptions('⿰木口')],
      ['丁', descriptions('⿰木？')],
    ])
    const { slots, totals } = auditSlots(table)
    expect(totals.hanCharacters).toBe(4)
    expect(totals.invalidDescriptions).toBe(0)
    expect(totals.coveredCharacters).toBe(4)
    expect(slots.get('⿰').get(0).get('木').size).toBe(3)
    expect(slots.get('⿰').get(1).get('木').size).toBe(1)
    expect(slots.get('⿰').get(1).get('口').size).toBe(2)
    expect(slots.get('⿰').get(1).has('？')).toBe(false)
  })
  it('counts the slots of nested operators at any depth', () => {
    const table = new Map([
      ['戊', descriptions('⿰木⿱日月')],
      ['己', descriptions('⿰水⿱日月')],
    ])
    const { slots } = auditSlots(table)
    expect(slots.get('⿰').get(0).get('木').size).toBe(1)
    expect(slots.get('⿰').get(0).get('水').size).toBe(1)
    expect(slots.get('⿱').get(0).get('日').size).toBe(2)
    expect(slots.get('⿱').get(1).get('月').size).toBe(2)
  })
  it('builds a top list per slot with ties in character order', () => {
    const table = new Map([
      ['甲', descriptions('⿰木口')],
      ['乙', descriptions('⿰水口')],
      ['丙', descriptions('⿰火木')],
    ])
    const catalog = buildSlotHints(table, [], 2)
    expect(catalog.operators.find(item => item.op === '⿰').slots).toEqual([
      { total: 3, hints: [['木', 1], ['水', 1]] },
      { total: 2, hints: [['口', 2], ['木', 1]] },
    ])
    expect(catalog.statistics.hintEntries).toBe(4)
  })
  it('reproduces the checked-in catalogue from the bundled sources', () => {
    const { table, sources } = readBundledSources()
    const actual = buildSlotHints(table, sources)
    const expected = JSON.parse(readFileSync(new URL('../src/core/slot-hints.json', import.meta.url), 'utf8'))
    expect(actual).toEqual(expected)
    expect(sources.every(source => /^[a-f0-9]{64}$/.test(source.compressedSha256) && /^[a-f0-9]{64}$/.test(source.textSha256))).toBe(true)
  })
  it('answers for a leaf slot through its parent operator', () => {
    const tree = parse('⿰木⿱口⬚', { open: true }).tree
    expect(hintsAt(tree, [1])).toBeNull()
    expect(hintsAt(tree, [0])).toMatchObject({ op: '⿰', slot: 0 })
    expect(hintsAt(tree, [1, 1])).toMatchObject({ op: '⿱', slot: 1 })
    expect(hintsAt(tree, [])).toBeNull()
    expect(hintsAt(null, [0])).toBeNull()
    expect(hintsAt({ op: '⿰', parts: ['木', null] }, [1])?.hints.length).toBeGreaterThan(0)
  })
})
