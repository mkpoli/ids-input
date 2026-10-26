import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { EXAMPLES } from '../demo/lib/examples.js'
import { COMPOSER_BASE } from '../demo/lib/composer.js'

const data = JSON.parse(readFileSync(new URL('../demo/lib/example-drawings.json', import.meta.url), 'utf8'))

describe('the prepared example drawings', () => {
  it('come from the composer export the demo uses', () => {
    expect(data.base).toBe(COMPOSER_BASE)
    expect(data.composer.commit).toMatch(/^[0-9a-f]{7,}$/)
    expect(data.composer.style).toBe('sans')
  })
  it('holds exactly the current examples', () => {
    const held = [...Object.keys(data.drawings), ...data.failed.map(entry => entry.sequence)]
    expect(held.sort()).toEqual(EXAMPLES.map(example => example.sequence).sort())
  })
  it('answer every example, or say why it was skipped', () => {
    const skipped = new Map(data.failed.map(entry => [entry.sequence, entry]))
    for (const example of EXAMPLES) {
      const cached = data.drawings[example.sequence]
      if (cached) {
        expect(cached.char).toBe(example.char)
        expect(cached.drawn.d.length).toBeGreaterThan(10)
      } else {
        expect(skipped.has(example.sequence)).toBe(true)
        expect(skipped.get(example.sequence).name).toBeString()
      }
    }
  })
})
