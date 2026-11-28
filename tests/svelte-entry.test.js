import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

// The Svelte entry is read as text: its modules compile only under the Svelte plugin.
const entry = readFileSync(new URL('../src/svelte/index.js', import.meta.url), 'utf8')
const exported = new Set([...entry.matchAll(/export\s*\{([^}]*)\}/g)].flatMap(match =>
  match[1].split(',').map(name => name.trim().split(/\s+as\s+/).pop()).filter(Boolean)))

test('the Svelte entry exports the helpers sites build their own panels from', () => {
  for (const name of ['createUnifiable', 'grassForm', 'IdsAlternatives', 'IdsCharacterInfo', 'IdsPartTools'])
    expect(exported.has(name)).toBe(true)
})
