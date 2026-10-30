import { describe, expect, it } from 'bun:test'
import { REPORT_ENDPOINT, reportEndpoint } from '../demo/lib/report-endpoint.js'

describe('the report endpoint', () => {
  it('follows ?endpoint= on a local run', () => {
    expect(reportEndpoint(new URL('http://localhost:5186/?endpoint=http://localhost:8787/'))).toBe('http://localhost:8787/')
    expect(reportEndpoint(new URL('http://127.0.0.1:5173/?endpoint=/intake'))).toBe('http://127.0.0.1:5173/intake')
  })
  it('ignores it on the published site, so a shared link cannot collect reports', () => {
    expect(reportEndpoint(new URL('https://ids.mkpo.li/?report=1&endpoint=https://collector.example/'))).toBe(REPORT_ENDPOINT)
    expect(reportEndpoint(new URL('https://preview.pages.dev/?endpoint=https://collector.example/'))).toBe(REPORT_ENDPOINT)
  })
  it('falls back to the deployed Worker', () => {
    expect(reportEndpoint(new URL('https://ids.mkpo.li/%E2%BF%B0%E6%9C%A8%E5%8F%A3'))).toBe(REPORT_ENDPOINT)
    expect(reportEndpoint(new URL('http://localhost:5186/?endpoint='))).toBe(REPORT_ENDPOINT)
  })
})
