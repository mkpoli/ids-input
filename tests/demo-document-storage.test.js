import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { createDocumentSession, fromSequence, sessionRecord } from '../src/document/index.js'

const memory = () => {
  const map = new Map()
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => { map.set(key, String(value)) },
    removeItem: key => { map.delete(key) },
    clear: () => map.clear(),
  }
}
const saved = () => {
  const session = createDocumentSession(fromSequence('⿰木口'))
  const chosen = session.document.root.children[0].id
  session.choose(chosen)
  session.setTransform([{ type: 'affine', matrix: [1, 0, 0, 1, 8, 9] }])
  return sessionRecord(session)
}

let originalLocal, originalSession
beforeEach(() => {
  originalLocal = globalThis.localStorage
  originalSession = globalThis.sessionStorage
  globalThis.localStorage = memory()
  globalThis.sessionStorage = memory()
})
afterEach(() => {
  globalThis.localStorage = originalLocal
  globalThis.sessionStorage = originalSession
})

describe('document records in demo storage', () => {
  it('keeps a tab document through writeTabs and readTabs', async () => {
    const { makeTab, readActiveTab, readTabs, writeTabs } = await import('../demo/lib/tabs.js')
    const record = saved()
    const tab = makeTab('⿰木口', '⿰木口', record)
    writeTabs([tab], tab.id)
    const [read] = readTabs()
    expect(read.id).toBe(tab.id)
    expect(read.document).toEqual(record)
    expect(readActiveTab()).toBe(tab.id)
  })
  it('keeps document records in drafts and deduplicates the pair', async () => {
    const { drafts, keep } = await import('../demo/lib/projects.js')
    const record = saved()
    keep('⿰木口', record)
    keep('⿰木口', record)
    expect(drafts()).toHaveLength(1)
    expect(drafts()[0].document).toEqual(record)
    const other = structuredClone(record)
    other.chosen = null
    keep('⿰木口', other)
    expect(drafts()).toHaveLength(2)
  })
})
