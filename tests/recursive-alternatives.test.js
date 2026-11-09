import { describe, expect, test } from 'bun:test'
import { parse, recursiveAlternatives, write } from '../src/core/index.js'

const tree = text => {
  const result = parse(text, { open: true })
  if (result.problem) throw new Error(result.problem)
  return result.tree
}
const adapter = (structures = {}, encodings = {}) => ({
  structure: async char => (structures[char] ?? []).map(text => ({ text })),
  encoded: async (text, options) => {
    expect(options.exact).toBe(true)
    return encodings[text] ?? []
  },
})
const collect = async (part, source, options) => {
  const events = []
  for await (const event of recursiveAlternatives(part, source, options)) events.push(event)
  const alternatives = events.filter(event => event.type === 'alternative')
  return {
    events,
    texts: alternatives.map(event => write(event.tree)),
    operations: Object.fromEntries(alternatives.map(event => [write(event.tree), event.operation])),
  }
}

describe('recursiveAlternatives', () => {
  test('independent expansions and merges combine in breadth-first order', async () => {
    const source = adapter({ 吋: ['⿰口寸'] }, { '⿰口寸': ['吋'] })
    const { texts, events, operations } = await collect(tree('⿰吋吋'), source)
    expect(texts).toEqual(['⿰⿰口寸吋', '⿰吋⿰口寸', '⿰⿰口寸⿰口寸'])
    expect(events.every(event => event.type === 'alternative')).toBe(true)
    expect(new Set(Object.values(operations))).toEqual(new Set(['expand']))
    const reverse = await collect(tree('⿰⿰口寸⿰口寸'), source)
    expect(reverse.texts).toEqual(['⿰吋⿰口寸', '⿰⿰口寸吋', '⿰吋吋'])
    expect(new Set(Object.values(reverse.operations))).toEqual(new Set(['merge']))
  })

  test('names alternatives that split and merge as both', async () => {
    const source = adapter({ 甲: ['⿰口寸'], 吋: ['⿰口寸'] }, { '⿰口寸': ['吋'] })
    const { operations } = await collect(tree('⿰甲吋'), source)
    expect(operations).toEqual({
      '⿰⿰口寸吋': 'expand',
      '⿰甲⿰口寸': 'expand',
      '⿰⿰口寸⿰口寸': 'expand',
      '⿰吋吋': 'both',
      '⿰吋⿰口寸': 'both',
    })
  })

  test('opens aliases and recursively merges newly formed subtrees', async () => {
    const source = adapter({ 甲: ['乙'], 乙: ['⿰口寸'] }, { '⿰口寸': ['丙'], '⿱丙木': ['丁'] })
    const { texts } = await collect(tree('⿱甲木'), source)
    expect(texts).toContain('⿱乙木')
    expect(texts).toContain('⿱⿰口寸木')
    expect(texts).toContain('⿱丙木')
    expect(texts).toContain('丁')
  })

  test('keeps partial slots, modifiers and marks; never merges their notes away', async () => {
    const source = adapter({ 吋: ['⿰口寸'] }, { '⿰口寸': ['吋'], '⿴[1]囗人': ['囚'] })
    const partial = { op: '⿴', note: '1', parts: ['吋', null], marks: 'ˊ' }
    const result = await collect(partial, source)
    expect(result.texts).toContain('⿴[1]⿰口寸⬚ˊ')
    expect(result.events[0].tree).toEqual({ ...partial, parts: [tree('⿰口寸'), null] })
    expect((await collect(tree('⿴[1]囗人'), source)).texts).not.toContain('囚')
    const marked = await collect({ op: '⿰', parts: ['口', '寸'], marks: 'ˊ' }, source)
    expect(marked.texts).toContain('吋ˊ')
    const innerMarked = await collect({ op: '⿰', parts: ['口ˊ', '寸'] }, source)
    expect(innerMarked.texts).not.toContain('吋')
  })

  test('emits only trees that survive writing and reading with their marks and notes', async () => {
    const source = adapter({ 甲: ['⿰木火ˊ', '⿴[1]囗人'], 乙: ['⿱水土'] })
    const root = await collect('甲', source, { maxDepth: 1 })
    expect(root.texts).toContain('⿰木火ˊ')
    const nested = await collect(tree('⿰甲乙'), source, { maxDepth: 1 })
    expect(nested.texts).toEqual(['⿰⿴[1]囗人乙', '⿰甲⿱水土'])
    for (const event of nested.events) if (event.type === 'alternative') {
      expect(tree(write(event.tree))).toEqual(event.tree)
    }
    const partial = await collect(tree('⿴[1]甲⬚ˇ'), source, { maxDepth: 1 })
    expect(partial.texts).toEqual(['⿴[1]⿴[1]囗人⬚ˇ'])
  })

  test('uses the literal selector and ignores invalid or incomplete adapter forms', async () => {
    const source = adapter({ '吋︀': ['⿰口寸', '⿰口', '⿰口⬚', '⿰口寸木'], 吋: ['⿱一二'] })
    const { texts } = await collect('吋︀ˊ', source, { maxDepth: 1 })
    expect(texts).toEqual(['⿰口寸ˊ'])
  })

  test('deduplicates cyclic aliases and repeated descriptions', async () => {
    const source = adapter({ 甲: ['乙', '乙'], 乙: ['甲'] })
    const { events, texts } = await collect('甲', source)
    expect(texts).toEqual(['乙'])
    expect(events).toHaveLength(1)
  })

  test('caches repeated lookups and bounds growing structural cycles', async () => {
    const calls = []
    const source = {
      structure: async char => { calls.push(char); return char === '甲' ? [{ text: '⿰甲乙' }] : [] },
    }
    const { texts, events } = await collect(tree('⿱甲甲'), source, { maxDepth: 2 })
    expect(texts).toContain('⿱⿰甲乙⿰甲乙')
    expect(calls.filter(char => char === '甲')).toHaveLength(1)
    expect(events.at(-1)).toEqual({ type: 'truncated', reasons: ['depth'] })
  })

  test('reports each bound only when unexplored work exists', async () => {
    const source = adapter({ 甲: ['乙'], 乙: ['丙'], 丙: ['丁'] })
    expect((await collect('甲', source, { maxDepth: 1 })).events.at(-1)).toEqual({ type: 'truncated', reasons: ['depth'] })
    expect((await collect('甲', source, { maxResults: 1 })).events.at(-1)).toEqual({ type: 'truncated', reasons: ['results'] })
    expect((await collect('甲', source, { maxStates: 1 })).events.at(-1)).toEqual({ type: 'truncated', reasons: ['states'] })
    expect((await collect('甲', source, { maxWork: 1 })).events.at(-1)).toEqual({ type: 'truncated', reasons: ['work'] })
    expect((await collect('甲', adapter({ 甲: ['乙'] }), { maxResults: 1 })).events).toHaveLength(1)
  })

  test('limits new adapter calls while allowing cached lookups', async () => {
    const calls = []
    const source = { structure: async char => { calls.push(char); return char === '甲' ? [{ text: '乙' }] : [] } }
    const { texts, events } = await collect(tree('⿰甲甲'), source, { maxLookups: 1 })
    expect(texts).toContain('⿰乙乙')
    expect(calls).toEqual(['甲'])
    expect(events.at(-1)).toEqual({ type: 'truncated', reasons: ['lookups'] })
  })

  test('continues other paths after failed lookups and reports incompleteness', async () => {
    const source = {
      structure: async char => {
        if (char === '甲') throw new Error('unavailable')
        return char === '乙' ? [{ text: '丙' }] : []
      },
      encoded: async () => { throw new Error('unavailable') },
    }
    const { texts, events } = await collect(tree('⿰甲乙'), source)
    expect(texts).toContain('⿰甲丙')
    expect(events.at(-1)).toEqual({ type: 'truncated', reasons: ['lookup'] })
  })

  test('times out hanging lookups, aborts them, and continues other paths', async () => {
    const requests = []
    const source = {
      structure: async (char, { signal }) => {
        if (char === '甲') { requests.push(signal); return await new Promise(() => {}) }
        return char === '乙' ? [{ text: '丙' }] : []
      },
      encoded: async (_text, { signal }) => { requests.push(signal); return await new Promise(() => {}) },
    }
    const { texts, events } = await collect(tree('⿰甲乙'), source, { lookupTimeoutMs: 10 })
    expect(texts).toContain('⿰甲丙')
    expect(events.at(-1)).toEqual({ type: 'truncated', reasons: ['lookup'] })
    expect(requests.length).toBeGreaterThan(1)
    expect(requests.every(signal => signal.aborted)).toBe(true)
  })

  test('aborts an in-flight lookup even when the adapter ignores its signal', async () => {
    const controller = new AbortController()
    let requestSignal
    let started
    const ready = new Promise(resolve => { started = resolve })
    const source = { structure: async (_char, { signal }) => { requestSignal = signal; started(); return await new Promise(() => {}) } }
    const pending = collect('甲', source, { signal: controller.signal, lookupTimeoutMs: 5000 })
    await ready
    controller.abort()
    await expect(pending).rejects.toThrow()
    expect(requestSignal.aborted).toBe(true)
  })

  test('yields child alternatives before looking up their parent', async () => {
    const source = {
      structure: async char => char === '甲' ? [{ text: '丙' }] : [],
      encoded: async () => { throw new Error('parent lookup must not be awaited yet') },
    }
    const iterator = recursiveAlternatives(tree('⿰甲乙'), source)
    const first = await iterator.next()
    expect(first.value.type).toBe('alternative')
    expect(write(first.value.tree)).toBe('⿰丙乙')
    await iterator.return()
  })

  test('works without encoded and propagates cancellation', async () => {
    const source = { structure: async char => char === '甲' ? [{ text: '乙' }] : [] }
    expect((await collect('甲', source)).texts).toEqual(['乙'])
    const controller = new AbortController()
    controller.abort()
    await expect(collect('甲', source, { signal: controller.signal })).rejects.toThrow()
    await expect(collect('甲', { structure: async () => { throw new DOMException('cancelled', 'AbortError') } })).rejects.toThrow('cancelled')
    await expect(collect('甲', source, { maxWork: Infinity })).rejects.toThrow(RangeError)
    await expect(collect('甲', source, { lookupTimeoutMs: 0 })).rejects.toThrow(RangeError)
    await expect(collect('甲', source, { lookupTimeoutMs: 2147483648 })).rejects.toThrow(RangeError)
  })
})

