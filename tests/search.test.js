import { describe, expect, it } from 'bun:test'
import { createSearch, parseQuery, readForms, tokens } from '../src/core/index.js'

// A few descriptions, as BabelStone writes them (regions dropped).
const table = new Map(Object.entries({
  木: ['⿻十八'], 十: ['⿻一丨'], 林: ['⿰木木'], 森: ['⿱木林'], 本: ['⿻木一'], 口: ['口'],
  杏: ['⿱木口'], 呆: ['⿱口木'], 困: ['⿴囗木'], 相: ['⿰木目'], 想: ['⿱相心'], 箱: ['⿱⺮相'],
  沐: ['⿰氵木'], 淋: ['⿰氵林'], 休: ['⿰亻木'], 体: ['⿰亻本'],
}))
const forms = readForms('form\tchar\tsource\tdetail\n⺡\t氵\tunicode-ucd\tx\n氵\t水\tcjkvi-variants\tleft\n亻\t人\tcjkvi-variants\tleft\n')
const search = createSearch(table, { forms })
const chars = query => search.search(query).hits.map(h => h.char)

describe('a query', () => {
  it('reads structures, wildcards, runs of components and ASCII names', () => {
    const { terms } = parseQuery('⿰？木　木口 lr氵＋')
    expect(terms.map(t => t.kind)).toEqual(['structure', 'components', 'structure'])
    expect(terms[0].tree).toEqual({ op: '⿰', parts: [null, '木'] })
    expect(terms[2].tree).toEqual({ op: '⿰', parts: ['氵', null] })
    expect(parseQuery('  ').problem).toBe('empty')
  })
  it('reads a zi.tools modifier without it changing the shape', () => {
    expect(parseQuery('⿴[1]囗人').terms).toEqual([expect.objectContaining({ kind: 'structure', tree: { op: '⿴', parts: ['囗', '人'] } })])
    expect(chars('⿴[1]囗木')).toContain('困')
    // A draft with a modifier is tokenised the same way, so its unfinished part stays a wildcard.
    expect(tokens('⿴[1]囗')).toEqual(['⿴', '囗'])
    expect(parseQuery('⿴[1]囗').terms).toEqual([expect.objectContaining({ kind: 'structure', tree: { op: '⿴', parts: ['囗', null] } })])
  })
})

describe('the search', () => {
  it('matches a whole description first, then the same shape deeper inside', () => {
    expect(chars('⿰木木')).toEqual(['林', '森', '淋'])
    expect(search.search('⿰木木').hits[0].sequence).toBe('⿰木木')
  })
  it('opens components where the query has structure', () => {
    const [hit] = search.search('⿱木⿰木木').hits
    expect(hit.char).toBe('森')
    expect(hit.sequence).toBe('⿱木⿰木木')
    expect(hit.spans).toEqual([[0, 5]])
  })
  it('takes an empty slot or ？ as any part, a component or a subtree, at any depth', () => {
    expect(chars('⿰？木')).toEqual(['休', '林', '沐', '森', '淋'])
    expect(chars('⿱⬚口')).toEqual(['杏'])
    expect(chars('⿱＋口')).toEqual(['杏'])
    expect(chars('⿱？⿰木目')).toEqual(['箱'])
    expect(chars('⿱⿰木目？')).toEqual(['想'])
  })
  it('highlights where the match lies', () => {
    const hit = search.search('⿰木目').hits.find(h => h.char === '想')
    expect(hit.sequence).toBe('⿱⿰木目心')
    expect(hit.spans).toEqual([[1, 4]])
  })
  it('needs every term to match', () => {
    expect(chars('⿰？？ 氵')).toEqual(['沐', '淋'])
    expect(chars('⿰？木 亻')).toEqual(['休'])
  })
  it('reads a run of components as all of them held, counted', () => {
    expect(chars('木木')).toEqual(['林', '森', '淋'])
    expect(chars('木木木')).toEqual(['森'])
    expect(chars('木')[0]).not.toBe('森')
    expect(chars('木林')).toEqual(['森', '淋'])
    expect(chars('口木')).toEqual(['呆', '杏'])
    const hit = search.search('口木').hits[0]
    expect(hit.spans.length).toBe(2)
  })
  it('folds radical and positional forms together', () => {
    expect(chars('⿰⺡木')).toEqual(['沐'])
    expect(chars('⿰水木')).toEqual(['沐'])
    expect(chars('人')).toEqual(['休', '体'])
  })
  it('matches the parts of ⿻ in either order', () => {
    expect(chars('⿻八十')).toEqual(chars('⿻十八'))
    expect(chars('⿻八十')[0]).toBe('木')
  })
  it('needs one description to hold a run, not several together', () => {
    const two = createSearch(new Map(Object.entries({ C: ['⿰木木', '⿱口口'], X: ['⿰C丨'], 林: ['⿰木木'] })))
    expect(two.search('木木口口').hits.map(h => h.char)).not.toContain('C')
    expect(two.search('木木').hits.map(h => h.char).sort()).toEqual(['C', 'X', '林'].sort())
  })
  it('counts nothing a cycle or ㇯ would add, and finds every member of a cycle', () => {
    const cycle = createSearch(new Map(Object.entries({ 水: ['⿰㇇甲'], 甲: ['㇯水㇇'], 冰: ['⿰冫水'], A: ['⿰B口'], B: ['⿱A木'] })))
    expect(cycle.search('水水').hits.map(h => h.char)).toEqual([])
    expect(cycle.search('口').hits.map(h => h.char).sort()).toEqual(['A', 'B'])
  })
  it('refuses a structure with more than its operators take', () => {
    expect(search.search('⿰木木木').problem).toBe('extra')
  })
  it('finds nothing for a shape no character has', () => {
    expect(chars('⿲木木木')).toEqual([])
    expect(search.search('').problem).toBe('empty')
  })
})

