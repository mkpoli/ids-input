// Looking the UCV and NUCV lists up by entry number, by form and by example character.
import { expect, it } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { createUcvIndex, entryCharacters } from '../src/core/ucv.js'

const index = createUcvIndex(JSON.parse(await readFile(new URL('../data/ucv.json', import.meta.url), 'utf8')))
const ids = (/** @type {import('../src/core/ucv.js').UcvEntry[]} */ entries) => entries.map(entry => entry.id)

it('gives every entry for an empty query, in the source order', () => {
  expect(index.find('')).toHaveLength(613)
  expect(index.find('  ')[0].id).toBe('1')
})

it('finds an entry by its number, with the lettered entries beside it', () => {
  expect(ids(index.find('321'))).toEqual(['321'])
  expect(ids(index.find('322'))).toEqual(['322', '322b'])
  expect(ids(index.find('322b'))).toEqual(['322b'])
})

it('finds the entries a character is a form of before those that list it as an example', () => {
  expect(ids(index.find('同'))[0]).toBe('321')
  expect(ids(index.find('爨'))).toContain('321')
  const found = index.find('壬')
  expect(found[0].id).toBe('1')
})

it('reads a form with a variation selector as its character', () => {
  expect(ids(index.formsOf('同\u{E0101}'))).toContain('321')
  expect(index.formsOf('爨')).toEqual([])
})

it('keeps to the list asked for', () => {
  expect(index.find('', { kind: 'not-unifiable' })).toHaveLength(14)
  expect(index.find('間', { kind: 'not-unifiable' }).map(entry => entry.id)).toContain('325')
})

it('counts a compatibility ideograph among an entry\'s examples', () => {
  const entry = index.find('321')[0]
  expect(entryCharacters(entry).examples.has('\u{2F920}')).toBe(true)
  expect(entryCharacters(entry).forms).toEqual(new Set(['同']))
})
