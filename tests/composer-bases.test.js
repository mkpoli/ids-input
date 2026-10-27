import { describe, expect, it } from 'bun:test'

import { COMPOSER_BASE, COMPOSER_BASES } from '../demo/lib/composer.js'

describe('composer faces', () => {
  it('gives each face its own export and keeps Sans as the base export', () => {
    expect(COMPOSER_BASES.sans).toBe(COMPOSER_BASE)
    expect(Object.keys(COMPOSER_BASES).sort()).toEqual(['klee', 'sans', 'serif'])
    expect(new Set(Object.values(COMPOSER_BASES)).size).toBe(3)
    expect(COMPOSER_BASES.serif).toContain('serif-bmp-compose-layout-v4-serif-f5')
    expect(COMPOSER_BASES.klee).toContain('kaisho-compose-layout-v4-kaisho-f5')
  })
})