describe('component lookup expressions', () => {
  it('finds characters containing the right-hand component', () => {
    expect(search.search('㇯？木')).toEqual(search.search('木'))
    expect(search.search('su？木', { limit: 2 })).toEqual(search.search('木', { limit: 2 }))
  })

  it('lists the encoded parts of the left-hand character through its descriptions', () => {
    const result = search.search('㇯森？')
    expect(result.hits.map(hit => hit.char)).toEqual(expect.arrayContaining(['木', '林', '十', '一', '丨', '八']))
    expect(result.hits.map(hit => hit.char)).not.toContain('森')
    expect(new Set(result.hits.map(hit => hit.char)).size).toBe(result.total)
    expect(search.search('su森？', { limit: 2 })).toEqual({ hits: result.hits.slice(0, 2), total: result.total })
    expect(search.search('㇯口？')).toEqual({ hits: [], total: 0 })
  })

  it('terminates on cycles and does not report subtraction operands as surviving parts', () => {
    const index = createSearch(new Map([['甲', ['⿰乙口']], ['乙', ['⿱甲木']], ['丙', ['㇯甲口']]]))
    expect(index.search('㇯甲？').hits.map(hit => hit.char)).toEqual(['乙', '口', '木'])
    expect(index.search('㇯丙？').hits).toEqual([])
  })

  it('opens selected variants by their base character and follows long chains', () => {
    const index = createSearch(new Map([
      ['甲', ['⿰乙︀口']], ['乙', ['⿰丙口']], ['丙', ['⿰丁口']], ['丁', ['⿰戊口']],
      ['戊', ['⿰己口']], ['己', ['⿰庚口']], ['庚', ['⿰辛口']], ['辛', ['⿰木口']],
    ]))
    const parts = index.search('㇯甲︀？').hits
    expect(parts.map(hit => hit.char)).toEqual(expect.arrayContaining(['乙︀', '辛', '木']))
    expect(parts.find(hit => hit.char === '乙︀').sequence).toBe('⿰丙口')
  })

  it('follows descriptions that are single-component aliases', () => {
    const index = createSearch(new Map([['訁', ['言']], ['言', ['⿱亠口']], ['甲', ['⿰訁木']]]))
    expect(index.search('㇯訁？').hits.map(hit => hit.char)).toEqual(['言', '亠', '口'])
    expect(index.search('㇯？言').hits.map(hit => hit.char)).toContain('訁')
    expect(index.search('㇯？口').hits.map(hit => hit.char)).toContain('訁')
    expect(index.search('㇯？言').hits.map(hit => hit.char)).toContain('甲')
    const folded = createSearch(new Map([['訁', ['言']], ['言', ['⿱亠口']]]), { forms: new Map([['訁', '言']]) })
    expect(folded.search('㇯？言').hits.map(hit => hit.char)).toContain('訁')
  })

  it('finds holders through chains of aliases without looping on cycles', () => {
    const index = createSearch(new Map([['甲', ['乙']], ['乙', ['丙']], ['丙', ['甲']], ['丁', ['⿰甲木']]]))
    expect(index.search('㇯？丙').hits.map(hit => hit.char)).toEqual(expect.arrayContaining(['甲', '乙', '丁']))
    const cycle = createSearch(new Map([['甲', ['⿰乙口']], ['乙', ['甲']]]))
    expect(cycle.search('㇯？甲').hits.map(hit => hit.char)).toEqual(['乙'])
  })

  it('keeps an alias literal even when the same kana is a visual search substitute', () => {
    const index = createSearch(new Map([['イ', ['木']], ['甲', ['⿰人口']], ['乙', ['⿰イ口']]]))
    const hits = index.search('㇯？木').hits.map(hit => hit.char)
    expect(hits).toEqual(expect.arrayContaining(['イ', '乙']))
    expect(hits).not.toContain('甲')
    const direct = createSearch(new Map([['イ', ['⿰人口']], ['甲', ['⿰人口']]]))
    expect(direct.search('㇯？イ').hits.map(hit => hit.char)).toEqual(expect.arrayContaining(['イ', '甲']))
    const indirect = createSearch(new Map([['イ', ['⿰乙口']], ['乙', ['甲']], ['甲', ['⿰人口']]]))
    expect(indirect.search('㇯？イ').hits.map(hit => hit.char)).toContain('イ')
    const alias = createSearch(new Map([['イ', ['人']]]))
    expect(alias.search('㇯？イ').hits.map(hit => hit.char)).toContain('イ')
  })

  it('opens a readable description or the component when the source contains placeholders', () => {
    const index = createSearch(new Map([['體', ['⿰骨豊']], ['骨', ['⿳{108}冖⺝', '⿱冖月']], ['豊', ['⿱{123}豆']]]))
    const hits = index.search('㇯體？').hits
    expect(hits.find(hit => hit.char === '骨').sequence).toBe('⿱冖月')
    expect(hits.find(hit => hit.char === '豊').sequence).toBe('豊')
  })

  it('treats an empty slot as the same wildcard for both lookup directions', () => {
    for (const empty of ['⬚', '＋']) {
      expect(search.search(`㇯木${empty}`)).toEqual(search.search('㇯木？'))
      expect(search.search(`㇯${empty}木`)).toEqual(search.search('㇯？木'))
    }
    expect(search.search('㇯⬚⬚')).toEqual(search.search('㇯？？'))
  })

  it('still permits a structural search for a subtraction with a wildcard', () => {
    const index = createSearch(new Map([['甲', ['㇯木口', '⿰木水']]]))
    expect(index.search('㇯木⬚', { componentLookup: false }).hits.map(hit => hit.char)).toContain('甲')
  })
})


