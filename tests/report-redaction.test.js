import { describe, expect, it } from 'bun:test'
import { redact } from '../demo/lib/report.js'

describe('a line on its way into a report', () => {
  it('loses every address of the machine it was written on', () => {
    for (const address of [
      'http://localhost:5186/@fs/home/someone/draft.js?token=abc',
      'http://127.0.0.1:5173/x',
      'http://127.1/private?token=secret',
      'http://a.b.local/private?token=secret',
      'http://[::1]:8787/intake',
      'http://192.168.1.10/private',
      'http://10.0.0.4/private',
      'http://172.20.3.4/private',
      'file:///home/someone/draft.ids.json',
      'file:/tmp/draft.ids.json',
    ]) expect(redact(`could not read ${address} twice`)).toBe('could not read (local) twice')
  })
  it('loses a path of its own, whatever the system calls home', () => {
    expect(redact('read /home/someone/draft.ids.json')).toBe('read (local)')
    expect(redact('read /Users/someone/draft.ids.json')).toBe('read (local)')
    expect(redact('read /tmp/draft.ids.json')).toBe('read (local)')
    expect(redact(String.raw`read C:\Users\someone\draft.ids.json`)).toBe('read (local)')
  })
  it('keeps a remote address, without what its query may say about the reader', () => {
    expect(redact('GET https://ids.mkpo.li/⿰木口?token=secret failed'))
      .toBe('GET https://ids.mkpo.li/⿰木口 failed')
    expect(redact('GET https://glyphatlas.org/atlas/composer/ failed'))
      .toBe('GET https://glyphatlas.org/atlas/composer/ failed')
  })
})
