// A grammar in ISO/IEC 14977 EBNF read into rules, and each rule drawn as a railroad diagram: the
// appendix draws the zi.tools IDS Extension from data/baishi-ids.ebnf itself, so the diagrams are
// the file's rules and cannot drift from them. The reader is strict: comments, terminal strings and
// special sequences have to close as ISO/IEC 14977 says, even inside comments, and anything the
// grammar does not use (repetition counts, exceptions) is an error. It reads sequences (","),
// choices ("|"), [options], {repetitions}, (groups), terminals, ? special sequences ? and rule
// names. The drawing follows Tab Atkins Jr.'s railroad-diagrams layout: a choice stacks its
// branches below the first, an option is a choice with an empty first branch, and a repetition
// loops back under its item.

/** @typedef {{ t: 'seq' | 'alt', items: Expr[] } | { t: 'opt' | 'rep', item: Expr } | { t: 'term' | 'special' | 'nt', text: string }} Expr */

/**
 * The text with its comments blanked out, read as ISO/IEC 14977 reads it: a comment may nest, and
 * a terminal string or a special sequence, in a comment or out of one, runs to its closing quote
 * or question mark. Offsets stay where they were. Throws where the text does not close.
 * @param {string} text
 */
export function withoutComments(text) {
  let out = '', at = 0
  /** @param {string} what @returns {never} */
  const fail = what => { throw new SyntaxError(`${what} at offset ${at}`) }
  /** Past a string or special sequence that opens at `at`. */
  const skip = () => {
    const close = text[at] === '?' ? '?' : text[at]
    const end = text.indexOf(close, at + 1)
    if (end < 0) fail(close === '?' ? 'unclosed special sequence' : 'unclosed terminal string')
    return end + 1
  }
  while (at < text.length) {
    if (text.startsWith('(*', at)) {
      const start = at
      let depth = 1
      at += 2
      while (depth) {
        if (at >= text.length) { at = start; fail('unclosed comment') }
        if (text.startsWith('(*', at)) { depth++; at += 2 }
        else if (text.startsWith('*)', at)) { depth--; at += 2 }
        else if (`"'?`.includes(text[at])) at = skip()
        else at++
      }
      out += text.slice(start, at).replace(/[^\n]/g, ' ')
    } else if (`"'?`.includes(text[at])) {
      const end = skip()
      out += text.slice(at, end)
      at = end
    } else out += text[at++]
  }
  return out
}

/** The tokens of a grammar: strings, special sequences, rule names, symbols and white space. */
const TOKEN = /\s+|"[^"]*"|'[^']*'|\?[^?]*\?|[A-Za-z](?:[A-Za-z0-9 ]*[A-Za-z0-9])?|[=;|,[\]{}()]/y

/**
 * Every rule of a grammar, in order: its name, its text as written and its expression. Throws on
 * anything outside the part of ISO/IEC 14977 described above.
 * @param {string} ebnf @returns {Map<string, { text: string, expr: Expr }>}
 */
