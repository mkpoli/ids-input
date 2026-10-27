import { describe, expect, it } from 'bun:test'
import { replacementPrefix, replacementQuery, resolveReplacement, write } from '../src/core/index.js'

const table = new Map(Object.entries({
  林: ['⿰木木'], 森: ['⿱木林'], 赢: ['⿱吂⿲月贝凡'],
  甲: ['⿰乙口'], 乙: ['⿱甲木'],
}))
const structure = async char => (table.get(char) ?? []).map(text => ({ text }))
const resolve = async text => {
  const query = replacementQuery(text)
  if (!query) throw Error('Invalid test query')
  const tree = await resolveReplacement(query, structure)
  return tree === null ? null : write(tree)
}

describe('zi.tools replacement expressions', () => {
  it('accepts the symbol, presentation selectors and RP alias with three components', () => {
    for (const prefix of ['🔄', '🔄︎', '🔄️', 'RP', 'rp'])
      expect(replacementQuery(`${prefix}赢贝女`)).toEqual({ source: '赢', target: '贝', replacement: '女' })
    expect(replacementQuery('🔄林木')).toBeNull()
    expect(replacementQuery('🔄林木火水')).toBeNull()
    expect(replacementQuery('🔄林？火')).toBeNull()
    expect(replacementQuery('⿰🔄木')).toBeNull()
    expect(replacementPrefix('  RP林LR')).toBe(true)
    expect(replacementQuery('  RP林LR')).toEqual({ source: '林', target: 'L', replacement: 'R' })
    expect(replacementQuery('RP{1}')).toEqual({ source: '{', target: '1', replacement: '}' })
  })
  it('replaces one nearest occurrence, with the last among equally shallow parts', async () => {
    expect(await resolve('🔄林木火')).toBe('⿰木火')
    expect(await resolve('🔄森木火')).toBe('⿱火林')
    expect(await resolve('🔄赢贝女')).toBe('⿱吂⿲月女凡')
  })
  it('accepts complete IDS operands and rejects incomplete or unknown operands', () => {
    expect(replacementQuery('🔄⿰木木木火')).toEqual({ source: '⿰木木', target: '木', replacement: '火' })
    expect(replacementQuery('RP林木⿱日月')).toEqual({ source: '林', target: '木', replacement: '⿱日月' })
    expect(replacementQuery('🔄⿰林林⿰木木火')).toEqual({ source: '⿰林林', target: '⿰木木', replacement: '火' })
    expect(replacementQuery('🔄⿰木木木⿱日')).toBeNull()
    expect(replacementQuery('🔄⿰木？木火')).toBeNull()
    expect(replacementQuery('🔄林木？︀')).toBeNull()
    expect(replacementQuery('🔄⿰木？︀木火')).toBeNull()
    expect(replacementQuery('🔄⿰木⬚木火')).toBeNull()
    expect(replacementQuery('🔄' + '⿾'.repeat(65) + '木木火')).toBeNull()
  })
  it('replaces a component or subtree with an IDS, including within opened descriptions', async () => {
    expect(await resolve('🔄⿰木木木火')).toBe('⿰火木')
    expect(await resolve('🔄林木⿱日月')).toBe('⿰木⿱日月')
    expect(await resolve('🔄⿰⿰木木日⿰木木火')).toBe('⿰火日')
    expect(await resolve('🔄⿰林林⿰木木火')).toBe('⿰林火')
    expect(await resolve('🔄⿰木日⿱木日火')).toBeNull()
  })
  it('opens nested components and terminates when descriptions are cyclic', async () => {
    expect(await resolve('🔄甲木火')).toBe('⿰⿱甲火口')
    expect(await resolve('🔄甲水火')).toBeNull()
  })
  it('compares matches across equally expanded candidates before choosing the nearest', async () => {
    const choices = new Map(Object.entries({ 甲: ['⿰乙丙'], 乙: ['⿰木口'], 丙: ['⿰口⿰木口'] }))
    const tree = await resolveReplacement(replacementQuery('🔄甲木火'), async char => (choices.get(char) ?? []).map(text => ({ text })))
    expect(write(tree)).toBe('⿰⿰火口丙')
  })
  it('stops making requests after an abandoned lookup is aborted', async () => {
    const controller = new AbortController()
    let finish, calls = 0
    const request = resolveReplacement(replacementQuery('🔄林木火'), () => {
      calls++
      return new Promise(resolve => { finish = resolve })
    }, { signal: controller.signal })
    controller.abort()
    finish([{ text: '⿰木木' }])
    await expect(request).rejects.toThrow()
    expect(calls).toBe(1)
  })
  it('does not return a result too long for the editor', async () => {
    const query = replacementQuery(`🔄甲木${'⿾'.repeat(10)}火`)
    const result = await resolveReplacement(query, async () => [{ text: `⿰${'⿾'.repeat(58)}木日` }])
    expect(result).toBeNull()
  })
  it('tries another match if the preferred result would be too long', async () => {
    const query = replacementQuery(`🔄甲木${'⿾'.repeat(10)}火`)
    const result = await resolveReplacement(query, async char => char === '甲'
      ? [{ text: `⿰${'⿾'.repeat(58)}日木` }, { text: '⿰木口' }] : [])
    expect(write(result)).toBe(`⿰${'⿾'.repeat(10)}火口`)
  })
  it('can replace a subtree after an expansion temporarily exceeds the editor length', async () => {
    const target = `${'⿾'.repeat(59)}木`
    const query = replacementQuery(`🔄⿰甲日${target}火`)
    const result = await resolveReplacement(query, async char => char === '甲'
      ? [{ text: `⿲${target}乙丙` }] : [])
    expect(write(result)).toBe('⿰⿲火乙丙日')
  })
  it('preserves component variation selectors in the output', async () => {
    expect(await resolve('🔄林木火︀')).toBe('⿰木火︀')
  })
})
