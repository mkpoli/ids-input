import { describe, expect, it } from 'bun:test'
import { retrying } from '../src/core/retry.js'

/** A fetch that answers each call from `answers` in turn: a status, or 'drop' for a network error. */
const scripted = answers => {
  const calls = []
  const get = async input => {
    calls.push(input)
    const answer = answers[Math.min(calls.length - 1, answers.length - 1)]
    if (answer === 'drop') throw new TypeError('Failed to fetch')
    return new Response(String(answer), { status: answer })
  }
  return { get, calls }
}
const quick = [1, 1, 1]

describe('a download asked for again', () => {
  it('answers on the first attempt that gets through a dropped connection', async () => {
    const { get, calls } = scripted(['drop', 'drop', 200])
    const response = await retrying(get, quick)('/a')
    expect(response.status).toBe(200)
    expect(calls.length).toBe(3)
  })
  it('asks again while the server is briefly unable to answer', async () => {
    const { get, calls } = scripted([503, 429, 200])
    expect((await retrying(get, quick)('/a')).status).toBe(200)
    expect(calls.length).toBe(3)
  })
  it('hands over a missing file at once', async () => {
    const { get, calls } = scripted([404])
    expect((await retrying(get, quick)('/a')).status).toBe(404)
    expect(calls.length).toBe(1)
  })
  it('gives the last error once the attempts run out', async () => {
    const { get, calls } = scripted(['drop'])
    await expect(retrying(get, quick)('/a')).rejects.toThrow('Failed to fetch')
    expect(calls.length).toBe(4)
  })
  it('gives the last answer once the attempts run out', async () => {
    const { get, calls } = scripted([502])
    expect((await retrying(get, quick)('/a')).status).toBe(502)
    expect(calls.length).toBe(4)
  })
  it('stops waiting when the request is aborted', async () => {
    const { get, calls } = scripted(['drop'])
    const controller = new AbortController()
    const pending = retrying(get, [60000])('/a', { signal: controller.signal })
    await Bun.sleep(5)
    controller.abort(new DOMException('stop', 'AbortError'))
    await expect(pending).rejects.toThrow('stop')
    expect(calls.length).toBe(1)
  })
  it('lets a timeout through untouched', async () => {
    const calls = []
    const get = async () => { calls.push(1); throw new DOMException('late', 'TimeoutError') }
    await expect(retrying(get, quick)('/a')).rejects.toThrow('late')
    expect(calls.length).toBe(1)
  })
  it('asks again after the plain Error a runtime other than the browser rejects with', async () => {
    const calls = []
    const get = async () => { calls.push(1); if (calls.length < 2) throw new Error('ConnectionRefused'); return new Response('ok') }
    expect((await retrying(get, quick)('/a')).status).toBe(200)
    expect(calls.length).toBe(2)
  })
})
