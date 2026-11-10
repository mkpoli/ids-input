// Write docs/slot-hints.md from src/core/slot-hints.json: one ranked bar chart per operator slot.
// The panel shows the first DEFAULT entries; this appendix shows every entry the catalogue keeps.
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const ALIASES = { '⿰': 'LR', '⿱': 'UD', '⿲': 'LL', '⿳': 'UU', '⿴': 'OC', '⿵': 'OD', '⿶': 'OU', '⿷': 'OR', '⿸': 'RD', '⿹': 'LD', '⿺': 'RU', '⿻': 'XX', '⿼': 'OL', '⿽': 'LU', '⿾': 'MI', '⿿': 'RO', '㇯': 'SU' }
const NAMES = {
  '⿰': 'left to right', '⿱': 'above to below', '⿲': 'left, middle and right', '⿳': 'above, middle and below',
  '⿴': 'full surround', '⿵': 'surround from above', '⿶': 'surround from below', '⿷': 'surround from left',
  '⿸': 'surround from upper left', '⿹': 'surround from upper right', '⿺': 'surround from lower left',
  '⿻': 'overlaid', '⿼': 'surround from right', '⿽': 'surround from lower right', '⿾': 'mirrored',
  '⿿': 'rotated', '㇯': 'subtracted', '〾': 'variant',
}
const WIDTH = 24
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
const bars = (hints) => {
  const top = Math.max(...hints.map(([, count]) => count), 1)
  const digits = Math.max(...hints.map(([, count]) => count.toLocaleString('en').length), 1)
  return hints.map(([part, count]) => {
    const filled = Math.max(1, Math.round(count / top * WIDTH))
    return `${count.toLocaleString('en').padStart(digits)}  ${'█'.repeat(filled).padEnd(WIDTH)}  ${part}  `
  }).join('\n')
}

/** @param {any} catalog */
export function renderAppendix(catalog) {
  const lines = []
  lines.push('# Appendix: common components by operator slot')
  lines.push('')
  lines.push('The inline editor offers the components that most often fill the slot being edited. The panel shows the first ' + catalog.default + ' by default; **Show more** reveals all ' + catalog.top + ' entries the catalogue keeps for that slot. The bars below show every stored entry, scaled to the most common component in that slot.')
  lines.push('')
  lines.push('A Han character counts once per operator slot and component wherever its descriptions place that component, at any depth. Alternative descriptions and duplicate sources do not inflate a count. Slots are numbered from 1 in reading order: an enclosure has the enclosing part in slot 1 and the inside in slot 2, and the subtraction operator SU has the base in slot 1 and the subtracted part in slot 2.')
  lines.push('')
  lines.push('The catalogue holds ' + catalog.statistics.slots + ' slots across all ' + catalog.operators.length + ' operators and ' + catalog.statistics.hintEntries.toLocaleString('en') + ' stored entries, covering ' + catalog.statistics.coveredCharacters.toLocaleString('en') + ' of the ' + catalog.statistics.hanCharacters.toLocaleString('en') + ' Han characters in the sources. The full ranking of a busy slot such as LR is much longer than ' + catalog.top + '; the catalogue keeps the most common entries so the panel stays a panel. Counts describe dictionary coverage, not usage frequency.')
  lines.push('')
  lines.push('Headings give each operator’s zi.tools ASCII name, its symbol and its English name; 〾 has no ASCII name.')
  lines.push('')
  lines.push('Sources: [BabelStone IDS](https://www.babelstone.co.uk/CJK/IDS.TXT), file date 2025-06-27 (public domain), and [Yi Bai IDS](https://github.com/yi-bai/ids/blob/da1e9f8a09e2ec8faaf176bac99203f978282041/ids_lv1.txt), level 1 at `da1e9f8a09e2ec8faaf176bac99203f978282041` (MIT). Exact versions, hashes and headers are recorded in [`src/core/slot-hints.json`](../src/core/slot-hints.json). Regenerate this page with `bun run build:slot-hints`.')
  lines.push('')
  lines.push('| Operator | Name | Slots |')
  lines.push('| --- | --- | --- |')
  for (const { op, slots } of catalog.operators) {
    const name = `${ALIASES[op] ?? '—'} ${op}`
    lines.push(`| ${name} | ${NAMES[op]} | ${slots.length} |`)
  }
  lines.push('')
  for (const { op, slots } of catalog.operators) {
    lines.push(`## ${ALIASES[op] ?? op} · ${op} · ${NAMES[op]}`)
    lines.push('')
    slots.forEach((slot, i) => {
      lines.push(`### Slot ${i + 1}`)
      lines.push('')
      if (!slot.hints.length) { lines.push('No components in the bundled descriptions.'); lines.push(''); return }
      const hidden = slot.total - slot.hints.length
      lines.push(`${slot.total.toLocaleString('en')} distinct components in this slot; ${slot.hints.length} shown${hidden > 0 ? `, ${hidden.toLocaleString('en')} rarer ones not stored` : ''}.`)
      lines.push('')
      lines.push('```text')
      lines.push(bars(slot.hints))
      lines.push('```')
      lines.push('')
    })
  }
  return lines.join('\n')
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const catalog = JSON.parse(readFileSync(new URL('../src/core/slot-hints.json', import.meta.url), 'utf8'))
  const out = new URL('../docs/slot-hints.md', import.meta.url)
  writeFileSync(out, renderAppendix(catalog))
  console.log(`Wrote docs/slot-hints.md (${catalog.statistics.hintEntries} entries).`)
}
