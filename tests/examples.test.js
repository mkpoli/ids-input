import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { EXAMPLES, EXAMPLE_GROUPS } from '../demo/lib/examples.js'
import { sourceNumber } from '../demo/lib/example-sources.js'
import { expandNumberedComponents, parseIdsTable, readNumberedComponents } from '../src/adapter/babelstone.js'
import { onlyTangut } from '../src/composer/tangut.js'
import { size } from '../src/composer/loader.js'
import { LONGEST, OPERATORS, parse, leaves } from '../src/core/index.js'

const shipped = parseIdsTable(gunzipSync(readFileSync(new URL('../data/babelstone-ids.tsv.gz', import.meta.url))).toString('utf8'))
const components = readNumberedComponents(readFileSync(new URL('../data/ids-components.tsv', import.meta.url), 'utf8'))
const table = expandNumberedComponents(shipped, components)
/** The characters BabelStone describes with each sequence. */
const described = new Map()
for (const [char, sequences] of table) for (const { text } of sequences) {
  const chars = described.get(text)
  if (chars) { if (!chars.includes(char)) chars.push(char) } else described.set(text, [char])
}

describe('the demo examples', () => {
  it('read as whole descriptions', () => {
    for (const { sequence, char } of EXAMPLES) {
      expect([...sequence].length).toBeLessThanOrEqual(LONGEST)
      if ([...sequence].length === 1) {
        expect(parse(sequence, { open: true }).tree).toBe(sequence)
        expect(char).toBe(sequence)
        continue
      }
      expect(parse(sequence).problem).toBeUndefined()
    }
  })
  it('name a character from BabelStone or a cited alternative description', () => {
    for (const group of EXAMPLE_GROUPS) {
      for (const example of group.examples) {
        const { sequence, char } = example
        const found = described.get(sequence) ?? []
        if (group.key === 'geba') {
          expect(group.refs ?? []).toContain(sourceNumber('geba-wp'))
          const name = char || example.abbreviates
          expect(typeof name).toBe('string')
          expect([...name]).toHaveLength(1)
          if (example.abbreviates) expect([...example.abbreviates]).toHaveLength(1)
        } else if (char) {
          expect([...char]).toHaveLength(1)
          if ('source' in example && example.source === 'data/small-seal.json.gz') {
            const seal = JSON.parse(gunzipSync(readFileSync(new URL('../data/small-seal.json.gz', import.meta.url))))
            expect(seal.table[char]).toContain(sequence)
            expect(seal.modern[char]).toContain(example.modern)
          } else if (example.sequence === '⿰𛂦方') {
            expect(example.refs).toContain(sourceNumber('irg-n2744'))
            expect(table.get(char).map(entry => entry.text)).toContain('⿰？方')
          } else expect(found).toContain(char)
        } else if (sequence === '⿱月朋') {
          // BabelStone assigns this description to 𦜳, a 肉-radical character; the dictionary entry
          // the example cites is a different, unencoded character.
          expect(found).toEqual(['𦜳'])
        } else {
          expect(found).toEqual([])
        }
      }
    }
  })
  it('draw the enclosure each source shows', () => {
    const bySequence = new Map(EXAMPLE_GROUPS.flatMap(group => group.examples.map(example => [example.sequence, example])))
    expect(bySequence.get('⿵门T')?.refs).toContain(sourceNumber('irg-n2744'))
    expect(bySequence.has('⿰门T')).toBe(false)
    expect(bySequence.get('⿺辶⿱𭕄共')?.abbreviates).toBe('選')
    expect(bySequence.has('⿰辶⿱𭕄共')).toBe(false)
    expect(bySequence.get('⿰舟ラ')?.refs).toContain(sourceNumber('ndl-jmtt'))
    expect(bySequence.has('⿰艦ラ')).toBe(false)
  })
  it('keep the Geba abbreviations in one cited group', () => {
    const group = EXAMPLE_GROUPS.find(group => group.key === 'geba')
    expect(group.refs ?? []).toContain(sourceNumber('geba-wp'))
    expect(group.examples).toContainEqual(expect.objectContaining({ sequence: '⿱宀R', char: '', abbreviates: '寮' }))
    expect(group.examples).toContainEqual(expect.objectContaining({ sequence: '⿰言ギ', char: '', abbreviates: '議' }))
    expect(group.examples).toContainEqual(expect.objectContaining({ sequence: '⿰木キ', char: '', abbreviates: '機' }))
    expect(group.examples).toContainEqual(expect.objectContaining({ sequence: '⿵门日', char: '间', abbreviates: '間' }))
    expect(group.examples).toContainEqual(expect.objectContaining({ sequence: '权', char: '权', abbreviates: '権' }))
    expect(group.examples).toContainEqual(expect.objectContaining({ sequence: '战', char: '战', abbreviates: '戦' }))
    expect(group.examples.every(example => example.abbreviates)).toBe(true)
    expect(group.examples).toHaveLength(60)
  })
  it('keep the word ligatures with their sources', () => {
    const group = EXAMPLE_GROUPS.find(group => group.key === 'ligature')
    expect(group.examples.map(example => example.sequence)).toEqual([
      '⿱宀⿺辶⿱⿰王尔⿲隹貝招', '⿱艹⿰马尼', '⿰⿳⿰SIR木阝',
      '⿱⿰⿱コン⿱クリ土', '⿱⿲ンメセ土', '⿸广⿰KO', '⿱宀K', '⿻Mo',
    ])
    const refs = new Map(group.examples.map(example => [example.sequence, example.refs]))
    expect(refs.get('⿱宀⿺辶⿱⿰王尔⿲隹貝招')).toEqual([sourceNumber('l2-12-032'), sourceNumber('utr45')])
    expect(refs.get('⿱艹⿰马尼')).toEqual([sourceNumber('zh-yue-hetizi')])
    expect(refs.get('⿰⿳⿰SIR木阝')).toEqual([sourceNumber('zh-yue-hetizi')])
    for (const sequence of ['⿱⿰⿱コン⿱クリ土', '⿱⿲ンメセ土', '⿸广⿰KO', '⿱宀K', '⿻Mo']) {
      expect(refs.get(sequence)).toEqual([sourceNumber('geba-wp')])
    }
    for (const example of group.examples) expect(example.char).toBe('')
  })
  it("writes out 龍's numbered right part", () => {
    expect(table.get('龍').map(entry => entry.text)).toContain('⿰𦚏⿷己三')
    expect(described.get('⿰𦚏⿷己三')).toContain('龍')
  })
  it('are distinct', () => {
    expect(new Set(EXAMPLES.map(example => example.sequence)).size).toBe(EXAMPLES.length)
  })
})

