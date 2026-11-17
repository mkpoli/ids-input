import { describe, expect, it } from 'bun:test'

import { COMPOSER_BASE, COMPOSER_BASES } from '../demo/lib/composer.js'

describe('composer faces', () => {
  it('gives each face its own export and keeps Sans as the base export', () => {
    expect(COMPOSER_BASES.sans).toBe(COMPOSER_BASE)
    expect(Object.keys(COMPOSER_BASES).sort()).toEqual(['fangsong', 'pen-writing', 'regular', 'sans', 'serif'])
    expect(new Set(Object.values(COMPOSER_BASES)).size).toBe(5)
    expect(COMPOSER_BASES.serif).toContain('8156f838798c-serif-compose-layout-v4-serif-f7+variants')
    expect(COMPOSER_BASES.regular).toContain('c14ee5e08798-regular-compose-layout-v4-regular-f7')
    expect(COMPOSER_BASES.fangsong).toContain('9f797e2322d2-fangsong-compose-layout-v4-fangsong-f7')
    expect(COMPOSER_BASES['pen-writing']).toContain('ce3eaafda8f9-kaisho-compose-layout-v4-kaisho-f7')
    expect(COMPOSER_BASES.sans).toContain('a83fc941166b-sans-compose-layout-v4-f7+variants')
  })
})
