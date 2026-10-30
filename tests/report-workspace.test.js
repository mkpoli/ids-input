import { describe, expect, it } from 'bun:test'
import { LIMITS, workspaceJson } from '../demo/lib/report.js'

const tab = (n) => ({ sequence: '⿰木口', document: { layer: 'x'.repeat(1024), n } })

describe('the workspace a report carries', () => {
  it('passes a small one through whole', () => {
    const workspace = { tabs: [tab(1), tab(2)], active: 0 }
    expect(JSON.parse(workspaceJson(workspace))).toEqual(workspace)
  })
  it('drops the last tabs rather than the whole document when it is too big', () => {
    const workspace = { tabs: Array.from({ length: 300 }, (_, i) => tab(i)), active: 0 }
    expect(Buffer.byteLength(workspaceJson(workspace))).toBeLessThanOrEqual(LIMITS.document)
    const kept = JSON.parse(workspaceJson(workspace))
    expect(kept.tabs[0].document.n).toBe(0)
    expect(kept.droppedTabs).toBeGreaterThan(0)
    expect(kept.active).toBe(0)
  })
  it('keeps the last tab even when it alone is over', () => {
    const workspace = { tabs: [{ sequence: '⬚', document: 'y'.repeat(300 * 1024) }] }
    expect(JSON.parse(workspaceJson(workspace)).tabs).toHaveLength(1)
  })
  it('takes an empty or odd workspace', () => {
    expect(workspaceJson(undefined)).toBe('{}')
    expect(workspaceJson({})).toBe('{}')
  })
})
