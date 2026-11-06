import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { parse } from '../src/core/ids.js'

const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'))
const data = read('../data/donor-parts.json')
const reviewed = read('./fixtures/donor-parts-reviewed.json')
const pinned = read('../data/unicode-fonts.json')

// A path arrives as a list of contours of commands: ["M",x,y] ["L",x,y] ["Q",…4] ["C",…6] ["Z"].
const contoursOf = path => (typeof path[0][0] === 'string' ? [path] : path)

/** A contour flattened to a closed polyline, curves included, for sampling. */
function polyline(contour) {
  const points = []
  let here = null
  for (const [op, ...numbers] of contour) {
    const pairs = []
    for (let i = 0; i < numbers.length; i += 2) pairs.push([numbers[i], numbers[i + 1]])
    if (op === 'M') { here = pairs[0]; points.push(here) } else if (op === 'L') { here = pairs[0]; points.push(here) } else if (op === 'Q' || op === 'C') {
      const control = [here, ...pairs]
      const span = control.slice(1).reduce((sum, p, i) => sum + Math.abs(p[0] - control[i][0]) + Math.abs(p[1] - control[i][1]), 0)
      const steps = Math.max(2, Math.ceil(span / 8) + 1)
      for (let step = 1; step <= steps; step++) {
        const t = step / steps
        let working = control
        while (working.length > 1) {
          working = working.slice(1).map((p, i) => [working[i][0] + (p[0] - working[i][0]) * t, working[i][1] + (p[1] - working[i][1]) * t])
        }
        points.push(working[0])
      }
      here = pairs[pairs.length - 1]
    }
  }
  if (points.length > 1) points.push(points[0])
  return points
}

const BOX = [-200, -300, 1200, 1000]
const SIDE = 192

/** Ink mask of a set of paths on a fixed grid over the em, by even-odd scanline. */
function mask(paths) {
  const rings = paths.flatMap(path => contoursOf(path).map(polyline))
  const bits = new Uint8Array(SIDE * SIDE)
  const [x0, y0, x1, y1] = BOX
  for (let row = 0; row < SIDE; row++) {
    const y = y0 + ((y1 - y0) * (row + 0.5)) / SIDE
    const crossings = []
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [ax, ay] = ring[i]
        const [bx, by] = ring[i + 1]
        if ((ay > y) !== (by > y)) crossings.push(ax + ((bx - ax) * (y - ay)) / (by - ay))
      }
    }
    if (!crossings.length) continue
    crossings.sort((a, b) => a - b)
    for (let column = 0; column < SIDE; column++) {
      const x = x0 + ((x1 - x0) * (column + 0.5)) / SIDE
      let inside = 0
      for (const crossing of crossings) if (crossing < x) inside++
      if (inside % 2) bits[row * SIDE + column] = 1
    }
  }
  return bits
}

const ink = bits => bits.reduce((sum, bit) => sum + bit, 0)

/** The tokens of an IDS, with a numbered component `{42}` counting as one. */
const tokensOf = ids => ids.match(/\{\d+\}|./gu) ?? []
/** `{42} 彐` names the component {42}; the label carries its written-out form. */
const reference = name => /^\{\d+\}/.exec(name)?.[0] ?? name
/** A repeated element is named by its position: 山上 and 山下 are both 山, 又中1 is 又. */
function bare(name, names) {
  if (names.includes(name)) return name
  for (let cut = 1; cut < name.length; cut++) {
    const stem = [...name].slice(0, -cut).join('')
    if (names.includes(stem)) return stem
  }
  return name
}

/** The middle of a path, for checking a position name against where the ink sits. */
const centreOf = path => {
  const [x0, y0, x1, y1] = boxOf(path)
  return [(x0 + x1) / 2, (y0 + y1) / 2]
}

