import { describe, expect, it } from 'bun:test'

import { COMPOSER_BASE, COMPOSER_BASES } from '../demo/lib/composer.js'

describe('composer faces', () => {
  it('gives each face its own export and keeps Sans as the base export', () => {
    expect(COMPOSER_BASES.sans).toBe(COMPOSER_BASE)
    expect(Object.keys(COMPOSER_BASES).sort()).toEqual(['fangsong', 'klee', 'sans', 'serif'])
    expect(new Set(Object.values(COMPOSER_BASES)).size).toBe(4)
    expect(COMPOSER_BASES.serif).toContain('8156f838798c-serif-compose-layout-v4-serif-f6')
    expect(COMPOSER_BASES.fangsong).toContain('9f797e2322d2-fangsong-compose-layout-v4-fangsong-f6')
    expect(COMPOSER_BASES.klee).toContain('ce3eaafda8f9-kaisho-compose-layout-v4-kaisho-f6')
  })
})
