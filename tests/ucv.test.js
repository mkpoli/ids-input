// The compiled UCV and NUCV lists keep the source's entries, forms and example characters.
import { expect, it } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'

const data = JSON.parse(await readFile(new URL('../data/ucv.json', import.meta.url), 'utf8'))
const outlines = JSON.parse(gunzipSync(await readFile(new URL('../data/ucv-forms.json.gz', import.meta.url))).toString('utf8'))
const entry = (/** @type {string} */ id) => data.entries.find((/** @type {{ id: string }} */ row) => row.id === id)

it('keeps every entry of both lists', () => {
  const kinds = data.entries.map((/** @type {{ kind: string }} */ row) => row.kind)
  expect(kinds.filter((/** @type {string} */ kind) => kind === 'unifiable')).toHaveLength(599)
  expect(kinds.filter((/** @type {string} */ kind) => kind === 'not-unifiable')).toHaveLength(14)
  expect(new Set(data.entries.map((/** @type {{ id: string }} */ row) => row.id)).size).toBe(613)
})

it('places each entry in a group the source names', () => {
  const groups = new Set(data.groups.flatMap((/** @type {{ id: string, subgroups: { id: string }[] }} */ group) => [group.id, ...group.subgroups.map(sub => sub.id)]))
  for (const row of data.entries) if (row.kind === 'unifiable') expect(groups.has(row.group)).toBe(true)
})

it('reads the forms, the criterion and the example characters of an entry', () => {
  expect(entry('321')).toEqual({
    id: '321', kind: 'unifiable', level: 1, group: 'j-3',
    forms: [{ glyph: 'u540c-08', of: '同' }, { glyph: 'u540c-08-var-001', of: '同' }, { glyph: 'cdp-8de1' }],
    // The source writes the third form as a private-use character of the CDP font.
    components: '同\u{F693}', jis: '148',
    unified: ['爂', '爨', '釁'],
    compatibility: [['爨', '\u{2F920}']],
    disunified: [['𦦝', '𦦧'], ['𦦞', '𦦡']],
  })
})

it('names a coded form by its character and a described one by its description', () => {
  expect(entry('1').forms).toEqual([{ glyph: 'u58ec', text: '壬' }, { glyph: 'u58ec-t', of: '壬' }, { glyph: 'u738b', text: '王' }, { glyph: 'u2123c', text: '𡈼' }])
  expect(entry('323').forms[1].glyph).toBe('u66f7-var-002')
  expect(data.entries.flatMap((/** @type {{ forms: { text?: string }[] }} */ row) => row.forms).some((/** @type {{ text?: string }} */ form) => form.text?.startsWith('⿱'))).toBe(true)
})

it('records the chart an example is shown from and a list that trails off', () => {
  expect(entry('1').charts['𢗖']).toBe('ucs2003')
  expect(entry('1').unifiedMore).toBe(true)
  expect(entry('1').unified).not.toContain('…')
})

it('draws nearly every form', () => {
  const names = new Set(data.entries.flatMap((/** @type {{ forms: { glyph: string }[] }} */ row) => row.forms.map(form => form.glyph)))
  const absent = [...names].filter(name => !outlines[name])
  expect(names.size).toBe(1606)
  expect(absent.length).toBeLessThanOrEqual(11)
  expect(outlines['u540c-08']).toMatch(/^M[\d. ]+L/)
})

it('keeps every review link and the characters a single form appears in', () => {
  expect(data.entries.flatMap((/** @type {{ review?: string[] }} */ row) => row.review ?? [])).toHaveLength(232)
  expect(entry('325').single[0]).toEqual({ char: '間', examples: ['墹', '𣊺', '𤩎', '𥼴', '𦗬', '𧒄', '𧢑', '𩴦'] })
})

it('keeps a count the source writes in words apart from the example characters', () => {
  expect(entry('402').single).toEqual([{ char: '网', examples: [], count: 'About 10' }, { char: '罒', examples: [], count: 'More than 300' }])
  const examples = data.entries.flatMap((/** @type {any} */ row) => [row.unified ?? [], row.compatibility ?? [], row.disunified ?? [], row.sourceSeparations ?? [], (row.single ?? []).map((/** @type {any} */ single) => single.examples)]).flat(3)
  expect(examples.filter((/** @type {string} */ char) => /** @type {number} */ (char.codePointAt(0)) < 128)).toEqual([])
})

it('reads a group title the source quotes either way', () => {
  for (const group of data.groups) expect(group.en).toBeTruthy()
})
