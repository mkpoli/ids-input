const CHARS = "木口永人大小工土火又水屮㗊燚叕㵘茻林矛彳亍弓𤣩王辛隹亠𧘇方𠂉匕頁𠦝𠆢鬲士冖一殳木日金水火土女子口吉隹魚牛馬羊犬貝毛手耳虫車力森晶鑫淼焱垚姦孨品嚞雥鱻犇驫羴猋贔毳掱聶蟲轟劦夾巫坐"
import { expect, it } from 'bun:test'
import { Composer } from '../src/composer/compose.js'
import { compose, createSource, sketch } from '../src/composer/loader.js'
import { groupParts } from '../src/core/preview.js'
import { files, shards } from './fixtures/composer-export.js'

const fixture = (missing = '') => {
  const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
  const extra = shards('g', [...new Set(CHARS)].filter(ch => !missing.includes(ch)).map((ch, i) => [ch, {
    k: ch, G: { v: 1, b: [100, 0, 300 + i, 800], p: [['MLLL', int16([400, 0, 1200 + 4 * i, 0, 1200 + 4 * i, 3200, 400, 3200]), int16(Array(8).fill(0))]] },
    ink: 2000, nl: 1, o: 1,
  }]))
  return createSource(async name => {
    const body = extra[name] ?? files[name]
    return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
  })
}
const inkOnly = drawing => ({ ...drawing, parts: drawing.parts.map(({ leaf, ...part }) => part) })

const cases = [["⿻大⿰人人", "夾"], ["⿻工⿰人人", "巫"], ["⿻⿰人人土", "坐"]]

it('uses designed whole glyphs for attested expanded forms without changing their source', async () => {
  const source = fixture()
  for (const [text, char] of cases) {
    for (const separate of [false, true])
      expect((await compose(source, text, { separate })).parts).toEqual((await compose(source, char, { separate })).parts)
    const c = new Composer(source.store())
    expect(c.parse(text)).not.toEqual(char)
  }
})
it('falls back to operands for unavailable or excluded whole glyphs', async () => {
  for (const [text, char] of cases) {
    const source = fixture(char)
    expect((await compose(source, text, { separate: true })).parts.length).toBeGreaterThan(1)
    const available = fixture()
    await compose(available, text)
    const c = new Composer(available.store(), { exclude: [char], separate: true })
    expect(c.compose(text).every(p => p.origin !== `glyph ${char}`)).toBe(true)
  }
})
it('keeps explicit nested forms editable', async () => {
  const source = fixture()
  for (const [text] of cases) {
    const sequence = '⿱木' + text
    const drawing = await compose(source, sequence, { separate: true })
    expect(drawing.parts.length).toBeGreaterThan(2)
    expect(groupParts(drawing.parts, await sketch(source, sequence))).not.toBeNull()
  }
})
