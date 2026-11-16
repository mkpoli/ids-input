// @ts-check
// A description for each variation sequence of an ideograph, read from how GlyphWiki builds the
// glyph it registers for the sequence. GlyphWiki draws a glyph from strokes and from other glyphs
// placed in frames; a glyph made of other glyphs alone names its components, and a component's
// glyph name says which form of it is meant (`u72ac-04` is 犬, `u5e73-k02` the form of 平 in the K
// source). The operators come from a description the tables give the character: the components are
// matched against its parts, by character where they are the same and by where their ink lies.
import { arity, isNode, parse, variantOf, write } from '../../src/core/ids.js'
import { ucvIdentifier } from '../../src/core/forms.js'

/**
 * @typedef {{ related: string, data: string }} Glyph A row of GlyphWiki's dump.
 * @typedef {[number, number, number, number]} Box x1, y1, x2, y2 in GlyphWiki's 200-unit square.
 * @typedef {{ name: string, frame: Box }} Placed A glyph placed in a frame.
 * @typedef {import('../../src/core/ids.js').Part} Part
 * @typedef {'named' | 'composed' | 'placed' | 'drawn'} How `named`: the glyph is named by a
 *   description. `composed`: its components are the parts of a description the tables give.
 *   `placed`: its components stand where the parts of such a description stand, and differ from
 *   them. `drawn`: the glyph is drawn from strokes, or its components fit no description, and the
 *   description is the character's own.
 * @typedef {{ description: string, how: How, glyph: string }} Described
 */

const SQUARE = /** @type {Box} */ ([0, 0, 200, 200])
/** A glyph name of a character: its code point, a variation selector, a source, a place in a
 * character (two digits) and a numbered variant, each optional. */
const UCS = /^u([0-9a-f]{4,6})(?:-u(fe0[0-9a-f]|e01[0-9a-f]{2}))?(?:-([a-z]{1,2})?(\d{2})?)?(?:-(var|itaiji)-(\d{3}))?$/
/** The longest reference a description may hold, in code points (`src/core/custom.js`). */
const LONGEST = 48
/** The sources a variant identifier names, by GlyphWiki's suffix. */
const SOURCES = new Map([['g', 'G'], ['t', 'T'], ['j', 'J'], ['k', 'K'], ['v', 'V'], ['h', 'H'], ['u', 'U'], ['m', 'M'], ['s', 'S'], ['kp', 'P']])
const char = (/** @type {string} */ hex) => String.fromCodePoint(parseInt(hex, 16))

/** The GlyphWiki name of a variation sequence: `u7a81-ue0102`. @param {string} sequence */
export const glyphName = sequence => [...sequence].map(c => `u${/** @type {number} */ (c.codePointAt(0)).toString(16)}`).join('-')

/** The reference a description names a GlyphWiki glyph by. @param {string} name */
const reference = name => `&GW-${name};`

/**
 * The glyphs a glyph's form is told against: its character's plain glyph, that glyph for the same
 * place in a character, and the glyph itself without its place (`u5e73-k02` has `u5e73`,
 * `u5e73-02` and `u5e73-k`). Empty for a name that is no character's.
 * @param {string} name @returns {string[]}
 */
export function comparedWith(name) {
  const read = UCS.exec(name)
  if (!read || read[2]) return []
  const [, point, , source, place, kind, number] = read
  const base = `u${/** @type {number} */ (char(point).normalize('NFC').codePointAt(0)).toString(16)}`
  return [...new Set([`u${point}`, base, ...(place ? [`u${point}-${place}`, `${base}-${place}`, `u${point}${source ? `-${source}` : ''}${kind ? `-${kind}-${number}` : ''}`] : [])])].filter(other => other !== name)
}

/**
 * A glyph's rows: the glyphs it places, and the points of its strokes.
 * @param {string} data @returns {{ placed: Placed[], points: number[][] }}
 */
export function rowsOf(data) {
  /** @type {Placed[]} */ const placed = []
  /** @type {number[][]} */ const points = []
  for (const row of data.split('$')) {
    const fields = row.split(':')
    if (fields[0] === '99') placed.push({ name: fields[7].split('@')[0], frame: /** @type {Box} */ (fields.slice(3, 7).map(Number)) })
    else if (fields[0] !== '0' && fields.length > 4) {
      for (let at = 3; at + 1 < fields.length; at += 2) points.push([Number(fields[at]), Number(fields[at + 1])])
    }
  }
  return { placed, points }
}

