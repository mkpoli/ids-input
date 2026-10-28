// @ts-nocheck: a port of han-compose's Python, kept line for line; its types are the arrays it reads.
// A port of han-compose's composer (`compose.py`, `Composer.compose`) over its web export: a sequence
// drawn from parts other characters' designers drew. The export carries what the composer reads
// when it draws: the learned layout, each character's glyph, and every host of each operand in each
// place in the composer's index order, each with its cut; `ranked` weighs the whole list against
// the target as `Composer._ranked` does, so an entry with no clean cut still takes a place. What it
// does not carry (teachers, KanjiVG's groups for overlays, the standalone model) falls back the way
// the composer falls back without them: rows of three share their axis by `SHARES`.
//
// Beyond the composer, ⿾ mirrors its operand, ⿿ turns it half round, 〾 draws it as it is, ㇯
// draws its second operand as a cut out of the first, and ⿼ ⿽ enclose from the right and the lower
// right, their inner part placed in the room the outer one leaves.
//
// Everything here is synchronous. `data.rec(key)` answers a key's record, `data.hosts(key, place)`
// every host entry of it there, cut or not, and `data.places(key)` the places it is held in; each
// answers empty for a key the export lacks or whose file is not loaded yet (which the caller loads
// before drawing again).
import { EM_BOX, area, count, drawnContours, fill, fitted, grown, groupRings, makePart, mapped, partInk, partOf,
  placed, pointsBox, pyRound, raster, rings, scaleOf, shrunk, square, stretchOf, union, within } from './geometry.js'
import { componentParts, componentPosition, componentPositionBox, componentRecord, containsComponentForm, isComponentForm, isGroupedForm } from './component-forms.js'
import { features, forward } from './layout.js'
import { pyramidCells } from './pyramid.js'
import { pyramidRows } from '../core/pyramid.js'
import { isOutbound, markFace, markParts } from './marks.js'
import { hexOf } from './sha256.js'
import componentConstants from './constants.json' with { type: 'json' }
import pyramidCatalog from './pyramid-glyphs.json' with { type: 'json' }

const pyramidGlyphs = new Map(pyramidCatalog.entries.flatMap(({ char, part, sequence, pair }) =>
  [sequence, `⿱${part}${pair}`, `⿱${part}⿰${part}${part}`].map(ids => [ids, char])))
const yanGlyphs = new Map(['⿳亠㐅厂', '⿱文厂'].flatMap(outer =>
  [['彡', '彥'], ['生', '產']].map(([inner, char]) => [`⿸${outer}${inner}`, char])))
const yanSources = new Map([['⿳亠㐅厂', '產'], ['⿱文厂', '產'], ['⿳亠丷厂', '产']])
// The stacked 日 pair has about this much outline ink in both exports.
const YAN_STACK_INK = 14000

export class LookupError extends Error { name = 'LookupError' }

/** The first `n` hosts of a list in the composer's index order, by each entry's position `r`. */
const upTo = (list, n) => list.filter(h => h.r < n)

const isSelector = ch => ch !== undefined && /^[︀-️\u{E0100}-\u{E01EF}]$/u.test(ch)

/** `⿰亻⿱亠女` as ['⿰', '亻', ['⿱', '亠', '女']], each operator taking `arity(op)` operands. */
export function parseTree(sequence, arity) {
  const chars = [...sequence]
  let at = 0
  const node = () => {
    if (at >= chars.length) throw new LookupError(`${sequence} is missing a component.`)
    let ch = chars[at++]
    const n = arity(ch)
    if (!n) {
      if (isSelector(chars[at])) ch += chars[at++]
      return ch
    }
    return [ch, ...Array.from({ length: n }, node)]
  }
  const tree = node()
  if (at !== chars.length) throw new LookupError(`${sequence} has more components than its operators take.`)
  return tree
}

/** A node written out again as a sequence. */
export const keyOf = node => typeof node === 'string' ? node : node[0] + node.slice(1).map(keyOf).join('')

/** An empty slot, as the editor writes it (EMPTY in ids-input's core). The composer lays a tree with empty
 *  slots out as it would a whole one, each empty slot an operand it knows nothing of (the layout
 *  reads its place's defaults, its ink is the unknown operand's), and draws no ink there: the slot
 *  becomes a placeholder in the box its node gave it. han-compose itself draws no empty slots. */
export const EMPTY = '⬚'
/** Whether a node is an empty slot, numbered in reading order (`⬚0`, `⬚1`, …) by `compose`. */
export const isEmpty = node => typeof node === 'string' && node[0] === EMPTY
const isRepeatedRow = node => Array.isArray(node) && (node[0] === '⿰' || node[0] === '⿲') &&
  node.slice(1).every(child => keyOf(child) === keyOf(node[1]))

/** The operators this port draws beyond the composer's, with rooms and turns of its own choosing: a
 *  preview using them is approximate, and no stored drawing has them. */
export const APPROXIMATE = ['⿾', '⿿', '〾', '㇯', '⿼', '⿽']
const MIRROR = '⿾', ROTATE = '⿿', VARIANT = '〾', SUBTRACT = '㇯'
const EXTRA_ENCLOSE = { '⿼': 'RBT', '⿽': 'RB' }
const EXTRA_INSIDE = { '⿼': [0, 0.15, 0.8, 0.85], '⿽': [0, 0.25, 0.7, 1] }

// Contour partitions of the exact font-export glyphs. The digest ties each cut to its
// outlines: other fonts and later exports keep the usual geometric composition.
const ENCLOSURE_CUTS = {
  '⿽水丶': ['氷', {
    '28ff54a66b480707055ab6088d46e79d134020f143adc6403a6e2f8e66928327': [[0,1,3,4,5],[2]],
    '745eac7b7fecf77b76d949e954c3b6d315141be8297d65e19079f0467f332312': [[0,1,2,3,4],[5]],
    '5268c2cbbac2aa9fdb586cd7b478c95bede10b46379f4afd24ce42ec7ede5495': [[0,2],[1]],
  }],
  '⿽十⺀': ['斗', {
    '752e2007a0eb368d6c6133ea1179c9ca52de9606f0b798081cff58d47ca0b053': [[0,1],[2,3]],
    'eb98857e9d6fbd093e1ff8e2a5fb182c920483376a4e8c36f5fbd0da43f66372': [[2,3],[0,1]],
    'f53105473310a9f7cc54485ebadaf9828670deef3707ef2c095a5e97d24994f3': [[0],[1,2]],
  }],
  '⿽人⿰𠄌丶': ['以', {
    'd862658851387f879787ed51aab13b42825e0d1ae1295b2bea798b143d05cc72': [[2,3],[1,4],[0]],
    '00d8ce03d34eae498f722d8bad84bcf5d77a807654560eb8ba440d2d6dc7dd52': [[2,4],[0,3],[1]],
    '1ef49823562accfb65a808cce67594327e1bd9eceabeaff1683826af671c9209': [[0],[1],[2]],
  }],
  '⿽戈从': ['㦰', {
    'b7d2cd4473cf5cda692771db18ae491dd302efd7e0fdafe3582ee0dd909117de': [[4,5,6,7],[0,1,2,3]],
    'e0606c7982bcb036d9ec1a866509fcbe1f079a387534c36a78e4c7041dc2fdbd': [[0,1,2,3],[4,5,6,7]],
  }],
}

export class Composer {
  /**
   * `data`: `{ manifest, layout, rec(key), hosts(key, place), places(key) }`; `exclude`: characters nothing is taken from (a
   * character redrawn to test, with its twins); `face`: the box a whole character fills, when those
   * characters change it (the manifest's is the median of `FULL` with none excluded); `separate`:
   * draw operands as individual pieces where possible, including cuts from a matching whole glyph,
   * so a view that changes one part can address its leaf.
   */
  constructor(data, { exclude = [], face = null, separate = false, fontStyle = 'sans' } = {}) {
    this.data = data
    const m = data.manifest, c = m.constants
    this.C = c
    this.layout = data.layout
    this.exclude = new Set(exclude)
    this.spelled = new Set(m.spelled)
    this.AXIS = c.AXIS
    this.ENCLOSE = { ...c.ENCLOSE, ...EXTRA_ENCLOSE }
    this.INSIDE = { ...c.INSIDE, ...EXTRA_INSIDE }
    this.SLOTS = c.SLOTS
    this.face = face ?? c.face
    this.separate = separate
    this.fontStyle = fontStyle
    // A static brush face keeps its own stroke weights; a variable export weights its parts.
    this.weighted = m.weighted ?? !(m.style === 'kaisho' && m.heavy === 400)
    this.stem0 = c.stem
    this.arities = new Map([...c.BINARY.map(op => [op, 2]), ...c.TERNARY.map(op => [op, 3]), ...c.UNARY.map(op => [op, 1])])
    this.expanding = new Set()
    this.approximate = new Set()
    this.pyramids = new WeakMap()
    this.nativeEnclosures = new Set()
  }

  arity = ch => this.arities.get(ch) ?? 0
  parse = sequence => parseTree(sequence, this.arity)
  // A key holding an empty slot has no record and no hosts: nothing is asked for it.
  rec = key => key.includes(EMPTY) ? null : (componentRecord(key, this.fontStyle) ?? this.data.rec(key))
  excluded = ch => this.exclude.has(ch)
  slot = (op, i) => this.SLOTS[op] ? this.SLOTS[op][i] : `${op}${i}`
  /** The pyramid a node reads as, remembered for this drawing. */
  pyramid(node) {
    if (typeof node === 'string' || !node || typeof node !== 'object') return pyramidRows(node)
    if (this.pyramids.has(node)) return this.pyramids.get(node)
    const found = pyramidRows(node)
    this.pyramids.set(node, found)
    return found
  }

  glyphRecord(ch) { return this.rec(ch)?.G ?? null }
  glyph(ch) { const g = this.glyphRecord(ch); return g ? partOf(g) : null }
  /** Whether the variable font draws `ch`: its strokes can be weighted. */
  own(ch) { return this.glyphRecord(ch)?.v === 1 }
  bySequence(k) { return this.rec(k)?.e ?? null }
  sequenceOf(ch) { return this.rec(ch)?.s ?? null }
  atomic(ch) { return this.rec(ch)?.at === 1 }

