import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { LIMITS, fitToDispatch } from '../demo/lib/report.js'

const TAB = (n, size = 1024) => ({ id: `t${n}`, sequence: '⿰木口', document: { layer: 'x'.repeat(size), n } })
const CONTEXT = {
  appVersion: '0.1.3', commit: '3e0c0e0f', route: '/', viewport: '1409×831', locale: 'ja',
  theme: 'light', face: 'serif', userAgent: 'x', platform: 'Win32', fonts: [],
}
const REPORT = {
  symptom: '心太大',
  sequence: '⿱⿲⿱日月⿱⿲糸言糸⿲長馬長⿱干戈心',
  link: 'https://ids.mkpo.li/?ids=x',
  contact: '',
}

/** The dispatch the Worker measures before it hands a report to the Action. */
function dispatchSize({ symptom, sequence, link, contact, document, context }) {
  /** @type {Record<string, string>} */
  const carried = {}
  for (const [name, value] of Object.entries({ symptom, sequence, link, contact, document, context })) {
    if (value) carried[name] = value
  }
  return Buffer.byteLength(JSON.stringify(carried))
}

/** @param {{ workspace?: unknown, context?: Record<string, unknown>, entries?: unknown[], report?: typeof REPORT }} [source] */
const fitted = ({ workspace = { tabs: [TAB(1), TAB(2)], active: 't1' }, context = CONTEXT, entries = [], report = REPORT } = {}) =>
  fitToDispatch({ ...report, workspace, context, entries: /** @type {any} */ (entries) })

describe('a report fitted to the dispatch', () => {
  it('is fitted to the size the intake will dispatch', () => {
    const worker = readFileSync(new URL('../workers/reports/src/index.js', import.meta.url), 'utf8')
    const size = /const MAX_DISPATCH = ([\d_]+)/.exec(worker)?.[1]
    expect(size).toBeDefined()
    expect(LIMITS.dispatch).toBe(Number(size?.replaceAll('_', '')))
  })
  it('keeps a report that already fits as it is', () => {
    const entries = [{ at: 1, level: 'warn', text: 'a warning' }]
    const workspace = { tabs: [TAB(1), TAB(2)], active: 't1' }
    const result = fitted({ workspace, entries })
    expect(JSON.parse(result.document)).toEqual(workspace)
    expect(JSON.parse(result.context)).toEqual({ ...CONTEXT, console: entries })
    expect(dispatchSize({ ...REPORT, ...result })).toBeLessThanOrEqual(LIMITS.dispatch)
  })
  it('cuts the last tabs from a workspace too big for it', () => {
    const workspace = { tabs: Array.from({ length: 300 }, (_, index) => TAB(index)), active: 't0' }
    const result = fitted({ workspace })
    const kept = JSON.parse(result.document)
    expect(dispatchSize({ ...REPORT, ...result })).toBeLessThanOrEqual(LIMITS.dispatch)
    expect(kept.tabs.length).toBeGreaterThan(0)
    expect(kept.tabs.length).toBeLessThan(300)
    expect(kept.tabs[0].id).toBe('t0')
    expect(kept.tabs.length + kept.droppedTabs).toBe(300)
  })
  it('cuts the context to leave the report somewhere to go', () => {
    const entries = Array.from({ length: 20 }, (_, index) => ({ at: index, level: 'warn', text: 'y'.repeat(500) }))
    const report = { ...REPORT, symptom: '漢'.repeat(4000), sequence: '⿰'.repeat(2000), link: `https://ids.mkpo.li/?ids=${'a'.repeat(4000)}`, contact: 'c'.repeat(200) }
    const result = fitted({ report, entries })
    expect(dispatchSize({ ...report, ...result })).toBeLessThanOrEqual(LIMITS.dispatch)
    expect(JSON.parse(result.context).console.length).toBeLessThan(20)
  })
  it('fits a context whose quotes and newlines cost more than its bytes', () => {
    const entries = Array.from({ length: 20 }, (_, index) => ({ at: index, level: 'warn', text: `"\\\n`.repeat(500) }))
    const result = fitted({ entries })
    expect(dispatchSize({ ...REPORT, ...result })).toBeLessThanOrEqual(LIMITS.dispatch)
    expect(() => JSON.parse(result.context)).not.toThrow()
  })
  it('drops a tab document that cannot fit, and keeps what the tab was', () => {
    const workspace = { tabs: [{ id: 't0', sequence: '⬚', document: 'y'.repeat(300 * 1024) }] }
    const result = fitted({ workspace })
    const kept = JSON.parse(result.document)
    expect(dispatchSize({ ...REPORT, ...result })).toBeLessThanOrEqual(LIMITS.dispatch)
    expect(kept.tabs).toHaveLength(1)
    expect(kept.tabs[0].sequence).toBe('⬚')
    expect(kept.tabs[0].document).toBeUndefined()
    expect(kept.droppedDocuments).toBe(1)
  })
})
