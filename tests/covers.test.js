import { describe, expect, it } from 'bun:test'
import { Composer } from '../src/composer/compose.js'
import { makePart, placed } from '../src/composer/geometry.js'
import { componentParts, isGroupedForm, isComponentForm } from '../src/composer/component-forms.js'

const contour = (x0, y0, x1, y1) => {
  const light = new Float64Array([x0, y0, x1, y0, x1, y1, x0, y1])
  return { ops: [], light, heavy: light.slice(), width: null }
}
const part = (...contours) => makePart(contours)
const at = (p, box) => placed(p, box, box, 0, 'test')

const lonely = () => {
  const c = Object.create(Composer.prototype)
  Object.defineProperty(c, 'partial', { value: false, configurable: true })
  c.coverCache = new Map()
  c.exclude = new Set()
  c.rec = () => null
  return c
}

describe('a cover', () => {
  it('is derived from the sequence, not only the four roots', () => {
    const c = lonely()
    c.sequenceOf = ch => ch === '龸' ? '⿱⺌冖' : null
    c.parse = () => ['⿱', '⺌', '冖']
    expect(c.isCover('龸')).toBe(true)
    c.parse = () => ['⿱', '木', '木']
    c.coverCache.clear()
    expect(c.isCover('林')).toBe(false)
  })

  it('narrows a bar under a derived cover', () => {
    const c = lonely()
    c.sequenceOf = ch => ch === '龸' ? '⿱⺌冖' : null
    c.parse = () => ['⿱', '⺌', '冖']
    const cover = [at(part(contour(100, 500, 800, 700)), [100, 500, 800, 700])]
    const bar = at(part(contour(0, 250, 900, 300)), [0, 250, 900, 300])
    const body = at(part(contour(0, 0, 900, 250)), [0, 0, 900, 250])
    const lower = [bar, body]
    c.fitUnderCover('⿱', ['龸', '木'], [cover, lower])
    const xs = bar.part.contours[0].light.filter((_, i) => i % 2 === 0)
    const width = Math.max(...xs) - Math.min(...xs)
    expect(width).toBeGreaterThan(0.6 * 700)
    expect(width).toBeLessThan(0.75 * 700)
  })

  it('leaves a middle 冖 open over a narrow part', () => {
    const c = lonely()
    const top = [at(part(contour(350, 500, 650, 800)), [350, 500, 650, 800])]
    const cover = [at(part(contour(0, 350, 900, 450)), [0, 350, 900, 450])]
    const lower = [at(part(contour(0, -50, 900, 300)), [0, -50, 900, 300])]
    c.fitUnderCover('⿳', ['卜', '冖', '人'], [top, cover, lower])
    // The top spans a third of the cover's width: the bar stays where the share put it.
    expect(cover[0].target[1]).toBe(350)
    // The part below still closes on the cover from underneath.
    expect(lower[0].target[1]).toBeGreaterThan(-50)
  })

  it('closes a middle 冖 on the part above and the part below', () => {
    const c = lonely()
    const top = [at(part(contour(0, 500, 900, 800)), [0, 500, 900, 800])]
    const cover = [at(part(contour(0, 350, 900, 450)), [0, 350, 900, 450])]
    const lower = [at(part(contour(0, -50, 900, 300)), [0, -50, 900, 300])]
    c.fitUnderCover('⿳', ['大', '冖', '牛'], [top, cover, lower])
    expect(cover[0].target[1]).toBeGreaterThan(350)
    expect(lower[0].target[1]).toBeGreaterThan(-50)
  })
})

describe('a cover over two parts', () => {
  it('splits the bands and narrows the bottom', () => {
    const c = lonely()
    c.face = [0, -100, 1000, 900]
    const cover = [at(part(contour(50, 600, 950, 880)), [50, 600, 950, 880])]
    const middle = [at(part(contour(60, 300, 940, 580)), [60, 300, 940, 580])]
    const bottom = [at(part(contour(50, -80, 950, 280)), [50, -80, 950, 280])]
    c.fitUnderCover('⿳', ['宀', '龶', '口'], [cover, middle, bottom])
    expect(cover[0].target[1]).toBeCloseTo(580, 0)
    expect(middle[0].target[3]).toBeCloseTo(690, 0)
    expect(bottom[0].target[2] - bottom[0].target[0]).toBeCloseTo(0.66 * 900, 0)
  })
})

describe('the KRM ⿱⺊冖 top', () => {
  it('is one prepared component in a flat stack, and only where a form exists', () => {
    const c = lonely()
    c.fontStyle = 'sans'
    c.spelled = new Map()
    expect(c.groupedStack(['⿳', '⺊', '冖', '人'])).toEqual(['⿱', ['⿱', '⺊', '冖'], '人'])
    expect(c.groupedStack(['⿳', '卜', '冖', '人'])).toEqual(['⿱', ['⿱', '⺊', '冖'], '人'])
    expect(isComponentForm('⿱⺊冖', 'sans')).toBe(true)
    expect(isComponentForm('⿱⺊冖', 'kaisho')).toBe(false)
  })
})

for (const style of ['sans', 'serif']) {
  it(`keeps the ${style} manuscript top joined with a rightward bar in separate view`, () => {
    expect(isGroupedForm('⿱⺊冖', style)).toBe(true)
    const [top, roof] = componentParts('⿱⺊冖', undefined, style)
    const points = top.part.contours[0].light
    const xs = Array.from(points).filter((_, i) => i % 2 === 0)
    // The bar projects to the right; the centred stem reaches the roof seam.
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(450)
    expect(Math.max(...xs)).toBeGreaterThan(700)
    expect(top.part.box[1]).toBe(560)
    expect(roof.part.box[3]).toBeGreaterThanOrEqual(560)
    expect(JSON.stringify(top)).not.toContain('Noto')
  })
}