  /** Outline length: a glyph's, or for an excluded or glyphless character its sequence's operands'. */
  ink(node, seen = new Set()) {
    if (componentRecord(keyOf(node), this.fontStyle)) return componentRecord(keyOf(node), this.fontStyle).ink
    if (Array.isArray(node) && node[0] === '⿸' && this.yanStackedDays(node[1], node[2]))
      return this.ink(node[1], seen) + this.ink('儿', seen) + YAN_STACK_INK
    if (typeof node !== 'string') return node.slice(1).reduce((s, n) => s + this.ink(n, seen), 0)
    const r = this.rec(node)
    if (!this.excluded(node) && r?.G) return r.ink
    if (r?.s && !seen.has(node)) {
      try { return this.ink(this.parse(r.s), new Set([...seen, node])) } catch { /* unreadable: as unknown */ }
    }
    return !this.excluded('永') ? this.rec('永')?.ink ?? 1000 : 1000
  }

  /** Permitted outline count; zero when an operand is unknown. */
  outlines(node, seen = new Set()) {
    if (componentRecord(keyOf(node), this.fontStyle)) return componentRecord(keyOf(node), this.fontStyle).o
    if (typeof node === 'string') {
      const r = this.rec(node)
      if (!this.excluded(node)) return r?.G ? r.G.p.length : 0
      if (r?.s && !seen.has(node)) {
        try { return this.outlines(this.parse(r.s), new Set([...seen, node])) } catch { /* unreadable */ }
      }
      return 0
    }
    const counts = node.slice(1).map(n => this.outlines(n, seen))
    return counts.every(Boolean) ? counts.reduce((a, b) => a + b, 0) : 0
  }

  /** Whether a sequence names a bare stroke among its operands. */
  stroked(node) {
    if (typeof node === 'string') { const p = node.codePointAt(0); return (p >= 0x31C0 && p <= 0x31EF) || this.outlines(node) === 1 }
    return node.slice(1).some(n => this.stroked(n))
  }

  place(part, target, native, origin) { return placed(part, part.box, fitted(part.box, target, this.C.STRETCH), native, origin) }

  // ---------------------------------------------------------------- the composer's entry
  /** The parts drawing `sequence`, weighted, and the loose `marks` its text carries after it. */
  compose(sequence, marks = '') {
    this.approximate.clear()
    this.nativeEnclosures.clear()
    let slots = 0
    const number = node => node === EMPTY ? `${EMPTY}${slots++}` : Array.isArray(node) ? [node[0], ...node.slice(1).map(number)] : node
    const tree = this.normalizeYan(number(this.cancelTransforms(this.parse(sequence))))
    const rendered = this.normalizeRequestedEnclosures(tree)
    // A mark that sits beside the drawing takes a margin: the character shrinks toward the opposite
    // corner, so the mark stands outside its strokes instead of over them.
    const frame = this.face.slice()
    let face = frame
    if (marks) {
      const outbound = [...marks].filter(isOutbound).join('')
      if (outbound) {
        const probe = markParts(this, outbound, frame, frame)
        if (probe.length) {
          const fitted = markFace(frame, union(probe.map(part => part.target)))
          if (fitted.scale < 1) face = fitted.face
        }
      }
    }
    const previous = this.face
    this.face = face
    try {
      const out = this.node(this.standaloneExpandedOverlay(rendered) ?? this.standalonePyramid(rendered) ?? this.standaloneRepeatedGrid(rendered) ?? this.normalizeRepeatedGrids(rendered), this.face.slice(), true)
      // Separated drawings retain reading order. Only publish ownership when every
      // rendered leaf produced exactly one piece (including empty placeholders).
      const ownership = this.separate ? this.leafOwners(tree) : null
      if (ownership?.split && ownership.owners.length === out.length && !out.some(p => p.cut)) {
        out.forEach((part, i) => { part.leaf = ownership.owners[i] })
      }
      if (!this.partial && this.weighted) this.balance(out)
      // Loose marks annotate the whole drawing; they take no part in its layout or weight.
      if (marks) out.push(...markParts(this, marks, frame, face))
      return out
    } finally { this.face = previous }
  }

  /**
   * Where each leaf of `sequence` goes before anything of it is drawn, from the layout alone: the
   * learned boxes where the composer would ask the network (reading whatever records are loaded, a
   * place's defaults for the rest), even shares of the axis elsewhere, and for an enclosure the
   * region and its `INSIDE`. Answers `{ index, box, empty }` per leaf in reading order, boxes in
   * font units, y up.
   */
  sketch(sequence) {
    const out = []
    const walk = (node, region, atRoot) => {
      const pyramid = this.pyramid(node)
      if (pyramid) {
        for (const box of pyramidCells(region, pyramid.layers)) out.push({ index: out.length, box, empty: false })
        return
      }
      const repeated = isGroupedForm(keyOf(node)) ? componentParts(keyOf(node), region, this.fontStyle, atRoot) : null
      if (repeated) {
        for (const part of repeated) out.push({ index: out.length, box: part.target, empty: false })
        return
      }
      if (!Array.isArray(node)) { out.push({ index: out.length, box: region, empty: node === EMPTY }); return }
      const grid = this.repeatedGrid(node)
      if (grid) {
        const start = out.length
        walk(grid.tree, region, atRoot)
        const leaves = out.splice(start)
        for (const i of grid.order) out.push({ ...leaves[i], index: out.length })
        return
      }
      const enclosure = this.splitEnclosure(node)
      if (enclosure) {
        const start = out.length
        walk(enclosure.tree, region, atRoot)
        const leaves = out.splice(start)
        const leafCount = n => Array.isArray(n) ? n.slice(1).reduce((sum, kid) => sum + leafCount(kid), 0) : 1
        const inner = leaves.splice(enclosure.innerIndex, leafCount(node[2]))
        if (leafCount(node[1]) === 1) out.push({ index: out.length, box: union(leaves.map(leaf => leaf.box)), empty: false })
        else {
          const order = this.repeatedGrid(node[1])?.order ?? leaves.map((_, i) => i)
          for (const i of order) out.push({ ...leaves[i], index: out.length })
        }
        for (const leaf of inner) out.push({ ...leaf, index: out.length })
        return
      }
      const op = node[0], kids = node.slice(1)
      if (kids.length === 2 && this.layout && (atRoot ? this.layout.ops.includes(op) : op === '⿰' || op === '⿱')) {
        let boxes = this.predict(op, kids.map(kid => this.normalizeRepeatedGrids(this.normalizeRequestedEnclosures(kid))))
        if (!atRoot) { const frame = union(boxes); boxes = boxes.map(b => mapped(b, frame, region)) }
        if (boxes.every(b => b[2] > b[0] && b[3] > b[1])) { kids.forEach((kid, i) => walk(kid, boxes[i], false)); return }
      }
      if (op in this.AXIS) {
        const axis = this.AXIS[op], lo = region[axis], span = (region[axis + 2] - lo) / kids.length
        kids.forEach((kid, i) => {
          const box = region.slice(), k = axis ? kids.length - 1 - i : i
          box[axis] = lo + k * span
          box[axis + 2] = lo + (k + 1) * span
          walk(kid, box, false)
        })
      } else if (this.INSIDE[op]) {
        walk(kids[0], region, false)
        const [x0, y0, x1, y1] = this.INSIDE[op], w = region[2] - region[0], h = region[3] - region[1]
        walk(kids[1], [region[0] + x0 * w, region[1] + y0 * h, region[0] + x1 * w, region[1] + y1 * h], false)
      } else if (op === MIRROR || op === ROTATE) {
        // About the region's centre, as `flipped` draws it: ⿾ mirrors each box, ⿿ turns it half round.
        const from = out.length
        walk(kids[0], region, atRoot)
        for (const leaf of out.slice(from)) {
          const [x0, y0, x1, y1] = leaf.box, turned = op === ROTATE
          leaf.box = [region[0] + region[2] - x1, turned ? region[1] + region[3] - y1 : y0, region[0] + region[2] - x0, turned ? region[1] + region[3] - y0 : y1]
        }
      } else kids.forEach(kid => walk(kid, region, false))
    }
    walk(this.normalizeYan(this.cancelTransforms(this.parse(sequence))), this.face.slice(), true)
    return out
  }

  /** An empty slot's placeholder: no ink, in the box its node gives it, with the slot's number. */
  placeholder(node, region) {
    return { ...placed(makePart([], region.slice()), region.slice(), region.slice(), 0, 'empty'), empty: Number(node.slice(1)) }
  }

  /** What an operand may be drawn as in `place`: itself, the character a sequence describes, then
   *  its positional forms there. */
  alternatives(node, place) {
    const out = [keyOf(node)]
    let ch = node
    if (typeof node !== 'string') {
      const e = this.bySequence(keyOf(node))
      if (!e) return out
      ch = e
      out.push(e)
    }
    for (const form of this.rec(ch)?.a?.[place] ?? []) if (!out.includes(form)) out.push(form)
    return out
  }

  /** The host pieces of `written` in `place`; with `uncut`, also the entries the export lists without
   *  a piece, which the composer weighs before finding it cannot cut them. */
  hostsOf(written, place, uncut = false) {
    if (written.includes(EMPTY)) return []
    const list = this.data.hosts(written, place)
    return uncut ? list : list.filter(h => this.cutOf(h))
  }

  /** What a host entry's cut is known by before its outlines are read: its box and its contour
   *  count; null for an entry the composer could not cut. An entry carries its piece's outlines
   *  (`p`), or the indices of the host glyph's contours it keeps (`k`). */
  cutOf(h) {
    // A cut only a parity drawing made, under its exclusion, is no cut for a sequence typed whole.
    if (h.pc && !this.exclude.size) return null
    if (h.p) return { box: h.b, count: h.p.length }
    if (h.k) return { box: h.b, count: h.k.length }
    return null
  }

