// @ts-check
// Messages for the components: a catalogue of `key → text`, falling back to English.
import en from '../../messages/en.json' with { type: 'json' }

/** @typedef {Record<string, string>} Messages */
/** @typedef {(key: string, params?: Record<string, string | number>) => string} Translate */

export { en }

/**
 * A function writing the message `key` with `params`: `{name}` is replaced by `params.name`, and a
 * key with `.one` and `.other` forms is a plural chosen by `params.count`, written in the locale's
 * own number format. A key the catalogue lacks comes from English, else stays the key.
 * @param {Messages} [messages]
 * @param {string} [locale]
 * @returns {Translate}
 */
export function translator(messages = en, locale = 'en') {
  /** @type {Intl.PluralRules | null} */
  let plurals = null, numbers = /** @type {Intl.NumberFormat | null} */ (null)
  try { plurals = new Intl.PluralRules(locale); numbers = new Intl.NumberFormat(locale) } catch { /* An unknown locale writes English numbers. */ }
  /** @param {string} key */
  const look = key => messages[key] ?? /** @type {Messages} */ (en)[key]
  return (key, params = {}) => {
    let text = look(key)
    if (text === undefined && 'count' in params) {
      const form = plurals?.select(Number(params.count)) ?? 'other'
      text = look(`${key}.${form}`) ?? look(`${key}.other`)
    }
    if (text === undefined) return key
    return text.replace(/\{(\w+)\}/g, (whole, name) => name in params
      ? (typeof params[name] === 'number' && numbers ? numbers.format(/** @type {number} */ (params[name])) : String(params[name]))
      : whole)
  }
}
