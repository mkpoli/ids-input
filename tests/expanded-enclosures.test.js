const CHARS = "山攵木口永人大小工土火又水屮㗊燚叕㵘茻林矛彳亍弓𤣩王辛隹亠𧘇方𠂉匕頁𠦝𠆢鬲士冖一殳木日金水火土女子口吉隹魚牛馬羊犬貝毛手耳虫車力森晶鑫淼焱垚姦孨品嚞雥鱻犇驫羴猋贔毳掱聶蟲轟劦夾巫坐"
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

const cases = [["⿵⿲彳⿱山一攵", "⿲彳⿱⿱山一{inner}攵"], ["⿴⿰彳亍", "⿲彳{inner}亍"], ["⿴⿰弓弓", "⿲弓{inner}弓"], ["⿴⿰𤣩王", "⿲𤣩{inner}王"], ["⿴⿰辛辛", "⿲辛{inner}辛"], ["⿴⿰隹隹", "⿲隹{inner}隹"], ["⿴⿱亠𧘇", "⿳亠{inner}𧘇"], ["⿸⿰方𠂉", "⿰方⿱𠂉{inner}"], ["⿹⿰匕頁", "⿰⿱匕{inner}頁"], ["⿸⿰𠦝𠆢", "⿰𠦝⿱𠆢{inner}"], ["⿶⿱⿰弓弓鬲", "⿱⿲弓{inner}弓鬲"], ["⿹⿰⿳士冖一殳", "⿰⿱⿳士冖一{inner}殳"]]

it('opens only supported enclosure hosts and keeps editable leaf ownership', async () => {
  const source = fixture()
  for (const [prefix, layout] of cases) for (const inner of ['木', '⬚', '⿱木⬚', '⿴行⬚']) {
    const text = prefix + inner, explicit = layout.replace('{inner}', inner)
    for (const separate of [false, true])
      expect(inkOnly(await compose(source, text, { separate }))).toEqual(inkOnly(await compose(source, explicit, { separate })))
    const leaves = await sketch(source, text)
    const drawing = await compose(source, text, { separate: true })
    const groups = groupParts(drawing.parts, leaves)
    expect(groups).not.toBeNull()
    expect(groups.length).toBe(leaves.filter(leaf => !leaf.empty).length)
    expect(leaves.filter(x => x.empty).length).toBe(inner.includes('⬚') ? 1 : 0)
  }
  const c = new Composer(source.store())
  for (const text of ['⿵⿰彳亍木', '⿴⿰火木口', '⿵林木', '⿱林木']) expect(c.splitEnclosure(c.parse(text))).toBeNull()
})

it('places the mountain host slot below 一 while retaining source leaf indices', async () => {
  const source = fixture()
  await sketch(source, '水')
  const c = new Composer(source.store())
  for (const inner of ['水', '⬚', '⿱木⬚', '⿴行⬚']) {
    const implicit = `⿵⿲彳⿱山一攵${inner}`
    const explicit = `⿲彳⿱⿱山一${inner}攵`
    expect(c.splitEnclosure(c.parse(implicit))).toEqual({
      tree: ['⿲', '彳', ['⿱', ['⿱', '山', '一'], c.parse(inner)], '攵'], innerIndex: 3,
    })
    const target = await sketch(source, explicit)
    // Source order is 彳, 山, 一, 攵, then the inserted subtree.
    const expected = [...target.slice(0, 3), target.at(-1), ...target.slice(3, -1)]
      .map((leaf, index) => ({ ...leaf, index }))
    expect(await sketch(source, implicit)).toEqual(expected)
    const drawing = await compose(source, implicit, { separate: true })
    const actualLeaves = drawing.parts.map(part => part.leaf)
    const explicitDrawing = await compose(source, explicit, { separate: true })
    const sourceIndex = index => index < 3 ? index : index === target.length - 1 ? 3 : index + 1
    const groups = groupParts(explicitDrawing.parts, target)
    expect(groups).not.toBeNull()
    const expectedOwners = []
    for (const group of groups) for (const index of group.parts) expectedOwners[index] = sourceIndex(group.index)
    expect(actualLeaves).toEqual(expectedOwners)
  }
  for (const text of ['⿴⿲彳⿱山一攵水', '⿸⿲彳⿱山一攵水', '⿵⿲彳⿱山二攵水', '⿵⿲彳⿱山一文水'])
    expect(c.splitEnclosure(c.parse(text))).toBeNull()
})
