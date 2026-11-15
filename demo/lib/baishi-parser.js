// A parser for the zi.tools IDS Extension made from its grammar file: the rules of
// data/baishi-ids.ebnf, as demo/lib/railroad.js reads them, are matched against the text directly,
// so the parser and the published grammar are one thing. Every way a rule can match from a place is
// worked out once (memoized), which reads the grammar exactly as written, ambiguity and all; a
// parse tree is then built along one derivation. Where nothing matches, the error names the
// furthest place reached and what the grammar expected there.
import { readGrammar } from './railroad.js'

/** @typedef {import('./railroad.js').Expr} Expr */
/**
 * A node of a parse: the rule it is (null for a terminal or special sequence), where it starts and
 * ends in code points, and the nodes it is made of.
 * @typedef {{ rule: string | null, start: number, end: number, children: ParseNode[] }} ParseNode
 */

// The special sequences of the grammar. Ideographic and Radical are the code points with those
// properties in Unicode 18.0.0 PropList.txt (2026-08-07), written out so the parser does not
// depend on the Unicode version of the JavaScript engine that runs it.
const IDEOGRAPHIC = [
  [0x3006, 0x3007], [0x3021, 0x3029], [0x3038, 0x303a], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xf900, 0xfa6d], [0xfa70, 0xfad9],
  [0x16fe4, 0x16fe4], [0x16ff2, 0x16ff6], [0x17000, 0x18cda], [0x18cff, 0x18d20], [0x18d80, 0x18df2], [0x18e00, 0x19191], [0x191a0, 0x191d2],
  [0x1b170, 0x1b2fb], [0x20000, 0x2a6df], [0x2a700, 0x2b81e], [0x2b820, 0x2cead], [0x2ceb0, 0x2ebe0], [0x2ebf0, 0x2ee5d], [0x2f800, 0x2fa1d],
  [0x30000, 0x3134a], [0x31350, 0x33479], [0x3d000, 0x3fc3f],
]
const RADICAL = [[0x2e80, 0x2e99], [0x2e9b, 0x2ef3], [0x2f00, 0x2fd5]]
/** @param {number[][]} ranges @param {number} code */
const within = (ranges, code) => ranges.some(([low, high]) => code >= low && code <= high)
/** The special sequences, each a test of one code point. */
const SPECIAL = /** @type {Record<string, (code: number) => boolean>} */ ({
  Ideographic: code => within(IDEOGRAPHIC, code),
  Radical: code => within(RADICAL, code),
  'CJK stroke': code => code >= 0x31c0 && code <= 0x31e5,
  TAB: code => code === 9,
})

/**
 * A parser for a grammar's rules.
 * @param {string} ebnf the grammar, in ISO/IEC 14977 EBNF
 */
