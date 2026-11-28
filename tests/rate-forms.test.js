// @ts-check
import { expect, test } from 'bun:test'
import { parse, write, place, partAt } from '../src/core/ids.js'
import { rateFormsOfPart, formSpelling, readFormSpelling, variationFamiliesOfPart } from '../src/core/variation-families.js'
import { rateHosts } from '@han-compose/composer/rate-forms'

test('all reviewed spellings remember the same four choices after a nested IDS round trip', () => {
  for (const host of rateHosts) {
    const options = rateFormsOfPart(host)
    expect(options.map(form => form.id)).toEqual(['cn-chevron', 'cn-strokes', 'jp-chevron', 'jp-strokes'])
    const source = parse('⿰氵' + host, { open: true }).tree
    if (!source) throw Error(host)
    for (const form of options) {
      const part = readFormSpelling(partAt(source, [1]), form.text)
      expect(part).not.toBeNull()
      const written = write(place(source, [1], part).tree)
      expect(written).toBe('⿰氵' + form.text)
      const reopened = parse(written, { open: true }).tree
      if (!reopened) throw Error(written)
      const picked = partAt(reopened, [1])
      expect(rateFormsOfPart(picked)).toEqual(options)
      expect(readFormSpelling(picked, form.text)).toBeNull()
    }
  }
  expect(rateFormsOfPart(parse('⿰率木').tree)).toEqual([])
  expect(rateFormsOfPart(null)).toEqual([])
})

test('loose marks survive changes from an exact subtree back to a native variation sequence', () => {
  const original = '率\u0301'
  const options = rateFormsOfPart(original)
  const expanded = readFormSpelling(original, options[0].text)
  expect(formSpelling(expanded)).toBe(options[0].text)
  const restored = readFormSpelling(expanded, options[3].text)
  expect(restored && write(restored)).toBe('率\u{E0101}\u0301')
})

test('a host catalogue shares the picker with the reviewed drawings and excludes evidence-only entries', () => {
  const forms = rateFormsOfPart('率')
  const supplied = { id: 'registered', subjects: ['率'], forms: forms.map(({ text }, i) => ({ id: String(i), text })) }
  const sourceOnly = { ...supplied, id: 'comparison', evidenceOnly: true }
  expect(variationFamiliesOfPart('率', () => [supplied, sourceOnly]).filter(group => !group.occurrence)).toEqual([supplied])
  expect(variationFamiliesOfPart('率', () => [sourceOnly]).filter(group => !group.occurrence)).toHaveLength(1)
  expect(variationFamiliesOfPart('{53}', () => [sourceOnly])).toEqual([])
})