  /** A host entry's piece: its own outlines, or the contours it keeps of its host's glyph, read from
   *  the host's record when the piece is chosen. */
  pieceOf(h) {
    let piece = h.p ? partOf(h) : h._piece
    if (!piece) {
      const glyph = this.glyph(h.h)
      if (!glyph) return makePart([], h.b.slice())
      piece = makePart(h.k.map(k => glyph.contours[k]), h.b.slice())
      Object.defineProperty(h, '_piece', { value: piece, enumerable: false })
    }
    // A piece cut along KanjiVG's groups, which a drawing using it credits.
    if (h.kv && !piece.kv) Object.defineProperty(piece, 'kv', { value: true, enumerable: false })
    return piece
  }

  /** A ranked host as the callers take it: the entry, and its piece read when first asked for. */
  chosen(h) {
    const self = this
    return { record: h, get piece() { return self.pieceOf(h) } }
  }

  node(node, region, atRoot = false) {
    if (isEmpty(node)) return [this.placeholder(node, region)]
    const pyramid = this.pyramid(node)
    if (pyramid) return pyramidCells(region, pyramid.layers).flatMap(box => this.node(pyramid.part, box))
    const native = this.enclosureParts(node, region)
    if (native) return native
    const key = keyOf(node), nativeSource = yanGlyphs.get(key) ?? yanSources.get(key)
    const repeated = (!nativeSource || !this.excluded(nativeSource)) && (!this.separate || isGroupedForm(key))
      ? componentParts(key, region, this.fontStyle, atRoot) : null
    if (repeated) return repeated
    const hasRepetition = containsComponentForm(keyOf(node))
    const C = this.C
    let encoded = typeof node === 'string' ? node : hasRepetition ? null : this.spelled.has(keyOf(node)) ? null : this.bySequence(keyOf(node))
    if (atRoot && typeof node !== 'string') {
      const redrawn = [...this.exclude].find(ch => this.sequenceOf(ch) === keyOf(node))
      if (redrawn) encoded = redrawn
    }
    if (this.separate && Array.isArray(node)) encoded = null
    if (encoded && !this.expanding.has(encoded) && (typeof node === 'string' || !this.excluded(encoded))) {
      const glyph = this.glyph(encoded)
      let tree = typeof node !== 'string' ? node : null
      if (!tree && this.sequenceOf(encoded) && !this.excluded(encoded)) {
        try { tree = this.parse(this.sequenceOf(encoded)) } catch (error) {
          if (!glyph) throw new LookupError(`${encoded} has no glyph, and its sequence is malformed.`)
        }
        if (typeof tree === 'string') tree = null
      }
      let squeezed = glyph !== null && stretchOf(glyph.box, region) > C.STRETCH
      if (tree && (this.stroked(tree) || this.atomic(encoded))) squeezed = false
      if (glyph && !(squeezed && tree)) return [this.place(glyph, region, this.ink(encoded), `glyph ${encoded}`)]
      if (!tree) throw new LookupError(`No glyph or sequence draws ${encoded}.`)
      this.expanding.add(encoded)
      try { return this.node(tree, region, atRoot) } catch (error) {
        if (!glyph || !(error instanceof LookupError)) throw error
        return [this.place(glyph, region, this.ink(encoded), `glyph ${encoded}`)]
      } finally { this.expanding.delete(encoded) }
    }
    if (typeof node === 'string') {
      const glyph = this.glyph(node)
      if (!glyph) throw new LookupError(`No glyph or sequence draws ${node}.`)
      return [this.place(glyph, region, this.ink(node), `glyph ${node}`)]
    }
    const found = this.separate || hasRepetition || isRepeatedRow(node) || this.spelled.has(keyOf(node)) ? null : this.instance(node, region)
    if (found) return [found]
    node = this.respelled(node)
    const op = node[0], children = node.slice(1)
    if (op === MIRROR || op === ROTATE) return this.flipped(op, children[0], region, atRoot)
    if (op === VARIANT) return this.node(children[0], region, atRoot)
    if (op === SUBTRACT) return this.subtracted(children, region, atRoot)
    if (!(op in this.AXIS) && !(op in this.ENCLOSE) && op !== '⿻') throw new LookupError(`${op} is not laid out.`)
    if (op === '⿻') return this.overlay(children, region)
    const yan = !this.separate && op === '⿸' && this.yanEnclosure(children, region)
    if (yan) return yan
    // Native compound forms have no trained layout features; fit their actual outlines.
    if (this.layout && (!hasRepetition || this.fontStyle === 'kaisho') && children.length === 2 && (atRoot ? this.layout.ops.includes(op) : op === '⿰' || op === '⿱')) {
      const learned = this.learned(op, children, atRoot ? null : region)
      if (learned) return learned
    }
    if (!this.separate && !hasRepetition && atRoot && op in this.AXIS) {
      const moved = this.transplant(op, children)
      if (moved) return moved
    }
    return this.shares(op, children, region)
  }

  /** Preserve the font's designed shape while retaining one adjustable piece per leaf. */
  enclosureParts(node, region) {
    const entry = ENCLOSURE_CUTS[keyOf(node)]
    // Expansion adapts a squeezed character to its region; do not replace it with that same glyph.
    if (!entry || this.expanding.size || this.excluded(entry[0])) return null
    const [char, cuts] = entry, record = this.glyphRecord(char)
    if (!record) return null
    const indices = cuts[hexOf(JSON.stringify(record.p))]
    if (!indices) return null
    this.nativeEnclosures.add(keyOf(node))
    const glyph = partOf(record), target = fitted(glyph.box, region, this.C.STRETCH)
    if (!this.separate) return [placed(glyph, glyph.box, target, this.ink(char), `glyph ${char}`)]
    return indices.map(group => {
      const part = makePart(group.map(i => glyph.contours[i]))
      return { ...placed(part, part.box, mapped(part.box, glyph.box, target), this.ink(char), `glyph ${char}`), balanceBox: glyph.box }
    })
  }

  /** Place an arbitrary inner operand in the room designed for these native enclosures. */
  yanStackedDays(outer, contents) {
    const source = yanSources.get(keyOf(outer))
    return !this.separate && this.fontStyle !== 'kaisho' && source && !this.excluded(source)
      && !this.excluded('昌') && !this.excluded('菖') && !this.excluded('儿') && !this.excluded('元')
      && Array.isArray(contents) && contents[0] === '⿱' && contents[1] === '儿'
      && ['昌', '⿱日日'].includes(keyOf(contents[2]))
  }

  yanEnclosure(children, region) {
    if (this.fontStyle === 'kaisho') return null
    const key = keyOf(children[0])
    if (!yanSources.has(key) || this.excluded(yanSources.get(key))) return null
    const outer = componentParts(key, region, this.fontStyle, true)
    const serif = this.fontStyle === 'serif', traditional = key !== '⿳亠丷厂'
    const contents = children[1]
    if (Array.isArray(contents) && contents[0] === '⿱' && contents[1] === '儿' && !this.excluded('儿') && !this.excluded('元')) {
      const top = serif ? (traditional ? 461 : 415) : (traditional ? 450 : 390)
      const baseBottom = traditional ? 210 : 180
      const stackedDays = this.yanStackedDays(children[0], contents)
      // A denser lower subtree needs more of the opening than a simple 丅.
      const ink = stackedDays ? YAN_STACK_INK : isEmpty(contents[2]) ? 0 : this.ink(contents[2])
      const extra = Math.max(0, Math.min(top - 120 - baseBottom, (Math.sqrt(ink / 3700) - 1) * 150))
      const bottom = baseBottom + extra
      const legs = componentPosition('儿:under-bar', mapped([250, bottom, 920, top + 2], componentConstants.face, region), this.fontStyle, top + 2 - bottom)
      if (legs) {
        const box = mapped(stackedDays ? [300, -59, 880, bottom - 25] : [240, -59, 940, bottom - 25], componentConstants.face, region)
        const days = stackedDays && componentPosition('昌:stack', box, this.fontStyle)
        const lower = days ? [days] : this.node(contents[2], box)
        // Strong vertical weight expansion closes the counters of compact,
        // dense lower components. Keep their native light-master detail.
        if (ink > 7400) for (const part of lower) part.weightLimit = [1, 0]
        return [...outer, legs, ...lower]
      }
    }
    // The traditional boxes follow 生 in Noto 產. The 产 enclosure's
    // lower crossbar leaves a shorter opening, so its top is lowered.
    const box = serif ? [198, -51, 954, traditional ? 445 : 330]
      : [227, -59, 944, traditional ? 431 : 335]
    const inner = this.node(children[1], mapped(box, componentConstants.face, region))
    // Fitting clears collisions, but must not enlarge the already calibrated
    // inner drawing to fill every available pixel of the opening.
    this.fit(outer, inner, region, this.stem0[0][0], this.C, { room: union(inner.map(p => p.target)), size: 128 })
    return [...outer, ...inner]
  }

  leafOwners(tree) {
    let index = 0, split = false, valid = true
    const walk = node => {
      if (!Array.isArray(node)) return [index++]
      const pyramid = this.pyramid(node)
      if (pyramid) {
        split = true
        return node.slice(1).flatMap(walk)
      }
      const grid = this.repeatedGrid(node)
      if (grid) {
        split = true
        const owners = node.slice(1).flatMap(walk)
        return grid.order.map(i => owners[i])
      }
      const enclosure = this.splitEnclosure(node)
      if (enclosure) {
        split = true
        const outer = walk(node[1]), inner = walk(node[2])
        const count = n => Array.isArray(n) ? n.slice(1).reduce((sum, child) => sum + count(child), 0) : 1
        const sourceInner = count(node[2])
        const outside = outer.length === 1 ? Array(count(enclosure.tree) - sourceInner).fill(outer[0]) : outer
        return [...outside.slice(0, enclosure.innerIndex), ...inner, ...outside.slice(enclosure.innerIndex)]
      }
      // Other rewrites can merge or introduce leaves; leave their grouping to geometry.
      if (this.respelled(node) !== node) valid = false
      return node.slice(1).flatMap(walk)
    }
    const owners = walk(tree)
    return valid ? { owners, split } : null
  }

