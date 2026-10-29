// @ts-check
// The zi.tools descriptions that name a character but carry a stroke chain this package cannot
// draw, such as `⿱丿⿹#(-𠃌㇉)一` for 乌. Pasting one resolves to the character it describes.

/**
 * A table of descriptions and the characters they name, one per line, `description<TAB>character`.
 * Lines starting with `# ` are comments: a chain itself starts with `#(`.
 * @param {string} text @returns {Map<string, string>}
 */
export function readChainEntries(text) {
  /** @type {Map<string, string>} */
  const entries = new Map()
  for (const line of (text ?? '').split('\n')) {
    if (!line || line.startsWith('# ')) continue
    const [description, char] = line.split('\t')
    if (!description || !char) continue
    entries.set(description.trim(), char.trim())
  }
  return entries
}

/**
 * The character a zi.tools description with a stroke chain names, or null. A description written
 * without its trailing glyph-variant note also resolves, as the table keeps it.
 * @param {Map<string, string>} entries @param {string | null | undefined} text
 * @returns {string | null}
 */
export function chainCharacter(entries, text) {
  const written = (text ?? '').trim()
  if (!written.includes('#(')) return null
  const exact = entries.get(written)
  if (exact !== undefined) return exact
  // Without its trailing note; a pure chain like `#(S)` holds no note to drop.
  const plain = written.replace(/\([0-9A-Za-z.,]+\)\s*$/u, '').trim()
  return plain.includes('#(') ? entries.get(plain) ?? null : null
}
