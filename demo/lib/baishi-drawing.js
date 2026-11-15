// What draws one zi.tools description on the appendix: a chain as its own line, a description the
// workshop reads as its preview without the variant identifiers, or nothing. The preview applies no
// bracket after an operator, and subtraction and replacement are search syntax, so none of those is
// drawn.
import { parse, withoutVariants, write } from '../../src/core/index.js'
import { chainPath } from '../../src/core/chain-shape.js'

/** @param {string} body @returns {{ kind: 'chain', d: string } | { kind: 'composed', sequence: string } | null} */
export function drawingOf(body) {
  const bare = body.replace(/^\{[^}]*\}/u, '')
  if (/^#\(.*\)$/u.test(bare)) { const d = chainPath(bare); return d ? { kind: 'chain', d } : null }
  if (/[㇯🔄[]/u.test(body)) return null
  const read = parse(body)
  return !read.problem && read.tree !== null ? { kind: 'composed', sequence: write(withoutVariants(read.tree)) } : null
}