it('keeps all Tangut examples in a separate section', () => {
  expect(EXAMPLE_GROUPS.map(group => group.key)).toEqual(['basic', 'complex', 'repeated', 'enclosures', 'mixed', 'geba', 'ligature', 'korean', 'seal', 'tangut'])
  const tangut = EXAMPLE_GROUPS.find(group => group.key === 'tangut').examples
  expect(tangut.every(example => onlyTangut(example.sequence))).toBe(true)
  expect(EXAMPLE_GROUPS.filter(group => group.key !== 'tangut').flatMap(group => group.examples).some(example => onlyTangut(example.sequence))).toBe(false)
  expect(tangut).toHaveLength(23)
  const layers = JSON.parse(gunzipSync(readFileSync(new URL('../data/tangut-layers.json.gz', import.meta.url))))
  expect(tangut).toContainEqual({ sequence: '⿱𘠀⿰𘣣𘠐', char: '𗀃' })
  expect(layers.characters['𗀃']).toBe('⿱𘠀𗸡')
  expect(tangut.some(example => example.sequence.includes('⿻'))).toBe(true)
  for (const operator of ['⿰', '⿱', '⿲', '⿳', '⿵', '⿸', '⿺']) {
    expect(tangut.some(example => example.sequence.startsWith(operator))).toBe(true)
  }
  expect(tangut.every(example => /^[\u{17000}-\u{187FF}\u{18D00}-\u{18D7F}]$/u.test(example.char))).toBe(true)
  const trees = tangut.map(example => parse(example.sequence).tree)
  expect(trees.filter(tree => size(tree).depth >= 4).length).toBeGreaterThanOrEqual(3)
  expect(trees.filter(tree => leaves(tree).length >= 6).length).toBeGreaterThanOrEqual(3)
  for (const operator of ['⿲', '⿳', '⿸', '⿵', '⿺']) expect(tangut.some(example => example.sequence.includes(operator))).toBe(true)
})

it('reads the Korean gukja as the source does', () => {
  const korean = EXAMPLE_GROUPS.find(group => group.key === 'korean').examples
  // 국자의 음역자와 구결자, oldid 42393816: the first reading the article gives for each character.
  const readings = {
    '㐎': '글', '乭': '돌', '㐘': '쌀', '乫': '갈', '㐓': '갈', '乬': '걸', '乷': '살', '乺': '솔',
    '㐒': '솔', '㐍': '졸', '乼': '줄', '乽': '잘', '㐔': '골', '乧': '둘', '㐙': '둘',
    '㔔': '강', '㔖': '각', '巪': '걱', '㪲': '둑', '㪳': '둥', '䜳': '둔', '䎞': '작',
    '㖙': '갓', '㖋': '갯', '㖎': '갯', '㖌': '굿', '㖍': '둣', '㖚': '붓', '唟': '것', '夞': '욋',
    '旕': '엇', '嗭': '짓', '廤': '곳', '蒊': '곳', '㖜': '곳', '㖯': '똥', '㖈': '놈', '䯩': '곱',
  }
  expect(korean.map(example => example.char).sort()).toEqual(Object.keys(readings).sort())
  for (const example of korean) expect(example.reading).toBe(readings[example.char])
  for (const shape of ['乙', '𠃍', '㇣', '𠃊', '𠮟', '口', '巴']) {
    expect(korean.some(example => example.sequence.includes(shape))).toBe(true)
  }
  expect(korean.filter(example => example.reading === '갈')).toHaveLength(2)
  expect(korean.filter(example => example.reading === '솔')).toHaveLength(2)
  expect(korean.filter(example => example.reading === '곳')).toHaveLength(3)
})

it('preserves digits, hentaigana, Latin and nested Bopomofo in the examples', () => {
  for (const sequence of ['⿱⿰◇ㅏㄴ', '⿰扌3', '⿰𛂦方', '⿰亻A', '⿰木⿳ㄙㄨㄥ', '⿰木⿱ㄅㄞ', '⿰木き']) {
    expect(EXAMPLES.some(example => example.sequence === sequence)).toBe(true)
    expect(parse(sequence).problem).toBeUndefined()
  }
  expect(leaves(parse('⿰木⿳ㄙㄨㄥ').tree).map(leaf => leaf.char)).toEqual(['木', 'ㄙ', 'ㄨ', 'ㄥ'])
})


it('illustrates every IDC outside the separate Tangut section', () => {
  const sequences = EXAMPLE_GROUPS.filter(group => group.key !== 'tangut').flatMap(group => group.examples.map(example => example.sequence))
  for (const [operator] of OPERATORS) {
    expect(sequences.some(sequence => sequence.includes(operator))).toBe(true)
  }
})
