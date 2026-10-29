import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { parse } from '../src/core/ids.js'

const data = JSON.parse(readFileSync(new URL('../demo/lib/comparison.json', import.meta.url), 'utf8'))
const english = JSON.parse(readFileSync(new URL('../demo/messages/en.json', import.meta.url), 'utf8'))

describe('the comparison gallery data', () => {
  it('holds the three sets it says it does, each a drawable sequence', () => {
    expect(data.entries.length).toBe(215)
    expect(data.sets.krm.shown).toBe(168)
    expect(data.sets.joyo.shown).toBe(20)
    expect(data.sets.review.shown).toBe(27)
    for (const set of ['krm', 'joyo', 'review']) expect(data.sets[set].measured).toBe(data.sets[set].shown)
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
      expect(['krm', 'joyo', 'review']).toContain(entry.set)
      expect(`compare.category.${entry.category}` in english).toBe(true)
      expect(`compare.setTag.${entry.set}` in english).toBe(true)
      expect(entry.reused).toBe(entry.nparts === 1)
      if (entry.set === 'joyo') expect(entry.category).toBe('designed')
      for (const key of ['f1', 'iou', 'layout']) expect(entry[key]).toBeGreaterThanOrEqual(0)
      expect(entry.f1).toBeLessThanOrEqual(1)
      expect(entry.iou).toBeLessThanOrEqual(1)
      // The 3×3 share L1 distance runs from 0 to 2.
      expect(entry.layout).toBeLessThanOrEqual(2)
    }
  })

  it('keeps both drawings in the boxes the page draws them in', () => {
    for (const entry of data.entries) {
      const numbers = text => [...text.matchAll(/-?\d+(?:\.\d+)?/g)].map(match => Number(match[0]))
      expect(Math.max(...numbers(entry.ours))).toBeLessThanOrEqual(1100)
      for (const path of entry.kage) expect(Math.max(...numbers(path))).toBeLessThanOrEqual(260)
    }
  })
})
