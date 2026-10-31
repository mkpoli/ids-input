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
          } else if ('source' in example && example.source === 'data/shuishu.json.gz') {
            const shui = JSON.parse(gunzipSync(readFileSync(new URL('../data/shuishu.json.gz', import.meta.url))))
            expect(shui.parts.map(part => part.part)).toContain(char)
            expect(shui.parts.find(part => part.part === char)?.shuiMeaning).toBe(example.modern)
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
      '⿺辶⿱宀⿱⿰王尔⿲隹貝招', '⿱⿰日日⿲有見財', '⿰⿱日斗⿱進金', '⿳𦥯⿲女子乚皿',
      '⿳五⿲矢口隹龰', '⿱黃⿱金⿳艹田⿵冂山', '⿳士⿲女口意祥',
      '⿱艹⿰马尼', '⿰⿳⿰SIR木阝',
      '⿱⿰⿱コン⿱クリ土', '⿱⿲ンメセ土', '⿸广⿰KO', '⿱宀K', '⿻Mo',
    ])
    const refs = new Map(group.examples.map(example => [example.sequence, example.refs]))
    expect(refs.get('⿺辶⿱宀⿱⿰王尔⿲隹貝招')).toEqual([sourceNumber('l2-12-032'), sourceNumber('utr45')])
    expect(refs.get('⿱⿰日日⿲有見財')).toEqual([sourceNumber('uhk-hetizi')])
    expect(refs.get('⿰⿱日斗⿱進金')).toEqual([sourceNumber('uhk-hetizi')])
    expect(refs.get('⿳𦥯⿲女子乚皿')).toEqual([sourceNumber('uhk-hetizi'), sourceNumber('zi-tools-kongmeng')])
    expect(refs.get('⿳五⿲矢口隹龰')).toEqual([sourceNumber('uhk-hetizi')])
    expect(refs.get('⿱黃⿱金⿳艹田⿵冂山')).toEqual([sourceNumber('uhk-hetizi'), sourceNumber('gmw-zuhezi')])
    expect(refs.get('⿳士⿲女口意祥')).toEqual([sourceNumber('fznews-jixiang')])
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
  expect(EXAMPLE_GROUPS.map(group => group.key)).toEqual(['basic', 'complex', 'repeated', 'enclosures', 'mixed', 'geba', 'ligature', 'korean', 'gugyeol', 'kokuji', 'ghost', 'nom', 'seal', 'shuishu', 'tangut'])
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
    // The article's last row gives 𬼝 no reading, so it carries none.
    '⿱去乙': undefined,
  }
  expect(korean.map(example => example.sequence).sort()).toEqual(Object.keys(readings).sort())
  for (const example of korean) {
    expect(example.reading).toBe(readings[example.sequence])
    expect(Object.hasOwn(example, 'reading')).toBe(readings[example.sequence] !== undefined)
  }
  expect(korean.find(example => example.sequence === '⿱去乙')).toEqual({ sequence: '⿱去乙', char: '𬼝' })
  for (const shape of ['乙', '𠃍', '㇣', '𠃊', '𠮟', '口', '巴']) {
    expect(korean.some(example => example.sequence.includes(shape))).toBe(true)
  }
  expect(korean.filter(example => !example.char)).toHaveLength(20)
  expect(korean.filter(example => example.reading === '갈')).toHaveLength(3)
  expect(korean.filter(example => example.reading === '솔')).toHaveLength(5)
  expect(korean.filter(example => example.reading === '곳')).toHaveLength(4)
})

it('reads the Korean gugyeol as the source does', () => {
  const gugyeol = EXAMPLE_GROUPS.find(group => group.key === 'gugyeol').examples
  // 국자의 음역자와 구결자, oldid 42393816: the second table, whose first reading each entry uses.
  const readings = {
    '⿱𠆢丶': '나', '⿱亦乁': '란', '⿱爲了': '료', '⿱厶小': '며', '⿰弓厼': '며', '⿱一丿': '면',
    '⿱斜𰆊': '산', '⿱士𰆊': '산', '乛': '야', '𠃌': '야', '⿱𠆢⺀': '어', '⿰丶㇒': '하',
    '⿱丷𰆊': '한', '⿱㇒丷': '호', '⿱乊乙': '홀',
  }
  expect(gugyeol.map(example => example.sequence).sort()).toEqual(Object.keys(readings).sort())
  for (const example of gugyeol) expect(example.reading).toBe(readings[example.sequence])
})

