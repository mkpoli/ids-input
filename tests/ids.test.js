import { describe, expect, it } from 'bun:test'
import { EMPTY, OPERATORS, applyOperator, arity, clear, descriptionEnd, isComponent, isDescription, isSequence, leaves, nextEmpty,
  parse, partAt, paths, place, problemOf, replaceAt, samePath, swapOp, unwrap, wrap, write } from '../src/core/index.js'

const tree = text => parse(text, { open: true }).tree

describe('a whole description', () => {
  it('reads as a tree of operators and components', () => {
    expect(parse('⿰亻⿱七木').tree).toEqual({ op: '⿰', parts: ['亻', { op: '⿱', parts: ['七', '木'] }] })
    expect(parse('⿲彳⿱山王攵').tree.parts).toHaveLength(3)
    expect(parse('⿾疋').tree).toEqual({ op: '⿾', parts: ['疋'] })
  })
  it('names what is wrong', () => {
    expect(parse('⿰亻').problem).toBe('missing')
    expect(parse('⿰亻木林').problem).toBe('extra')
    expect(parse('⿰亻a').problem).toBe('component')
    expect(parse('木').problem).toBe('character')
    expect(parse('').problem).toBe('character')
    expect(parse('⿰亻 木').problem).toBe('character')
    expect(parse('⿰' + '⿰'.repeat(64)).problem).toBe('character')
    expect(problemOf('⿰亻木')).toBeNull()
    expect(problemOf('⿰亻')).toBe('missing')
  })
  it('keeps a variation selector with its component', () => {
    expect(parse('⿱艹曷\u{E0100}').tree.parts[1]).toBe('曷\u{E0100}')
    expect(leaves(parse('⿱艹曷\u{E0100}').tree).map(leaf => leaf.char)).toEqual(['艹', '曷\u{E0100}'])
  })
  it('takes ？, katakana letters, strokes and radicals as components', () => {
    expect(isDescription('⿰？木')).toBe(true)
    expect(isDescription('⿱コ疋')).toBe(true)
    expect(isDescription('⿱㇒一')).toBe(true)
    expect(isDescription('⿰⺡骨')).toBe(true)
    expect(isComponent('a')).toBe(false)
    expect(isComponent(null)).toBe(false)
  })
  it('knows each operator\'s arity', () => {
    expect(OPERATORS).toHaveLength(18)
    expect(arity('⿲')).toBe(3)
    expect(arity('〾')).toBe(1)
    expect(arity('木')).toBe(0)
    expect(isSequence('⿰')).toBe(true)
    expect(isSequence('木')).toBe(false)
  })
  it('finds where a description ends inside longer text', () => {
    expect(descriptionEnd([...'⿰亻哥と'])).toBe(3)
    expect(descriptionEnd([...'⿰亻'])).toBe(-1)
    expect(descriptionEnd([...'a'])).toBe(-1)
  })
})

describe('a draft read as the editor reads it', () => {
  it('reads ⬚ and the parts still missing at the end as empty slots', () => {
    expect(tree('⿰亻')).toEqual({ op: '⿰', parts: ['亻', null] })
    expect(tree('⿰⬚木')).toEqual({ op: '⿰', parts: [null, '木'] })
    expect(tree('')).toBeNull()
    expect(tree('木')).toBe('木')
  })
  it('still names what is wrong', () => {
    expect(parse('⿰亻木林', { open: true }).problem).toBe('extra')
    expect(parse('⿰亻a', { open: true }).problem).toBe('component')
  })
  it('keeps ？, the part no character names, apart from an empty slot', () => {
    expect(tree('⿰？木')).toEqual({ op: '⿰', parts: ['？', '木'] })
  })
  it('reads a pasted ＋ as an empty slot too, and writes ⬚', () => {
    expect(tree('⿰＋木')).toEqual({ op: '⿰', parts: [null, '木'] })
    expect(write(tree('⿰＋木'))).toBe('⿰⬚木')
    expect(parse('⿰＋木').problem).toBe('component')
  })
  it('writes an empty slot as ⬚, which no whole description takes', () => {
    for (const text of ['⿰⿱匕失⿱コ疋', '⿲亻⬚木', '⿲亻？木', '⿾疋', '⿻⬚⬚']) expect(write(tree(text))).toBe(text)
    expect(write(null)).toBe(EMPTY)
    expect(parse('⿰⬚木').problem).toBe('component')
  })
})

