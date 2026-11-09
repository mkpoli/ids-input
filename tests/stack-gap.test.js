import { expect, it } from 'bun:test'
import { Composer } from '@han-compose/composer/compose'
import { commands, makePart, placed } from '@han-compose/composer/geometry'
import constants from '@han-compose/composer/constants.json' with { type: 'json' }

const rect = (x0, y0, x1, y1) => {
  const light = new Float64Array([x0, y0, x1, y0, x1, y1, x0, y1])
  return { ops: commands('MLLL'), light, heavy: light.slice(), width: null }
}
const part = (boxes, origin) => {
  const contours = boxes.map(box => rect(...box))
  const x0 = Math.min(...boxes.map(box => box[0])), y0 = Math.min(...boxes.map(box => box[1]))
  const x1 = Math.max(...boxes.map(box => box[2])), y1 = Math.max(...boxes.map(box => box[3]))
  return placed(makePart(contours), [x0, y0, x1, y1], [x0, y0, x1, y1], 0, origin)
}
const composer = () => new Composer({
  manifest: { constants, spelled: [] }, layout: null,
  rec: () => null, hosts: () => [], places: () => [],
})
// A wide top with a narrow stroke that hangs below it, over a wide bar: the median gap is clear
// while the hanging stroke reaches into the bar.
const hookOverBar = (reach) => [
  part([[0, 600, 1000, 700], [800, 600 - reach, 860, 600]], 'upper'),
  part([[0, 0, 1000, 280]], 'lower'),
]

it('pulls a stacked part out of the one below when their nearest ink overlaps', () => {
  const [upper, lower] = hookOverBar(350)
  expect(upper.target[1]).toBeLessThan(lower.target[3])
  composer().space(1, [[upper], [lower]])
  expect(upper.target[1]).toBeGreaterThan(lower.target[3])
})

it('leaves a pair whose nearest ink clears the bar alone', () => {
  const [upper, lower] = hookOverBar(300)
  const top = upper.target.slice(), bottom = lower.target.slice()
  composer().space(1, [[upper], [lower]])
  expect(upper.target).toEqual(top)
  expect(lower.target).toEqual(bottom)
})