  /** Two identical reflections or half-turns restore the subtree, before lookup and layout. */
  cancelTransforms(node) {
    if (!Array.isArray(node)) return node
    const kids = node.slice(1).map(child => this.cancelTransforms(child))
    if ((node[0] === MIRROR || node[0] === ROTATE) && Array.isArray(kids[0]) && kids[0][0] === node[0]) return kids[0][1]
    return [node[0], ...kids]
  }

  /** The same yan enclosure can put its contents inside 厂 before grouping the upper strokes. */
  normalizeYan(node) {
    if (!Array.isArray(node)) return node
    const op = node[0], kids = node.slice(1).map(child => this.normalizeYan(child))
    const tail = kids.at(-1)
    if (Array.isArray(tail) && tail.length === 3 && tail[0] === '⿸' && tail[1] === '厂') {
      if (op === '⿳' && kids.length === 3 && kids[0] === '亠' && (kids[1] === '㐅' || kids[1] === '丷'))
        return ['⿸', ['⿳', kids[0], kids[1], '厂'], tail[2]]
      if (op === '⿱' && kids.length === 2 && kids[0] === '文')
        return ['⿸', ['⿱', '文', '厂'], tail[2]]
    }
    return [op, ...kids]
  }

  /** Whole-character lookup for attested expanded overlays; nested editing keeps its leaves. */
  standaloneExpandedOverlay(node) {
    const equivalents = {"⿻大⿰人人": "夾", "⿻工⿰人人": "巫", "⿻⿰人人土": "坐"}
    const char = equivalents[keyOf(node)]
    return char && !this.excluded(char) && this.glyph(char) ? char : null
  }

  /** Whole-character lookup for attested expanded pyramid-glyphs; nested editing keeps its leaves. */
  standalonePyramid(node) {
    const char = pyramidGlyphs.get(keyOf(node))
    return char && !this.excluded(char) && this.glyph(char) ? char : null
  }

  /** A complete attested grid uses its designed glyph, including separated previews. */
  standaloneRepeatedGrid(node) {
    for (const [part, char] of Object.entries({ 口: '㗊', 火: '燚', 又: '叕', 水: '㵘', 屮: '茻' })) {
      if ([`⿰⿱${part}${part}⿱${part}${part}`, `⿱⿰${part}${part}⿰${part}${part}`].includes(keyOf(node))
        && !this.excluded(char) && this.glyph(char)) return char
    }
    return null
  }

  /** Canonicalize attested grids before lookup; preserve the editor's tree and leaf order. */
  normalizeRepeatedGrids(node) {
    if (!Array.isArray(node)) return node
    const grid = this.repeatedGrid(node)
    return grid ? grid.tree : [node[0], ...node.slice(1).map(child => this.normalizeRepeatedGrids(child))]
  }

  repeatedGrid(node) {
    for (const part of ['口', '火', '又', '水', '屮']) {
      if (keyOf(node) === `⿰⿱${part}${part}⿱${part}${part}`)
        return { tree: ['⿱', ['⿰', part, part], ['⿰', part, part]], order: [0, 2, 1, 3] }
    }
    return null
  }

  /** These host aliases use their expanded form for glyph lookup and parent layout features. */
  requestedEnclosure(node) {
    if (!Array.isArray(node) || node.length !== 3) return null
    const [op, outer, inner] = node
    if (op === '⿹' && (outer === '須' || keyOf(outer) === '⿰彡頁')) return { tree: ['⿰', ['⿱', '彡', inner], '頁'], innerIndex: 1 }
    if (op === '⿸' && (outer === '攸' || keyOf(outer) === '⿲亻丨攵')) return { tree: ['⿲', '亻', '丨', ['⿱', '攵', inner]], innerIndex: 3 }
    if (op === '⿸' && (outer === '𪧇' || keyOf(outer) === '⿱宀爿')) return { tree: ['⿱', '宀', ['⿰', '爿', inner]], innerIndex: 2 }
    if (op === '⿸' && (outer === '朕' || keyOf(outer) === '⿰月关')) return { tree: ['⿰', '月', ['⿱', '关', inner]], innerIndex: 2 }
    return null
  }

  /** Normalize the rendering tree only; the source tree still owns editable leaf indices. */
  normalizeRequestedEnclosures(node) {
    if (!Array.isArray(node)) return node
    const rewritten = this.requestedEnclosure(node)
    const tree = rewritten?.tree ?? node
    return [tree[0], ...tree.slice(1).map(child => this.normalizeRequestedEnclosures(child))]
  }

  /** Layout and first inner leaf for two-part descriptions with a disconnected outer part. */
  splitEnclosure(node) {
    if (!Array.isArray(node) || node.length !== 3) return null
    const [op, outer, inner] = node
    // Match explicit hosts without merging the original editable leaves.
    const requested = this.requestedEnclosure(node)
    if (requested) return requested
    if (op === '⿵' && keyOf(outer) === '⿲彳⿱山一攵') return { tree: ['⿲', '彳', ['⿱', ['⿱', '山', '一'], inner], '攵'], innerIndex: 3 }
    if (op === '⿴' && keyOf(outer) === '⿰彳亍') return { tree: ['⿲', '彳', inner, '亍'], innerIndex: 1 }
    if (op === '⿴' && keyOf(outer) === '⿰弓弓') return { tree: ['⿲', '弓', inner, '弓'], innerIndex: 1 }
    if (op === '⿴' && keyOf(outer) === '⿰𤣩王') return { tree: ['⿲', '𤣩', inner, '王'], innerIndex: 1 }
    if (op === '⿴' && keyOf(outer) === '⿰辛辛') return { tree: ['⿲', '辛', inner, '辛'], innerIndex: 1 }
    if (op === '⿴' && keyOf(outer) === '⿰隹隹') return { tree: ['⿲', '隹', inner, '隹'], innerIndex: 1 }
    if (op === '⿴' && keyOf(outer) === '⿱亠𧘇') return { tree: ['⿳', '亠', inner, '𧘇'], innerIndex: 1 }
    if (op === '⿸' && keyOf(outer) === '⿰方𠂉') return { tree: ['⿰', '方', ['⿱', '𠂉', inner]], innerIndex: 2 }
    if (op === '⿹' && keyOf(outer) === '⿰匕頁') return { tree: ['⿰', ['⿱', '匕', inner], '頁'], innerIndex: 1 }
    if (op === '⿸' && keyOf(outer) === '⿰𠦝𠆢') return { tree: ['⿰', '𠦝', ['⿱', '𠆢', inner]], innerIndex: 2 }
    if (op === '⿶' && keyOf(outer) === '⿱⿰弓弓鬲') return { tree: ['⿱', ['⿲', '弓', inner, '弓'], '鬲'], innerIndex: 1 }
    if (op === '⿹' && keyOf(outer) === '⿰⿳士冖一殳') return { tree: ['⿰', ['⿱', ['⿳', '士', '冖', '一'], inner], '殳'], innerIndex: 3 }
    if (op === '⿴' && (outer === '林' || keyOf(outer) === '⿰木木')) return { tree: ['⿲', '木', inner, '木'], innerIndex: 1 }
    const sides = { 行: ['彳', '亍'], 弜: ['弓', '弓'], 玨: ['𤣩', '王'], 辡: ['辛', '辛'], 雔: ['隹', '隹'] }
    if (op === '⿴' && Object.hasOwn(sides, outer)) return { tree: ['⿲', sides[outer][0], inner, sides[outer][1]], innerIndex: 1 }
    if (op === '⿴' && outer === '衣') return { tree: ['⿳', '亠', inner, '𧘇'], innerIndex: 1 }
    if (op === '⿸' && outer === '𭤨') return { tree: ['⿰', '方', ['⿱', '𠂉', inner]], innerIndex: 2 }
    if (op === '⿴' && (outer === '𨺅' || keyOf(outer) === '⿰𨸏⿾𨸏')) return { tree: ['⿲', '𨸏', inner, ['⿾', '𨸏']], innerIndex: 1 }
    if (op === '⿹' && outer === '頃') return { tree: ['⿰', ['⿱', '匕', inner], '頁'], innerIndex: 1 }
    if (op === '⿴' && ['⿰⿱口口⿱口口', '⿱⿰口口⿰口口'].includes(keyOf(outer))) {
      return { tree: ['⿳', ['⿰', '口', '口'], inner, ['⿰', '口', '口']], innerIndex: 2 }
    }
    if (op === '⿴' && outer === '㗊') return { tree: ['⿳', '吅', inner, '吅'], innerIndex: 1 }
    if (op === '⿸' && outer === '倝') return { tree: ['⿰', '𠦝', ['⿱', '𠆢', inner]], innerIndex: 2 }
    if (op === '⿶' && outer === '𩰲') return { tree: ['⿱', ['⿲', '弓', inner, '弓'], '鬲'], innerIndex: 1 }
    if (op === '⿹' && outer === '𣪊') return { tree: ['⿰', ['⿱', ['⿳', '士', '冖', '一'], inner], '殳'], innerIndex: 3 }
    return null
  }

  /** Rendering rewrites for split enclosures and compound corners (原 in 愿). */
  respelled(node) {
    const grid = this.repeatedGrid(node)
    if (grid) return grid.tree
    const enclosure = this.splitEnclosure(node)
    if (enclosure) return enclosure.tree
    if (node[0] !== '⿸' || node.length !== 3 || typeof node[1] !== 'string') return node
    let outer
    try { outer = this.parse(this.sequenceOf(node[1]) ?? '') } catch { return node }
    if (Array.isArray(outer) && outer[0] === '⿸' && outer.length === 3
      && !(typeof outer[1] === 'string' && (this.sequenceOf(outer[1]) ?? '').startsWith('⿸'))) return ['⿸', outer[1], ['⿱', outer[2], node[2]]]
    return node
  }