describe('visual substitutes in IDS queries', () => {
  const shapes = createSearch(new Map(Object.entries({
    人: ['人'], 亼: ['⿱𠆢一'], 从: ['⿰人人'], 众: ['⿱人从'],
    休: ['⿰亻木'], 合: ['⿱亼口'], 余: ['⿱亼朩'], 木: ['木'], 口: ['口'],
  })), { forms })
  const result = query => shapes.search(query)

  it('accepts the requested shapes in runs and structures, including positional forms', () => {
    for (const [alias, canonical] of [
      ['ㅅ', '人'], ['ᄉ', '人'], ['ᆺ', '人'], ['스', '亼'], ['스', '亼'],
      ['⿰ㅅ木', '⿰人木'], ['⿱스口', '⿱亼口'], ['⿱스口', '⿱亼口'],
      ['ㅅㅅ', '人人'], ['스口', '亼口'], ['⿱스？ 口', '⿱亼？ 口'],
    ]) {
      expect(result(alias)).toEqual(result(canonical))
      expect(result(alias).hits.length).toBeGreaterThan(0)
    }
    expect(result('⿰ㅅ木').hits[0].char).toBe('休')
    expect(result('⿱스口').hits[0]).toMatchObject({ char: '合', sequence: '⿱亼口', spans: [[0, 3]] })
    expect(result('ㅅㅅ').hits.map(hit => hit.char)).not.toContain('休')
  })

  it('keeps the entered term, leaves other Hangul alone, and checks structure arity', () => {
    expect(parseQuery('⿱스口').terms[0]).toMatchObject({ text: '⿱스口', tree: { op: '⿱', parts: ['亼', '口'] } })
    expect(parseQuery('수').terms[0]).toMatchObject({ text: '수', leaves: ['수'] })
    expect(result('⿱스口木').problem).toBe('extra')
  })
})


