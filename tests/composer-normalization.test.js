import { expect, it } from 'bun:test'
import { Composer, keyOf, parseTree } from '../src/composer/compose.js'
import { compose, createSource } from '../src/composer/loader.js'
import { constants, layout, shards } from './fixtures/composer-export.js'

// Deliberately unequal outline lengths expose spelling-dependent row allocation.
const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
const glyph = (key, box, ink) => ({ k: key, ink, nl: 1, o: 1, G: { v: 1, b: box,
  p: [['MLLL', int16([box[0], box[1], box[2], box[1], box[2], box[3], box[0], box[3]].map(n => n * 4)), int16(Array(8).fill(0))]] } })
const records = {
  木: glyph('木', [100, 0, 900, 800], 3000),
  口: glyph('口', [100, 0, 900, 800], 5000),
  寸: glyph('寸', [100, 0, 900, 800], 6000),
  吋: { ...glyph('吋', [100, 0, 900, 800], 7000), s: '⿰口寸' },
  永: glyph('永', [100, 0, 900, 800], 3200),
  '⿰口寸': { k: '⿰口寸', e: '吋' },
}
const fixture = () => {
  const input = {
    'manifest.json': JSON.stringify({ format: 5, weighted: false, constants, spelled: [], files: { layout: { path: 'layout.json' }, hosts: { bytes: 0 } } }),
    'layout.json': JSON.stringify(layout),
    ...shards('g', Object.entries(records)),
  }
  return createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
}
const readyComposer = async options => {
  const source = fixture()
  await source.ready()
  await source.load(source.filesOf(Object.keys(records)))
  return new Composer(source.store(), options)
}

it('shares outer metrics and donor keys across a contracted component spelling', async () => {
  for (const separate of [false, true]) {
    const c = await readyComposer({ separate })
    const expanded = c.parse('⿰口寸'), original = keyOf(expanded)
    expect(c.renderKey(expanded)).toBe('吋')
    expect(c.ink(expanded)).toBe(c.ink('吋'))
    expect(c.outlines(expanded)).toBe(c.outlines('吋'))
    expect(c.alternatives(expanded, 'B')[0]).toBe('吋')
    expect(c.middleWhole(expanded)).toBe(c.middleWhole('吋'))
    expect(keyOf(expanded)).toBe(original)
    const a = c.compose('⿱木⿰口寸').find(part => part.origin === 'glyph 木')
    const b = c.compose('⿱木吋').find(part => part.origin === 'glyph 木')
    expect(a.target).toEqual(b.target)
  }
})

it('uses canonical records for learned features in both editing modes', async () => {
  for (const separate of [false, true]) {
    const c = await readyComposer({ separate })
    const asked = [], rec = c.rec
    c.rec = key => { asked.push(key); return rec(key) }
    c.predict('⿱', ['木', c.parse('⿰口寸')])
    expect(asked.slice(-2)).toEqual(['木', '吋'])
  }
})

it('loads a newly discovered normalized glyph before returning the drawing', async () => {
  const source = fixture()
  const expanded = await compose(source, '⿱木⿰口寸')
  const contracted = await compose(source, '⿱木吋')
  expect(expanded.d).toBe(contracted.d)
  expect(expanded.origins).toEqual(contracted.origins)
  expect((await compose(fixture(), '⿱木⿰口寸')).d).toBe(expanded.d)
})

it('preserves crossing modifiers through parsing and rendering rewrites', async () => {
  const c = await readyComposer()
  const text = '⿱木⿻[1:]口寸'
  const tree = c.parse(text)
  expect(keyOf(tree)).toBe(text)
  expect(keyOf(c.cancelTransforms(tree))).toBe(text)
  expect(keyOf(c.normalizeYan(tree))).toBe(text)
  expect(keyOf(c.normalizeRepeatedGrids(tree))).toBe(text)
  expect(keyOf(c.normalizeRequestedEnclosures(tree))).toBe(text)
  expect(c.renderKey(tree)).toBe(text)
  const arity = op => c.arity(op)
  expect(parseTree('⿻[1:]口寸', arity).note).toBe('1:')
})

it('prefers a donor with a canonically exact sibling over a closer unrelated density', () => {
  const base = { op: '⿱', j: 1, v: 1, si: 7000, d: 0, k: [0], b: [0, 0, 1000, 1000], r: 0 }
  const hosts = [{ ...base, h: '甲', ok: ['⿰口寸'], si: 14000 }, { ...base, h: '乙', ok: ['日'] }]
  const c = new Composer({ manifest: { constants, spelled: [], files: { hosts: { bytes: 1 } } }, layout,
    rec: key => records[key] ?? null, hosts: (key, place) => key === '木' && place === 'T' ? hosts : [], places: () => [] })
  for (const sibling of [c.parse('⿰口寸'), '吋']) {
    const ranked = c.ranked('⿱', 0, '木', [sibling], [0, 0, 1000, 1000])
    expect(ranked[0][1].record.h).toBe('甲')
  }
})

it('uses the same preferred donor keys when only a source-spelling host exists', () => {
  const c = new Composer({ manifest: { constants, spelled: [], files: { hosts: { bytes: 1, places: ['B\t⿰口寸'] } } }, layout,
    rec: key => records[key] ?? null, hosts: () => [], places: () => [] })
  const expanded = c.parse('⿰口寸')
  expect(c.alternatives(expanded, 'B')).toEqual(c.alternatives('吋', 'B'))
  expect(c.alternatives(expanded, 'B')).toEqual(['吋'])
  expect(c.hasHosts('⿱', ['木', expanded])).toBe(false)
  expect(c.hasHosts('⿱', ['木', '吋'])).toBe(false)
})

it('uses canonical metrics for an explicit encoded mapping on a source atom', () => {
  const evidence = { 甲: { e: '乙', ink: 1000, G: { p: [0] } }, 乙: { ink: 7000, G: { p: [0, 1, 2] } } }
  const c = new Composer({ manifest: { constants, spelled: [] }, layout,
    rec: key => evidence[key] ?? null, hosts: () => [], places: () => [] })
  expect(c.renderKey('甲')).toBe('乙')
  expect(c.ink('甲')).toBe(c.ink('乙'))
  expect(c.outlines('甲')).toBe(c.outlines('乙'))
})

it('does not use an excluded glyph as the normalized metric donor', async () => {
  const c = await readyComposer({ exclude: ['吋'] })
  expect(c.bySequence('⿰口寸')).toBeNull()
  expect(c.ink(c.parse('⿰口寸'))).toBe(11000)
})
