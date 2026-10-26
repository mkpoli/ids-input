// @ts-check
// Duplicate-key detection for document JSON. JSON.parse keeps the last of two equal keys; the
// document format rejects the ambiguity. The text must already be valid JSON.

/**
 * Every object key that occurs more than once at the same level, at any depth.
 * @param {string} text
 * @returns {string[]}
 */
export function duplicateKeys(text) {
  let at = 0
  /** @type {string[]} */
  const found = []
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
  const value = () => {
    space()
    const char = text[at]
    if (char === '{') return object()
    if (char === '[') return array()
    if (char === '"') { string(); return }
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
      if (seen.has(key)) found.push(key)
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
  return found
}
