// @ts-check
// JSON inspection for document files: duplicate object keys and numbers outside finite binary64.
// JSON.parse keeps the last of two equal keys and turns overflowing numbers into Infinity; the
// document format rejects both. The text must already be valid JSON.

/**
 * Every object key that occurs more than once at the same level, at any depth.
 * @param {string} text
 * @returns {string[]}
 */
export function duplicateKeys(text) {
  return inspectJson(text).duplicateKeys
}

/**
 * The structural problems JSON.parse hides: duplicate object keys, and numbers that overflow or
 * underflow binary64.
 * @param {string} text
 * @returns {{ duplicateKeys: string[], numbers: string[] }}
 */
export function inspectJson(text) {
  let at = 0
  /** @type {string[]} */
  const duplicateKeys = []
  /** @type {string[]} */
  const numbers = []
  const space = () => { while (at < text.length && /\s/.test(text[at])) at++ }
  /** @returns {string} */
  const string = () => {
    const start = at
    at++
    while (at < text.length) {
      const char = text[at++]
      if (char === '\\') at++
      else if (char === '"') return JSON.parse(text.slice(start, at))
    }
    throw new Error('unterminated string')
  }
  const number = () => {
    const start = at
    while (at < text.length && /[0-9eE+.-]/.test(text[at])) at++
    const raw = text.slice(start, at)
    const value = Number(raw)
    const significand = raw.split(/[eE]/)[0]
    if (!Number.isFinite(value) || (value === 0 && /[1-9]/.test(significand))) numbers.push(raw)
  }
  const value = () => {
    space()
    const char = text[at]
    if (char === '{') return object()
    if (char === '[') return array()
    if (char === '"') { string(); return }
    if (char === '-' || (char >= '0' && char <= '9')) { number(); return }
    while (at < text.length && !/[\s,\]}]/.test(text[at])) at++
  }
  const object = () => {
    at++
    space()
    if (text[at] === '}') { at++; return }
    const seen = new Set()
    for (;;) {
      space()
      const key = string()
      if (seen.has(key)) duplicateKeys.push(key)
      seen.add(key)
      space()
      if (text[at] !== ':') throw new Error('expected a colon')
      at++
      value()
      space()
      const char = text[at++]
      if (char === '}') return
      if (char !== ',') throw new Error('expected a comma or closing brace')
    }
  }
  const array = () => {
    at++
    space()
    if (text[at] === ']') { at++; return }
    for (;;) {
      value()
      space()
      const char = text[at++]
      if (char === ']') return
      if (char !== ',') throw new Error('expected a comma or closing bracket')
    }
  }
  space()
  value()
  space()
  if (at !== text.length) throw new Error('trailing text')
  return { duplicateKeys, numbers }
}
