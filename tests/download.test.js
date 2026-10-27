import { afterEach, expect, spyOn, test } from 'bun:test'
import { download } from '../demo/lib/files.js'

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
let spies = []
afterEach(() => {
  for (const spy of spies) spy.mockRestore()
  spies = []
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
  else delete globalThis.document
})

function browser(click = () => {}) {
  const link = { click, remove: () => {} }
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => link, body: { append: () => {} },
  } })
  const revoke = spyOn(URL, 'revokeObjectURL')
  const remove = spyOn(link, 'remove')
  const timer = spyOn(globalThis, 'setTimeout').mockImplementation(() => 0)
  spies.push(revoke, remove, timer)
  return { link, revoke, remove, timer }
}

for (const type of ['image/svg+xml', 'image/png']) {
  test(`${type} remains readable after the click until delayed cleanup`, async () => {
    const { link, revoke, remove, timer } = browser()
    download(new Blob(['file contents'], { type }), '字.svg')
    expect(link.download).toBe('字.svg')
    expect(link.hidden).toBe(true)
    expect(await (await fetch(link.href)).text()).toBe('file contents')
    expect(revoke).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    const [cleanup, delay] = timer.mock.calls[0]
    expect(delay).toBeGreaterThanOrEqual(60_000)
    cleanup()
    expect(remove).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith(link.href)
  })
}

test('a failed click releases the file and preserves the error', () => {
  const error = new Error('download blocked')
  const { link, revoke, remove, timer } = browser(() => { throw error })
  expect(() => download(new Blob(['svg']), '字.svg')).toThrow(error)
  expect(remove).toHaveBeenCalledTimes(1)
  expect(revoke).toHaveBeenCalledWith(link.href)
  expect(timer).not.toHaveBeenCalled()
})
