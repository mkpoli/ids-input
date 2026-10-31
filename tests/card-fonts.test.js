import { expect, it } from 'bun:test'
import { OPERATORS } from '../src/core/ids.js'
import { facesFor } from '../worker/fonts.js'

it('loads real IDC glyphs from one dedicated face for all 18 operators', async () => {
  const requests = []
  const env = { ASSETS: { fetch: async url => {
    requests.push(url.pathname)
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'font/ttf' } })
  } } }
  const { familyOf } = await facesFor(env, OPERATORS.map(([operator]) => operator).join(''))
  for (const [operator] of OPERATORS) expect(familyOf(operator)).toBe('IDS Operators')
  expect(requests.filter(path => path.endsWith('/operators.ttf'))).toHaveLength(1)
  expect(requests.some(path => path.includes('/unicode/'))).toBe(false)
})