it('preserves Han compatibility components and unrelated Hangul syllables', () => {
  const index = createSearch(new Map([['甲', ['⿰神木']], ['乙', ['⿰神木']]]))
  expect(index.search('⿰神木').hits.map(hit => hit.char)).toEqual(['甲'])
  expect(index.search('⿰神木').hits.map(hit => hit.char)).toEqual(['乙'])
  expect(parseQuery('슨').terms[0].leaves).toEqual(['슨'])
})


it('preserves attached variation selectors when mapping a visual substitute', () => {
  for (const selector of ['\uFE00', '\u{E0100}']) {
    for (const [alias, canonical] of [['ㅅ', '人'], ['스', '亼']]) {
      const written = canonical + selector
      const index = createSearch(new Map([['甲', [`⿰${written}木`]]]))
      for (const wrap of [part => part, part => `⿰${part}木`]) {
        const query = wrap(alias + selector)
        expect(index.search(query)).toEqual(index.search(wrap(written)))
        expect(index.search(query).hits.map(hit => hit.char)).toEqual(['甲'])
        expect(parseQuery(query).terms[0].leaves[0]).toBe(written)
      }
    }
  }
})


it('accepts Hangul and kana lookalikes without rewriting the result descriptions', () => {
  const table = new Map(Object.entries({
    加: ['⿰力口'], 江: ['⿰氵工'], 名: ['⿱夕口'], 外: ['⿰夕卜'],
    仁: ['⿰亻二'], 分: ['⿱八刀'], 取: ['⿰耳又'], 私: ['⿰禾厶'],
    化: ['⿰亻匕'], 归: ['⿰刂彐'], 众: ['⿱人从'],
    匠: ['⿷匚斤'], 中: ['⿻口丨'], 旦: ['⿱日一'],
    甲: ['⿰𠃍口'], 乙: ['⿰𠃊口'], 丙: ['⿰〇口'],
  }))
  const index = createSearch(table)
  for (const [query, canonical, expected] of [
    ['⿰カロ', '⿰力口', '加'], ['⿰ｶﾛ', '⿰力口', '加'],
    ['⿰氵エ', '⿰氵工', '江'], ['⿱タㅁ', '⿱夕口', '名'],
    ['⿰タト', '⿰夕卜', '外'], ['⿰亻ニ', '⿰亻二', '仁'],
    ['⿱ハ刀', '⿱八刀', '分'], ['⿰耳ヌ', '⿰耳又', '取'],
    ['⿰禾ム', '⿰禾厶', '私'], ['⿰亻ヒ', '⿰亻匕', '化'],
    ['⿰刂ヨ', '⿰刂彐', '归'], ['⿱ㅅㅆ', '⿱人从', '众'],
    ['⿷ㄷ斤', '⿷匚斤', '匠'], ['⿻ㅁㅣ', '⿻口丨', '中'],
    ['⿱日ㅡ', '⿱日一', '旦'], ['⿰ㄱロ', '⿰𠃍口', '甲'],
    ['⿰ㄴロ', '⿰𠃊口', '乙'], ['⿰ㅇロ', '⿰〇口', '丙'],
  ]) {
    expect(index.search(query)).toEqual(index.search(canonical))
    expect(index.search(query).hits[0]).toMatchObject({ char: expected, sequence: canonical })
    const parts = query.replace(/[⿰⿱⿷⿻]/gu, ''), canonicalParts = canonical.replace(/[⿰⿱⿷⿻]/gu, '')
    expect(index.search(parts)).toEqual(index.search(canonicalParts))
    expect(index.search(parts).hits.map(hit => hit.char)).toContain(expected)
  }
  expect(parseQuery('ノ').terms[0].leaves).toEqual([{ anyOf: ['丿', '㇢', '亅'] }])
  expect(parseQuery('ㅁㅁ').terms[0].leaves).toEqual(['口', '口'])
  // A complete syllable stays a syllable, and ambiguous kana are not guessed.
  expect(parseQuery('미ガパ').terms[0].leaves).toEqual(['미', 'ガ', 'パ'])
  for (const query of ['ガ', 'カ\u3099', 'ｶﾞ', 'カ゛', 'ハ゜', 'ハ\u309A', 'ﾊﾟ']) {
    const leaves = parseQuery(query).terms[0].leaves
    expect(leaves).not.toContain('力')
    expect(leaves).not.toContain('八')
  }
})


