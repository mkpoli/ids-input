// The merged corpus: an artifact a rebuild reproduces, whose ready rows the composer can parse and
// whose unencoded components are addressable forms.
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parse } from '../src/core/ids.js'

const corpus = JSON.parse(gunzipSync(readFileSync(new URL('../data/ids-corpus.json.gz', import.meta.url))).toString('utf8'))
const rows = corpus.descriptions.rows
const column = name => corpus.descriptions.columns.indexOf(name)
const subject = column('subject'), text = column('text'), resolved = column('resolved')
const role = column('role'), regions = column('regions'), status = column('status')

describe('the merged corpus', () => {
  it('names its format, version and licence', () => {
    expect(corpus.format).toBe('ids-input/ids-corpus')
    expect(corpus.version).toBe(1)
    expect(corpus.licence.spdx).toBe('GPL-2.0-or-later')
  })

  it('carries one row per distinct description', () => {
    const keys = new Set(rows.map(row => `${row[subject]}\0${row[text]}\0${row[regions]}\0${row[role]}`))
    expect(keys.size).toBe(rows.length)
  })

  it('parses every ready description with the composer’s own parser', () => {
    const ready = rows.filter(row => row[status] === 'ready')
    expect(ready.length).toBeGreaterThan(100000)
    for (const row of ready) parse(row[text])
  })

  it('leaves an entity-bearing description unresolved rather than guessing', () => {
    const entity = rows.filter(row => row[text].includes('&'))
    expect(entity.length).toBeGreaterThan(0)
    for (const row of entity) {
      expect(row[status]).toBe('unresolved')
      expect(row[resolved]).toContain('&chise:')
    }
  })

  it('gives every unencoded component a form that parses inside a tree', () => {
    const [cidColumn, charColumn] = [0, 1]
    expect(corpus.components.rows.length).toBe(corpus.counts.components)
    for (const row of corpus.components.rows) {
      const point = Number.parseInt(String(row[charColumn]).slice(2), 16)
      expect(point).toBeGreaterThanOrEqual(corpus.pua.base)
      expect(() => parse(`⿰${String.fromCodePoint(point)}木`)).not.toThrow()
      expect(/^(?:chise|bsp):/.test(row[cidColumn])).toBe(true)
    }
  })

  it('records the equivalences its alignment finds between numbers, entities and characters', () => {
    const known = new Set(corpus.components.rows.map(row => row[0]))
    expect(corpus.equivalences.rows.length).toBe(corpus.counts.equivalences)
    for (const row of corpus.equivalences.rows) {
      const [a, b, basis, status, prov, note] = row
      const ns = [a.split(':')[0], b.split(':')[0]]
      expect(ns).not.toEqual(['ucs', 'ucs'])
      expect(ns.some(ns => ns === 'bsp' || ns === 'chise')).toBe(true)
      for (const cid of [a, b]) if (cid.startsWith('bsp:') || cid.startsWith('chise:')) expect(known.has(cid)).toBe(true)
      expect(basis).toBe('alignment')
      expect(['verified', 'candidate']).toContain(status)
      expect(prov.length).toBeGreaterThan(0)
      expect(note).toMatch(/^\d+ characters?: /)
      for (const cid of [a, b]) if (cid.startsWith('ucs:')) {
        const point = Number.parseInt(cid.slice(4), 16)
        expect(point >= 0xd800 && point <= 0xdfff).toBe(false)
      }
    }
    expect(corpus.equivalences.rows.find(row => row[0] === 'bsp:7' && row[1] === 'chise:CDP-8BD0')?.[3]).toBe('verified')
    expect(corpus.equivalences.rows.find(row => row[0] === 'bsp:7' && row[1] === 'ucs:53C0')?.[3]).toBe('verified')
  })

  it('resolves every name its descriptions use', () => {
    const known = new Set(corpus.components.rows.map(row => row[0]))
    for (const row of rows) for (const [, name] of (row[text].matchAll(/&([^;]+);/g))) expect(known.has(`chise:${name}`)).toBe(true)
  })
})