it('reads the Japanese kokuji in kana', () => {
  const kokuji = EXAMPLE_GROUPS.find(group => group.key === 'kokuji').examples
  const readings = {
    '⿰土下': 'あくつ', '⿰魚利': 'あさり', '⿺辶南': 'あっぱれ', '⿱海土': 'あま',
    '⿵𠘨巾': 'いかのぼり', '⿰角鳥': 'いかる', '⿰土入': 'いり', '⿰木入': 'いり',
    '⿰魚弱': 'いわし', '⿱𥫗丸': 'うつぼ', '⿰𩙿𥁕': 'うどん', '⿰虫老': 'えび',
    '⿰火貢': 'おおづつ', '⿰糹威': 'おどす', '⿰亻弟': 'おもかげ', '⿱下風': 'おろし',
    '⿰女鼻': 'かか', '⿰石花': 'かき', '⿰土行': 'がけ', '⿰釒芳': 'かざり',
    '⿰木島': 'かし', '⿰木堅': 'かし', '⿰魚石': 'かじか', '⿰釒送': 'かすがい',
    '⿰魚希': 'かずのこ', '⿰糹齊': 'かすり', '⿰糸忍': 'かせ', '⿱艹縵': 'かつら',
    '⿰口入': 'かます', '⿰衤𠧗': 'かみしも', '⿰魚喜': 'きす', '⿺瓦千': 'キログラム',
    '⿰米千': 'キロメートル', '⿰立千': 'キロリットル', '⿰口食': 'くう', '⿰木門': 'くぬぎ',
    '⿰木到': 'くぬぎ', '⿱久米': 'くめ', '⿰山弁': 'くら', '⿰亻車': 'くるま',
    '⿰田衣': 'けさ', '⿰糹頝': 'コウ', '⿰魚康': 'コウ', '⿰米花': 'こうじ',
    '⿵𠘨木': 'こがらし', '⿱艹座': 'ござ', '⿰魚甬': 'こち', '⿰魚冬': 'このしろ',
    '⿰革𠧗': 'こはぜ', '⿰土花': 'ごみ', '⿺辶入': 'こむ', '⿰忄永': 'こらえる',
    '⿰木神': 'さかき', '⿺辶谷': 'さこ', '⿱𥫗世': 'ささ', '⿱𥫗彫': 'ささら',
    '⿰口行': 'さそう', '⿰扌刃': 'さて', '⿰耳定': 'しか', '⿰田鳥': 'しぎ',
    '⿱雨下': 'しずく', '⿰身美': 'しつけ', '⿰木典': 'しで', '⿸疒積': 'しゃく',
    '⿰魚虎': 'しゃちほこ', '⿰口贈': 'しょう', '⿰訁定': 'ジョウ', '⿰月萃': 'スイ',
    '⿰木昌': 'すぎ', '⿰米合': 'すくも', '⿰米家': 'すくも', '⿺辶一': 'すべる',
    '⿰月泉': 'せん', '⿰米厘': 'センチ', '⿺瓦厘': 'センチグラム', '⿰立厘': 'センチリットル',
    '⿰木山': 'そま', '⿰舟雪': 'そり', '⿰車雪': 'そり', '⿰衤擧': 'たすき',
    '⿰火達': 'タツ', '⿰木府': 'たぶ', '⿰魚雪': 'たら', '⿰土𠧗': 'たわ',
    '⿲彳鳥亍': 'ちどり', '⿰木母': 'つが', '⿵門山': 'つかえる', '⿰木觀': 'つき',
    '⿰柬鳥': 'つぐみ', '⿺辶十': 'つじ', '⿰衤妻': 'つま', '⿱弓一': 'テ',
    '⿺瓦十': 'デカグラム', '⿰米十': 'デカメートル', '⿰立十': 'デカリットル', '⿺瓦分': 'デシグラム',
    '⿰立分': 'デシリットル', '⿰山𠧗': 'とうげ', '⿰魚於': 'どじょう', '⿰木万': 'とち',
    '⿰木⿸𠂆万': 'とち', '⿺辶中': 'とても', '⿰革丙': 'とも', '⿰口頓': 'トン',
    '⿺瓦屯': 'トン', '⿵𠘨止': 'なぎ', '⿰木知': 'なぎ', '⿱山刀': 'なた',
    '⿰魚念': 'なまず', '⿰入鳥': 'にお', '⿹勹匕': 'におう', '⿱代土': 'ぬた',
    '⿰氵土': 'ねた', '⿰魚危': 'はえ', '⿰石谷': 'はざま', '⿰火田': 'はたけ',
    '⿱白田': 'はたけ', '⿰魚神': 'はたはた', '⿰亻動': 'はたらく', '⿰口新': 'はなし',
    '⿰木泉': 'はんぞう', '⿰釒兵': 'びょう', '⿱林下': 'ふむと', '⿰釒武': 'ぶりき',
    '⿰土屏': 'へい', '⿺瓦百': 'ヘクトグラム', '⿰米百': 'ヘクトメートル', '⿰立百': 'ヘクトリットル',
    '⿰木䙳': 'ほくそ', '⿱母衣': 'ほろ', '⿰木正': 'まさき', '⿰木升': 'ます',
    '⿰木舛': 'ます', '⿰亻吴': 'また', '⿰土山': 'まま', '⿸麻呂': 'まろ',
    '⿰米毛': 'ミリ', '⿺瓦毛': 'ミリグラム', '⿰立毛': 'ミリリットル', '⿱少毛': 'むしる',
    '⿰木室': 'むろ', '⿰魚休': 'めばる', '⿱木工': 'もく', '⿰米刃': 'もみ',
    '⿰木⿱艹⿰亻𠤎': 'もみじ', '⿻勹乂': 'もんめ', '⿰身雁': 'やがて', '⿰身應': 'やがて',
    '⿱艹泡': 'やち', '⿱𥫗梁': 'やな', '⿰釒遣': 'やり', '⿰月雪': 'ゆき',
    '⿰衤行': 'ゆき', '⿰山平': 'ゆり', '⿵門水': 'ゆり', '⿰木卆': 'わく',
  }


  expect(kokuji.map(example => example.sequence).sort()).toEqual(Object.keys(readings).sort())
  for (const example of kokuji) {
    expect(example.reading).toBe(readings[example.sequence])
    expect(example.reading).toMatch(/^[\u3040-\u30FFー]+$/)
  }
})

