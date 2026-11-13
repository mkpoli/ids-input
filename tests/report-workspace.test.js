import { describe, expect, it } from 'bun:test'
import { workspaceJson } from '../demo/lib/report.js'

const LIMIT = 8 * 1024
const tab = (n, size = 1024) => ({ id: `t${n}`, sequence: '⿰木口', document: { layer: 'x'.repeat(size), n } })

describe('the workspace a report carries', () => {
  it('passes a small one through whole', () => {
    const workspace = { tabs: [tab(1), tab(2)], active: 0 }
    expect(JSON.parse(workspaceJson(workspace, LIMIT))).toEqual(workspace)
  })
  it('drops the last tabs rather than the whole workspace when it is too big', () => {
    const workspace = { tabs: Array.from({ length: 300 }, (_, i) => tab(i)), active: 0 }
    expect(Buffer.byteLength(workspaceJson(workspace, LIMIT))).toBeLessThanOrEqual(LIMIT)
    const kept = JSON.parse(workspaceJson(workspace, LIMIT))
    expect(kept.tabs[0].document.n).toBe(0)
    expect(kept.droppedTabs).toBeGreaterThan(0)
    expect(kept.tabs.length + kept.droppedTabs).toBe(300)
    expect(kept.active).toBe(0)
  })
  it('keeps the tab being looked at while it drops the others', () => {
    const workspace = { tabs: Array.from({ length: 300 }, (_, i) => tab(i)), activeTab: 't150', active: 150 }
    const kept = JSON.parse(workspaceJson(workspace, LIMIT))
    const active = kept.tabs.find(item => item.id === 't150')
    expect(active).toBeDefined()
    expect(active.document.n).toBe(150)
    expect(kept.tabs.length + kept.droppedTabs).toBe(300)
  })
  it('keeps the first tab and drops its document when the tab alone is over', () => {
    const workspace = { tabs: [{ sequence: '⬚', document: 'y'.repeat(300 * 1024) }] }
    const kept = JSON.parse(workspaceJson(workspace, 200))
    expect(kept.tabs).toHaveLength(1)
    expect(kept.tabs[0].sequence).toBe('⬚')
    expect(kept.tabs[0].document).toBeUndefined()
    expect(kept.droppedDocuments).toBe(1)
  })
  it('takes a local address out of an imported document, wherever it sits', () => {
    const workspace = { tabs: [{ sequence: '⿰木口', document: {
      title: 'made on file:///home/alice/private.ids.json',
      assets: [{ uri: 'http://localhost:8080/glyph.svg', note: 'via /@fs/home/alice/draw.js' }],
    } }] }
    const sent = JSON.stringify(JSON.parse(workspaceJson(workspace, LIMIT)))
    expect(sent).not.toContain('alice')
    expect(sent).toContain('(local)')
    expect(JSON.parse(workspaceJson(workspace, LIMIT)).tabs[0].sequence).toBe('⿰木口')
  })
  it('takes an empty or odd workspace', () => {
    expect(workspaceJson(undefined, LIMIT)).toBe('{}')
    expect(workspaceJson({}, LIMIT)).toBe('{}')
  })
})
