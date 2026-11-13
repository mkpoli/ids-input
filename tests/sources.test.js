// The source catalogue: one entry per source, with the fields the Sources page and the tests rely
// on. The README points at the page, so a citation lands here instead of in a second list.
import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { CATALOGUE, RECORDS } from '../demo/lib/source-catalogue.js'
import { CATEGORIES, FEATURES, SOURCES, TAGS } from '../demo/lib/sources.js'
import { EXAMPLE_SOURCES } from '../demo/lib/example-sources.js'
import { LOCALES, appMessages } from '../demo/lib/locales.js'
import { inline } from '../demo/lib/rich-text.js'

const localeCodes = LOCALES.map(([code]) => code)
const categoryIds = new Set(CATEGORIES.map(([id]) => id))
const tagIds = new Set(TAGS.map(([id]) => id))
const featureIds = new Set(FEATURES.map(([id]) => id))

describe('the source catalogue', () => {
  it('has one entry per id, and the example records follow the top-level sources', () => {
    expect(SOURCES.length).toBeGreaterThanOrEqual(60)
    expect(CATALOGUE).toEqual([...SOURCES, ...RECORDS])
    expect(RECORDS).toHaveLength(EXAMPLE_SOURCES.length)
    const ids = CATALOGUE.map(entry => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(RECORDS.every(entry => entry.id.startsWith('example-'))).toBe(true)
    expect(RECORDS.every(entry => entry.category === 'examples')).toBe(true)
  })

  it('uses a known category and only known tags', () => {
    for (const entry of CATALOGUE) {
      expect(categoryIds.has(entry.category), `${entry.id} has category ${entry.category}`).toBe(true)
      for (const tag of entry.tags) expect(tagIds.has(tag), `${entry.id} has tag ${tag}`).toBe(true)
      expect(entry.title.trim()).not.toBe('')
    }
  })

  it('has a summary in every locale, or a message key that resolves in every locale', () => {
    for (const entry of SOURCES) {
      if (entry.summary) {
        expect(Object.keys(entry.summary).sort()).toEqual([...localeCodes].sort())
        for (const code of localeCodes) expect(entry.summary[code]?.trim(), `${entry.id} ${code}`).not.toBe('')
      }
      if (entry.summaryKey) {
        for (const [code, , catalogue] of LOCALES) {
          const app = appMessages(code)
          expect(app[entry.summaryKey] ?? catalogue[entry.summaryKey], `${entry.id} ${code}`).toBeTruthy()
        }
      }
      expect(Boolean(entry.summary || entry.summaryKey || entry.note)).toBe(true)
    }
  })

  it('is reachable from the README and built as a page', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
    expect(readme).toContain('https://ids.mkpo.li/sources')
    const vite = readFileSync(new URL('../demo/vite.config.js', import.meta.url), 'utf8')
    expect(vite).toContain('sources.html')
    expect(readFileSync(new URL('../demo/sources.html', import.meta.url), 'utf8')).toContain('id="sources"')
  })

  it('escapes a note and keeps only http links', () => {
    expect(inline('<b>木</b>')).toBe('&lt;b&gt;木&lt;/b&gt;')
    expect(inline('[木](https://example.org/a?b=1&c=2)')).toBe('<a href="https://example.org/a?b=1&amp;c=2" target="_blank" rel="noreferrer">木</a>')
    expect(inline('![x](javascript:alert(1))')).not.toContain('<a ')
    expect(inline('a `⿰` b')).toBe('a <code>⿰</code> b')
  })

  it('keeps BabelStone\'s numbered components in the note', () => {
    const note = SOURCES.find(entry => entry.id === 'babelstone')?.note ?? ''
    expect(note).toContain('{12}')
    expect(note).toContain('{82}')
    expect(note).toContain('ids-components.tsv')
  })

  it('carries the sources the catalogue must not lose', () => {
    const ids = new Set(SOURCES.map(entry => entry.id))
    for (const id of ['babelstone', 'glyphwiki', 'jigmo', 'unifont', 'iosevka', 'kanji-tools', 'mybox', 'pinz', 'unicode-18-ch3'])
      expect(ids.has(id), id).toBe(true)
    for (const entry of SOURCES) for (const path of entry.used ?? [])
      expect(existsSync(new URL(`../${path}`, import.meta.url)), `${entry.id}: ${path}`).toBe(true)
  })

  it('names the part of the app each source is used in', () => {
    for (const entry of SOURCES) {
      expect(entry.usedIn?.length, entry.id).toBeGreaterThan(0)
      for (const feature of entry.usedIn ?? []) expect(featureIds.has(feature), `${entry.id}: ${feature}`).toBe(true)
    }
    for (const entry of RECORDS) {
      expect(entry.usedIn).toEqual(['examples'])
      expect(Array.isArray(entry.citedBy)).toBe(true)
    }
    expect(RECORDS[0].citedBy.length).toBeGreaterThan(0)
  })

  it('has every sources message in every locale', () => {
    const keys = Object.keys(appMessages('en')).filter(key => key.startsWith('sources.'))
    for (const [code] of LOCALES) {
      const messages = appMessages(code)
      for (const key of keys) expect(messages[key], `${code} ${key}`).toBeTruthy()
      for (const key of ['sources.title', 'sources.files', 'sources.citedBy', ...FEATURES.map(([id]) => `sources.use.${id}`)]) expect(messages[key], `${code} ${key}`).toBeTruthy()
    }
  })

  it('gives the example records their citation number, status and note', () => {
    for (const [index, entry] of RECORDS.entries()) {
      expect(entry.number).toBe(index + 1)
      expect(entry.note).toBe(EXAMPLE_SOURCES[index].note)
      expect(entry.status).toBe(EXAMPLE_SOURCES[index].status)
      expect(entry.category).toBe('examples')
    }
  })
})