export function readGrammar(ebnf) {
  const text = withoutComments(ebnf)
  /** @type {{ value: string, at: number }[]} */
  const tokens = []
  TOKEN.lastIndex = 0
  while (TOKEN.lastIndex < text.length) {
    const at = TOKEN.lastIndex
    const match = TOKEN.exec(text)
    if (!match) throw new SyntaxError(`unexpected ${JSON.stringify(text[at])} at offset ${at}`)
    if (!/^\s/.test(match[0])) tokens.push({ value: match[0], at })
  }
  /** @type {Map<string, { text: string, expr: Expr }>} */
  const rules = new Map()
  let at = 0
  /** @param {string} rule @returns {never} */
  const fail = rule => { throw new SyntaxError(`${rule}: unexpected ${tokens[at]?.value ?? 'end'}${tokens[at] ? ` at offset ${tokens[at].at}` : ''}`) }
  while (at < tokens.length) {
    const name = tokens[at]
    if (!/^[A-Za-z]/.test(name.value) || tokens[at + 1]?.value !== '=') fail('grammar')
    at += 2
    const rule = name.value
    /** @returns {Expr} */
    const choice = () => {
      const items = [sequence()]
      while (tokens[at]?.value === '|') { at++; items.push(sequence()) }
      return items.length === 1 ? items[0] : { t: 'alt', items }
    }
    /** @returns {Expr} */
    const sequence = () => {
      const items = [term()]
      while (tokens[at]?.value === ',') { at++; items.push(term()) }
      return items.length === 1 ? items[0] : { t: 'seq', items }
    }
    /** @returns {Expr} */
    const term = () => {
      const token = tokens[at]?.value
      if (token === undefined) return fail(rule)
      at++
      /** @param {string} close @param {(item: Expr) => Expr} make */
      const group = (close, make) => { const item = choice(); if (tokens[at]?.value !== close) fail(rule); at++; return make(item) }
      if (token === '[') return group(']', item => ({ t: 'opt', item }))
      if (token === '{') return group('}', item => ({ t: 'rep', item }))
      if (token === '(') return group(')', item => item)
      if (token[0] === '"' || token[0] === "'") return { t: 'term', text: token.slice(1, -1) }
      if (token[0] === '?') return { t: 'special', text: token.slice(1, -1).trim() }
      if (/^[A-Za-z]/.test(token)) return { t: 'nt', text: token }
      at--
      return fail(rule)
    }
    const expr = choice()
    if (tokens[at]?.value !== ';') fail(rule)
    if (rules.has(rule)) throw new SyntaxError(`${rule}: defined twice`)
    rules.set(rule, { text: text.slice(name.at, tokens[at].at + 1), expr })
    at++
  }
  return rules
}

/** The rules a rule names, in the order it first names them. @param {Expr} expr @returns {string[]} */
export function references(expr) {
  /** @type {string[]} */
  const out = []
  /** @param {Expr} node */
  const walk = node => {
    if ('items' in node) node.items.forEach(walk)
    else if ('item' in node) walk(node.item)
    else if (node.t === 'nt' && !out.includes(node.text)) out.push(node.text)
  }
  walk(expr)
  return out
}

// ---------------------------------------------------------------- drawing

const ARC = 10, GAP = 10, BOX = 11, FRAME = 10, LABEL = 18, PAD = 10, LEAD = 20
/** @param {string} text */
const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** A width for text in the diagram's monospace face: wide characters take a full em. @param {string} text */
const textWidth = text => [...text].reduce((sum, char) => sum + (/[ᄀ-￿\u{20000}-\u{3FFFF}]/u.test(char) ? 13 : 7.6), 0)
/** @param {number} n */
const r = n => Math.round(n * 10) / 10

/**
 * A rule spliced into the diagram, drawn in its own coordinates: (0, 0) is where the track enters
 * it. `svg` is its own markup; each rule spliced into it is a child placed at (x, y) of its own
 * track, so a change deep down redraws only the rules that hold it.
 * @typedef {{ path: string, name: string, w: number, up: number, down: number, svg: string, children: { x: number, y: number, node: RailNode }[] }} RailNode
 */
/** @typedef {{ w: number, up: number, down: number, draw: (x: number, y: number, place: (node: RailNode, x: number, y: number) => void) => string }} Box */
/**
 * What a drawing opens. `open` holds the paths of the rules spliced in; a path is the parent's path,
 * "/" and the rule's ordinal among the mentions of rules in its parent (the top rule is ""). A rule
 * open further up its own path is drawn as a link to it. Without `open` every rule stays a box.
 * @typedef {{ rules: Map<string, { text: string, expr: Expr }>, open?: Set<string>, sorted: string[], path: string, ancestors: { name: string, path: string }[], next: { n: number }, cache: Map<string, RailNode> }} Context
 */

/** @param {Expr} expr @param {Context} ctx @returns {Box} */
function layout(expr, ctx) {
  switch (expr.t) {
    case 'term': case 'special': return token(expr.t === 'special' ? `? ${expr.text} ?` : expr.text, expr.t === 'term' ? 'terminal' : 'special', '', true)
    case 'nt': return rule(expr.text, ctx)
    case 'seq': return sequence(expr.items.map(item => layout(item, ctx)))
    case 'alt': return choice(expr.items.map(item => layout(item, ctx)))
    case 'opt': return choice([SKIP, layout(expr.item, ctx)])
    case 'rep': return choice([SKIP, oneOrMore(layout(expr.item, ctx))])
  }
}

