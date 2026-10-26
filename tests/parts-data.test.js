import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { paletteRows } from '../src/adapter/index.js'

const document = JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url), 'utf8'))
const parts = paletteRows(document)
const byPart = new Map(parts.map(part => [part.part, part]))

describe('palette stroke metadata', () => {
  it('counts all twelve radical forms missing from Unihan', () => {
    const chars = [...'⺊⺌⺗⺼⺈⺶⺄⺝⺀⺆⺻⻀']
    const counts = [2, 3, 4, 4, 2, 6, 1, 4, 2, 2, 5, 4]
    expect(chars.map(char => byPart.get(char)?.strokes)).toEqual(counts)
    expect(parts.filter(part => part.kind !== 't' && part.strokes == null)).toEqual([])
  })

  it('classifies every Han component while leaving the circle stroke outside the five classes', () => {
    const classes = new Set(['横', '豎', '撇', '點', '折'])
    const han = parts.filter(part => [...part.part].length === 1 && (part.kind === 'c' || part.kind === 'd'))
    expect(han).toHaveLength(1641)
    expect(han.filter(part => !classes.has(part.first))).toEqual([])
    expect(['山', '月', '宀', '弓', '⺝', '⺀', '⺆', '⺻', '⻀'].map(char => byPart.get(char).first))
      .toEqual(['豎', '撇', '點', '折', '豎', '點', '撇', '折', '横'])
    expect(['小', '水', '亅', '乀', '𠃍', '𠃎'].map(char => byPart.get(char).first))
      .toEqual(['豎', '豎', '豎', '點', '折', '折'])
    expect(byPart.get('㇣').first).toBeNull()
  })

  it('generates metadata from complete single-character codes and explicit radical counts', () => {
    const result = spawnSync('python3', ['-c', `
import sys
sys.path.insert(0, "scripts")
from build_ids_parts import first_strokes, stroke_counts, RADICAL_COUNTS
sample = "# header\\n山\\tshs\\n小\\tznp\\n小\\tsnp\\n⺊\\tsh\\n坏\\ts?\\n词组\\thh\\n空\\t\\n"
first = first_strokes(sample)
assert first == {"山": "豎", "小": "豎", "⺊": "豎", "⻀": "横"}, first
assert first_strokes("𠃍\\ths\\n乀\\tz", "㇕\\t𠃍\\tunicode-ucd\\tEquivalentUnifiedIdeograph\\n㇏\\t乀\\tunicode-ucd\\tEquivalentUnifiedIdeograph") == {"𠃍": "折", "乀": "點", "⻀": "横"}
counts = stroke_counts(list(RADICAL_COUNTS) + ["木", "㇐", "？"], {}, {"木": "4"})
assert all(counts[c] == (n, False) for c, n in RADICAL_COUNTS.items()), counts
assert counts["木"] == (4, False)
assert counts["㇐"] == (1, True)
assert counts["？"] == (None, False)
`], { cwd: new URL('..', import.meta.url), encoding: 'utf8' })
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  })
})