export function createParser(ebnf) {
  const rules = readGrammar(ebnf)
  const order = new Map([...rules.keys()].map((name, i) => [name, i]))
  for (const rule of rules.values()) checkSpecials(rule.expr)
  /** A number for each expression, to memoize by. @type {Map<Expr, number>} */
  const ids = new Map()
  /** @param {Expr} expr */
  const number = expr => { ids.set(expr, ids.size); if ('items' in expr) expr.items.forEach(number); else if ('item' in expr) number(expr.item) }
  for (const rule of rules.values()) number(rule.expr)

  /**
   * Parse `text` as `rule`, the whole of it. What was expected where the parse failed is only
   * worked out on a second pass, for a text that fails.
   * @param {string} rule @param {string} text @param {boolean} [track]
   * @returns {{ ok: true, tree: ParseNode, chars: string[] } | { ok: false, at: number, expected: string[], chars: string[] }}
   */
  function parse(rule, text, track = false) {
    const chars = [...text]
    const width = chars.length + 1
    /** Ends each rule can reach from each place, by rule and place. @type {(Set<number> | null)[]} */
    const memo = blank(order.size * width)
    /** Ends each other expression reaches from each place. @type {(Set<number> | null)[]} */
    const reached = blank(ids.size * width)
    let furthest = 0
    /** The terminals and special sequences that failed at `furthest`. @type {Set<Expr>} */
    let expected = new Set()
    /** @param {number} at @param {Expr} what */
    const miss = (at, what) => {
      if (!track) return
      if (at > furthest) { furthest = at; expected = new Set() }
      if (at === furthest) expected.add(what)
    }

    /** Every end `expr` reaches from `at`. @param {Expr} expr @param {number} at @returns {Set<number>} */
    function ends(expr, at) {
      if (expr.t === 'nt') return ruleEnds(expr.text, at)
      return reached[/** @type {number} */ (ids.get(expr)) * width + at] ??= endsOf(expr, at)
    }
    /** @param {Expr} expr @param {number} at @returns {Set<number>} */
    function endsOf(expr, at) {
      switch (expr.t) {
        case 'term': {
          const want = codePoints(expr.text)
          for (let i = 0; i < want.length; i++) if (chars[at + i] !== want[i]) { miss(at + i, expr); return new Set() }
          return new Set([at + want.length])
        }
        case 'special': {
          const char = chars[at]
          if (char !== undefined && SPECIAL[expr.text](/** @type {number} */ (char.codePointAt(0)))) return new Set([at + 1])
          miss(at, expr)
          return new Set()
        }
        case 'nt': return ruleEnds(expr.text, at)
        case 'alt': { const out = new Set(); for (const item of expr.items) for (const end of ends(item, at)) out.add(end); return out }
        case 'seq': {
          let current = new Set([at])
          for (const item of expr.items) {
            const next = new Set()
            for (const from of current) for (const end of ends(item, from)) next.add(end)
            current = next
            if (!current.size) break
          }
          return current
        }
        case 'opt': return new Set([at, ...ends(expr.item, at)])
        case 'rep': {
          const out = new Set([at])
          /** @type {number[]} */
          const queue = [at]
          while (queue.length) {
            const from = /** @type {number} */ (queue.shift())
            for (const end of ends(expr.item, from)) if (end > from && !out.has(end)) { out.add(end); queue.push(end) }
          }
          return out
        }
      }
    }
    /** @param {string} name @param {number} at */
    function ruleEnds(name, at) {
      const key = /** @type {number} */ (order.get(name)) * width + at
      const known = memo[key]
      if (known) return known
      memo[key] = new Set()
      return memo[key] = ends(/** @type {{ expr: Expr }} */ (rules.get(name)).expr, at)
    }

    /**
     * One derivation of `expr` from `at` to `end`, as nodes.
     * @param {Expr} expr @param {number} at @param {number} end @returns {ParseNode[] | null}
     */
    function build(expr, at, end) {
      switch (expr.t) {
        case 'term': case 'special': return ends(expr, at).has(end) ? [{ rule: null, start: at, end, children: [] }] : null
        case 'nt': {
          if (!ruleEnds(expr.text, at).has(end)) return null
          const children = build(/** @type {{ expr: Expr }} */ (rules.get(expr.text)).expr, at, end)
          return children ? [{ rule: expr.text, start: at, end, children }] : null
        }
        case 'alt': { for (const item of expr.items) if (ends(item, at).has(end)) { const got = build(item, at, end); if (got) return got } return null }
        case 'opt': return at === end ? [] : build(expr.item, at, end)
        case 'seq': return sequence(expr.items, at, end)
        case 'rep': {
          if (at === end) return []
          for (const middle of ends(expr.item, at)) {
            if (middle <= at || middle > end) continue
            if (!ends(expr, middle).has(end)) continue
            const head = build(expr.item, at, middle), tail = build(expr, middle, end)
            if (head && tail) return [...head, ...tail]
          }
          return null
        }
      }
    }
    /** @param {Expr[]} items @param {number} at @param {number} end @returns {ParseNode[] | null} */
    function sequence(items, at, end) {
      if (!items.length) return at === end ? [] : null
      const [first, ...rest] = items
      for (const middle of ends(first, at)) {
        if (middle > end) continue
        if (rest.length && !reaches(rest, middle, end)) continue
        if (!rest.length && middle !== end) continue
        const head = build(first, at, middle), tail = sequence(rest, middle, end)
        if (head && tail) return [...head, ...tail]
      }
      return null
    }
    /** @param {Expr[]} items @param {number} at @param {number} end */
    function reaches(items, at, end) {
      let current = new Set([at])
      for (const item of items) { const next = new Set(); for (const from of current) for (const one of ends(item, from)) next.add(one); current = next }
      return current.has(end)
    }

    if (!rules.has(rule)) throw new Error(`no rule ${rule}`)
    if (ruleEnds(rule, 0).has(chars.length)) {
      const tree = build({ t: 'nt', text: rule }, 0, chars.length)
      if (tree) return { ok: true, tree: tree[0], chars }
    }
    if (!track) return parse(rule, text, true)
    // A text that matches only in part fails where its longest match ends, unless the parse went further.
    const longest = Math.max(0, ...ruleEnds(rule, 0))
    if (longest > furthest || !expected.size) return { ok: false, at: longest, expected: ['end'], chars }
    // Where the longest match ends, the text could also have ended.
    return { ok: false, at: furthest, expected: [...describe(expected), ...(longest === furthest ? ['end'] : [])], chars }
  }

  /** What `rule` can begin with: the terminals and special sequences. @type {Map<string, Set<Expr>>} */
  const firsts = new Map()
  /** Whether a rule can match nothing. @type {Map<string, boolean>} */
  const empty = new Map([...rules.keys()].map(name => [name, false]))
  /** @param {Expr} expr @returns {boolean} */
  const nullable = expr => expr.t === 'opt' || expr.t === 'rep' || (expr.t === 'nt' && /** @type {boolean} */ (empty.get(expr.text)))
    || (expr.t === 'alt' && expr.items.some(nullable)) || (expr.t === 'seq' && expr.items.every(nullable))
  /** @param {Expr} expr @param {Set<Expr>} out */
  const first = (expr, out) => {
    if (expr.t === 'term' || expr.t === 'special') out.add(expr)
    else if (expr.t === 'nt') for (const one of firsts.get(expr.text) ?? []) out.add(one)
    else if (expr.t === 'alt') for (const item of expr.items) first(item, out)
    else if (expr.t === 'seq') { for (const item of expr.items) { first(item, out); if (!nullable(item)) break } }
    else first(expr.item, out)
  }
  for (let changed = true; changed;) {
    changed = false
    for (const [name, rule] of rules) {
      const was = firsts.get(name)?.size ?? -1, out = new Set(was < 0 ? [] : firsts.get(name))
      first(rule.expr, out)
      firsts.set(name, out)
      const blank = nullable(rule.expr)
      if (out.size !== was || blank !== empty.get(name)) { empty.set(name, blank); changed = true }
    }
  }
  /** Terminals and special sequences alike, by what they print. @param {Expr} expr */
  const label = expr => expr.t === 'special' ? `? ${expr.text} ?` : JSON.stringify(/** @type {{ text: string }} */ (expr).text)
  /**
   * What was expected, as few names as can say it: a rule stands for the terminals it begins with
   * when all of them were expected; the terminals left over are given as they are.
   * @param {Set<Expr>} expected
   */
  function describe(expected) {
    const wanted = new Set([...expected].map(label))
    // Rules that only rename another rule say nothing new.
    const candidates = [...firsts].filter(([name, set]) => rules.get(name)?.expr.t !== 'nt' && set.size > 1 && [...set].every(one => wanted.has(label(one))))
      // The larger set first; of equal sets, the rule defined later, which is the narrower one.
      .sort((a, b) => b[1].size - a[1].size || /** @type {number} */ (order.get(b[0])) - /** @type {number} */ (order.get(a[0])))
    /** @type {string[]} */
    const out = []
    const covered = new Set()
    for (const [name, set] of candidates) {
      const labels = [...set].map(label)
      if (labels.every(one => covered.has(one))) continue
      out.push(name)
      labels.forEach(one => covered.add(one))
    }
    for (const one of wanted) if (!covered.has(one)) out.push(one)
    return out
  }

  /** Whether `text` is a whole `rule`, without building a tree. @param {string} rule @param {string} text */
  const accepts = (rule, text) => parse(rule, text).ok

  return { rules, parse, accepts }
}

