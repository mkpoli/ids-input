import { describe, expect, it } from 'bun:test'
import { createRenderNormalizer } from '@han-compose/composer/normalization'

const ARITY = { '⿰': 2, '⿱': 2, '⿻': 2, '⿳': 3 }
const parse = text => {
  const chars = [...text]
  let at = 0
  const walk = () => {
    const char = chars[at++]
    if (char === undefined) throw new Error('Missing operand')
    if (!ARITY[char]) {
      if (/^[\uFE00-\uFE0F]$/u.test(chars[at] ?? '')) return char + chars[at++]
      return char
    }
    let note
    if (chars[at] === '[') {
      const end = chars.indexOf(']', at)
      if (end < 0) throw new Error('Missing annotation end')
      note = chars.slice(at + 1, end).join('')
      at = end + 1
    }
    const node = [char, ...Array.from({ length: ARITY[char] }, walk)]
    if (note) node.note = note
    return node
  }
  const node = walk()
  if (at !== chars.length) throw new Error('Extra input')
  return node
}
const keyOf = node => typeof node === 'string' ? node : node[0] + (node.note ? `[${node.note}]` : '') + node.slice(1).map(keyOf).join('')
const setup = (records, options = {}) => {
  const reads = []
  const normalizer = createRenderNormalizer({ record: key => { reads.push(key); return records[key] ?? null }, parse, keyOf, ...options })
  return { normalizer, reads, resolve: text => normalizer.resolve(parse(text)) }
}