test('reads a subtraction through its decompositions', async () => {
  const source = adapter({ 軍: ['⿱冖車'], 光: ['⿱⺌兀'], 輝: ['⿰光軍'] })
  const direct = await collect(tree('㇯軍車'), source)
  expect(direct.texts).toContain('冖')
  expect(direct.operations['冖']).toBe('merge')
  expect((await collect(tree('⿰光㇯軍車'), source)).texts).toContain('⿰光冖')
  expect((await collect(tree('㇯輝車'), source)).texts).toContain('⿰光冖')
})

test('offers the encoded character beside the remainder', async () => {
  const source = adapter({ 軍: ['⿱冖車'] }, { '㇯軍車': ['乙', '？', '甲乙'] })
  const { texts, operations } = await collect(tree('㇯軍車'), source)
  expect(texts).toContain('冖')
  expect(texts).toContain('乙')
  expect(operations['乙']).toBe('merge')
  expect(texts).not.toContain('？')
  expect(texts).not.toContain('甲乙')
})

test('follows a single-component description as well as a decomposition', async () => {
  const source = adapter({ 甲: ['⿱冖車'], 乙: ['甲'] })
  expect((await collect(tree('㇯乙車'), source)).texts).toContain('冖')
})

test('does not take one operand of a description that is itself a subtraction', async () => {
  const source = adapter({ 乌: ['㇯鸟丶'], 鸟: ['⿱一鸟'] })
  const { texts } = await collect(tree('㇯乌丶'), source)
  expect(texts).not.toContain('鸟')
})

test('leaves a subtraction the decompositions do not resolve', async () => {
  const source = adapter({ 軍: ['⿱冖車'] })
  const { texts } = await collect(tree('㇯軍光'), source)
  expect(texts).toEqual(['㇯⿱冖車光'])
})