const SKIP = /** @type {Box} */ ({ w: 0, up: 0, down: 0, draw: () => '' })

/** A box on the line. @param {string} label @param {string} kind @param {string} attributes @param {boolean} round @returns {Box} */
function token(label, kind, attributes, round) {
  const w = textWidth(label) + 20
  return { w, up: BOX, down: BOX, draw: (x, y) => `<g class="${kind}"${attributes}><rect x="${r(x)}" y="${r(y - BOX)}" width="${r(w)}" height="${BOX * 2}"${round ? ' rx="10"' : ''}/><text x="${r(x + w / 2)}" y="${r(y + 4)}">${escape(label)}</text></g>` }
}

/** A rule named on the line: a box, a link to the same rule open further up, or the rule itself
 * spliced in as a node of its own. @param {string} name @param {Context} ctx @returns {Box} */
function rule(name, ctx) {
  const path = `${ctx.path}/${ctx.next.n++}`
  const above = ctx.ancestors.find(one => one.name === name)
  const data = ` data-rule="${escape(name)}" data-path="${path}"`
  if (!ctx.open) return token(name, 'non-terminal', ` data-rule="${escape(name)}"`, false)
  if (above) return token(`↑ ${name}`, 'non-terminal recursive', `${data} data-link="${above.path}" tabindex="-1" role="link" aria-label="${escape(name)}"`, false)
  if (!ctx.open.has(path) || !ctx.rules.has(name)) return token(`+ ${name}`, 'non-terminal', `${data} tabindex="-1" role="button" aria-expanded="false" aria-label="${escape(name)}"`, false)
  const node = spliced(name, path, ctx)
  return { w: node.w, up: node.up, down: node.down, draw: (x, y, place) => { place(node, x, y); return '' } }
}

/** The open paths under a path, as a key: a node is the same while they are. Paths under one path
 * sit together in sorted order, so a binary search finds the first. @param {string[]} sorted @param {string} path */
function openUnder(sorted, path) {
  const prefix = `${path}/`
  let low = 0, high = sorted.length
  while (low < high) { const mid = (low + high) >> 1; if (sorted[mid] < prefix) low = mid + 1; else high = mid }
  let end = low
  while (end < sorted.length && sorted[end].startsWith(prefix)) end++
  return sorted.slice(low, end).join(' ')
}

/** A rule spliced in: its frame, its label, and its own diagram inside. @param {string} name @param {string} path @param {Context} ctx @returns {RailNode} */
function spliced(name, path, ctx) {
  const key = `${path} ${openUnder(ctx.sorted, path)}`
  const cached = ctx.cache.get(key)
  if (cached) return cached
  const inner = layout(/** @type {{ expr: Expr }} */ (ctx.rules.get(name)).expr, { ...ctx, path, ancestors: [...ctx.ancestors, { name, path }], next: { n: 0 } })
  const label = `− ${name}`
  const w = Math.max(inner.w + FRAME * 2, textWidth(label) + 16)
  const up = inner.up + FRAME + LABEL, down = inner.down + FRAME
  /** @type {RailNode['children']} */
  const children = []
  const data = ` data-rule="${escape(name)}" data-path="${path}"`
  const body = inner.draw(FRAME, 0, (node, x, y) => children.push({ x, y, node }))
  const svg = `<rect class="frame" x="0" y="${r(-up)}" width="${r(w)}" height="${r(up + down)}" rx="6"/>`
    + `<g class="frame-label"${data} data-up="${r(up)}" tabindex="-1" role="button" aria-expanded="true" aria-label="${escape(name)}"><rect x="0" y="${r(-up)}" width="${r(textWidth(label) + 16)}" height="${LABEL}" rx="6"/><text x="8" y="${r(-up + 13)}">${escape(label)}</text></g>`
    + `<path d="M0 0h${FRAME}"/>${body}<path d="M${r(FRAME + inner.w)} 0H${r(w)}"/>`
  const node = { path, name, w, up, down, svg, children }
  ctx.cache.set(key, node)
  return node
}