  // ---------------------------------------------------------------- hosts
  /** The drawn part closest to what `node` needs at `index` of `op` inside `box`, as [record, piece]. */
  host(op, index, node, siblings, box, isPlaced = false) {
    if (containsComponentForm(keyOf(node))) return null
    // A cut of an entire repeated row can include strokes belonging to its host.
    // Draw the row from its own glyph or its operands instead.
    if (isRepeatedRow(node)) return null
    // A separated drawing gives each leaf its own piece, so a host for a whole operand sequence is
    // not used; the sequence is drawn through `node` instead.
    if (this.separate && Array.isArray(node)) return null
    const ranked = this.ranked(op, index, node, siblings, box, isPlaced)
    return ranked.length ? ranked[0][1] : null
  }

  ranked(op, index, node, siblings, box, isPlaced = false) {
    const C = this.C, place = this.slot(op, index)
    const want = siblings.reduce((s, n) => s + this.ink(n), 0)
    const aspect = (box[2] - box[0]) / Math.max(box[3] - box[1], 1)
    const siblingKeys = siblings.map(keyOf)
    let hand = null
    if (node === '𠂇') {
      const drawn = [op, ...siblings.slice(0, index), node, ...siblings.slice(index)]
      const ch = this.bySequence(keyOf(drawn)) ?? ''
      hand = ch && !this.excluded(ch) ? this.rec(ch)?.hand ?? null : null
      // The hand forms are read from KanjiVG's stroke types.
      if (hand !== null) this.handForms = true
    }
    const weighed = (candidates, written, facing = false) => {
      const scored = []
      for (const [h, alien] of candidates) {
        if (this.excluded(h.h)) continue
        if (hand !== null) {
          // The hand an entry's node writes (`hd`).
          if (h.hd !== hand) continue
        }
        let exact = h.op === op && h.ok.length === siblingKeys.length && h.ok.every((k, j) => k === siblingKeys[j])
        exact = exact && h.j === 1
        const ratio = Math.abs(Math.log(Math.max(h.si, 1) / Math.max(want, 1)))
        scored.push([!exact, alien, ratio, h.d, h])
      }
      const cmp4 = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]) || (a[3] - b[3])
      const ordered = scored.slice().sort(cmp4)
      const limit = isPlaced ? 32 : 16
      const mine = ordered.filter(r => r[4].v === 1).slice(0, limit), foreign = ordered.filter(r => r[4].v !== 1).slice(0, limit)
      const found = []
      for (const [notExact, alien, ratio, depth, h] of [...mine, ...foreign].sort(cmp4)) {
        // An entry the composer could not cut takes its place among those weighed, and is passed over.
        const cut = this.cutOf(h)
        if (!cut) continue
        if (alien && cut.count !== this.outlines(node)) continue
        const b = cut.box
        const shape = Math.abs(Math.log(((b[2] - b[0]) / Math.max(b[3] - b[1], 1)) / aspect))
        const size = Math.abs(Math.log(Math.max(b[2] - b[0], 1) * Math.max(b[3] - b[1], 1) / Math.max((box[2] - box[0]) * (box[3] - box[1]), 1)))
        let near = 0
        if (isPlaced) near = h.wh && !facing ? [0, 1, 2, 3].reduce((s, k) => s + Math.abs(b[k] - box[k]), 0) / 4 / C.PLACED_UNITS : C.PLACED_NESTED
        found.push([notExact, ratio + shape + 0.5 * size + 0.1 * depth + near + C.KIN_COST * alien
          + C.FOREIGN_COST * (h.v !== 1) + C.UNJAPANESE_COST * (h.j !== 1), h])
      }
      return found
    }
    for (const written of this.alternatives(node, place)) {
      const kin = C.KIN_PLACES[place]
      let candidates = this.hostsOf(written, place, true).map(h => [h, false])
      if (kin) candidates = candidates.concat(upTo(this.hostsOf(written, kin, true), C.KIN_HOSTS).map(h => [h, true]))
      let found = weighed(candidates, written)
      const facing = C.FACING_PLACES[place]
      if (facing && found.length && !found.some(r => r[2].v === 1)) {
        found = found.concat(weighed(this.hostsOf(written, facing, true).filter(h => h.v === 1).slice(0, C.KIN_HOSTS).map(h => [h, true]), written, true))
        const local = found.filter(r => r[2].v === 1 && r[2].j === 1)
        if (local.length) found = local
      }
      if (op in this.ENCLOSE && typeof node === 'string' && this.own(node) && found.length && !found.some(r => r[2].v === 1)) return []
      if (found.length) {
        found.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]))
        return this.nativeShapes(found.map(r => [r[1], this.chosen(r[2])]))
      }
    }
    return []
  }

  /** A fallback cut with a detached bar the native cuts lack is left out (`_native_shapes`). */
  nativeShapes(ranked) {
    if (this.partial) return ranked
    const own = ranked.filter(r => r[1].record.v === 1)
    if (!own.length || own.length === ranked.length) return ranked
    const references = own.map(r => { const m = square(r[1].piece, 64); return [m, grown(m, 64, 2)] })
    return ranked.filter(row => {
      if (row[1].record.v === 1) return true
      const piece = row[1].piece, mask = square(piece, 64), g = grown(mask, 64, 2)
      const total = count(mask)
      const agrees = references.some(([reference, expanded]) => {
        let extra = 0, missing = 0
        for (let i = 0; i < mask.length; i++) { extra += mask[i] & (1 - expanded[i]); missing += reference[i] & (1 - g[i]) }
        return extra <= this.C.TYPICAL_EXTRA * total && missing <= this.C.TYPICAL_GLYPH * count(reference)
      })
      return agrees || !extraBar(piece, mask, references.map(r => r[1]))
    })
  }

  // ---------------------------------------------------------------- learned layout
  predict(op, children) {
    const keys = children.map(keyOf)
    return forward(this.layout, features(this.layout, op, keys.map(k => this.rec(k)), [this.slot(op, 0), this.slot(op, 1)]))
  }

  learned(op, children, region) {
    const C = this.C, stem = this.stem0[0][0], frameOf = region ?? this.face
    let boxes = this.predict(op, children)
    if (region) { const frame = union(boxes); boxes = boxes.map(b => mapped(b, frame, region)) }
    if (op in this.ENCLOSE && !region && area(boxes[0]) < C.ENCLOSING_LEAST * area(this.face)) boxes[0] = this.face.slice()
    if (C.COVERING.includes(op)) boxes[0] = union(boxes)
    if (boxes.some(b => b[2] <= b[0] || b[3] <= b[1])) return null
    const groups = []
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      let box = boxes[i]
      let part = this.host(op, i, child, [...children.slice(0, i), ...children.slice(i + 1)], box, region === null)
      if (part && op in this.ENCLOSE && i === 0 && typeof child === 'string' && this.own(child)
        && stretchOf(part.piece.box, box) > C.ENCLOSING_STRETCH) part = null
      if (!part) {
        if (op in this.ENCLOSE && i === 1) {
          groups.push(this.node(child, box))
          const opening = this.room(op, groups[0], frameOf)
          const limit = !opening || area(opening) <= area(box) ? box : opening
          this.fit(groups[0], groups[1], frameOf, stem, C, { room: limit })
        } else groups.push(this.node(child, box))
        continue
      }
      let { record: drawn, piece: source } = part
      if (op === '⿺' && i === 1 && groups[0].length === 1 && groups[0][0].origin.startsWith('glyph')) {
        const swept = sweptPart(groups[0][0], box[0] - C.FACING[0], C)
        if (swept) {
          groups[0] = swept
          const opening = this.room(op, groups[0], frameOf)
          if (opening) box = [opening[0], opening[1], Math.min(opening[2], box[2]), Math.min(opening[3], box[3])]
        } else return this.node(['⿰', ...children], frameOf)
      }
      if (op in this.ENCLOSE && i === 1 && groups[0].every(p => p.origin.startsWith('glyph'))) {
        groups.push([placed(source, source.box, fitted(source.box, box, C.STRETCH), this.ink(drawn.h), `learned ${drawn.h}`)])
        this.fit(groups[0], groups[1], frameOf, stem, C, { room: box })
        continue
      }
      if (op in this.ENCLOSE && i === 1) {
        let room = this.room(op, groups[0], frameOf)
        room = room && shrunk(room, C.OPENING_SHARE)
        if (room && (within(box, room) < C.ROOM_TRUST || stretchOf(source.box, box) > C.STRETCH)) {
          const other = this.host(op, i, child, children.slice(0, 1), room)
          if (other) ({ record: drawn, piece: source } = other)
          let anchor = null
          if (stretchOf(source.box, room) > C.STRETCH) {
            groups.push(this.node(child, room))
            anchor = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2]
          } else groups.push([this.place(source, room, this.ink(drawn.h), `learned ${drawn.h}`)])
          this.fit(groups[0], groups[1], frameOf, stem, C, { room, anchor })
          continue
        }
      }
      if (!region && op in this.AXIS && drawn.wh) {
        const s = stretchOf(source.box, box)
        if (!(C.HOST_SNAP < s && s <= C.HOST_EXTENT)) {
          const across = 1 - this.AXIS[op]
          box = [0, 1, 2, 3].map(k => k % 2 === across ? source.box[k] : box[k])
        }
      }
      if (op in this.AXIS && stretchOf(source.box, box) > C.STRETCH) return null
      groups.push([placed(source, source.box, box, this.ink(drawn.h), `learned ${drawn.h}`)])
      if (op === '⿸' && Array.isArray(children[0]) && i === 1 && this.collide(groups[0], groups[1], frameOf, 256) > C.COLLIDE)
        this.fit(groups[0], groups[1], frameOf, stem, C, { size: 256, room: box })
      if (C.CLEARED.includes(op) && i === 1 && this.collide(groups[0], groups[1], frameOf, 64) > C.COLLIDE) {
        const opening = this.room(op, groups[0], frameOf)
        const limit = !opening || area(opening) <= area(box) ? box : shrunk(opening, C.OPENING_SHARE)
        this.fit(groups[0], groups[1], frameOf, stem, C, { room: limit })
      }
    }
    if (op in this.AXIS) this.space(this.AXIS[op], groups)
    return groups.flat()
  }

  /** A whole character's operands each taken unscaled from where a designer put them (`_transplant`). */
  transplant(op, children) {
    const C = this.C, axis = this.AXIS[op], options = []
    for (let i = 0; i < children.length; i++) {
      const siblings = [...children.slice(0, i), ...children.slice(i + 1)]
      const want = siblings.reduce((s, n) => s + this.ink(n), 0)
      const found = []
      for (const written of this.alternatives(children[i], this.slot(op, i)))
        for (const h of upTo(this.hostsOf(written, this.slot(op, i)), C.TRANSPLANT_HOSTS)) {
          if (h.d || this.excluded(h.h) || h.op !== op || h.ok.length !== children.length - 1) continue
          found.push([Math.abs(Math.log(Math.max(h.si, 1) / Math.max(want, 1))), h])
        }
      found.sort((a, b) => a[0] - b[0])
      const pieces = found.slice(0, C.TRANSPLANT_CANDIDATES).map(([ratio, h]) => [ratio, h, this.cutOf(h), h.g])
      if (!pieces.length) return null
      options.push(pieces)
    }
    const misfit = (a, b) => {
      const gap = axis === 0 ? b[2].box[0] - a[2].box[2] : a[2].box[1] - b[2].box[3]
      return Math.abs(gap - (a[3] + b[3]) / 2) + 40 * (a[0] + b[0])
    }
    let best = options[0].map(p => [0, [p]])
    for (const row of options.slice(1)) {
      best = row.map(p => best.map(([cost, chain]) => [cost + misfit(chain.at(-1), p), [...chain, p]])
        .reduce((a, b) => b[0] < a[0] ? b : a))
    }
    const [cost, chain] = best.reduce((a, b) => b[0] < a[0] ? b : a)
    if (cost > C.TRANSPLANT_TOLERANCE * (children.length - 1)) return null
    return chain.map(([, h]) => { const piece = this.pieceOf(h); return placed(piece, piece.box, piece.box.slice(), this.ink(h.h), `transplant ${h.h}`) })
  }

  // ---------------------------------------------------------------- no layout to follow
  /** Operands sharing the region along an aligned operator by `SHARES`; an enclosed one in the room its
   *  enclosing part leaves. */
  shares(op, children, region) {
    const C = this.C
    if (op in this.ENCLOSE) {
      const outer = this.node(children[0], region)
      let room = this.room(op, outer, region)
      const fallback = !room
      if (!room) {
        const [x0, y0, x1, y1] = this.INSIDE[op], w = region[2] - region[0], h = region[3] - region[1]
        room = [region[0] + x0 * w, region[1] + y0 * h, region[0] + x1 * w, region[1] + y1 * h]
      }
      const inner = this.node(children[1], room)
      this.fit(outer, inner, region, this.stem0[0][0], C,
        fallback && op === '⿽' ? { room, bounds: room } : undefined)
      return [...outer, ...inner]
    }
    const axis = this.AXIS[op]
    const [power, middle] = C.SHARES[`${op},${children.length}`] ?? [0.5, 1.0]
    const other = children[1]
    const compactYan = op === '⿰' && children[0] === '朱' && Array.isArray(other) && other[0] === '⿸'
      && yanSources.has(keyOf(other[1])) && !this.separate && this.fontStyle !== 'kaisho'
      && !this.excluded('朱') && !this.excluded('鴸') && !this.excluded(yanSources.get(keyOf(other[1])))
    const weights = children.map((child, k) => this.ink(child) ** power * (k > 0 && k < children.length - 1 ? middle : 1))
    const gap = compactYan ? 0.01 : 0.04, fit = (1 - gap * (children.length - 1)) / weights.reduce((a, b) => a + b, 0)
    const lo = region[axis], span = region[axis + 2] - region[axis]
    const groups = []
    let yanBox = null
    let at = 0
    children.forEach((child, i) => {
      let a = at, b = at + weights[i] * fit
      at = b + gap
      if (axis === 1) [a, b] = [1 - b, 1 - a]
      const box = region.slice()
      box[axis] = lo + a * span
      box[axis + 2] = lo + b * span
      // The sloping right edge of 朱 leaves space for the enclosure's curved
      // left stroke; a gap between their bounding boxes exaggerates it.
      if (compactYan && i === 1) { box[0] -= span * 0.045; yanBox = box.slice() }
      // 鴸 supplies a full-height left 朱 even in exports without a usable host cut.
      if (compactYan && i === 0) {
        const native = componentPositionBox('朱:L', this.fontStyle)
        if (native) {
          const vertical = mapped(native, componentConstants.face, region)
          groups.push([componentPosition('朱:L', [box[0], vertical[1], box[2], vertical[3]], this.fontStyle)])
          return
        }
      }
      const part = this.host(op, i, child, [...children.slice(0, i), ...children.slice(i + 1)], box)
      if (part) groups.push([placed(part.piece, part.piece.box, fitted(part.piece.box, box, C.STRETCH), this.ink(part.record.h), `host ${part.record.h}`)])
      else groups.push(this.row(child, box, children.length))
    })
    if (compactYan && !this.partial) {
      // Restore just enough room when a whole-glyph outline protrudes toward 朱.
      const size = 512, mask = grown(fill(groupRings(groups[0]), size, region), size, 1)
      const original = groups[1].map(part => part.target.slice())
      for (let step = 0; step <= 9; step++) {
        const frame = yanBox.slice()
        frame[0] += span * 0.005 * step
        groups[1].forEach((part, i) => { part.target = mapped(original[i], yanBox, frame) })
        const right = fill(groupRings(groups[1].filter(part => !part.cut)), size, region)
        if (!right.some((value, i) => value && mask[i])) break
      }
    } else if (!compactYan) this.space(axis, groups)
    return groups.flat()
  }

  /** `child` drawn into `box` as one of `count` aligned operands; a whole glyph in a row of three may
   *  change its proportions up to `ROW_STRETCH`. */
  row(child, box, n) {
    const group = this.node(child, box)
    if (n === 3 && group.length === 1 && group[0].origin.startsWith('glyph ')) group[0].target = fitted(group[0].source, box, this.C.ROW_STRETCH)
    else if (n === 3 && group.length > 1 && group[0].balanceBox && group.every(p => p.balanceBox === group[0].balanceBox)) {
      const frame = group[0].balanceBox, target = fitted(frame, box, this.C.ROW_STRETCH)
      for (const part of group) part.target = mapped(part.source, frame, target)
    }
    return group
  }

  /** A sequence drawn whole somewhere in the font, in any place but the left or the top (`_instance`). */
  instance(node, region) {
    const C = this.C, k = keyOf(node)
    if (k.includes(EMPTY)) return null
    const names = [k, ...(this.bySequence(k) ? [this.bySequence(k)] : [])]
    if (names.some(n => this.excluded(n)) && !this.stroked(node)) return null
    let best = null
    const need = this.outlines(node), stroked = this.stroked(node)
    for (const name of names) {
      for (const place of this.data.places(name)) {
        if (C.SIDED_PLACES.includes(place)) continue
        for (const h of upTo(this.hostsOf(name, place), C.INSTANCE_HOSTS)) {
          if (this.excluded(h.h)) continue
          const cut = this.cutOf(h)
          if (stroked && cut.count !== need) continue
          if (cut.count < C.INSTANCE_KEPT * need) continue
          const s = stretchOf(cut.box, region)
          if (s <= C.STRETCH && (!best || s < best[0])) best = [s, h]
        }
      }
    }
    if (!best) return null
    const piece = this.pieceOf(best[1])
    return placed(piece, piece.box, region.slice(), this.ink(best[1].h), `instance ${best[1].h}`)
  }

  // ---------------------------------------------------------------- overlays
  /** Operands drawn across each other (⿻), where characters overlaying like operands put them. */
  overlay(children, region) {
    const C = this.C, keys = children.map(keyOf)
    // Teachers: overlays the export holds both pieces of, sharing an operand.
    const teachers = []
    for (const index of [0, 1]) {
      for (const h of upTo(this.hostsOf(keys[index], `⿻${index}`), C.OVERLAY_HOSTS)) {
        if (this.excluded(h.h) || h.op !== '⿻' || h.ok.length !== 1) continue
        const other = this.hostsOf(h.ok[0], `⿻${1 - index}`).find(o => o.h === h.h && o.d === h.d && o.op === '⿻')
        if (!other) continue
        const written = index === 0 ? [keys[0], h.ok[0]] : [h.ok[0], keys[1]]
        const pieces = index === 0 ? [h, other] : [other, h]
        teachers.push({ ch: h.h, pieces, written, frame: h.fr })
      }
    }
    const usable = teachers.filter(t => keys.every((k, j) => t.written[j] === k
      || (1 / C.OVERLAY_INK <= this.ink(k) / Math.max(this.ink(t.written[j]), 1) && this.ink(k) / Math.max(this.ink(t.written[j]), 1) <= C.OVERLAY_INK)))
    if (!usable.length && children.length === 2) {
      const outer = this.node(children[0], region)
      const rooms = { '⿶': this.room('⿶', outer, region), '⿵': this.room('⿵', outer, region) }
      const share = Object.fromEntries(Object.entries(rooms).map(([op, r]) => [op, r ? area(r) / area(region) : 0]))
      for (const [op, other] of [['⿶', '⿵'], ['⿵', '⿶']]) {
        if (share[op] >= C.OPEN_ROOM && share[op] >= C.OPEN_ONE_SIDE * share[other]) {
          const cells = this.cells(op, outer, region, children[1])
          if (cells) return [...outer, ...cells]
          if (this.layout?.ops.includes(op)) {
            const boxes = this.predict(op, children), frame = union(boxes)
            return children.flatMap((child, j) => this.node(child, mapped(boxes[j], frame, region)))
          }
          return this.node([op, ...children], region)
        }
      }
      return this.node(['⿱', ...children], region)
    }
    if (!usable.length) {
      return children.flatMap(child => {
        const glyph = typeof child === 'string' ? this.glyph(child) : null
        return this.node(child, glyph ? mapped(glyph.box, EM_BOX, region) : region)
      })
    }
    const chosen = usable.sort((a, b) => keys.filter((k, j) => k === b.written[j]).length - keys.filter((k, j) => k === a.written[j]).length).slice(0, C.TEACHERS_OVERLAY)
    const shares = [0, 1].map(j => [0, 1, 2, 3].map(k => chosen.reduce((s, t) => {
      const b = t.pieces[j].b, f = t.frame, w = Math.max(f[2] - f[0], 1), h = Math.max(f[3] - f[1], 1)
      return s + [(b[0] - f[0]) / w, (b[1] - f[1]) / h, (b[2] - f[0]) / w, (b[3] - f[1]) / h][k]
    }, 0) / chosen.length))
    return children.flatMap((child, j) => {
      const box = mapped(shares[j], [0, 0, 1, 1], region)
      const donor = chosen.find(t => t.written[j] === keys[j])
      // A separated drawing unfolds a sequence operand rather than taking a teacher's piece for it.
      if (donor && !containsComponentForm(keyOf(child)) && !(this.separate && Array.isArray(child))) {
        const piece = this.pieceOf(donor.pieces[j])
        return [placed(piece, piece.box, box, this.ink(donor.ch), `overlay ${donor.ch}`)]
      }
      return this.node(child, box)
    })
  }

  /** A side-by-side pair in the two cells a stroke down the middle of an opening makes (山's in 幽). */
  cells(op, outer, region, inner) {
    if (isComponentForm(keyOf(inner))) return null
    const C = this.C
    let tree = Array.isArray(inner) ? inner : null
    if (!tree && this.sequenceOf(inner)) { try { tree = this.parse(this.sequenceOf(inner)) } catch { tree = null } }
    if (!Array.isArray(tree) || tree[0] !== '⿰' || tree.length !== 3) return null
    const middle = (region[0] + region[2]) / 2
    const halves = [[region[0], region[1], middle, region[3]], [middle, region[1], region[2], region[3]]]
    const rooms = halves.map(half => this.room(op, outer, half))
    if (rooms.some(r => !r || area(r) < C.CELL_ROOM * area(region))) return null
    const grow = C.ROOM_MARGIN * this.stem0[0][0]
    return tree.slice(1).flatMap((child, i) => {
      const room = [rooms[i][0] - grow, rooms[i][1], rooms[i][2] + grow, rooms[i][3]]
      const found = this.host('⿰', i, child, [tree[2 - i]], room)
      if (!found) return this.node(child, room)
      return [placed(found.piece, found.piece.box, fitted(found.piece.box, room, C.CELL_STRETCH), this.ink(found.record.h), `host ${found.record.h}`)]
    })
  }

  // ---------------------------------------------------------------- operators beyond the composer
  /** ⿾ its operand mirrored left to right, ⿿ turned half round, about the region's centre. */
  flipped(op, child, region, atRoot) {
    this.approximate.add(op)
    const out = this.node(child, region, atRoot)
    const about = [(region[0] + region[2]) / 2, (region[1] + region[3]) / 2]
    for (const p of out) p.flips = [...p.flips ?? [], { x: true, y: op === ROTATE, about }]
    return out
  }

  /** ㇯ the second operand drawn where it lies in the first, as a cut taken out of it. */
  subtracted(children, region, atRoot) {
    const out = this.node(children[0], region, atRoot)
    const cut = this.node(children[1], region)
    for (const p of cut) p.cut = true
    return [...out, ...cut]
  }

  // ---------------------------------------------------------------- fitting
  // While a drawing meets data not loaded yet it is drawn again once that has loaded, so until then the
  // mask-based fitting is skipped: the pass only has to find out what else the drawing needs.
  get partial() { return (this.data.missing?.size ?? 0) > 0 }
  fit(outer, inner, region, stem, C, options) { return this.partial ? false : fitInside(outer, inner, region, stem, C, options) }
  collide(outer, inner, region, size) { return this.partial ? 0 : collision(outer, inner, region, size) }

  /** The largest empty box inside `region` the placed enclosing part closes on its closed sides,
   *  `ROOM_MARGIN` stroke widths clear of its ink (`_room`). */
  room(op, outer, region, size = 48) {
    if (this.partial) return null
    const C = this.C
    const ink = fill(groupRings(outer), size, region)
    const margin = Math.max(1, pyRound(C.ROOM_MARGIN * this.stem0[0][0] / ((region[2] - region[0]) / size)))
    const blocked = grown(ink, size, margin)
    // Each closed side must have ink between the room and the region's edge: prefix counts make
    // that a lookup.
    const pre = new Int32Array((size + 1) * (size + 1))
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++)
      pre[(r + 1) * (size + 1) + c + 1] = ink[r * size + c] + pre[r * (size + 1) + c + 1] + pre[(r + 1) * (size + 1) + c] - pre[r * (size + 1) + c]
    const sum = (r0, r1, c0, c1) => r1 <= r0 || c1 <= c0 ? 0
      : pre[r1 * (size + 1) + c1] - pre[r0 * (size + 1) + c1] - pre[r1 * (size + 1) + c0] + pre[r0 * (size + 1) + c0]
    const sides = this.ENCLOSE[op]
    let best = null
    const heights = new Int32Array(size)
    for (let row = 0; row < size; row++) {
      for (let c = 0; c < size; c++) heights[c] = blocked[row * size + c] ? 0 : heights[c] + 1
      const stack = []
      for (let col = 0; col <= size; col++) {
        const h = col < size ? heights[col] : 0
        while (stack.length && heights[stack.at(-1)] >= h) {
          const top = stack.pop()
          const height = heights[top], left = stack.length ? stack.at(-1) + 1 : 0, width = col - left
          if (!height || !width) continue
          const r0 = row - height + 1, r1 = row + 1, c0 = left, c1 = col
          const closed = { L: sum(r0, r1, 0, c0), R: sum(r0, r1, c1, size), T: sum(0, r0, c0, c1), B: sum(r1, size, c0, c1) }
          if ([...sides].every(s => closed[s] > 0) && (!best || height * width > best[0])) best = [height * width, r0, r1, c0, c1]
        }
        stack.push(col)
      }
    }
    if (!best) return null
    const [, r0, r1, c0, c1] = best, w = (region[2] - region[0]) / size, h = (region[3] - region[1]) / size
    return [region[0] + c0 * w, region[3] - r1 * h, region[0] + c1 * w, region[3] - r0 * h]
  }

  /** Neighbouring parts moved apart where they face each other closer than `FACING` (`_space`). */
  space(axis, groups) {
    if (this.partial) return
    const C = this.C
    for (let k = 0; k + 1 < groups.length; k++) {
      const a = groups[k], b = groups[k + 1]
      const gap = facing(a, b, axis)
      if (gap === null || gap >= C.FACING[axis]) continue
      const half = (C.FACING[axis] - gap) / 2
      const [first, second] = axis === 0 ? [a, b] : [b, a]
      const limit = group => C.SQUEEZE * (Math.max(...group.map(p => p.target[axis + 2])) - Math.min(...group.map(p => p.target[axis])))
      squeeze(first, axis, 0, -Math.min(half, limit(first)))
      squeeze(second, axis, Math.min(half, limit(second)), 0)
    }
  }

  // ---------------------------------------------------------------- weight
  /** Each part's strokes brought to the width the whole character's density calls for (`_balance`). */
  balance(group) {
    const C = this.C, stem = this.stem0
    const curve = (density, axis) => C.STEM_CURVE[axis][0] + C.STEM_CURVE[axis][1] * density / 1000
    const density = group.reduce((s, p) => { const [sx, sy] = scaleOf(p); return s + (p.inkLength ?? partInk(p.part)) * (sx + sy) / 2 }, 0)
    const ratio = [0, 1].map(axis => stem[axis][1] / stem[axis][0] - 1)
    // The stroke widths the whole drawing is brought to, which a placeholder's outline follows.
    this.stroke = [curve(density, 0), curve(density, 1)]
    for (const p of group) {
      if (p.empty !== undefined || p.fixed) continue
      const weight = [], target = p.target.slice(), scale = scaleOf(p)
      for (const axis of [0, 1]) {
        const box = p.balanceBox ?? p.source
        const extent = box[axis + 2] - box[axis]
        if (extent <= 2 * stem[axis][0]) {
          const width = extent * curve(density, axis) / curve(p.native, axis), middle = (target[axis] + target[axis + 2]) / 2
          target[axis] = middle - width / 2
          target[axis + 2] = middle + width / 2
          weight.push(0)
          continue
        }
        const measured = p.part.contours[0]?.width
        const own = measured ? measured[axis] : curve(p.native, axis)
        weight.push(Math.min(p.weightLimit?.[axis] ?? 1, Math.max(-0.6, (curve(density, axis) / (scale[axis] * own) - 1) / ratio[axis])))
      }
      p.target = target
      p.weight = weight
    }
  }
}