describe('the editor verbs', () => {
  const t = tree('⿰亻⿱七木')
  it('split a slot: the part first, then empty slots', () => {
    expect(write(wrap('⿲', '木'))).toBe('⿲木⬚⬚')
    expect(wrap('⿾', '疋')).toEqual({ op: '⿾', parts: ['疋'] })
  })
  it('swap an operator and keep its parts', () => {
    expect(write(swapOp(t, [1], '⿻').tree)).toBe('⿰亻⿻七木')
    expect(write(swapOp(t, [], '⿲').tree)).toBe('⿲亻⿱七木⬚')
    expect(write(swapOp(tree('⿲亻木⬚'), [], '⿰').tree)).toBe('⿰亻木')
  })
  it('refuse a swap that would drop a filled part', () => {
    expect(swapOp(tree('⿲亻木口'), [], '⿰')).toEqual({ problem: 'drop' })
    expect(swapOp(t, [1], '⿾')).toEqual({ problem: 'drop' })
  })
  it('remove one level, keeping the first part that is filled', () => {
    expect(write(unwrap(t, [1]))).toBe('⿰亻七')
    expect(write(unwrap(tree('⿰⬚木'), []))).toBe('木')
    expect(unwrap(tree('⿰⬚⬚'), [])).toBeNull()
    expect(unwrap(t, [0])).toBe(t)
  })
  it('clear a slot', () => {
    expect(write(clear(t, [1, 0]))).toBe('⿰亻⿱⬚木')
    expect(clear(t, [])).toBeNull()
  })
  it('replace a part, leaving the tree it came from as it was', () => {
    const next = replaceAt(t, [1, 1], '朩')
    expect(write(next)).toBe('⿰亻⿱七朩')
    expect(write(t)).toBe('⿰亻⿱七木')
  })
})

describe('an operator put on a draft', () => {
  it('on an empty tree, chooses its first slot', () => {
    expect(applyOperator(null, [], '⿰')).toEqual({ tree: { op: '⿰', parts: [null, null] }, chosen: [0] })
  })
  it('on a component, splits it and chooses the new slot beside it', () => {
    const { tree: next, chosen } = applyOperator(tree('⿰亻失'), [1], '⿱')
    expect(write(next)).toBe('⿰亻⿱失⬚')
    expect(chosen).toEqual([1, 1])
  })
  it('a unary one on a component chooses the component', () => {
    expect(applyOperator(tree('⿰亻疋'), [1], '⿾').chosen).toEqual([1])
  })
  it('a unary one on an empty slot chooses the slot inside it', () => {
    const { tree: next, chosen } = applyOperator(tree('⿰亻⬚'), [1], '⿾')
    expect(write(next)).toBe('⿰亻⿾⬚')
    expect(chosen).toEqual([1, 0])
  })
  it('on a node, swaps it, or refuses to drop a filled part', () => {
    expect(write(applyOperator(tree('⿰亻木'), [], '⿱').tree)).toBe('⿱亻木')
    expect(applyOperator(tree('⿲亻木口'), [], '⿰')).toEqual({ problem: 'drop' })
  })
  it('with nothing to fill, takes the whole tree as its first part', () => {
    const { tree: next, chosen } = applyOperator(tree('⿰亻木'), null, '⿱')
    expect(write(next)).toBe('⿱⿰亻木⬚')
    expect(chosen).toEqual([1])
  })
})

describe('a part placed', () => {
  it('moves on to the next empty slot, or stays', () => {
    expect(place(tree('⿰⬚⬚'), [0], '亻')).toEqual({ tree: { op: '⿰', parts: ['亻', null] }, chosen: [1] })
    expect(place(tree('⿰亻⬚'), [1], '木').chosen).toEqual([1])
  })
})

describe('moving through a tree', () => {
  const t = tree('⿰⬚⿱七⬚')
  it('steps through every part in reading order', () => {
    expect(paths(t)).toEqual([[], [0], [1], [1, 0], [1, 1]])
    expect(leaves(t).map(leaf => leaf.char)).toEqual([null, '七', null])
    expect(partAt(t, [1, 1])).toBeNull()
    expect(partAt(t, [0, 0])).toBeUndefined()
  })
  it('finds the next empty slot, coming round', () => {
    expect(nextEmpty(t)).toEqual([0])
    expect(nextEmpty(t, [0])).toEqual([1, 1])
    expect(nextEmpty(t, [1, 1])).toEqual([0])
    expect(nextEmpty(tree('⿰亻木'))).toBeNull()
  })
  it('compares paths', () => {
    expect(samePath([1, 0], [1, 0])).toBe(true)
    expect(samePath([], [])).toBe(true)
    expect(samePath([1], [1, 0])).toBe(false)
    expect(samePath(null, [])).toBe(false)
  })
})