// These are synthetic export identities; no spelling is inferred from glyph resemblance.
describe('render normalization', () => {
  it('contracts independent subtrees bottom up and preserves source child plans', () => {
    const { resolve } = setup({ '⿰口寸': { e: '吋' }, '⿱吋吋': { e: '甲' } })
    const plan = resolve('⿱⿰口寸⿰口寸')
    expect(plan.source).toBe('⿱⿰口寸⿰口寸')
    expect(plan.key).toBe('甲')
    expect(plan.node).toBe('甲')
    expect(plan.encoded).toBe('甲')
    expect(plan.children.map(child => child.source)).toEqual(['⿰口寸', '⿰口寸'])
    expect(plan.children.map(child => child.key)).toEqual(['吋', '吋'])
    expect(plan.children[0].children.map(child => child.source)).toEqual(['口', '寸'])
    expect(plan.capped).toBe(false)
  })

  it('keeps proven child contractions when the whole expression has no encoded match', () => {
    const { resolve } = setup({ '⿰口寸': { e: '吋' } })
    const plan = resolve('⿱木⿰口寸')
    expect(plan.key).toBe('⿱木吋')
    expect(plan.node).toEqual(['⿱', '木', '吋'])
    expect(plan.encoded).toBeNull()
    expect(plan.capped).toBe(false)
  })

  it('uses original exact evidence before a conflicting contracted spelling', () => {
    const { resolve } = setup({ '⿰口寸': { e: '吋' }, '⿱木⿰口寸': { e: '甲' }, '⿱木吋': { e: '乙' } })
    expect(resolve('⿱木⿰口寸').key).toBe('甲')
  })

  it('finds evidence beyond two decomposition passes', () => {
    const { resolve } = setup({ A: { s: 'B' }, B: { s: 'C' }, C: { s: 'D' }, D: { s: 'E' }, '⿱E木': { e: '甲' } })
    const plan = resolve('⿱A木')
    expect(plan.key).toBe('甲')
    expect(plan.children[0].key).toBe('A')
    expect(plan.capped).toBe(false)
  })

  it('can expand one operand while another remains contracted', () => {
    const { resolve } = setup({ A: { s: '⿰口木' }, '⿰口木': { e: 'A' }, '⿰口寸': { e: '吋' }, '⿱⿰口木吋': { e: '甲' } })
    expect(resolve('⿱A⿰口寸').key).toBe('甲')
  })

  it('does not replace a native atom or unresolved operator with unsuccessful expansion evidence', () => {
    const { resolve } = setup({ A: { s: '⿰口木' } })
    expect(resolve('A').key).toBe('A')
    expect(resolve('⿱A木').key).toBe('⿱A木')
  })

  it('keeps source atoms distinct from characters sharing their decomposition', () => {
    const { resolve } = setup({ 甲: { s: '⿰木木' }, '⿰木木': { e: '林' }, '⿱林口': { e: '乙' } })
    const atom = resolve('甲')
    expect(atom.key).toBe('甲')
    expect(atom.encoded).toBeNull()
    const compound = resolve('⿱甲口')
    expect(compound.key).toBe('乙')
    expect(compound.children[0].key).toBe('甲')
    expect(compound.children[0].encoded).toBeNull()
    expect(setup({ 甲: { e: '乙' } }).resolve('甲').key).toBe('乙')
  })

  it('follows explicit encoded chains and rejects encoded cycles', () => {
    const chain = setup({ '⿰口寸': { e: 'A' }, A: { e: 'B' }, B: { e: 'C' } })
    expect(chain.resolve('⿰口寸').key).toBe('C')
    const cycle = setup({ '⿰口寸': { e: 'A' }, A: { e: 'B' }, B: { e: 'A' } })
    expect(cycle.resolve('⿰口寸').key).toBe('⿰口寸')
    expect(cycle.resolve('A').key).toBe('A')
  })

  it('terminates self and mutual decomposition cycles without claiming an identity', () => {
    for (const records of [{ A: { s: 'A' } }, { A: { s: 'B' }, B: { s: 'A' } }]) {
      const { resolve, reads } = setup(records)
      const plan = resolve('⿱A木')
      expect(plan.key).toBe('⿱A木')
      expect(plan.capped).toBe(false)
      expect(reads.length).toBeLessThan(10)
    }
  })

  it('excludes encoded targets while permitting excluded atoms as decomposition evidence', () => {
    const excluded = key => key === 'A' || key === '吋'
    expect(setup({ '⿰口寸': { e: '吋' } }, { excluded }).resolve('⿰口寸').key).toBe('⿰口寸')
    const plan = setup({ A: { s: 'B' }, '⿱B木': { e: '甲' } }, { excluded }).resolve('⿱A木')
    expect(plan.key).toBe('甲')
  })

  it('preserves operator notes through child contraction and independent expansion', () => {
    const { resolve } = setup({ '⿰口寸': { e: '吋' }, '⿻木吋': { e: '甲' }, A: { s: 'B' }, '⿻[1:]B吋': { e: '乙' } })
    const noted = resolve('⿻[1:]木⿰口寸')
    expect(noted.key).toBe('⿻[1:]木吋')
    expect(noted.node.note).toBe('1:')
    expect(noted.encoded).toBeNull()
    expect(resolve('⿻[1:]A⿰口寸').key).toBe('乙')
    expect(resolve('⿻木⿰口寸').node).not.toHaveProperty('note')
  })

  it('does not erase variation selectors or derive equivalence from similar components', () => {
    const { resolve } = setup({ '⿱木口': { e: '甲' }, '⿰口寸': { e: '吋' } })
    for (const text of ['⿱木\uFE00口', '⿰口\uFE00寸', '⿱⿻韦丷吋', '⿱⿻龶⿱乛丷吋']) {
      expect(resolve(text).key).toBe(text)
      expect(resolve(text).encoded).toBeNull()
    }
  })

  it('rejects malformed or annotation-dropping decomposition evidence', () => {
    const records = { A: { s: '⿰木' }, B: { s: '⿻[1:]木口' }, '⿻木口': { e: '甲' } }
    const droppingParse = text => {
      const node = parse(text)
      if (Array.isArray(node)) delete node.note
      return node
    }
    expect(setup(records).resolve('A').key).toBe('A')
    expect(setup(records, { parse: droppingParse }).resolve('B').key).toBe('B')
  })

  it('does not mutate or annotate input arrays', () => {
    const node = parse('⿻[1:]木⿰口寸')
    const before = structuredClone(node)
    const { normalizer } = setup({ '⿰口寸': { e: '吋' } })
    const plan = normalizer.resolve(node)
    expect(node).toEqual(before)
    expect(node[2]).toEqual(['⿰', '口', '寸'])
    expect(plan.node).not.toBe(node)
    expect(Object.isFrozen(plan)).toBe(true)
    expect(Object.isFrozen(plan.children)).toBe(true)
  })

  it('does not retain negative record results across resolve calls', () => {
    const records = {}
    const { resolve } = setup(records)
    expect(resolve('⿰口寸').key).toBe('⿰口寸')
    records['⿰口寸'] = { e: '吋' }
    expect(resolve('⿰口寸').key).toBe('吋')
  })

  it('shares positive records across calls without spending their read budget again', () => {
    const { resolve, reads } = setup({ 木: {}, 口: {}, '⿱木口': {}, '⿰木口': {} }, { limits: { records: 4 } })
    for (let i = 0; i < 100; i++) {
      const plan = resolve(i % 2 ? '⿱木口' : '⿰木口')
      expect(plan.capped).toBe(false)
    }
    expect(reads).toHaveLength(4)
    expect(new Set(reads).size).toBe(4)
  })

  it('retries null records across calls until a positive record is available', () => {
    const records = {}
    const { resolve, reads } = setup(records)
    resolve('甲')
    resolve('甲')
    records['甲'] = {}
    resolve('甲')
    resolve('甲')
    expect(reads).toEqual(['甲', '甲', '甲'])
  })

  it('retains a proved target when the read budget stops its remaining chain', () => {
    const { resolve, reads } = setup({ '⿰木木': { e: '甲' }, 甲: { e: '乙' } }, { limits: { records: 1 } })
    const plan = resolve('⿰木木')
    expect(plan.key).toBe('甲')
    expect(plan.encoded).toBe('甲')
    expect(plan.capped).toBe(true)
    expect(reads).toEqual(['⿰木木'])
  })

  it('retains a validated hop when the work budget ends', () => {
    const plan = setup({ '⿰口寸': { e: '吋' } }, { limits: { work: 2 } }).resolve('⿰口寸')
    expect(plan.key).toBe('吋')
    expect(plan.encoded).toBe('吋')
    expect(plan.capped).toBe(true)
  })

  it('retains a validated hop when the chain depth ends', () => {
    const plan = setup({ 甲: { e: '乙' }, 乙: { e: '丙' } }, { limits: { depth: 0 } }).resolve('甲')
    expect(plan.key).toBe('乙')
    expect(plan.encoded).toBe('乙')
    expect(plan.capped).toBe(true)
  })

  it('retains only validated hops when the node budget ends', () => {
    const records = { '⿰口寸': { e: '吋' }, 吋: { e: '甲' } }
    const partial = setup(records, { limits: { nodes: 4 } }).resolve('⿰口寸')
    expect(partial.key).toBe('吋')
    expect(partial.encoded).toBe('吋')
    expect(partial.capped).toBe(true)
    const unproved = setup(records, { limits: { nodes: 3 } }).resolve('⿰口寸')
    expect(unproved.key).toBe('⿰口寸')
    expect(unproved.encoded).toBeNull()
    expect(unproved.capped).toBe(true)
  })

  it('rejects the chain when a later target is cyclic, malformed, compound or excluded', () => {
    for (const target of ['吋', '⿰木', '⿰木木', '甲', '', 42]) {
      const plan = setup({ '⿰口寸': { e: '吋' }, 吋: { e: target } }, { excluded: key => key === '甲' }).resolve('⿰口寸')
      expect(plan.key).toBe('⿰口寸')
      expect(plan.encoded).toBeNull()
      expect(plan.capped).toBe(false)
    }
  })

  it('reads target records so a store can request their shards', () => {
    const { resolve, reads } = setup({ '⿰口寸': { e: '吋' } })
    expect(resolve('⿰口寸').key).toBe('吋')
    expect(reads).toContain('吋')
    expect(new Set(reads).size).toBe(reads.length)
  })

  it('has deterministic per-call caps on reads, candidate nodes, work and depth', () => {
    const records = { A: { s: 'B' }, B: { s: 'C' }, C: { s: 'D' }, '⿱D木': { e: '甲' } }
    for (const limits of [{ records: 2 }, { nodes: 3 }, { work: 1 }, { depth: 0 }]) {
      const first = setup(records, { limits }), second = setup(records, { limits })
      const a = first.resolve('⿱A木'), b = second.resolve('⿱A木')
      expect(a.capped).toBe(true)
      expect(a.key).toBe(b.key)
      expect(first.reads).toEqual(second.reads)
      if (limits.records !== undefined) expect(first.reads.length).toBeLessThanOrEqual(limits.records)
    }
  })

  it('does not reset the work or read budget for each child', () => {
    const { resolve, reads } = setup({ A: { s: 'B' }, C: { s: 'D' }, E: { s: 'F' } }, { limits: { records: 4 } })
    expect(resolve('⿳ACE').capped).toBe(true)
    expect(reads.length).toBeLessThanOrEqual(4)
  })

  it('bounds actual callback volume across one hundred resolve calls', () => {
    const { normalizer, reads } = setup({})
    const outcomes = Array.from({ length: 100 }, (_, i) => normalizer.resolve(['⿱', String.fromCodePoint(0x4e00 + i), '木']))
    expect(reads).toHaveLength(256)
    expect(outcomes.at(-1).capped).toBe(true)
  })

  it('is idempotent for normalized keys and trees', () => {
    const { normalizer, resolve } = setup({ '⿰口寸': { e: '吋' }, 吋: { s: '⿰口寸' } })
    for (const text of ['⿱木⿰口寸', '⿰口寸', '⿻[1:]木⿰口寸']) {
      const once = resolve(text), twice = normalizer.resolve(once.node)
      expect(twice.key).toBe(once.key)
      expect(twice.node).toEqual(once.node)
    }
  })

  it('rejects invalid limits', () => {
    for (const limits of [{ records: -1 }, { depth: 1.5 }, { nodes: Infinity }, { work: NaN }]) {
      expect(() => setup({}, { limits })).toThrow(RangeError)
    }
  })
})