// -------------------------------------------------------------------- free functions
/** A detached four-point horizontal spanning half the part that no native cut supports (`_extra_bar`). */
function extraBar(part, mask, references) {
  const size = 64, [x0, y0, x1, y1] = part.box, width = x1 - x0, height = y1 - y0
  for (const contour of part.contours) {
    const p = contour.light
    if (p.length !== 8) continue
    const b = pointsBox(p)
    if (b[2] - b[0] < 0.5 * width || b[3] - b[1] > 0.15 * height) continue
    const bar = fill(rings([contour], [p], 2), size, part.box).map((v, i) => v & mask[i])
    if (!count(bar) || !references.length) continue
    const others = part.contours.filter(c => c !== contour)
    const rest = fill(rings(others, others.map(c => c.light), 2), size, part.box).map((v, i) => v & mask[i])
    const near = grown(bar, size, 1)
    if (near.some((v, i) => v & rest[i])) continue
    const n = count(bar)
    if (references.every(ref => { let out = 0; for (let i = 0; i < bar.length; i++) out += bar[i] & (1 - ref[i]); return out > 0.25 * n })) return true
  }
  return false
}

/** The share of the inner parts' ink lying on the enclosing part's. */
export function collision(outer, inner, region, size = 64) {
  const a = fill(groupRings(outer), size, region), b = fill(groupRings(inner), size, region)
  let both = 0, total = 0
  for (let i = 0; i < a.length; i++) { both += a[i] & b[i]; total += b[i] }
  return both / Math.max(total, 1)
}

