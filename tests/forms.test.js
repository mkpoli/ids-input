// The forms a component may be written as: sequences, sibling encodings and named variants.
import { expect, it } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { componentForms, ucvFormOf, ucvIdentifier, writtenForm } from '../src/core/forms.js'
import { createUcvIndex } from '../src/core/ucv.js'
import { parse, variantIdentifier, write } from '../src/core/ids.js'

const ucv = createUcvIndex(JSON.parse(await readFile(new URL('../data/ucv.json', import.meta.url), 'utf8')))
const DOTTED = '者\u{E0101}'

it('gives nothing for a component with one form, a node or an empty slot', () => {
  expect(componentForms('一', { ucv })).toEqual([])
  expect(componentForms(null, { ucv })).toEqual([])
  expect(componentForms(/** @type {any} */ ({ op: '⿰', parts: ['氵', '壬'] }), { ucv })).toEqual([])
})

it('lists the character, then its variation sequences', () => {
  const forms = componentForms('者', { sequences: new Map([['者', [DOTTED]]]) })
  expect(forms).toEqual([{ write: '者', kind: 'plain' }, { write: DOTTED, kind: 'sequence' }])
  expect(writtenForm(forms, DOTTED)?.kind).toBe('sequence')
})

it('offers the other characters of a unifiable entry as sibling encodings', () => {
  const forms = componentForms('壬', { ucv })
  expect(forms.map(form => form.write)).toEqual(['壬', '王', '𡈼'])
  expect(forms[1]).toEqual({ write: '王', kind: 'sibling', entry: '1', unifiable: true, form: 3, glyph: 'u738b' })
})

it('offers the other character of a non-unifiable entry, marked as such', () => {
  const forms = componentForms('閒', { ucv })
  const sibling = forms.find(form => form.write === '間')
  expect(sibling?.kind).toBe('sibling')
  expect(sibling?.unifiable).toBe(false)
  expect(sibling?.entry).toBe('325')
})

it('offers a description an entry gives for a form', () => {
  const forms = componentForms('烕', { ucv })
  expect(forms.map(form => form.write)).toContain('⿵戊天')
})

it('writes a form no code point names with its variant identifier only when asked', () => {
  expect(componentForms('壬', { ucv }).some(form => form.kind === 'variant')).toBe(false)
  const forms = componentForms('壬', { ucv, variants: true })
  expect(forms.map(form => form.write)).toEqual(['壬', '壬q0012', '王', '𡈼'])
  expect(forms[1]).toEqual({ write: '壬q0012', kind: 'variant', entry: '1', unifiable: true, form: 2, glyph: 'u58ec-t' })
})

it('names a form the way zi.tools does', () => {
  expect(ucvIdentifier('8a', 2, 2)).toBe('q008a2')
  expect(ucvIdentifier('213a', 9, 13)).toBe('q213a09')
  expect(ucvIdentifier('298za', 1, 2)).toBeNull()
  expect(variantIdentifier('q008a2')).toEqual({ kind: 'ucv', sign: 'q', entry: '8a', form: 2, other: '' })
  expect(variantIdentifier('q213a09')).toEqual({ kind: 'ucv', sign: 'q', entry: '213a', form: 9, other: '' })
})

it('reads a component with such an identifier back as that form', () => {
  const found = ucvFormOf(ucv, '壬q0012')
  expect(found?.entry.id).toBe('1')
  expect(found?.form.glyph).toBe('u58ec-t')
  expect(ucvFormOf(ucv, '壬')).toBeNull()
  expect(ucvFormOf(ucv, '壬T')).toBeNull()
  // An entry the component is no form of.
  expect(ucvFormOf(ucv, '壬q3212')).toBeNull()
  expect(writtenForm(componentForms('壬q0012', { ucv, variants: true }), '壬q0012')?.kind).toBe('variant')
})

it('keeps the identifier on the component when a description is read and written', () => {
  const read = parse('⿰氵壬q0012')
  expect(read.problem).toBeUndefined()
  expect(/** @type {any} */ (read.tree).parts).toEqual(['氵', '壬q0012'])
  expect(write(/** @type {any} */ (read.tree))).toBe('⿰氵壬q0012')
})

import { formedTree, glyphReference } from '../src/core/forms.js'
import { runPreview } from '../src/core/preview.js'

it('writes a form only an outline draws as its glyph reference, and drops other identifiers', () => {
  const shaped = formedTree(/** @type {any} */ (parse('⿰氵.壬q0012').tree), ucv)
  expect(shaped.formed).toBe(true)
  expect(write(/** @type {any} */ (shaped.tree))).toBe('⿰氵&GW-u58ec-t;')
  expect(glyphReference('u58ec-t')).toBe('&GW-u58ec-t;')
  const plain = formedTree(/** @type {any} */ (parse('⿰氵.壬T').tree), ucv)
  expect(plain.formed).toBe(false)
  expect(write(/** @type {any} */ (plain.tree))).toBe('⿰氵壬')
})

it('leaves a form no source draws, and an identifier of another entry, as the plain component', () => {
  expect(componentForms('氵', { ucv, variants: true })).toEqual([])
  expect(formedTree('氵q4302', ucv)).toEqual({ tree: '氵', formed: false })
  expect(formedTree('壬q3212', ucv)).toEqual({ tree: '壬', formed: false })
})

it('asks the preview for the formed description, and for no final image of it', async () => {
  /** @type {string[]} */
  const asked = []
  const steps = await new Promise(resolve => {
    /** @type {any[]} */
    const seen = []
    runPreview('⿰氵壬q0012', {
      preview: async (/** @type {string} */ text) => { asked.push(`preview ${text}`); return { d: 'M0 0' } },
      drawing: async (/** @type {string} */ text) => { asked.push(`drawing ${text}`); return 'final.png' },
      formed: async () => '⿰氵&GW-u58ec-t;',
      signal: new AbortController().signal,
    }, patch => { seen.push(patch); if (patch.step) resolve(seen) })
  })
  expect(asked).toEqual(['preview ⿰氵&GW-u58ec-t;'])
  expect(steps.at(-1).step).toBe('composed')
})

it('draws the plain description, final image and all, where no identifier names a form', async () => {
  /** @type {string[]} */
  const asked = []
  await new Promise(resolve => runPreview('⿰氵壬T', {
    preview: async (/** @type {string} */ text) => { asked.push(`preview ${text}`); return { d: 'M0 0' } },
    drawing: async (/** @type {string} */ text) => { asked.push(`drawing ${text}`); return null },
    formed: async () => null,
    signal: new AbortController().signal,
  }, patch => { if (patch.step) resolve(patch) }))
  expect(asked.sort()).toEqual(['drawing ⿰氵壬', 'preview ⿰氵壬'])
})

import { formedText } from '../src/core/forms.js'

it('forms one component alone, which is no description', () => {
  expect(formedText('壬q0012', ucv)).toBe('&GW-u58ec-t;')
  expect(formedText('⿰氵壬q0012', ucv)).toBe('⿰氵&GW-u58ec-t;')
  expect(formedText('壬T', ucv)).toBeNull()
  expect(formedText('壬', ucv)).toBeNull()
  expect(formedText('ab12', ucv)).toBeNull()
})