/** @param {Box[]} items @returns {Box} */
function sequence(items) {
  const w = items.reduce((sum, item) => sum + item.w, 0) + GAP * (items.length - 1)
  return { w, up: Math.max(...items.map(item => item.up)), down: Math.max(...items.map(item => item.down)), draw: (x, y, place) => {
    let out = '', at = x
    items.forEach((item, i) => {
      if (i) { out += `<path d="M${r(at)} ${r(y)}h${GAP}"/>`; at += GAP }
      out += item.draw(at, y, place); at += item.w
    })
    return out
  } }
}

/** Branches stacked under the first; each leaves and rejoins the line with quarter arcs. @param {Box[]} items @returns {Box} */
function choice(items) {
  const w = Math.max(...items.map(item => item.w)) + ARC * 4
  /** Each branch's line, below the first. */
  const drops = [0]
  let bottom = items[0].down
  for (const item of items.slice(1)) {
    const drop = Math.max(bottom + GAP + item.up, ARC * 2)
    drops.push(drop)
    bottom = drop + item.down
  }
  return { w, up: items[0].up, down: bottom, draw: (x, y, place) => {
    let out = `<path d="M${r(x)} ${r(y)}h${ARC * 2}"/>${items[0].draw(x + ARC * 2, y, place)}<path d="M${r(x + ARC * 2 + items[0].w)} ${r(y)}H${r(x + w)}"/>`
    items.slice(1).forEach((item, i) => {
      const drop = drops[i + 1]
      out += `<path d="M${r(x)} ${r(y)}a${ARC} ${ARC} 0 0 1 ${ARC} ${ARC}v${r(drop - ARC * 2)}a${ARC} ${ARC} 0 0 0 ${ARC} ${ARC}"/>`
      out += item.draw(x + ARC * 2, y + drop, place)
      out += `<path d="M${r(x + ARC * 2 + item.w)} ${r(y + drop)}H${r(x + w - ARC * 2)}a${ARC} ${ARC} 0 0 0 ${ARC} ${-ARC}v${r(ARC * 2 - drop)}a${ARC} ${ARC} 0 0 1 ${ARC} ${-ARC}"/>`
    })
    return out
  } }
}

/** The item, and a line under it back from its end to its start. @param {Box} item @returns {Box} */
function oneOrMore(item) {
  const w = item.w + ARC * 2
  const loop = Math.max(item.down + GAP, ARC * 2)
  return { w, up: item.up, down: loop, draw: (x, y, place) => `<path d="M${r(x)} ${r(y)}h${ARC}"/>${item.draw(x + ARC, y, place)}<path d="M${r(x + ARC + item.w)} ${r(y)}h${ARC}"/>`
    + `<path d="M${r(x + ARC + item.w)} ${r(y)}a${ARC} ${ARC} 0 0 1 ${ARC} ${ARC}v${r(loop - ARC * 2)}a${ARC} ${ARC} 0 0 1 ${-ARC} ${ARC}H${r(x + ARC)}a${ARC} ${ARC} 0 0 1 ${-ARC} ${-ARC}v${r(ARC * 2 - loop)}a${ARC} ${ARC} 0 0 1 ${ARC} ${-ARC}"/>` }
}

/** Layouts kept between redraws of one grammar, so an unchanged rule is the same node. */
const CACHES = new WeakMap()

/**
 * A grammar drawn from its top rule, as nested nodes: the root's own markup, with the start and end
 * bars, and every rule spliced in as a child. With `open`, the paths in it are spliced in; without,
 * every rule stays a box. `width` and `height` are the diagram's; the root's track starts at (x, y).
 * @param {Map<string, { text: string, expr: Expr }>} rules @param {string} top @param {Set<string>} [open]
 * @returns {{ root: RailNode, width: number, height: number, x: number, y: number }}
 */
