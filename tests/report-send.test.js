import { afterEach, describe, expect, it } from 'bun:test'
import { ReportError, sendReport } from '../demo/lib/report.js'

const real = globalThis.fetch
afterEach(() => { globalThis.fetch = real })

/** @param {string} symptom */
const report = symptom => ({
  symptom, contact: '', image: false,
  snapshot: { sequence: '⿰木口', link: '', document: '{}', context: '{}', image: null },
})

describe('sending a report', () => {
  it('carries a signal, so a hung intake cannot keep the dialog busy', async () => {
    /** @type {RequestInit | undefined} */
    let init
    globalThis.fetch = (async (url, options) => {
      init = options
      return new Response(JSON.stringify({ number: 7, url: 'https://github.com/mkpoli/ids-input/issues/7' }), { status: 201 })
    })
    const answer = await sendReport('https://ids.mkpo.li/api/report', report('it broke'))
    expect(answer.number).toBe(7)
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(init?.signal?.aborted).toBe(false)
    expect(/** @type {FormData} */ (init?.body).get('symptom')).toBe('it broke')
  })
  it('lets an abort through to the caller, which keeps the text', async () => {
    globalThis.fetch = async () => { throw new DOMException('The operation timed out.', 'TimeoutError') }
    await expect(sendReport('https://ids.mkpo.li/api/report', report('it broke'))).rejects.toThrow(DOMException)
  })
  it('reports the intake’s own words on a refusal', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'Too many reports' }), { status: 429 }))
    await expect(sendReport('https://ids.mkpo.li/api/report', report('it broke'))).rejects.toThrow(ReportError)
  })
})