it('leaves unlisted halfwidth and enclosed kana out of the alias mapping', () => {
  const index = createSearch(new Map([['甲', ['⿰ｬ口']], ['乙', ['⿰ャ口']]]))
  expect(index.search('⿰ｬ口').hits.map(hit => hit.char)).toEqual(['甲'])
  expect(index.search('⿰ャ口').hits.map(hit => hit.char)).toEqual(['乙'])
  expect(parseQuery('⿰㋕口').terms[0].leaves).toEqual(['㋕', '口'])
})


it('keeps the circle constraint in bare and mixed-component queries', () => {
  const index = createSearch(new Map([['甲', ['⿰〇口']], ['乙', ['⿰木口']]]))
  for (const circle of ['〇', 'ㅇ', 'ᄋ', 'ᆼ', '\uFFB7']) {
    expect(index.search(circle).hits.map(hit => hit.char)).toEqual(['甲'])
    expect(index.search(circle + '口').hits.map(hit => hit.char)).toEqual(['甲'])
    expect(index.search(circle + circle).hits).toEqual([])
  }
})


// Alternatives belong to the query: 人 and 井 remain distinct in the indexed descriptions.
describe('Ashide component families', () => {
  const index = createSearch(new Map(Object.entries({
    休: ['⿰亻木'], 仁: ['⿰亻二'], 甲: ['⿰井木'], 乙: ['⿰人井'], 丙: ['⿰人人'],
    丁: ['⿰人木'], 戊: ['⿰井井'], 己: ['⿰人木', '⿰井木'],
    字: ['⿱宀子'], 才: ['⿻一⿻亅丿'], 材: ['⿰木才'], 打: ['⿰扌丁'],
    忙: ['⿰忄亡'], 切: ['⿰七刀'], 吉: ['⿱士口'], 土: ['⿱十一'],
    江: ['⿰氵工'], 迎: ['⿺辶卬'], 中: ['⿻口丨'], 岩: ['⿱山石'],
    桐: ['⿰木同'], 析: ['⿰朩斤'], 杉: ['⿰木彡'], 吾: ['⿱五口'],
  })), { forms })
  const hits = query => index.search(query).hits.map(hit => hit.char)

  it('searches each alternative without making the Han components equivalent', () => {
    expect(hits('⿰イ木')).toEqual(expect.arrayContaining(['休', '甲', '丁']))
    expect(hits('⿰人木')).not.toContain('甲')
    expect(hits('⿰井木')).not.toContain('休')
    expect(hits('⿰ｲ木')).toEqual(hits('⿰イ木'))
    for (const [query, expected] of [['ウ', '字'], ['オ', '材'], ['オ', '打'], ['シ', '江'], ['シ', '迎'], ['シ', '中'], ['ヲ', '岩'], ['ホ', '析'], ['ミ', '杉']]) {
      expect(hits(query)).toContain(expected)
    }
  })

  it('counts repeated alternatives across different components', () => {
    expect(hits('イイ')).toEqual(expect.arrayContaining(['乙', '丙', '戊']))
    for (const char of ['休', '仁', '甲', '丁', '己']) expect(hits('イイ')).not.toContain(char)
    expect(hits('イイイ')).not.toContain('乙')
    expect(hits('イ人')).toEqual(expect.arrayContaining(['乙', '丙']))
    expect(hits('イ人')).not.toContain('戊')
    expect(hits('イ井')).toEqual(expect.arrayContaining(['乙', '戊']))
    expect(hits('イ井')).not.toContain('丙')
    expect(hits('イ井人')).not.toContain('乙')
  })

  it('reassigns a broad match when a narrower request needs its component', () => {
    const forward = index.search('イ人').hits.find(hit => hit.char === '乙')
    const reverse = index.search('人イ').hits.find(hit => hit.char === '乙')
    expect(forward).toEqual(reverse)
    expect(forward).toMatchObject({ sequence: '⿰人井', spans: [[1, 2], [2, 3]] })
    expect(hits('⿰イ井')).toContain('乙')
    expect(hits('⿰井イ')).not.toContain('乙')
    expect(hits('イ 人')).toContain('丁') // Separate terms may refer to the same occurrence.
  })

  it('keeps subtractive operands out of component matches', () => {
    const cut = createSearch(new Map([['甲', ['㇯人井']]]))
    expect(cut.search('イ').hits).toEqual([])
  })

  it('leaves literal kana with voicing marks out of the ambiguous alias path', () => {
    const kana = createSearch(new Map([['甲', ['⿰カ口']], ['乙', ['⿰力口']]]))
    expect(kana.search('カ゛').hits.map(hit => hit.char)).toEqual(['甲'])
    expect(kana.search('カ').hits.map(hit => hit.char)).toEqual(['乙'])
  })
})


