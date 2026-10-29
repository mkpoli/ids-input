import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { parse } from '../src/core/ids.js'

const data = JSON.parse(readFileSync(new URL('../demo/lib/comparison.json', import.meta.url), 'utf8'))
const english = JSON.parse(readFileSync(new URL('../demo/messages/en.json', import.meta.url), 'utf8'))

describe('the comparison gallery data', () => {
  it('holds the two sets it says it does, each a drawable sequence', () => {
    expect(data.entries.length).toBe(64)
    expect(data.sets.krm.shown).toBe(44)
    expect(data.sets.joyo.shown).toBe(20)
    for (const set of ['krm', 'joyo']) expect(data.sets[set].measured).toBeGreaterThanOrEqual(data.sets[set].shown)
    for (const entry of data.entries) {
      expect(parse(entry.sequence, { open: true }).problem).toBeUndefined()
      expect(entry.ours.startsWith('M')).toBe(true)
      expect(entry.kage.length).toBeGreaterThan(0)
      for (const path of entry.kage) expect(path.startsWith('M')).toBe(true)
    }
  })

  it('gives each entry one sequence, a set, a category the page names and scores in range', () => {
    const seen = new Set()
    for (const entry of data.entries) {
      expect(seen.has(entry.sequence)).toBe(false)
      seen.add(entry.sequence)
      expect(['krm', 'joyo']).toContain(entry.set)
      expect(`compare.category.${entry.category}` in english).toBe(true)
      expect(`compare.setTag.${entry.set}` in english).toBe(true)
      expect(entry.reused).toBe(entry.nparts === 1)
      if (entry.set === 'krm') expect(entry.nparts).toBeGreaterThanOrEqual(2)
      for (const key of ['f1', 'iou', 'layout']) {
        expect(entry[key]).toBeGreaterThanOrEqual(0)
        expect(entry[key]).toBeLessThanOrEqual(1)
      }
    }
  })

  it('keeps both drawings in the boxes the page draws them in', () => {
    for (const entry of data.entries) {
      // The composer's path is written in a 1000-unit em; KAGE's in a 200-unit box. A coordinate
      // beyond its box would be clipped in the gallery.
      const numbers = text => [...text.matchAll(/-?\d+(?:\.\d+)?/g)].map(match => Number(match[0]))
      expect(Math.max(...numbers(entry.ours))).toBeLessThanOrEqual(1100)
      for (const path of entry.kage) expect(Math.max(...numbers(path))).toBeLessThanOrEqual(260)
    }
  })
})