it('keeps the sourced JIS ghost kanji with Japanese IDS and no assigned readings', () => {
  const group = EXAMPLE_GROUPS.find(group => group.key === 'ghost')
  expect(group.refs).toEqual([sourceNumber('babelstone'), sourceNumber('sanseido-ghost')])
  expect(group.examples).toEqual([
    { sequence: '⿳山一女', char: '妛' },
    { sequence: '⿰弓哥', char: '彁' },
    { sequence: '⿰木劵', refs: [sourceNumber('babelstone'), sourceNumber('kanken-ghost')], char: '椦' },
    ...[
      ['墸', '⿰土⿱艹⿻者丶'], ['壥', '⿰土㕓'], ['挧', '⿰扌羽'],
      ['暃', '⿱日非'], ['槞', '⿰木竜'], ['蟐', '⿰虫常'],
      ['袮', '⿰衤尓'], ['閠', '⿵門玉'], ['駲', '⿰馬州'],
    ].map(([char, sequence]) => ({ sequence, refs: [sourceNumber('babelstone'), sourceNumber('wdic-ghost'), sourceNumber('ja-wp-ghost')], char })),
  ])
  for (const example of group.examples) {
    expect(example).not.toHaveProperty('reading')
    expect(table.get(example.char).some(entry => entry.text === example.sequence && entry.regions.includes('J'))).toBe(true)
  }
})

it('reads the Vietnamese Nôm as the source does', () => {
  const nom = EXAMPLE_GROUPS.find(group => group.key === 'nom').examples
  const readings = {
    '⿺巴三': 'ba', '⿰宁字': 'chữ', '⿰土癸': 'cõi', '⿰忄吉': 'ghét', '⿱罒𪜀': 'là',
    '⿴𰀪⺀': 'làm', '⿱丷又': 'một', '⿰南年': 'năm', '⿰㝵人': 'người', '⿱百林': 'trăm',
    '⿺竜内': 'trong', '⿱天上': 'trời',
  }
  expect(nom.map(example => example.sequence).sort()).toEqual(Object.keys(readings).sort())
  for (const example of nom) {
    expect(example.reading).toBe(readings[example.sequence])
    expect(example.reading).toMatch(/^[a-zA-ZÀ-ỹ]+$/u)
  }
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
