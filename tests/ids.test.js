import { describe, expect, it } from 'bun:test'
import { EMPTY, OPERATORS, OPERATOR_GROUPS, applyOperator, arity, clear, descriptionEnd, isComponent, isDescription, isLetter, isSequence, leaves, nextEmpty,
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
    expect(parse('⿰亻\u0378').problem).toBe('component')
    expect(parse('木').problem).toBe('character')
    expect(parse('').problem).toBe('character')
    expect(parse('⿰亻 木').problem).toBe('character')
    expect(parse('⿰' + '⿰'.repeat(64)).problem).toBe('character')
    expect(problemOf('⿰亻木')).toBeNull()
    expect(problemOf('⿰亻')).toBe('missing')
  })
  it('keeps a zi.tools modifier with its operator', () => {
    expect(parse('⿴[1]囗人').tree).toEqual({ op: '⿴', parts: ['囗', '人'], note: '1' })
    expect(write(parse('⿻[1:]丨日').tree)).toBe('⿻[1:]丨日')
    expect(write(parse('⿻[.,x]〢日').tree)).toBe('⿻[.,x]〢日')
    expect(write(parse('㇯[2]王一').tree)).toBe('㇯[2]王一')
    expect(descriptionEnd([...'⿻[1:]丨日木'])).toBe(7)
    // Brackets outside the modifier grammar still stand as components.
    expect(write(parse('⿰[木').tree)).toBe('⿰[木')
    expect(parse('⿰[]木').problem).toBe('extra')
    // Editing below the operator keeps the modifier with it.
    expect(write(place(parse('⿴[1]囗水').tree, [1], { op: '⿰', parts: ['水', '一'] }).tree)).toBe('⿴[1]囗⿰水一')
    // A different operator starts without one.
    expect(write(swapOp(parse('⿴[1]囗人').tree, [], '⿵').tree)).toBe('⿵囗人')
    // Only operators zi.tools gives modifiers to read one; elsewhere the brackets stay components.
    expect(parse('⿲[1]').tree).toEqual({ op: '⿲', parts: ['[', '1', ']'] })
    expect(parse('⿸[1]厂人').problem).toBe('extra')
    // A note that is not a modifier is not written back.
    expect(write({ op: '⿴', note: 'x]y', parts: ['囗', '人'] })).toBe('⿴囗人')
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
    expect(isComponent('\u0378')).toBe(false)
    expect(isComponent(null)).toBe(false)
  })
  it('takes letters and digits independently of preview font coverage', () => {
    expect(parse('⿸广⿰KO').tree).toEqual({ op: '⿸', parts: ['广', { op: '⿰', parts: ['K', 'O'] }] })
    for (const char of ['a', 'Z', '0', 'é', 'Ω', 'Ж', 'ӂ', 'ꙮ', 'ά', 'א', 'ش', 'अ', '𐐀', 'あ', 'ア', 'ー', 'ㇰ', '가', 'ㄱ', 'ᄀ', 'Ｋ', '０', 'ｶ', '\u{1B001}']) {
      expect(isLetter(char)).toBe(true)
      expect(isComponent(char)).toBe(true)
    }
    // Spaces and invisible Hangul fillers stay out.
    for (const char of [' ', '\u3164', '\u115F', '\uFFA0']) expect(isComponent(char)).toBe(false)
    expect(isLetter('木')).toBe(false)
  })
  it('round-trips ideographs, symbols and private-use components', () => {
    for (const char of ['〇', '〆', '〡', '𛅰', '𘬀', '!', '.', '-', '∞', '☯', '😀', '\u0301', '\uE000', '\u{F0000}', '\u{100000}']) {
      const text = `⿰${char}木`
      expect(isComponent(char)).toBe(true)
      expect(write(parse(text).tree)).toBe(text)
      expect(descriptionEnd([...text])).toBe([...text].length)
    }
    expect(isLetter('〇')).toBe(false)
    expect(parse('〇', { open: true }).tree).toBe('〇')
    expect(write(parse('⿰〇\u{E0100}木').tree)).toBe('⿰〇\u{E0100}木')
  })
  it('reserves operators, slots and invisible or invalid code points', () => {
    for (const char of [...OPERATORS.map(([op]) => op), EMPTY, '＋', '\u0000', '\u200D', '\uFE0F', '\u{E0100}', '\uD800', '\uFFFF', '\u{10FFFF}', '\u0378']) {
      expect(isComponent(char)).toBe(false)
    }
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
    expect(descriptionEnd([...'\u0378'])).toBe(-1)
    expect(descriptionEnd([...'⿰KO and'])).toBe(3)
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
    expect(parse('⿰亻\u0378', { open: true }).problem).toBe('component')
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
  it('puts the whole tree inside a new empty enclosure', () => {
    for (const op of ['⿴', '⿵', '⿶', '⿷', '⿸', '⿹', '⿺', '⿼', '⿽']) {
      const { tree: next, chosen } = applyOperator(tree('⿰亻⬚'), null, op)
      expect(write(next)).toBe(`${op}⬚⿰亻⬚`)
      expect(chosen).toEqual([0])
    }
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

describe('the operator groups', () => {
  it('hold every operator once, each in the group of its arity', () => {
    const all = OPERATOR_GROUPS.flatMap(group => group.ops)
    expect(all.slice().sort()).toEqual(OPERATORS.map(([op]) => op).sort())
    for (const group of OPERATOR_GROUPS) for (const op of group.ops) expect(arity(op)).toBe(group.arity)
  })
})
