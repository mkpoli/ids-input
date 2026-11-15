import { describe, expect, it } from 'bun:test'
import { cardSvg } from '../worker/card.js'
import { cardParts, characterFor, firstDrawn, namedFor, unitsFor } from '../worker/render.js'

const env = { ASSETS: { fetch: async () => new Response(null, { status: 404 }) } }
const drawing = { d: 'M0 0L100 0L100 100Z' }

describe('the units a card draws a named sequence in', () => {
  it('sets the written characters beside the character, each once', async () => {
    expect(await unitsFor(env, '⿰设冓', '講')).toEqual(['講', '设', '冓'])
    expect(await unitsFor(env, '⿰忄井', '警')).toEqual(['警', '忄', '井'])
  })
  it('leaves out the character when the description already writes it', async () => {
    expect(await unitsFor(env, '⿰警井', '警')).toEqual(['⿰警井'])
  })
  it('keeps a sequence whole unless it is one operator on two characters', async () => {
    for (const sequence of ['⿺廴占', '⿱艹么', '⿰⿱艹么井', '木']) expect(await unitsFor(env, sequence, '警')).toEqual([sequence])
    expect(await unitsFor(env, '⿰忄井', null)).toEqual(['⿰忄井'])
  })
  it('labels a card of one drawing as a sequence, and one of several as its characters', () => {
    const one = cardSvg(cardParts('⿰釒哥', drawing, '鎶'))
    expect(one).toContain('>Ideographic description sequence</text>')
    expect(one).not.toContain('each drawn on its own')
    const units = ['講', '设', '冓']
    const several = cardSvg(cardParts('⿰设冓', drawing, '講', { units, drawings: units.map(() => drawing), codepoint: 'U+8B1B' }))
    expect(several).toContain('Characters of the description, each drawn on its own')
  })
  it('never repeats the character in the units a card is given', async () => {
    const units = await unitsFor(env, '⿰设冓', '講')
    const svg = cardSvg({ sequence: '⿰设冓', char: '講', units, drawings: units.map(() => drawing) })
    expect(svg.match(/data-character="true"/g)).toHaveLength(1)
    expect(new Set(units).size).toBe(units.length)
  })
  it('names the example character, else the table character, for both the card and its page', async () => {
    expect(await characterFor(env, '⿰忄井')).toBe('𲟱')
    expect(await characterFor(env, '⿰木子')).toBe(null)
    // The index reads ⿱亠公 as 𬺤, a different character; the example names 衮 and no character.
    expect(namedFor('⿱亠公', '𬺤')).toBe(null)
  })
})

describe('the ways a card may draw a sequence', () => {
  it('takes the first that draws, and fails as the last did when none does', async () => {
    const asked = []
    const draw = async way => { asked.push(way); if (way !== 'plain') throw new Error(`no outline for ${way}`); return 'drawing' }
    expect(await firstDrawn(['formed', 'plain'], draw)).toBe('drawing')
    expect(asked).toEqual(['formed', 'plain'])
    expect(await firstDrawn(['plain', 'never asked'], draw)).toBe('drawing')
    await expect(firstDrawn(['formed', 'other'], draw)).rejects.toThrow('no outline for other')
  })
})
