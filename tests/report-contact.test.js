import { describe, expect, it } from 'bun:test'
import { LIMITS } from '../demo/lib/report.js'
import { keepContact, storedContact } from '../demo/lib/report-contact.js'
import { withStorage } from './fixtures/storage.js'

describe('the contact a report remembers', () => {
  it('starts empty', () => withStorage({}, () => {
    expect(storedContact()).toBe('')
  }))

  it('keeps the address for the next report', () => withStorage({}, () => {
    keepContact('@someone')
    expect(storedContact()).toBe('@someone')
  }))

  it('trims the space around the address', () => withStorage({}, () => {
    keepContact('  someone@example.com  ')
    expect(storedContact()).toBe('someone@example.com')
  }))

  it('forgets the address when the field is cleared', () => withStorage({ 'ids-input:reportContact': JSON.stringify('@someone') }, () => {
    keepContact('   ')
    expect(storedContact()).toBe('')
  }))

  it('cuts an address to the size the field has', () => withStorage({}, () => {
    keepContact('x'.repeat(LIMITS.contact + 40))
    expect(storedContact()).toBe('x'.repeat(LIMITS.contact))
  }))

  it('ignores a record that is not an address', () => withStorage({ 'ids-input:reportContact': JSON.stringify({ address: '@someone' }) }, () => {
    expect(storedContact()).toBe('')
  }))
})