export function railTree(rules, top, open) {
  let cache = CACHES.get(rules)
  if (!cache) { cache = new Map(); CACHES.set(rules, cache) }
  const expr = /** @type {{ expr: Expr }} */ (rules.get(top)).expr
  const body = layout(expr, { rules, open, sorted: open ? [...open].sort() : [], path: '', ancestors: [{ name: top, path: '' }], next: { n: 0 }, cache })
  const width = Math.ceil(body.w + LEAD * 2 + PAD * 2), height = Math.ceil(body.up + body.down + PAD * 2)
  const y = PAD + body.up
  /** @type {RailNode['children']} */
  const children = []
  const x0 = PAD + LEAD
  const inner = body.draw(0, 0, (node, x, y) => children.push({ x, y, node }))
  const svg = `<path d="M${-LEAD} -8v16"/><path d="M${-LEAD} 0h${LEAD}"/>${inner}<path d="M${r(body.w)} 0h${LEAD}"/><path d="M${r(body.w + LEAD)} -8v16"/>`
  return { root: { path: '', name: top, w: body.w, up: body.up, down: body.down, svg, children }, width, height, y, x: x0 }
}

/** A node and everything spliced into it, as one string of markup. @param {RailNode} node @returns {string} */
const flatten = node => node.svg + node.children.map(child => `<g transform="translate(${r(child.x)} ${r(child.y)})">${flatten(child.node)}</g>`).join('')

/**
 * A railroad diagram as one SVG, from its start bar to its end bar: of the rule `top` with the
 * paths in `open` spliced in, or of one rule on its own.
 * @param {Map<string, { text: string, expr: Expr }>} rules @param {string} top @param {Set<string>} [open]
 * @returns {{ svg: string, width: number, height: number }}
 */
export function railroad(rules, top, open) {
  const { root, width, height, y, x } = railTree(rules, top, open)
  const svg = `<svg class="railroad-diagram" role="group" aria-label="${escape(top)}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`
    + `<g transform="translate(${x} ${r(y)})">${flatten(root)}</g></svg>`
  return { svg, width, height }
}

/**
 * Where a rule first sits in the fully open grammar: the shallowest path that names it, the top
 * rule's own being "". Null for a rule the top rule never reaches.
 * @param {Map<string, { text: string, expr: Expr }>} rules @param {string} top @param {string} name
 * @returns {string | null}
 */
export function placeOf(rules, top, name) {
  if (name === top) return ''
  const all = openable(rules, top)
  const names = namesOf(rules, top)
  return all.filter(path => names.get(path) === name).sort((a, b) => a.split('/').length - b.split('/').length)[0] ?? null
}

/** The rule at each path of the fully open grammar. @param {Map<string, { text: string, expr: Expr }>} rules @param {string} top */
export function namesOf(rules, top) {
  /** @type {Map<string, string>} */
  const out = new Map()
  /** @param {string} name @param {string} path @param {string[]} ancestors */
  const walk = (name, path, ancestors) => {
    named(/** @type {{ expr: Expr }} */ (rules.get(name)).expr).forEach((child, n) => {
      if (ancestors.includes(child) || !rules.has(child)) return
      out.set(`${path}/${n}`, child)
      walk(child, `${path}/${n}`, [...ancestors, child])
    })
  }
  walk(top, '', [top])
  return out
}

/** Every rule an expression names, once per mention, in order. @param {Expr} expr @returns {string[]} */
function named(expr) {
  /** @type {string[]} */
  const out = []
  /** @param {Expr} node */
  const collect = node => { if ('items' in node) node.items.forEach(collect); else if ('item' in node) collect(node.item); else if (node.t === 'nt') out.push(node.text) }
  collect(expr)
  return out
}

/**
 * The paths that open, from the top rule down: every rule that is not open further up its own
 * path, or, given `open`, only those one level below what is open now.
 * @param {Map<string, { text: string, expr: Expr }>} rules @param {string} top @param {Set<string>} [open]
 * @returns {string[]}
 */
export function openable(rules, top, open) {
  /** @type {string[]} */
  const out = []
  /** @param {string} name @param {string} path @param {string[]} ancestors */
  const walk = (name, path, ancestors) => {
    named(/** @type {{ expr: Expr }} */ (rules.get(name)).expr).forEach((child, n) => {
      if (ancestors.includes(child) || !rules.has(child)) return
      const at = `${path}/${n}`
      if (open && !open.has(at)) { out.push(at); return }
      if (!open) out.push(at)
      walk(child, at, [...ancestors, child])
    })
  }
  walk(top, '', [top])
  return out
}
