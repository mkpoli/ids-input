import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { parse, write } from '../src/core/ids.js'
import { positionalRespellings, positionalSuggestion, readPositionalForms } from '../src/core/positional.js'

const forms = readPositionalForms(readFileSync(new URL('../data/positional-forms.tsv', import.meta.url), 'utf8'))
const suggested = (/** @type {string} */ text) => { const found = positionalSuggestion(parse(text).tree, forms); return found && write(found.tree) }

describe('a component spelled in full where characters write its positional form', () => {
  it('is respelled with the form, the description as typed left alone', () => {
    const tree = parse('⿱竹⿰魚羊').tree
    expect(suggested('⿱竹⿰魚羊')).toBe('⿱𥫗⿰魚羊')
    expect(write(tree)).toBe('⿱竹⿰魚羊')
    const [change] = positionalRespellings(tree, forms)
    expect(change).toMatchObject({ at: [0], place: 'top', from: '竹', to: '𥫗' })
    expect(change.formed).toBeGreaterThan(change.written * 20)
  })

  it('reads the place from the operator and the operand\'s position', () => {
    expect(suggested('⿰竹馬')).toBeNull()
    expect(suggested('⿱馬竹')).toBeNull()
    expect(suggested('⿳竹日心')).toBe('⿳𥫗日心')
    expect(suggested('⿰人⿱艸魚')).toBe('⿰亻⿱艹魚')
    expect(suggested('⿸广竹')).toBeNull()
  })

  it('offers nothing for a form already written, or a component written both ways', () => {
    expect(suggested('⿱𥫗⿰魚羊')).toBeNull()
    expect(suggested('⿰魚刀')).toBeNull()
    expect(suggested('⿱林火')).toBeNull()
    expect(suggested('竹')).toBeNull()
  })

  it('lists only components some character does write in full there', () => {
    for (const [, row] of forms) expect(row.written).toBeGreaterThanOrEqual(1)
    expect(forms.has('left\t言')).toBe(false)
  })
})