it('handles long repeated families without enumerating alternative combinations', () => {
  const index = createSearch(new Map([['甲', ['⿰人'.repeat(19) + '井']]]))
  expect(index.search('イ'.repeat(20)).hits.map(hit => hit.char)).toEqual(['甲'])
  expect(index.search('イ'.repeat(21)).hits).toEqual([])
})


it('never combines mutually exclusive nested descriptions to fill repeated alternatives', () => {
  const index = createSearch(new Map([
    ['甲', ['⿰乙口']], ['乙', ['⿰人木', '⿰井木']],
    ['丙', ['⿰乙乙']], ['丁', ['⿰乙人']],
  ]))
  expect(index.search('イイ').hits.map(hit => hit.char)).not.toContain('甲')
  expect(index.search('イ人').hits.map(hit => hit.char)).not.toContain('甲')
  expect(index.search('イ井').hits.map(hit => hit.char)).not.toContain('甲')
  expect(index.search('イ木').hits.map(hit => hit.char)).toContain('甲')
  expect(index.search('イイ').hits.map(hit => hit.char)).toEqual(expect.arrayContaining(['丙', '丁']))
  expect(index.search('人井').hits.map(hit => hit.char)).toContain('丙')
})


it('collapses interchangeable alternatives before combining repeated nested components', () => {
  const index = createSearch(new Map([
    ['甲', ['⿰乙'.repeat(19) + '乙']],
    ['乙', [...'亻𠂆人入㐄井'].map(component => `⿰${component}木`)],
  ]))
  expect(index.search('イ'.repeat(20)).hits.map(hit => hit.char)).toEqual(['甲'])
  expect(index.search('イ'.repeat(21)).hits).toEqual([])
  expect(index.search('イ'.repeat(14) + '亻𠂆人入㐄井').hits.map(hit => hit.char)).toEqual(['甲'])
  expect(index.search('イ'.repeat(15) + '亻𠂆人入㐄井').hits).toEqual([])
})


it('keeps nested alternatives exclusive even with only one indexed target per kana', () => {
  const index = createSearch(new Map([
    ['甲', ['⿰乙口']], ['乙', ['⿰人木', '⿰力木']],
  ]))
  expect(index.search('イカ').hits).toEqual([])
  expect(index.search('人力').hits).toEqual([])
  expect(index.search('イ木').hits.map(hit => hit.char)).toContain('甲')
})

it('bounds mixed demands across mutually exclusive expansions before building frontiers', () => {
  const descriptions = [...'人力十勹囗艹'].map(c => '⿰' + c + '木')
  const index = createSearch(new Map([
    ['甲', ['⿰乙'.repeat(13) + '乙']], ['乙', descriptions],
    ['丙', ['⿰入尸']], ['丁', ['⿰乙'.repeat(83) + '乙']],
  ]))
  const query = [...'イカキクコサ'].map(c => c.repeat(14)).join('')
  expect(index.search(query).hits.map(hit => hit.char)).toEqual(['丁'])
})

it('searches literal brace and digit operands in a complete description', () => {
  const search = createSearch(new Map([['甲', ['⿳{1}']]]))
  expect(search.search('⿳{1}').hits.map(hit => hit.char)).toEqual(['甲'])
})

it('preserves halfwidth kana voicing marks as component constraints', () => {
  const search = createSearch(new Map([['甲', ['⿰ｶﾞ']], ['乙', ['⿰ｶ木']]]))
  expect(search.search('ｶﾞ').hits.map(hit => hit.char)).toEqual(['甲'])
})
