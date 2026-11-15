// The way to reach a reporter, kept for the next report. A report is often followed by another, and
// the address rarely changes; clearing the field forgets it.
import { LIMITS } from './report.js'
import { load, save } from './storage.js'

const KEY = 'reportContact'

/** The viewer's contact from an earlier report. @returns {string} */
export function storedContact() {
  const kept = load(KEY, '')
  return typeof kept === 'string' ? kept.trim().slice(0, LIMITS.contact) : ''
}

/** Keep the address for the next report; an empty one forgets the earlier. @param {string} value */
export function keepContact(value) {
  save(KEY, value.trim().slice(0, LIMITS.contact) || undefined)
}
