import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { COMPOSER_BASE } from '../demo/lib/composer.js'
import { isComponent, parse } from '../src/core/ids.js'
import coverage from '../data/unicode-coverage.json' with { type: 'json' }

it('indexes the default composer and bundled Unicode glyphs', () => {
  const catalog = JSON.parse(gunzipSync(readFileSync(new URL('../data/composer-catalog.json.gz', import.meta.url))))
  expect(catalog.base).toBe(COMPOSER_BASE)
  expect(catalog.commit).toMatch(/^[0-9a-f]{7,}$/)
  expect(new Set(catalog.keys).size).toBe(catalog.keys.length)
  expect(catalog.keys.length).toBeGreaterThan(100_000)
  expect(catalog.keys).toContain('木')
  const keys = new Set(catalog.keys)
  for (const name of ['tangut-outlines', 'small-seal-outlines', 'bopomofo-outlines']) {
    const glyphs = JSON.parse(gunzipSync(readFileSync(new URL(`../data/${name}.json.gz`, import.meta.url))))
    expect(Object.keys(glyphs.records).every(key => keys.has(key))).toBe(true)
  }
  expect(catalog.keys.every(key => !parse(key, { open: true }).problem)).toBe(true)
  for (const char of ['א', 'ش', 'अ']) {
    expect(isComponent(char)).toBe(true)
    expect(coverage.some(([a, b]) => char.codePointAt(0) >= a && char.codePointAt(0) <= b)).toBe(true)
  }
})