/** `size` empty slots, made at once so the memo is one flat array. @param {number} size @returns {any[]} */
function blank(size) {
  /** @type {any[]} */
  const out = []
  out.length = size
  return out.fill(null)
}

/** The code points of each terminal. @type {Map<string, string[]>} */
const POINTS = new Map()
/** @param {string} text */
function codePoints(text) {
  let points = POINTS.get(text)
  if (!points) POINTS.set(text, points = [...text])
  return points
}

/** @param {Expr} expr */
function checkSpecials(expr) {
  if ('items' in expr) expr.items.forEach(checkSpecials)
  else if ('item' in expr) checkSpecials(expr.item)
  else if (expr.t === 'special' && !SPECIAL[expr.text]) throw new Error(`no test for the special sequence ? ${expr.text} ?`)
}

/** The text a node covers. @param {ParseNode} node @param {string[]} chars */
export const textOf = (node, chars) => chars.slice(node.start, node.end).join('')

/** The nodes of a tree for the rules named, outermost first, in reading order. @param {ParseNode} node @param {Set<string>} names @returns {ParseNode[]} */
export function nodesOf(node, names) {
  /** @type {ParseNode[]} */
  const out = []
  /** @param {ParseNode} one */
  const walk = one => { if (one.rule && names.has(one.rule)) out.push(one); one.children.forEach(walk) }
  walk(node)
  return out
}