/** A group moved in from its low and high edges along `axis`, together. */
function squeeze(group, axis, low, high) {
  const lo = Math.min(...group.map(p => p.target[axis])), hi = Math.max(...group.map(p => p.target[axis + 2]))
  const newLo = lo + low, newHi = hi + high, scale = (newHi - newLo) / Math.max(hi - lo, 1)
  for (const p of group) {
    const t = p.target.slice()
    t[axis] = newLo + (p.target[axis] - lo) * scale
    t[axis + 2] = newLo + (p.target[axis + 2] - lo) * scale
    p.target = t
  }
}

/** The median gap between two groups along their facing edges, in font units (`_facing`). */
function facing(a, b, axis, size = 250) {
  const ma = fill(groupRings(a), size, EM_BOX), mb = fill(groupRings(b), size, EM_BOX)
  const gaps = []
  for (let line = 0; line < size; line++) {
    // Side by side: per row, the last ink of the first and the first of the second, along columns.
    let lastA = -1, firstB = -1
    for (let k = 0; k < size; k++) {
      const i = axis === 0 ? line * size + k : k * size + line
      if (ma[i]) lastA = k
      if (mb[i] && firstB < 0) firstB = k
    }
    if (lastA >= 0 && firstB >= 0) gaps.push(firstB - lastA)
  }
  if (gaps.length < 5) return null
  gaps.sort((x, y) => x - y)
  const n = gaps.length, median = n % 2 ? gaps[(n - 1) / 2] : (gaps[n / 2 - 1] + gaps[n / 2]) / 2
  return median * 1000 / size
}