/**
 * @param {Map<string, Glyph>} glyphs GlyphWiki's rows by name, every glyph the sequences reach.
 * @param {(char: string, source?: string) => string[]} descriptionsOf A character's descriptions as
 *   the tables write them, the first one first; with a source letter, those of that source first.
 * @param {{ entries: { id: string, kind: string, forms: { glyph: string, text?: string, of?: string }[] }[] } | null} [ucv]
 * @param {Map<string, string>} [standardized] The standardized variation sequence of each CJK
 *   compatibility ideograph, which writes its form.
 */
export function createDescriber(glyphs, descriptionsOf, ucv = null, standardized = new Map()) {
  /** @type {Map<string, { text?: string, of?: string, id: string | null }>} */
  const forms = new Map()
  for (const entry of ucv?.entries ?? []) {
    entry.forms.forEach((form, at) => {
      if (forms.has(form.glyph)) return
      forms.set(form.glyph, { text: form.text, of: form.of, id: entry.kind === 'unifiable' ? ucvIdentifier(entry.id, at + 1, entry.forms.length) : null })
    })
  }

  /** The glyph a name stands for, wherever it is placed: one glyph placed alone stands for that
   * glyph. With `whole`, only where it fills the square, which makes the name another name of it.
   * @param {string} name @param {boolean} [whole] */
  const resolve = (name, whole = false) => {
    const seen = new Set([name])
    for (;;) {
      const { placed, points } = rowsOf(glyphs.get(name)?.data ?? '')
      if (placed.length !== 1 || points.length || !glyphs.has(placed[0].name) || seen.has(placed[0].name)) return name
      if (whole && placed[0].frame.some((value, at) => value !== SQUARE[at])) return name
      seen.add(name = placed[0].name)
    }
  }
  /** The glyph a name is another name of. @param {string} name */
  const alias = name => resolve(name, true)

  /** @type {Map<string, string>} The character each glyph is the plain glyph of: a unified
   * ideograph before a radical or a stroke, the lowest code point first, never a compatibility
   * ideograph or a Kangxi radical. */
  const siblings = new Map()
  const unified = (/** @type {string} */ text) => /^\p{Unified_Ideograph}$/u.test(text)
  const plains = [...glyphs.keys()].flatMap(name => { const plain = /^u([0-9a-f]{4,6})$/.exec(name); return plain ? [parseInt(plain[1], 16)] : [] }).sort((a, b) => a - b)
  for (const point of plains) {
    const written = String.fromCodePoint(point)
    // A Kangxi radical stands for its character as a compatibility ideograph does.
    if (written.normalize('NFKC') !== written || !/^[\p{Ideographic}\p{Radical}\u31C0-\u31EF]$/u.test(written)) continue
    const glyph = alias(`u${point.toString(16)}`), held = siblings.get(glyph)
    if (!held || unified(written) && !unified(held)) siblings.set(glyph, written)
  }

  /** @type {Map<string, string>} The variation sequence each glyph is registered for, the first
   * selector of a character first. */
  const registered = new Map()
  for (const name of [...glyphs.keys()].sort()) {
    const read = /^u([0-9a-f]{4,6})-u(fe0[0-9a-f]|e01[0-9a-f]{2})$/.exec(name)
    if (read && !registered.has(alias(name))) registered.set(alias(name), char(read[1]) + char(read[2]))
  }

  /** @type {Map<string, Box | null>} */
  const inked = new Map()
  /** Where a glyph's ink lies in its square, from its strokes' points. @param {string} name @returns {Box | null} */
  const ink = (name, depth = 0) => {
    if (inked.has(name)) return inked.get(name) ?? null
    if (depth > 12) return null
    const { placed, points } = rowsOf(glyphs.get(name)?.data ?? '')
    /** @type {number[][]} */ const all = [...points]
    for (const { name: inner, frame } of placed) {
      const box = ink(inner, depth + 1)
      if (!box) continue
      const [x1, y1, x2, y2] = frame
      all.push([x1 + box[0] * (x2 - x1) / 200, y1 + box[1] * (y2 - y1) / 200], [x1 + box[2] * (x2 - x1) / 200, y1 + box[3] * (y2 - y1) / 200])
    }
    const box = all.length ? /** @type {Box} */ ([Math.min(...all.map(p => p[0])), Math.min(...all.map(p => p[1])), Math.max(...all.map(p => p[0])), Math.max(...all.map(p => p[1]))]) : null
    inked.set(name, box)
    return box
  }

  /** @type {Map<string, { code: string, ends: number[] }[]>} */
  const flattened = new Map()
  /** The strokes a glyph is drawn from, each with its kind, the shapes of its ends and where its
   * two ends lie in the glyph's square. @param {string} name @returns {{ code: string, ends: number[] }[]} */
  const strokes = (name, depth = 0) => {
    const known = flattened.get(name)
    if (known) return known
    if (depth > 12) return []
    /** @type {{ code: string, ends: number[] }[]} */ const all = []
    for (const row of (glyphs.get(name)?.data ?? '').split('$')) {
      const fields = row.split(':')
      if (fields[0] === '99') {
        const [x1, y1, x2, y2] = fields.slice(3, 7).map(Number)
        for (const { code, ends } of strokes(fields[7].split('@')[0], depth + 1)) {
          all.push({ code, ends: ends.map((value, at) => at % 2 ? y1 + value * (y2 - y1) / 200 : x1 + value * (x2 - x1) / 200) })
        }
      } else if (fields[0] !== '0' && fields.length > 6) {
        all.push({ code: fields.slice(0, 3).join(':'), ends: [Number(fields[3]), Number(fields[4]), Number(fields.at(-2)), Number(fields.at(-1))] })
      }
    }
    flattened.set(name, all)
    return all
  }
  /** How far apart two strokes of one form may lie, in the form's own width and height. */
  const NEAR = 0.3
  /**
   * Whether two glyphs are one form placed differently: the same strokes, each with its ends
   * near the other's once both glyphs are fitted to one square.
   * @param {string} a @param {string} b
   */
  const sameForm = (a, b) => {
    if (a === b) return true
    const [first, second] = [a, b].map(name => {
      const all = strokes(name), box = ink(name)
      if (!box) return []
      const w = Math.max(box[2] - box[0], 1), h = Math.max(box[3] - box[1], 1)
      return all.map(({ code, ends }) => ({ code, ends: ends.map((value, at) => at % 2 ? (value - box[1]) / h : (value - box[0]) / w) }))
    })
    if (!first.length || first.length !== second.length) return false
    const free = new Set(second.keys())
    for (const stroke of first) {
      let nearest = -1, least = Infinity
      for (const at of free) {
        const other = second[at]
        if (other.code !== stroke.code) continue
        const far = Math.max(...stroke.ends.map((value, end) => Math.abs(value - other.ends[end])))
        if (far < least) { least = far; nearest = at }
      }
      if (nearest < 0 || least > NEAR) return false
      free.delete(nearest)
    }
    return true
  }

  /** A character as a description writes it: a compatibility ideograph as the character that has
   * its glyph, else as its standardized sequence. @param {string} point A code point, in hex. */
  const written = point => {
    const own = char(point)
    return own.normalize('NFC') === own ? own : siblings.get(alias(`u${point}`)) ?? standardized.get(own) ?? own.normalize('NFC')
  }

  /** A description GlyphWiki names a glyph by (`u2ff1-u7a74-u72ac`), or null. @param {string} name @returns {Part | null} */
  const named = name => {
    if (!/^u2ff[0-9a-f]-/.test(name)) return null
    const parts = name.match(/u[0-9a-f]{4,6}|cdp-[0-9a-f]{4}/g) ?? []
    if (parts.join('-') !== name) return null
    const read = parse(parts.map(part => part.startsWith('cdp-') ? `&CDP-${part.slice(4).toUpperCase()};` : written(part.slice(1))).join(''))
    return read.problem ? null : read.tree
  }

  /** A reference to a glyph, or `instead` where the name is longer than a description may hold.
   * @param {string} name @param {string | null} instead */
  const referred = (name, instead) => [...reference(name)].length <= LONGEST ? reference(name) : instead ?? '？'

  /**
   * A glyph of `base` against the character's plain glyph: its own description where it is built
   * of other parts, the character where it is the same form, else null.
   * @param {string} base @param {string} name @param {string} plain @param {number} depth @returns {Part | null}
   */
  const formOf = (base, name, plain, depth) => {
    const [made, usual] = depth < 3 ? [built(base, resolve(name), depth + 1), glyphs.has(plain) ? built(base, resolve(plain), depth + 1) : null] : [null, null]
    if (made && made.description !== usual?.description) return made.tree
    return !glyphs.has(plain) || sameForm(resolve(name), resolve(plain)) ? base : null
  }

  /**
   * What a placed glyph is: the character it is a form of, and that form as a description writes
   * it. A form no notation names is written as a reference to the glyph.
   * @param {string} name @param {number} [depth]
   * @returns {{ char: string | null, tree: Part | null, text: Part }}
   */
  const component = (name, depth = 0) => {
    // A glyph named by a description, as placed or as a numbered variant of it.
    const tree = named(name.replace(/(?:-\d{2})?(?:-(?:var|itaiji)-\d{3})?$/, ''))
    if (tree) return { char: null, tree, text: tree }
    const read = UCS.exec(name)
    if (!read) {
      const cdp = /^cdp-([0-9a-f]{4})(?:-\d{2})?$/.exec(name)
      if (cdp) return { char: null, tree: null, text: `&CDP-${cdp[1].toUpperCase()};` }
      // A glyph of another glyph set: the glyph it is another name of, else a form of the
      // character GlyphWiki relates it to.
      if (alias(name) !== name) return component(alias(name), depth)
      const related = glyphs.get(name)?.related ?? ''
      const of = /^u[0-9a-f]{4,6}$/.test(related) && related !== 'u3013' ? char(related.slice(1)).normalize('NFC') : null
      const form = of ? formOf(of, name, `u${/** @type {number} */ (of.codePointAt(0)).toString(16)}`, depth) : null
      return { char: of, tree: isNode(form) ? form : null, text: form ?? referred(name, of) }
    }
    const [, point, selector, source, place, kind, number] = read
    // A compatibility ideograph is a form of the character it stands for.
    const own = char(point), base = own.normalize('NFC')
    if (selector) return { char: base, tree: null, text: kind ? referred(name, base) : base + char(selector) }
    // The character's plain glyph, under whatever name.
    const usual = place && glyphs.has(`u${point}-${place}`) ? `u${point}-${place}` : `u${point}`
    if (own === base && (!source && !kind || alias(name) === alias(usual))) return { char: base, tree: null, text: base }
    // The plain glyph of another character: that character writes the form.
    const sibling = siblings.get(alias(name)) ?? (place && !source && !kind ? siblings.get(alias(`u${point}`)) : undefined)
    if (sibling) return { char: base, tree: null, text: sibling }
    // A compatibility ideograph's own glyph is written as its standardized sequence.
    const sequence = standardized.get(own)
    if (sequence && !kind && (!source || alias(name) === alias(`u${point}`))) return { char: base, tree: null, text: sequence }
    // A glyph registered for a variation sequence of the character: that sequence writes the form.
    const whole = `u${point}${source ? `-${source}` : ''}${kind ? `-${kind}-${number}` : ''}`
    const sequenced = registered.get(alias(place ? whole : name))
    if (sequenced && [...sequenced][0] === base) return { char: base, tree: null, text: sequenced }
    // A form of a component variation entry, as placed or as the entry names it.
    const listed = forms.get(name) ?? forms.get(whole)
    if (listed?.text && !listed.text.includes('⬚')) {
      const form = parse(listed.text)
      if ([...listed.text].length === 1 || !form.problem && !isNode(form.tree)) return { char: base, tree: null, text: listed.text }
      if (!form.problem) return { char: base, tree: form.tree ?? null, text: form.tree ?? base }
    }
    if (listed?.of === base && listed.id) return { char: base, tree: null, text: base + listed.id }
    // A source's form or a numbered variant, against the plain glyph of the same place.
    const plainName = `u${/** @type {number} */ (base.codePointAt(0)).toString(16)}`
    const form = formOf(base, name, place && glyphs.has(`${plainName}-${place}`) ? `${plainName}-${place}` : plainName, depth)
    if (form !== null) return { char: base, tree: isNode(form) ? form : null, text: form }
    const letter = kind || own !== base ? undefined : SOURCES.get(/** @type {string} */ (source))
    return { char: base, tree: null, text: letter ? base + letter : referred(name, base) }
  }

  /** A component's character, without its variant identifier or selector. @param {string} part */
  const plainOf = part => [...variantOf(part).base][0] ?? ''
  /** @type {Map<string, Part[]>} */
  const read = new Map()
  /** A character's descriptions as trees. @param {string} of */
  const treesOf = of => {
    let trees = read.get(of)
    if (!trees) {
      trees = descriptionsOf(of).flatMap(text => { const found = parse(text); return found.problem || !isNode(found.tree) ? [] : [found.tree] })
      read.set(of, trees)
    }
    return trees
  }

  /** Where the part `at` of an operator stands in `box`. @param {string} op @param {number} at @param {Box} box @returns {Box} */
  const within = (op, at, [x1, y1, x2, y2]) => {
    const w = x2 - x1, h = y2 - y1
    /** @param {number} a @param {number} b @param {number} c @param {number} d @returns {Box} */
    const cut = (a, b, c, d) => [x1 + w * a, y1 + h * b, x1 + w * c, y1 + h * d]
    if (op === '⿰') return at ? cut(0.5, 0, 1, 1) : cut(0, 0, 0.5, 1)
    if (op === '⿱') return at ? cut(0, 0.5, 1, 1) : cut(0, 0, 1, 0.5)
    if (op === '⿲') return cut(at / 3, 0, (at + 1) / 3, 1)
    if (op === '⿳') return cut(0, at / 3, 1, (at + 1) / 3)
    if (!at || arity(op) < 2) return cut(0, 0, 1, 1)
    const inner = { '⿴': [0.25, 0.25, 0.75, 0.75], '⿵': [0.2, 0.35, 0.8, 1], '⿶': [0.2, 0, 0.8, 0.65], '⿷': [0.35, 0.2, 1, 0.8], '⿼': [0, 0.2, 0.65, 0.8],
      '⿸': [0.3, 0.3, 1, 1], '⿹': [0, 0.3, 0.7, 1], '⿺': [0.3, 0, 1, 0.7], '⿽': [0, 0, 0.7, 0.7] }[op]
    return inner ? cut(inner[0], inner[1], inner[2], inner[3]) : cut(0, 0, 1, 1)
  }

  /**
   * The ways a tree divides into `most` parts or fewer: each a list of its parts with where they
   * stand and how to put another part in their place. A character divides as its first description.
   * @param {Part} tree @param {Box} box @param {number} most @param {number} opened
   * @returns {{ part: Part, box: Box, path: (number | 'in')[] }[][]}
   */
  const divisions = (tree, box, most, opened = 0) => {
    /** @type {{ part: Part, box: Box, path: (number | 'in')[] }[][]} */
    const found = [[{ part: tree, box, path: [] }]]
    if (most < 2 || tree === null) return found
    const inside = isNode(tree) ? tree : opened < 2 ? treesOf(plainOf(tree))[0] ?? null : null
    if (!isNode(inside) || inside.op === '㇯' || arity(inside.op) < 2 && inside.op !== '⿾' && inside.op !== '⿿') return found
    const step = isNode(tree) ? [] : /** @type {('in')[]} */ (['in'])
    const depth = isNode(tree) ? opened : opened + 1
    /** @type {{ part: Part, box: Box, path: (number | 'in')[] }[][]} */
    let joined = [[]]
    inside.parts.forEach((part, at) => {
      const ways = divisions(part, within(inside.op, at, box), most - (inside.parts.length - 1), depth)
        .map(way => way.map(piece => ({ ...piece, path: [...step, at, ...piece.path] })))
      joined = joined.flatMap(before => ways.flatMap(way => before.length + way.length <= most ? [[...before, ...way]] : []))
    })
    return [...found, ...joined.filter(way => way.length > 1)]
  }

  /** `tree` with `part` at `path`, a character on the way opened as its first description. @param {Part} tree @param {(number | 'in')[]} path @param {Part} part @returns {Part} */
  const put = (tree, path, part) => {
    if (!path.length) return part
    const [step, ...rest] = path
    if (step === 'in') return put(typeof tree === 'string' ? treesOf(plainOf(tree))[0] : tree, rest, part)
    if (!isNode(tree)) return tree
    return { op: tree.op, parts: tree.parts.map((inner, at) => at === step ? put(inner, rest, part) : inner) }
  }

  /** How much of two boxes is shared, from 0 to 1. @param {Box} a @param {Box} b */
  const shared = (a, b) => {
    const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1])
    if (w <= 0 || h <= 0) return 0
    const both = w * h
    return both / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - both)
  }

  /** Every order of 0..n-1. @param {number} n @returns {number[][]} */
  const orders = n => n <= 1 ? [[...Array(n).keys()]] : orders(n - 1).flatMap(order => Array.from({ length: n }, (_, at) => [...order.slice(0, at), n - 1, ...order.slice(at)]))

  /**
   * The description of a glyph of `base`, or null where the glyph is not made of other glyphs
   * alone or its components stand as no description's parts do.
   * @param {string} base @param {string} name @param {number} [depth]
   * @returns {{ description: string, tree: Part, how: How } | null}
   */
  function built(base, name, depth = 0) {
    const tree = named(name)
    if (tree) return { description: write(tree), tree, how: 'named' }
    const { placed, points } = rowsOf(glyphs.get(name)?.data ?? '')
    if (points.length || placed.length < 2 || placed.length > 7) return null
    const parts = placed.map(({ name: inner, frame }) => {
      const box = ink(inner) ?? SQUARE
      const [x1, y1, x2, y2] = frame
      return { ...component(inner, depth), box: /** @type {Box} */ ([x1 + box[0] * (x2 - x1) / 200, y1 + box[1] * (y2 - y1) / 200, x1 + box[2] * (x2 - x1) / 200, y1 + box[3] * (y2 - y1) / 200]) }
    })
    const whole = ink(name) ?? SQUARE
    const own = UCS.exec(name)
    const candidates = [...new Set([base, ...(own && char(own[1]) !== base ? [char(own[1])] : [])])].flatMap(treesOf)
    /** @param {Part} part @param {typeof parts[number]} piece */
    const same = (part, piece) => typeof part === 'string'
      ? piece.char === plainOf(part)
      : piece.tree ? write(piece.tree) === write(part) : piece.char !== null && treesOf(piece.char).some(found => write(found) === write(part))
    /** How much of `box` lies in `slot`, from 0 to 1. @param {Box} slot @param {Box} box */
    const inside = (slot, box) => {
      const w = Math.min(slot[2], box[2]) - Math.max(slot[0], box[0]), h = Math.min(slot[3], box[3]) - Math.max(slot[1], box[1])
      return w <= 0 || h <= 0 ? 0 : w * h / Math.max((box[2] - box[0]) * (box[3] - box[1]), 1)
    }
    // The best reading of each description the components could write: 2 where they are its
    // parts, 1 where they only stand where its parts stand.
    /** @type {Map<string, { tree: Part, score: number, rank: number }>} */
    const readings = new Map()
    const every = orders(parts.length)
    for (const candidate of candidates) {
      for (const way of divisions(candidate, whole, parts.length)) {
        if (way.length !== parts.length) continue
        // Parts that share one place, as those of ⿻ do, cannot be told apart by where they lie.
        const apart = new Set(way.map(piece => piece.box.join())).size === way.length
        for (const order of every) {
          const exact = order.every((piece, at) => same(way[at].part, parts[piece]))
          if (!exact && !(apart && order.every((piece, at) => inside(way[at].box, parts[piece].box) >= 0.6))) continue
          const score = order.reduce((sum, piece, at) => sum + shared(way[at].box, parts[piece].box), 0) / parts.length
          const tree = order.reduce((made, piece, at) => put(made, way[at].path, parts[piece].text), /** @type {Part} */ (candidate))
          const text = write(tree), held = readings.get(text), rank = exact ? 2 : 1
          if (!held || held.rank < rank || held.rank === rank && held.score < score) readings.set(text, { tree, score, rank })
        }
      }
    }
    const [best, next] = [...readings.values()].sort((a, b) => b.rank - a.rank || b.score - a.score)
    if (!best) return null
    if (best.rank === 2) return { description: write(best.tree), tree: best.tree, how: 'composed' }
    // Placed: the components lie in the parts' places, and no other description fits nearly as well.
    return best.score >= 0.3 && (!next || best.score - next.score >= 0.1) ? { description: write(best.tree), tree: best.tree, how: 'placed' } : null
  }

  /**
   * The description of a variation sequence, from the glyph GlyphWiki registers for it; null
   * where it registers none.
   * @param {string} sequence @returns {Described | null}
   */
  return sequence => {
    const base = [...sequence][0]
    if (!glyphs.has(glyphName(sequence))) return null
    const glyph = resolve(glyphName(sequence))
    const found = built(base, glyph)
    if (found) return { description: found.description, how: found.how, glyph }
    // A glyph that is another character's is described as that character.
    const other = UCS.exec(glyph)
    const of = other && !other[2] && char(other[1]) !== base && descriptionsOf(char(other[1])).length ? char(other[1]) : base
    // A source's glyph of the character is described as that source writes it.
    const source = other && char(other[1]) === base && !other[4] && !other[5] ? SOURCES.get(other[3] ?? '') : undefined
    const description = descriptionsOf(of, source).find(text => { const read = parse(text); return !read.problem && isNode(read.tree) })
    return { description: description ?? of, how: 'drawn', glyph }
  }
}
