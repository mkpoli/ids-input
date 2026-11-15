// A grammar in ISO/IEC 14977 EBNF read into rules, and each rule drawn as a railroad diagram: the
// appendix draws the zi.tools IDS Extension from data/baishi-ids.ebnf itself, so the diagrams are
// the file's rules and cannot drift from them. Only what that grammar uses is read: sequences
// (","), choices ("|"), [options], {repetitions}, (groups), "terminals", ? special sequences ? and
// rule names. The drawing follows Tab Atkins Jr.'s railroad-diagrams layout: a choice stacks its
// branches below the first, an option is a choice with an empty first branch, and a repetition
// loops back under its item.

/** @typedef {{ t: 'seq' | 'alt', items: Expr[] } | { t: 'opt' | 'rep', item: Expr } | { t: 'term' | 'special' | 'nt', text: string }} Expr */

/** Comments out, as ISO EBNF writes them. @param {string} text */
export const withoutComments = text => text.replace(/\(\*[\s\S]*?\*\)/g, '')

/**
 * Every rule of a grammar, in order: its name, its text as written and its expression.
 * @param {string} ebnf @returns {Map<string, { text: string, expr: Expr }>}
 */
export function readGrammar(ebnf) {
  /** @type {Map<string, { text: string, expr: Expr }>} */
  const rules = new Map()
  for (const match of withoutComments(ebnf).matchAll(/^([a-z][a-z ]*?) *=([\s\S]*?);[ \t]*$/gm)) {
    rules.set(match[1], { text: match[0].trim(), expr: readExpr(match[2], match[1]) })
  }
  return rules
}