describe('donor parts', () => {
  it('declares its format and the faces it was drawn from', () => {
    expect(data.format).toBe('ids-input/donor-parts')
    expect(data.version).toBe(1)
    expect(data.entries.length).toBeGreaterThan(0)
    for (const face of data.faces) {
      const pin = pinned.fonts.find(font => font.file === face.file)
      expect(pin, `${face.file} is pinned in data/unicode-fonts.json`).toBeTruthy()
      expect(face.sha256).toBe(pin.sha256)
    }
    for (const entry of data.entries) {
      expect(data.faces.map(face => face.name)).toContain(entry.face)
    }
  })

  it('covers every candidate exactly once, shipped or skipped with a reason', () => {
    const shipped = data.entries.map(entry => entry.char)
    const skipped = data.skipped.map(row => row.char)
    expect(shipped.length + skipped.length).toBe(data.candidates)
    expect(new Set([...shipped, ...skipped]).size).toBe(data.candidates)
    for (const row of data.skipped) expect(row.reason.length).toBeGreaterThan(0)
  })

  it('describes a vertical stack standing on 山', () => {
    for (const entry of data.entries) {
      const tree = parse(entry.ids.replaceAll(/\{\d+\}/gu, '〇')).tree
      expect(tree, entry.ids).toBeTruthy()
      expect(['⿱', '⿳']).toContain(tree.op)
      expect(tokensOf(entry.ids).at(-1), entry.char).toBe('山')
    }
  })

  it('writes every part as a closed, non-empty path', () => {
    for (const entry of data.entries) {
      expect(entry.parts.length).toBeGreaterThan(0)
      for (const part of [...entry.parts.map(p => p.path), ...entry.pieces]) {
        for (const contour of contoursOf(part)) {
          expect(contour.length).toBeGreaterThan(2)
          expect(contour[0][0]).toBe('M')
          expect(contour.at(-1)).toEqual(['Z'])
          // Only the first command opens a contour, and only the last closes it.
          for (const [op] of contour.slice(1, -1)) expect(['L', 'Q', 'C']).toContain(op)
          for (const [, ...numbers] of contour.slice(0, -1)) {
            expect(numbers.length % 2).toBe(0)
            for (const value of numbers) expect(Number.isFinite(value)).toBe(true)
          }
        }
      }
    }
  })

  it('cuts the ink into parts that do not overlap', () => {
    for (const entry of data.entries) {
      const masks = entry.parts.map(part => mask([part.path]))
      const sizes = masks.map(ink)
      for (const size of sizes) expect(size, entry.char).toBeGreaterThan(0)
      for (let a = 0; a < masks.length; a++) {
        for (let b = a + 1; b < masks.length; b++) {
          let shared = 0
          for (let i = 0; i < masks[a].length; i++) if (masks[a][i] && masks[b][i]) shared++
          // Two parts may touch along a sampled cell; they may not share a body.
          expect(shared / Math.min(sizes[a], sizes[b]), `${entry.char} parts ${a + 1} and ${b + 1}`)
            .toBeLessThan(0.02)
        }
      }
    }
  })

  it('leaves the glyph whole: every piece goes to exactly one part, uncut', () => {
    for (const entry of data.entries) {
      // Comparing the drawn ink with itself would prove nothing — a part is a piece,
      // written out again. What a reader is promised is that the division took the
      // font's outlines whole: each piece claimed once, none split, none invented.
      const pieces = entry.pieces.map(piece => JSON.stringify(piece))
      const claimed = entry.parts.map(part => JSON.stringify(part.path))
      expect(claimed.length).toBe(pieces.length)
      expect([...claimed].sort()).toEqual([...pieces].sort())
      expect(new Set(claimed).size, `${entry.char} claims a piece twice`).toBe(claimed.length)
    }
  })

  it('draws each piece as ink the parts account for, pixel for pixel', () => {
    // A raster reading of the same promise, which would catch a part whose path was
    // edited away from the piece it stands for rather than merely reordered.
    for (const entry of data.entries) {
      const parts = mask(entry.parts.map(part => part.path))
      const glyph = mask(entry.pieces)
      let apart = 0
      for (let i = 0; i < glyph.length; i++) if (glyph[i] !== parts[i]) apart++
      const total = ink(glyph)
      expect(total).toBeGreaterThan(0)
      expect(apart / total, `${entry.char} ink the parts and the pieces disagree about`)
        .toBeLessThan(0.005)
    }
  })

  it("names every layer out of the character's own description", () => {
    for (const entry of data.entries) {
      const tokens = tokensOf(entry.ids)
      // The first layer is the outer operator's operands, written back out.
      expect(entry.first.length).toBe(entry.ids.startsWith('⿳') ? 3 : 2)
      expect(entry.first.map(name => reference(name)).join('')).toBe(tokens.slice(1).join(''))
      // Every terminal name is a token of the description, and nothing else is.
      for (const name of entry.terminal) expect(tokens).toContain(reference(name))
      const operators = tokens.filter(token => /^[⿰-⿿㇯〾]$/u.test(token)).length
      expect(entry.terminal.length).toBe(tokens.length - operators)
      // Every part belongs to a terminal element, position suffix and all.
      for (const part of entry.parts) expect(entry.terminal).toContain(bare(part.leaf, entry.terminal))
      // A part exists for every element, and no element is left undrawn.
      expect(new Set(entry.parts.map(part => bare(part.leaf, entry.terminal))))
        .toEqual(new Set(entry.terminal))
      // The parts come out grouped by element, in the order the description reads, so the
      // distinct labels stand one to one against the terminal elements. The review page
      // counts on that to say which operand a part came out of, which matching names
      // cannot do for ⿱山山.
      const slots = [...new Set(entry.parts.map(part => part.leaf))]
      expect(slots.map(leaf => bare(leaf, entry.terminal))).toEqual(entry.terminal)
      // A position name has to agree with where the ink actually sits, or two
      // elements of one name could be labelled the wrong way round.
      for (const part of entry.parts) {
        const stem = bare(part.leaf, entry.terminal)
        if (stem === part.leaf) continue
        const place = [...part.leaf].slice([...stem].length)[0]
        const other = entry.parts.find(p => p.leaf !== part.leaf && bare(p.leaf, entry.terminal) === stem
          && [...p.leaf].slice([...stem].length)[0] === ({ 上: '下', 下: '上', 左: '右', 右: '左' })[place])
        if (!other) continue
        const [mx, my] = centreOf(part.path)
        const [ox, oy] = centreOf(other.path)
        const said = `${entry.char} ${part.leaf} against ${other.leaf}`
        if (place === '上') expect(my, said).toBeGreaterThan(oy)
        if (place === '下') expect(my, said).toBeLessThan(oy)
        if (place === '左') expect(mx, said).toBeLessThan(ox)
        if (place === '右') expect(mx, said).toBeGreaterThan(ox)
      }
    }
  })

  it('roots the recursion in the terminal elements and never loops', () => {
    for (const entry of data.entries) {
      expect(entry.recursive.map(node => node.leaf)).toEqual(entry.terminal)
      const walk = (node, seen) => {
        expect(node.leaf.length).toBeGreaterThan(0)
        expect(seen, `${entry.char} expands ${node.leaf} inside itself`).not.toContain(node.leaf)
        for (const child of node.children) walk(child, [...seen, node.leaf])
      }
      for (const node of entry.recursive) walk(node, [])
      // A numbered component is a reference, not a character to look up.
      const numbered = node => {
        if (/^\{\d+\}/.test(node.leaf)) expect(node.children).toEqual([])
        node.children.forEach(numbered)
      }
      entry.recursive.forEach(numbered)
    }
  })

  it('still decomposes the 25 reviewed characters the way the reader signed off', () => {
    const shipped = new Map(data.entries.map(entry => [entry.char, entry]))
    for (const row of reviewed.entries) {
      const entry = shipped.get(row.char)
      expect(entry, `${row.char} is still shipped`).toBeTruthy()
      expect(entry.ids).toBe(row.ids)
      expect(entry.first).toEqual(row.first)
      expect(entry.terminal).toEqual(row.terminal)
      expect(entry.pieces.length).toBe(row.pieces)
      const group = parts => {
        const out = new Map()
        for (const part of parts) {
          const leaf = bare(part.leaf, row.terminal)
          const box = part.box ?? boxOf(part.path)
          const area = part.area ?? areaOf(part.path)
          out.set(leaf, [...(out.get(leaf) ?? []), [...box.map(Math.round), Math.round(area)]])
        }
        for (const list of out.values()) list.sort((a, b) => a[0] - b[0] || a[1] - b[1])
        return out
      }
      const mine = group(entry.parts)
      const theirs = group(row.parts)
      expect([...mine.keys()].sort()).toEqual([...theirs.keys()].sort())
      for (const [leaf, list] of theirs) {
        const ours = mine.get(leaf)
        expect(ours.length, `${row.char} ${leaf} piece count`).toBe(list.length)
        for (const [index, want] of list.entries()) {
          const got = ours[index]
          for (let side = 0; side < 4; side++) {
            expect(Math.abs(got[side] - want[side]), `${row.char} ${leaf} box`).toBeLessThanOrEqual(1)
          }
          expect(Math.abs(got[4] - want[4]) / want[4], `${row.char} ${leaf} area`).toBeLessThan(0.015)
        }
      }
    }
  })
})

/** A path's bounding box, from its flattened outline. */
function boxOf(path) {
  const points = contoursOf(path).flatMap(polyline)
  const xs = points.map(p => p[0])
  const ys = points.map(p => p[1])
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

/** A path's enclosed area, by the shoelace formula; a counter winds the other way and so is taken off. */
function areaOf(path) {
  let total = 0
  for (const contour of contoursOf(path)) {
    const ring = polyline(contour)
    for (let i = 0; i < ring.length - 1; i++) {
      total += (ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]) / 2
    }
  }
  return Math.abs(total)
}
