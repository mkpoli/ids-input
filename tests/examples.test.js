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
          } else if (example.sequence === '⿱無⿰無無') {
            // Unicode 17.0 encoded the character after the BabelStone edition, which has no row.
            expect(example.refs).toContain(sourceNumber('irg-ws2021-uk-20565'))
            expect(table.has(char)).toBe(false)
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
      '⿱宀⿺辶⿱⿰王尔⿲隹貝招', '⿱⿰日日⿲有見財', '⿰⿱日斗⿱進金',
      '⿱艹⿰马尼', '⿰⿳⿰SIR木阝',
      '⿱⿰⿱コン⿱クリ土', '⿱⿲ンメセ土', '⿸广⿰KO', '⿱宀K', '⿻Mo',
    ])
    const refs = new Map(group.examples.map(example => [example.sequence, example.refs]))
    expect(refs.get('⿱宀⿺辶⿱⿰王尔⿲隹貝招')).toEqual([sourceNumber('l2-12-032'), sourceNumber('utr45')])
    expect(refs.get('⿱⿰日日⿲有見財')).toEqual([sourceNumber('uhk-hetizi')])
    expect(refs.get('⿰⿱日斗⿱進金')).toEqual([sourceNumber('uhk-hetizi')])
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
  // 국자의 음역자와 구결자, oldid 42393816: the first reading the article gives for each form.
  const readings = {
    '⿱加𠃍': '각', '⿱加乙': '갈', '⿱可乙': '갈', '⿱加己': '갈',
    '⿱加𠮟': '갓', '⿱加㇣': '강', '⿱介乙': '갤', '⿱介𠮟': '갯',
    '⿱𠮟介': '갯', '⿱巨𠃍': '걱', '⿱巨乙': '걸', '⿱擧乙': '걸',
    '⿱去𠮟': '것', '⿱古乙': '골', '⿳亠口乙': '골', '⿸庫乙': '골',
    '⿱古巴': '곱', '⿱高巴': '곱', '⿱古𠮟': '곳', '⿳亠口𠮟': '곳',
    '⿸庫𠮟': '곳', '⿱花𠮟': '곳', '⿱句乙': '굴', '⿱九乙': '굴',
    '⿱拘乙': '굴', '⿱仇𠮟': '굿', '⿱文乙': '글', '⿱其乙': '길',
    '⿱非乙': '길', '⿱未𠮟': '끗', '⿱奴乙': '놀', '⿱老乙': '놀',
    '⿱老口': '놈', '⿱艿𠮟': '늦', '⿱月乙': '달', '⿱付乙': '댈',
    '⿱代乙': '댈', '⿱石乙': '돌', '⿱冬乙': '돌', '⿱道𠮟': '돗',
    '⿱斗𠃍': '둑', '⿱豆𠃊': '둔', '⿱入乙': '둘', '⿱斗乙': '둘',
    '⿱豆乙': '둘', '⿱斗𠮟': '둣', '⿱斗㇣': '둥', '⿱同𠮟': '똥',
    '⿱𠮟同': '똥', '⿱叱乙': '뜰', '⿱浮乙': '뜰', '⿱馬乙': '말',
    '⿱末乙': '말', '⿱毛乙': '몰', '⿱木乙': '몰', '⿱卯乙': '묠',
    '⿱未乙': '밀', '⿱夜口': '뱀', '⿱甫乙': '볼', '⿱夫乙': '불',
    '⿱火乙': '불', '⿱不乙': '불', '⿱付𠮟': '붓', '⿱始𠮟': '비롯',
    '⿱分𠮟': '뿐', '⿱𠮟分': '뿐', '⿱角乙': '뿔', '⿱士乙': '살',
    '⿱沙乙': '살', '⿱沙邑': '삽', '⿱覀乙': '설', '⿱折乙': '설',
    '⿱鋤乙': '설', '⿱小乙': '솔', '⿱少乙': '솔', '⿱松乙': '솔',
    '⿱召乙': '솔', '⿱所乙': '솔', '⿱小𠮟': '솟', '⿱米乙': '쌀',
    '⿱種𠮟': '씻', '⿱於𠃍': '억', '⿱於乙': '얼', '⿱菸叱': '엇',
    '⿱於𠮟': '엇', '⿱如𠮟': '엿', '⿱汝𠮟': '엿', '⿱五乙': '올',
    '⿱乎乙': '올', '⿱吾乙': '올', '⿱外𠮟': '욋', '⿱右乙': '울',
    '⿱于乙': '울', '⿱佑乙': '울', '⿱由乙': '율', '⿱乳乙': '율',
    '⿱芿𠮟': '잇', '⿱者𠃍': '작', '⿱者乙': '잘', '⿱者𠮟': '잣',
    '⿱丁乙': '절', '⿱爫乙': '졸', '⿱注乙': '줄', '⿱注𠮟': '줏',
    '⿱直𠮟': '짓', '⿱次乙': '찰', '⿱吐乙': '톨', '⿱土乙': '톨',
    '⿱巴𠮟': '팟', '⿱坪乙': '펼', '⿱甫𠮟': '폿', '⿱下乙': '할',
    '⿱呼乙': '홀', '⿱禾乙': '활',
  }
  expect(korean.map(example => example.sequence).sort()).toEqual(Object.keys(readings).sort())
  for (const example of korean) expect(example.reading).toBe(readings[example.sequence])
  for (const shape of ['乙', '𠃍', '㇣', '𠃊', '𠮟', '口', '巴']) {
    expect(korean.some(example => example.sequence.includes(shape))).toBe(true)
  }
  expect(korean.filter(example => !example.char)).toHaveLength(20)
  expect(korean.filter(example => example.reading === '갈')).toHaveLength(3)
  expect(korean.filter(example => example.reading === '솔')).toHaveLength(5)
  expect(korean.filter(example => example.reading === '곳')).toHaveLength(4)
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