/** @param {string} source @param {string} rule @returns {Expr} */
function readExpr(source, rule) {
  const tokens = [...source.matchAll(/"[^"]*"|\?[^?]*\?|[a-z][a-z ]*[a-z]|[a-z]|[|,[\]{}()]/g)].map(match => match[0])
  let at = 0
  const fail = () => { throw new SyntaxError(`${rule}: unexpected ${tokens[at] ?? 'end'}`) }
  /** @returns {Expr} */
  const choice = () => {
    const items = [sequence()]
    while (tokens[at] === '|') { at++; items.push(sequence()) }
    return items.length === 1 ? items[0] : { t: 'alt', items }
  }
  /** @returns {Expr} */
  const sequence = () => {
    const items = [term()]
    while (tokens[at] === ',') { at++; items.push(term()) }
    return items.length === 1 ? items[0] : { t: 'seq', items }
  }
  /** @returns {Expr} */
  const term = () => {
    const token = tokens[at++]
    if (token === undefined) return fail()
    /** @param {string} close @param {(item: Expr) => Expr} make */
    const group = (close, make) => { const item = choice(); if (tokens[at++] !== close) fail(); return make(item) }
    if (token === '[') return group(']', item => ({ t: 'opt', item }))
    if (token === '{') return group('}', item => ({ t: 'rep', item }))
    if (token === '(') return group(')', item => item)
    if (token.startsWith('"')) return { t: 'term', text: token.slice(1, -1) }
    if (token.startsWith('?')) return { t: 'special', text: token.slice(1, -1).trim() }
    if (/^[a-z]/.test(token)) return { t: 'nt', text: token }
    return fail()
  }
  const expr = choice()
  if (at !== tokens.length) fail()
  return expr
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

const ARC = 10, GAP = 10, BOX = 11, FRAME = 10, LABEL = 18
/** @param {string} text */
const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** A width for text in the diagram's monospace face: wide characters take a full em. @param {string} text */
const textWidth = text => [...text].reduce((sum, char) => sum + (/[ᄀ-￿\u{20000}-\u{3FFFF}]/u.test(char) ? 13 : 7.6), 0)
/** @param {number} n */
const r = n => Math.round(n * 10) / 10

/** @typedef {{ w: number, up: number, down: number, draw: (x: number, y: number) => string }} Box */
/**
 * What a drawing opens. `open` holds the paths of the rules spliced in; a path is the parent's path,
 * "/" and the rule's ordinal among the rules its parent names in order (the top rule is ""). A rule
 * open further up its own path is drawn as a link to it. Without `open` every rule stays a box.
 * @typedef {{ rules: Map<string, { text: string, expr: Expr }>, open?: Set<string>, path: string, ancestors: { name: string, path: string }[], next: { n: number } }} Context
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
  return { w, up: BOX, down: BOX, draw: (x, y) => `<g class="${kind}"${attributes} data-x="${r(x)}" data-y="${r(y)}"><rect x="${r(x)}" y="${r(y - BOX)}" width="${r(w)}" height="${BOX * 2}"${round ? ' rx="10"' : ''}/><text x="${r(x + w / 2)}" y="${r(y + 4)}">${escape(label)}</text></g>` }
}

/** A rule named on the line: a box, a link to the same rule open further up, or the rule itself
 * spliced in, framed and labelled with its name. @param {string} name @param {Context} ctx @returns {Box} */
function rule(name, ctx) {
  const path = `${ctx.path}/${ctx.next.n++}`
  const above = ctx.ancestors.find(one => one.name === name)
  const data = ` data-rule="${escape(name)}" data-path="${path}"`
  if (!ctx.open) return token(name, 'non-terminal', ` data-rule="${escape(name)}"`, false)
  if (above) return token(`↑ ${name}`, 'non-terminal recursive', `${data} data-link="${above.path}" tabindex="0" role="link" aria-label="${escape(name)}"`, false)
  const body = ctx.rules.get(name)
  if (!ctx.open.has(path) || !body) return token(`+ ${name}`, 'non-terminal', `${data} tabindex="0" role="button" aria-expanded="false" aria-label="${escape(name)}"`, false)
  const inner = layout(body.expr, { ...ctx, path, ancestors: [...ctx.ancestors, { name, path }], next: { n: 0 } })
  const label = `− ${name}`
  const w = Math.max(inner.w + FRAME * 2, textWidth(label) + 16)
  const up = inner.up + FRAME + LABEL
  const down = inner.down + FRAME
  return { w, up, down, draw: (x, y) => `<g class="spliced" data-x="${r(x)}" data-y="${r(y)}"${data}>`
    + `<rect class="frame" x="${r(x)}" y="${r(y - up)}" width="${r(w)}" height="${r(up + down)}" rx="6"/>`
    + `<g class="frame-label"${data} tabindex="0" role="button" aria-expanded="true" aria-label="${escape(name)}"><rect x="${r(x)}" y="${r(y - up)}" width="${r(textWidth(label) + 16)}" height="${LABEL}" rx="6"/><text x="${r(x + 8)}" y="${r(y - up + 13)}">${escape(label)}</text></g>`
    + `<path d="M${r(x)} ${r(y)}h${r(FRAME)}"/>${inner.draw(x + FRAME, y)}<path d="M${r(x + FRAME + inner.w)} ${r(y)}H${r(x + w)}"/></g>` }
}

/** @param {Box[]} items @returns {Box} */
function sequence(items) {
  const w = items.reduce((sum, item) => sum + item.w, 0) + GAP * (items.length - 1)
  return { w, up: Math.max(...items.map(item => item.up)), down: Math.max(...items.map(item => item.down)), draw: (x, y) => {
    let out = '', at = x
    items.forEach((item, i) => {
      if (i) { out += `<path d="M${r(at)} ${r(y)}h${GAP}"/>`; at += GAP }
      out += item.draw(at, y); at += item.w
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
  return { w, up: items[0].up, down: bottom, draw: (x, y) => {
    let out = `<path d="M${r(x)} ${r(y)}h${ARC * 2}"/>${items[0].draw(x + ARC * 2, y)}<path d="M${r(x + ARC * 2 + items[0].w)} ${r(y)}H${r(x + w)}"/>`
    items.slice(1).forEach((item, i) => {
      const drop = drops[i + 1]
      out += `<path d="M${r(x)} ${r(y)}a${ARC} ${ARC} 0 0 1 ${ARC} ${ARC}v${r(drop - ARC * 2)}a${ARC} ${ARC} 0 0 0 ${ARC} ${ARC}"/>`
      out += item.draw(x + ARC * 2, y + drop)
      out += `<path d="M${r(x + ARC * 2 + item.w)} ${r(y + drop)}H${r(x + w - ARC * 2)}a${ARC} ${ARC} 0 0 0 ${ARC} ${-ARC}v${r(ARC * 2 - drop)}a${ARC} ${ARC} 0 0 1 ${ARC} ${-ARC}"/>`
    })
    return out
  } }
}

/** The item, and a line under it back from its end to its start. @param {Box} item @returns {Box} */
function oneOrMore(item) {
  const w = item.w + ARC * 2
  const loop = Math.max(item.down + GAP, ARC * 2)
  return { w, up: item.up, down: loop, draw: (x, y) => `<path d="M${r(x)} ${r(y)}h${ARC}"/>${item.draw(x + ARC, y)}<path d="M${r(x + ARC + item.w)} ${r(y)}h${ARC}"/>`
    + `<path d="M${r(x + ARC + item.w)} ${r(y)}a${ARC} ${ARC} 0 0 1 ${ARC} ${ARC}v${r(loop - ARC * 2)}a${ARC} ${ARC} 0 0 1 ${-ARC} ${ARC}H${r(x + ARC)}a${ARC} ${ARC} 0 0 1 ${-ARC} ${-ARC}v${r(ARC * 2 - loop)}a${ARC} ${ARC} 0 0 1 ${ARC} ${-ARC}"/>` }
}

/**
 * A railroad diagram, from its start bar to its end bar, as SVG with its size. With `open`, the
 * diagram is of the rule `top` with those paths spliced in; without, of one rule on its own.
 * @param {Map<string, { text: string, expr: Expr }>} rules @param {string} top @param {Set<string>} [open]
 * @returns {{ svg: string, width: number, height: number }}
 */
export function railroad(rules, top, open) {
  const expr = /** @type {{ expr: Expr }} */ (rules.get(top)).expr
  const body = layout(expr, { rules, open, path: '', ancestors: [{ name: top, path: '' }], next: { n: 0 } })
  const pad = 10, lead = 20
  const width = Math.ceil(body.w + lead * 2 + pad * 2), height = Math.ceil(body.up + body.down + pad * 2)
  const y = pad + body.up
  const bar = (/** @type {number} */ x) => `<path d="M${r(x)} ${r(y - 8)}v16"/>`
  const svg = `<svg class="railroad-diagram" role="group" aria-label="${escape(top)}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`
    + `${bar(pad)}<path d="M${pad} ${r(y)}h${lead}"/>${body.draw(pad + lead, y)}<path d="M${r(pad + lead + body.w)} ${r(y)}h${lead}"/>${bar(pad + lead * 2 + body.w)}</svg>`
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
