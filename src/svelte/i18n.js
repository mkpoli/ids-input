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

/** Each first-stroke class as the message key that names it (㇐ Horizontal, ㇑ Vertical). */
export const STROKE_CLASS_KEY = { 横: 'h', 豎: 's', 撇: 'p', 點: 'd', 折: 'z' }

/**
 * What a character's first stroke is, as a message names it: the stroke itself and its class, so a
 * reader sees ㇐ beside the word. Empty where no class is known.
 * @param {Translate} t
 * @param {'横' | '豎' | '撇' | '點' | '折' | null | undefined} cls
 */
export function strokeClassName(t, cls) {
  if (!cls) return ''
  const key = `parts.first.${STROKE_CLASS_KEY[cls]}`
  const text = t(key)
  return text === key ? '' : text
}

/**
 * A character's stroke count and first stroke as one line for a tooltip, such as `4 strokes ·
 * ㇐ Horizontal`. Empty where neither is recorded.
 * @param {Translate} t
 * @param {{ strokes?: number | null, first?: '横' | '豎' | '撇' | '點' | '折' | null } | null | undefined} record
 */
export function strokeSummary(t, record) {
  if (!record) return ''
  return [record.strokes == null ? '' : t('parts.strokeCount', { count: record.strokes }), strokeClassName(t, record.first)]
    .filter(Boolean).join(' · ')
}
