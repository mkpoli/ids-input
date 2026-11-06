import { describe, expect, it } from 'bun:test'
import { createSampleDrawings } from '../demo/lib/sample-drawings.js'

describe('the font switch sample drawings', () => {
  it('starts a newer sequence at once and abandons the one before', async () => {
    const started = []
    const signals = []
    const samples = createSampleDrawings((sequence, { signal }) => {
      started.push(sequence)
      signals.push(signal)
      if (signal.aborted) return Promise.reject(new Error('replaced'))
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('replaced')))
        if (sequence === '⿰木口') return
        resolve({ d: sequence })
      })
    })
    const first = samples('⿰木口')
    const second = samples('⿱日生')
    await Promise.resolve()
    expect(started).toEqual(['⿰木口', '⿱日生'])
    expect(signals[0].aborted).toBe(true)
    expect(await first).toBeNull()
    expect(await second).toEqual({ d: '⿱日生' })
  })

  it('shares one drawing between callers and keeps it for the sequence', async () => {
    let calls = 0
    const samples = createSampleDrawings(async sequence => { calls++; return { d: sequence } })
    const [a, b] = await Promise.all([samples('⿰木口'), samples('⿰木口')])
    expect(calls).toBe(1)
    expect(a).toEqual({ d: '⿰木口' })
    expect(b).toEqual({ d: '⿰木口' })
    expect(await samples('⿰木口')).toEqual({ d: '⿰木口' })
    expect(calls).toBe(1)
  })

  it('keeps no failure, so a retry asks again', async () => {
    let calls = 0
    const samples = createSampleDrawings(async () => {
      calls++
      if (calls === 1) throw new Error('offline')
      return { d: 'ok' }
    })
    expect(await samples('⿰木口')).toBeNull()
    expect(await samples('⿰木口')).toEqual({ d: 'ok' })
    expect(calls).toBe(2)
  })

  it('asks for nothing when the sequence is empty', async () => {
    let calls = 0
    const samples = createSampleDrawings(async () => { calls++; return { d: 'x' } })
    expect(await samples('')).toBeNull()
    expect(calls).toBe(0)
  })
})