/**
 * The enclosed parts moved and scaled together to the largest size at which their ink fits the
 * enclosing part's opening, clear of its ink by `ROOM_MARGIN` stems, nearest where they stand
 * (`_fit_inside`). Answers whether a placement was found.
 */
export function fitInside(outer, inner, region, stem, C, { size = 64, room = null, anchor = null, bounds = null } = {}) {
  const w = (region[2] - region[0]) / size, h = (region[3] - region[1]) / size
  const margin = Math.max(1, pyRound(C.ROOM_MARGIN * stem / Math.max(w, h) / 2))
  const ink = grown(fill(groupRings(outer), size, region), size, margin)
  const words = (size + 31) >> 5
  const inkBits = new Uint32Array(size * words)
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (ink[r * size + c]) inkBits[r * words + (c >> 5)] |= 1 << (c & 31)
  const x0 = Math.min(...inner.map(p => p.target[0])), y0 = Math.min(...inner.map(p => p.target[1]))
  const x1 = Math.max(...inner.map(p => p.target[2])), y1 = Math.max(...inner.map(p => p.target[3]))
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const top = room ? Math.min(1.6, (room[2] - room[0]) / Math.max(x1 - x0, 1), (room[3] - room[1]) / Math.max(y1 - y0, 1)) : 1.6
  const steps = Math.max(0, Math.ceil((0.45 - top) / -0.05))
  for (let s = 0; s < steps; s++) {
    const scale = top + s * -0.05
    const hw = (x1 - x0) * scale / 2, hh = (y1 - y0) * scale / 2
    const box = [cx - hw, cy - hh, cx + hw, cy + hh]
    const moved = inner.map(p => ({ ...p, target: [cx + (p.target[0] - cx) * scale, cy + (p.target[1] - cy) * scale,
      cx + (p.target[2] - cx) * scale, cy + (p.target[3] - cy) * scale] }))
    const mask = fill(groupRings(moved), size, [box[0], box[3] - size * h, box[0] + size * w, box[3]])
    let r0 = size, r1 = -1, c0 = size, c1 = -1
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (mask[r * size + c]) {
      if (r < r0) r0 = r
      if (r > r1) r1 = r
      if (c < c0) c0 = c
      if (c > c1) c1 = c
    }
    if (r1 < 0) return false
    const mh = r1 - r0 + 1, mw = c1 - c0 + 1
    if (mh > size || mw > size) continue
    // The cropped mask shifted to every column, as bit rows.
    const shifted = []
    for (let C0 = 0; C0 + mw <= size; C0++) {
      const bits = new Uint32Array(mh * words)
      for (let i = 0; i < mh; i++) for (let j = 0; j < mw; j++) if (mask[(r0 + i) * size + c0 + j]) {
        const col = C0 + j
        bits[i * words + (col >> 5)] |= 1 << (col & 31)
      }
      shifted.push(bits)
    }
    const free = (R, C0) => {
      if (bounds && (region[0] + C0 * w < bounds[0] || region[0] + (C0 + mw) * w > bounds[2] ||
        region[3] - (R + mh) * h < bounds[1] || region[3] - R * h > bounds[3])) return false
      const bits = shifted[C0]
      for (let i = 0; i < mh; i++) for (let k = 0; k < words; k++) if (bits[i * words + k] & inkBits[(R + i) * words + k]) return false
      return true
    }
    const [ax, ay] = anchor ?? [cx, cy]
    const wantRow = (region[3] - (ay + hh)) / h + r0, wantCol = (ax - hw - region[0]) / w + c0
    // Free top-left corners in order of distance from where the parts stand, row-major among equals.
    const offsets = []
    for (let R = 0; R + mh <= size; R++) for (let C0 = 0; C0 + mw <= size; C0++) offsets.push([(R - wantRow) ** 2 + (C0 - wantCol) ** 2, R, C0])
    offsets.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]))
    const hit = offsets.find(([, R, C0]) => free(R, C0))
    if (!hit) continue
    const [, R, C0] = hit
    const topEdge = region[3] - (R - r0) * h, left = region[0] + (C0 - c0) * w
    const dx = left - (cx - hw), dy = topEdge - (cy + hh)
    for (const p of inner) {
      const t = p.target
      p.target = [cx + (t[0] - cx) * scale + dx, cy + (t[1] - cy) * scale + dy, cx + (t[2] - cx) * scale + dx, cy + (t[3] - cy) * scale + dy]
    }
    return true
  }
  return false
}

/**
 * A glyph drawn round the lower left of another part as a designer draws it there (`_swept`): its
 * strokes pressed left of `edge`, the stroke sweeping along its foot drawn out under the other part.
 */
export function sweptPart(p, edge, C) {
  const contours = drawnContours(p)
  const boxes = contours.map(pointsBox)
  const x0 = Math.min(...boxes.map(b => b[0])), y0 = Math.min(...boxes.map(b => b[1]))
  const x1 = Math.max(...boxes.map(b => b[2])), y1 = Math.max(...boxes.map(b => b[3]))
  const [reach, foot] = C.SWEEP_REACH
  const sweeps = boxes.map((b, k) => [b, k]).filter(([b]) => b[2] >= x1 - reach * (x1 - x0) && b[1] <= y0 + foot * (y1 - y0)
    && b[3] - b[1] >= C.SWEEP_RISE * (y1 - y0)).map(([, k]) => k)
  if (sweeps.length !== 1 || contours.length < 2) return null
  const sweep = sweeps[0], pts = contours[sweep]
  let lowMin = Infinity, lowMax = -Infinity
  for (let i = 0; i < pts.length; i += 2) if (pts[i + 1] <= y0 + 0.2 * (y1 - y0)) { lowMin = Math.min(lowMin, pts[i]); lowMax = Math.max(lowMax, pts[i]) }
  if (lowMax < lowMin || lowMax - lowMin < C.SWEEP_FOOT * (x1 - x0)) return null
  const head = Math.max(...boxes.filter((_, k) => k !== sweep).map(b => b[2]))
  if (head <= edge || edge <= x0 + (x1 - x0) / 4) return null
  edge = Math.max(edge, x0 + C.SWEEP_PRESSED * (head - x0))
  const pressed = (edge - x0) / (head - x0)
  const left = boxes[sweep][0], turn = left + C.STEM_SPAN, end = x1 - C.SWEEP_END * (x1 - x0)
  const shift = (left - x0) * pressed - (left - x0)
  if (end <= turn + shift) return null
  const start = turn + shift
  const drawnOut = points => {
    const out = points.slice()
    for (let i = 0; i < out.length; i += 2) {
      const x = points[i]
      out[i] = x <= turn ? x + shift : x <= end ? start + (x - turn) * (end - start) / (end - turn) : x
    }
    return out
  }
  const [sx, sy] = scaleOf(p)
  const cx = (p.source[0] + p.source[2]) / 2, cy = (p.source[1] + p.source[3]) / 2
  const gx = (p.target[0] + p.target[2]) / 2, gy = (p.target[1] + p.target[3]) / 2
  const at = (c, move) => {
    const map = src => { const out = new Float64Array(src.length); for (let i = 0; i < src.length; i += 2) { out[i] = (src[i] - cx) * sx + gx; out[i + 1] = (src[i + 1] - cy) * sy + gy } return move(out) }
    return { ops: c.ops, light: map(c.light), heavy: map(c.heavy), width: c.width }
  }
  const strokes = makePart(p.part.contours.filter((_, k) => k !== sweep).map(c => at(c, q => q)))
  const box = strokes.box
  const pressedBox = [x0 + (box[0] - x0) * pressed, box[1], x0 + (box[2] - x0) * pressed, box[3]]
  const drawn = makePart([at(p.part.contours[sweep], drawnOut)])
  return [placed(strokes, strokes.box, pressedBox, p.native, `swept ${p.origin}`, p.weight),
    placed(drawn, drawn.box, drawn.box.slice(), p.native, `swept ${p.origin}`, p.weight)]
}

export { raster }
