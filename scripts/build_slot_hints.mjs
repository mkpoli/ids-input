// Count the single components each operator slot takes in the bundled IDS data, and write the most
// common ones for the inline editor's hint panel. Sources and method match build_structure_templates.
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { isNode, parse, OPERATORS } from '../src/core/ids.js'
import { readBundledSources } from './build_structure_templates.mjs'

/** How many components a slot's hint panel offers. */
export const TOP = 12

/** Whether a character may stand as a hint: a single encoded component, not an operator, an empty
 * slot or an unnamed part. @param {import('../src/core/ids.js').Part} part */
const isHint = part => typeof part === 'string' && [...part].length === 1 && part !== '？' && part !== '⬚'

/** Whether `char` is a Han character in the ranges the bundled IDS sources describe. @param {string} char */
const isHan = char => {
  const cp = char.codePointAt(0)
  return cp >= 0x3400 && cp <= 0x4dbf || cp >= 0x4e00 && cp <= 0x9fff || cp >= 0xf900 && cp <= 0xfaff || cp >= 0x20000 && cp <= 0x3ffff
}
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0

/**
 * Distinct Han characters using each component in each operator slot. A character counts once per
 * slot and component however many descriptions place it there.
 * @param {Map<string, import('../src/core/decompose.js').Sequence[]>} table
 */
export function auditSlots(table) {
  /** @type {Map<string, Map<number, Map<string, Set<string>>>>} */
  const slots = new Map()
  const covered = new Set()
  const totals = { mergedCharacters: table.size, hanCharacters: 0, descriptions: 0, validDescriptions: 0, invalidDescriptions: 0 }
  for (const [char, descriptions] of table) {
    if (!isHan(char)) continue
    totals.hanCharacters++
    for (const { text } of descriptions) {
      totals.descriptions++
      const parsed = parse(text)
      if (parsed.problem) { totals.invalidDescriptions++; continue }
      totals.validDescriptions++
      if (!isNode(parsed.tree)) continue
      const { op, parts } = parsed.tree
      for (let slot = 0; slot < parts.length; slot++) {
        const part = parts[slot]
        if (!isHint(part)) continue
        let bySlot = slots.get(op)
        if (!bySlot) slots.set(op, bySlot = new Map())
        let byPart = bySlot.get(slot)
        if (!byPart) bySlot.set(slot, byPart = new Map())
        let subjects = byPart.get(part)
        if (!subjects) byPart.set(part, subjects = new Set())
        subjects.add(char)
        covered.add(char)
      }
    }
  }
  return { slots, totals: { ...totals, coveredCharacters: covered.size } }
}

/**
 * The catalogue the hint panel reads: every operator, its slots in order, and the most common
 * components in each.
 * @param {Map<string, import('../src/core/decompose.js').Sequence[]>} table
 * @param {{ id: string, path: string, url: string, version: string, compressedSha256: string, textSha256: string, header: string[] }[]} sources
 * @param {number} [top]
 */
export function buildSlotHints(table, sources, top = TOP) {
  const { slots, totals } = auditSlots(table)
  const operators = OPERATORS.map(([op, arity]) => ({
    op,
    slots: Array.from({ length: arity }, (_, slot) => {
      const byPart = slots.get(op)?.get(slot) ?? new Map()
      const hints = [...byPart]
        .map(([part, subjects]) => [part, subjects.size])
        .sort((a, b) => b[1] - a[1] || compare(a[0], b[0]))
        .slice(0, top)
      return { total: byPart.size, hints }
    }),
  }))
  const used = operators.flatMap(({ slots }) => slots.filter(slot => slot.total > 0))
  return {
    version: 1,
    top,
    method: 'A Han character counts once in a slot for each single-component character its supplied descriptions place there; alternative descriptions add no duplicate. Components are ranked by the number of distinct characters using them in that slot. Counts describe corpus decompositions, not language-use frequency.',
    sources,
    statistics: {
      ...totals,
      slots: used.length,
      hintEntries: used.reduce((total, slot) => total + slot.hints.length, 0),
    },
    operators,
  }
}

/** The slot table as plain text, for the build's own report. */
export function formatSlotHints(catalog, limit = 8) {
  return catalog.operators.flatMap(({ op, slots }) => slots.map((slot, i) =>
    `${op} ${i + 1} [${slot.total}] ${slot.hints.slice(0, limit).map(([part, count]) => `${part} ${count}`).join('  ')}`
  )).join('\n')
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { table, sources } = readBundledSources()
  const catalog = buildSlotHints(table, sources)
  const target = new URL('../src/core/slot-hints.json', import.meta.url)
  writeFileSync(target, JSON.stringify(catalog, null, 2) + '\n')
  console.log(formatSlotHints(catalog))
  console.log(`\n${catalog.statistics.slots} slots, ${catalog.statistics.hintEntries} hints, ${catalog.statistics.coveredCharacters}/${catalog.statistics.hanCharacters} Han characters`)
}
