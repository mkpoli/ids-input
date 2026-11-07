import { expect, it } from 'bun:test'
import { keyOf, parseTree } from '../src/composer/compose.js'
import { FORMS, matchVisualForm, visualFormParts } from '../src/composer/visual-forms.js'
import { constants, layout, shards } from './fixtures/composer-export.js'
import { compose, createSource } from '../src/composer/loader.js'
import { Composer } from '../src/composer/compose.js'

const arity = op => constants.BINARY.includes(op) ? 2 : constants.TERNARY.includes(op) ? 3 : constants.UNARY.includes(op) ? 1 : 0
const parsed = text => parseTree(text, arity)

it('matches every accepted spelling and leaves the base to the composer', () => {
  for (const [sequence, base] of [
    ['⿱⿻龶⿱乛丷吋', '吋'],
    ['⿳⿻韦丷一吋', '吋'],
    ['⿳⿱𰀁乛⿱⺌一⿰口寸', '⿰口寸'],
    ['⿳⿱𰀁乛⿱⺌一吋', '吋'],
  ]) {
    const match = matchVisualForm(keyOf(parsed(sequence)))
    expect(match?.form.id).toBe('shou-hooked-top')
    expect(match?.base).toBe(base)
  }
})

it('does not accept the rejected 韦 grouping', () => {
  expect(matchVisualForm(keyOf(parsed('⿱⿻韦丷吋')))).toBeNull()
})

it('does not match through an operator annotation or a variation selector', () => {
  expect(matchVisualForm(keyOf(parsed('⿱⿻[1]龶⿱乛丷吋')))).toBeNull()
  expect(matchVisualForm(keyOf(parsed('⿱⿻龶︀⿱乛丷吋')))).toBeNull()
})

it('keeps each registered prefix a complete operand sequence', () => {
  for (const form of FORMS) {
    for (const prefix of form.patterns) {
      expect(() => parsed(`${prefix}口`)).not.toThrow()
    }
  }
})

it('declines a separated drawing and an excluded donor', () => {
  const composer = { separate: true, fontStyle: 'sans', renderKey: keyOf, parse: parsed, glyph: () => ({}), excluded: () => false, ink: () => 1, node: () => [] }
  expect(visualFormParts(composer, parsed('⿱⿻龶⿱乛丷吋'), [0, 0, 1000, 1000], keyOf)).toBeNull()
  const excluded = { ...composer, separate: false, excluded: () => true }
  expect(visualFormParts(excluded, parsed('⿱⿻龶⿱乛丷吋'), [0, 0, 1000, 1000], keyOf)).toBeNull()
})

it('declines a missing donor contour', () => {
  const composer = { separate: false, fontStyle: 'sans', renderKey: keyOf, parse: parsed, glyph: () => ({ contours: [] }), excluded: () => false, ink: () => 1, node: () => [] }
  expect(visualFormParts(composer, parsed('⿱⿻龶⿱乛丷吋'), [0, 0, 1000, 1000], keyOf)).toBeNull()
})

const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
const box = ([x0, y0, x1, y1]) => ['MLLL', int16([x0, y0, x1, y0, x1, y1, x0, y1].map(value => value * 4)), int16(Array(8).fill(0))]
const donor = (key, boxes) => ({ k: key, nl: boxes.length, o: boxes.length,
  ink: boxes.reduce((sum, [x0, y0, x1, y1]) => sum + 2 * (x1 - x0 + y1 - y0), 0),
  G: { v: 1, b: [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))], p: boxes.map(box) } })
