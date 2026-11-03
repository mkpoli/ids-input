import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { paletteRows } from '../src/adapter/index.js'

const document = JSON.parse(readFileSync(new URL('../data/ids-parts.json', import.meta.url), 'utf8'))
const parts = paletteRows(document)
const byPart = new Map(parts.map(part => [part.part, part]))

describe('palette stroke metadata', () => {
  it('carries 〇, which no sequence names, as a one-stroke part', () => {
    expect(byPart.get('〇')).toMatchObject({ uses: 0, strokes: 1, first: '折', kind: 'd' })
    // The character list carries the same stroke count; the two sources must agree.
    const han = JSON.parse(gunzipSync(readFileSync(new URL('../data/han-parts.json.gz', import.meta.url))))
    expect(han.strokes[han.keys.indexOf('〇')]).toBe(byPart.get('〇').strokes)
  })

  it('counts all fourteen radical forms missing from Unihan', () => {
    const chars = [...'⺊⺌⺗⺼⺈⺶⺄⺝⺀⺆⺻⻀⺂⺕']
    const counts = [2, 3, 4, 4, 2, 6, 1, 4, 2, 2, 5, 4, 1, 3]
    expect(chars.map(char => byPart.get(char)?.strokes)).toEqual(counts)
    expect(parts.filter(part => part.kind !== 't' && part.strokes == null)).toEqual([])
  })

  it('classifies every Han component while leaving the circle stroke outside the five classes', () => {
    const classes = new Set(['横', '豎', '撇', '點', '折'])
    const han = parts.filter(part => [...part.part].length === 1 && (part.kind === 'c' || part.kind === 'd'))
    expect(han.length).toBeGreaterThan(10000)
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
assert first == {"山": "豎", "小": "豎", "⺊": "豎", "⻀": "横", "⺂": "折"}, first
assert first_strokes("𠃍\\ths\\n乀\\tz", "㇕\\t𠃍\\tunicode-ucd\\tEquivalentUnifiedIdeograph\\n㇏\\t乀\\tunicode-ucd\\tEquivalentUnifiedIdeograph") == {"𠃍": "折", "乀": "點", "⻀": "横", "⺂": "折"}
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
