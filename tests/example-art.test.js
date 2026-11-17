import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { EXAMPLES } from '../demo/lib/examples.js'
import { COMPOSER_BASES } from '../demo/lib/composer.js'

/** The faces whose cards carry art of their own. */
const FACES = ['serif', 'regular', 'fangsong', 'pen-writing']
const read = path => JSON.parse(readFileSync(new URL(`../demo/lib/${path}`, import.meta.url), 'utf8'))
const sans = read('example-drawings.json')
const art = Object.fromEntries(FACES.map(face => [face, read(`example-art-${face}.json`)]))
const sequences = EXAMPLES.map(example => example.sequence).sort()

describe('the example card art', () => {
  it('covers every face and comes from that face’s export', () => {
    for (const face of FACES) {
      expect(art[face].base).toBe(COMPOSER_BASES[face])
      expect(art[face].composer.commit).toMatch(/^[0-9a-f]{7,}$/)
      expect(Object.keys(art[face].art).sort()).toEqual(sequences)
    }
  })
  it('keeps the cards to the current examples', () => {
    for (const face of FACES) for (const sequence of Object.keys(art[face].art)) expect(EXAMPLES.some(example => example.sequence === sequence)).toBe(true)
  })
  it('draws the common examples with the face’s own outlines', () => {
    for (const face of FACES) {
      expect(art[face].art['⿾正'].d).not.toBe(sans.drawings['⿾正'].drawn.d)
      expect(art[face].art['⿱艹半'].d).not.toBe(sans.drawings['⿱艹半'].drawn.d)
    }
  })
  it('holds a usable path for every card', () => {
    for (const face of FACES) {
      for (const [sequence, entry] of Object.entries(art[face].art)) {
        expect([face, sequence, Boolean(entry.d || entry.emoji?.length)]).toEqual([face, sequence, true])
        expect(entry.d ?? '').not.toMatch(/NaN|Infinity/)
      }
    }
  })
  it('keeps the card of an unencoded sequence', () => {
    for (const face of FACES) expect(art[face].art['⿱車🚗'].d?.length).toBeGreaterThan(10)
  })
})