const formRecords = {
  丨: donor('丨', [[470, 0, 530, 800]]),
  乛: donor('乛', [[700, 600, 950, 660], [880, 600, 930, 700]]),
  三: donor('三', [[340, 790, 660, 820], [280, 720, 720, 750], [190, 660, 810, 695]]),
  一: donor('一', [[60, 440, 940, 475]]),
  丷: donor('丷', [[320, 480, 450, 555], [550, 480, 680, 555]]),
  '𰀁': donor('𰀁', [[400, 760, 600, 800]]),
  '⺌': donor('⺌', [[400, 500, 600, 540]]),
  口: donor('口', [[120, 20, 880, 420]]),
  寸: donor('寸', [[120, 20, 880, 420]]),
  吋: donor('吋', [[100, 20, 900, 430]]),
  '⿰口寸': { k: '⿰口寸', e: '吋' },
}
const sourceOfForms = () => createSource(async name => {
  const input = { 'manifest.json': JSON.stringify({ format: 5, weighted: false, constants, spelled: [], files: { layout: { path: 'layout.json' }, hosts: { bytes: 0 } } }),
    'layout.json': JSON.stringify(layout), ...shards('g', Object.entries(formRecords)) }
  return input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer
})

it('draws donor pieces in a real composer, in both faces, and never in cells', async () => {
  for (const fontStyle of ['sans', 'serif']) {
    const source = sourceOfForms()
    await source.ready()
    await source.load(source.filesOf(Object.keys(formRecords)))
    const composer = new Composer(source.store(), { fontStyle })
    const tree = composer.parse('⿱⿻龶⿱乛丷吋')
    const parts = composer.node(tree, composer.face.slice(), true)
    expect(parts.map(part => part.origin).slice(0, 7)).toEqual(['stem 丨', 'bar 三', 'bar 三', 'bar 三', 'hook 乛', 'bar 一', 'dot 丷'])
    expect(parts.slice(0, 7).every(part => part.fixed)).toBe(true)
    expect(composer.cellsFor(tree)).toBe(false)
    expect(composer.sharedForm(tree)).toBe(true)
    expect(new Composer(source.store(), { fontStyle: 'kaisho' }).sharedForm(tree)).toBe(false)
    expect(new Composer(source.store(), { exclude: ['丨'] }).sharedForm(tree)).toBe(false)
    expect(new Composer(source.store(), { separate: true }).sharedForm(tree)).toBe(false)
    const drawn = await compose(source, '⿱⿻龶⿱乛丷吋')
    expect(drawn.cells).toBeUndefined()
    expect(drawn.origins[0]).toBe('stem 丨')
    await expect(compose(source, '⿱⿻龶⿱乛丷吋', { layout: 'cells' })).rejects.toThrow('Cells layout does not draw shared visual forms.')
  }
})

it('draws the normalized base the same way in both spellings', async () => {
  const source = sourceOfForms()
  await source.ready()
  await source.load(source.filesOf(Object.keys(formRecords)))
  const composer = new Composer(source.store())
  const normal = composer.parse('⿳⿱𰀁乛⿱⺌一吋')
  const expanded = composer.parse('⿳⿱𰀁乛⿱⺌一⿰口寸')
  const a = composer.node(normal, composer.face.slice(), true)
  const b = composer.node(expanded, composer.face.slice(), true)
  expect(a.map(part => part.origin)).toEqual(b.map(part => part.origin))
  expect(a.map(part => part.target)).toEqual(b.map(part => part.target))
  expect(composer.cellsFor(expanded)).toBe(false)
  const dense = '⿳⿱𰀁乛⿱⺌一⿰⿳一口寸⿳一口寸'
  const denseDrawing = await compose(source, dense)
  expect(denseDrawing.cells).toBeUndefined()
  expect(denseDrawing.origins[0]).toBe('stem 丨')
  expect(composer.cellsFor(composer.parse(dense))).toBe(false)
  for (const options of [{ layout: 'cells', exclude: ['丨'] }, { layout: 'cells', fontStyle: 'kaisho' }]) {
    const allowed = await compose(source, dense, options)
    expect(allowed.cells).toBe(true)
    expect(allowed.origins.some(origin => origin.startsWith('stem '))).toBe(false)
  }
})
