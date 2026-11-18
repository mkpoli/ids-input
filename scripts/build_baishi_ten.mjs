// Rebuild the Sans witnesses for 十(.t) from the cited GlyphWiki KAGE records.
import { writeFileSync } from 'node:fs'
import { Kage, Polygons } from '@kurgm/kage-engine'
import { area } from './lib/outline.mjs'

const engine = new Kage()
engine.kShotai = engine.kGothic
engine.kFont.kWidth = 5
// u2db01-j@5 uses u5348-01@1 on the left and u5348-j@3 on the right.
const risingNoon = ['2:0:7:37:15:31:61:16:94', '1:0:0:30:50:98:50', '1:32:0:61:50:61:186', '2:0:7:16:118:51:107:102:93']
const flatNoon = ['2:0:7:62:18:50:62:26:95', '1:2:0:50:45:170:45', '1:0:0:18:106:183:106', '1:32:0:100:45:100:185']
// u6222-g@3, with its 口 component pinned to u53e3-j@20.
engine.kBuhin.push('u53e3-j', '1:12:13:42:46:42:154$1:2:2:42:46:158:46$1:22:23:158:46:158:154$1:2:2:42:154:158:154')
const halberd = ['99:0:0:15:9:107:69:u53e3-j', '1:0:0:12:75:186:75', '1:32:32:35:75:35:159', '1:2:2:35:102:87:102', '1:2:2:35:128:87:128', '2:0:7:13:163:55:156:117:144', '1:32:0:87:75:87:185', '2:7:8:144:21:163:31:172:48', '6:0:5:127:14:124:167:173:180:182:180', '2:0:7:167:90:147:144:102:177']

// u2db01-j@5 in situ, with its remaining component records pinned as well.
engine.kBuhin.push('u5348-01', risingNoon.join('$'))
engine.kBuhin.push('u5348-j', flatNoon.join('$'))
engine.kBuhin.push('u6728-01', '1:0:0:13:61:90:61$1:0:0:53:15:53:185$2:32:7:50:61:40:110:13:148$2:7:8:55:86:74:94:85:109') // @14
engine.kBuhin.push('u5fc3-04', '99:0:0:0:54:200:254:u5fc3-09') // @10
engine.kBuhin.push('u5fc3-09', '2:7:8:37:70:38:105:18:118$3:0:5:66:71:66:122:147:122$2:7:8:87:65:107:75:118:95$2:7:8:148:72:172:88:179:113') // @1
const pairedNoons = ['99:0:0:3:0:160:200:u6728-01', '99:0:0:67:5:190:138:u5348-01', '99:0:0:122:3:195:138:u5348-j', '99:0:0:60:30:198:200:u5fc3-04']

function outlines(records, fit = false) {
  const strokes = records.map(record => {
    const polygons = new Polygons()
    engine.makeGlyph2(polygons, record)
    return polygons.array.map(polygon => {
      const points = polygon.array.map(({ x, y }) => [x, y])
      return area(points) < 0 ? points.reverse() : points
    })
  })
  const points = strokes.flat(2)
  const bounds = [0, 1].map(axis => [Math.min(...points.map(p => p[axis])), Math.max(...points.map(p => p[axis]))])
  const scale = fit ? 900 / Math.max(...bounds.map(([lo, hi]) => hi - lo)) : 5
  const center = bounds.map(([lo, hi]) => fit ? (lo + hi) / 2 : 100)
  return strokes.map(polygons => polygons.map(points => 'M' + points.map(point => point.map((v, i) => +(500 + (v - center[i]) * scale).toFixed(1)).join(' ')).join('L') + 'Z').join(''))
}
const output = { flatNoon: outlines(flatNoon, true), risingNoon: outlines(risingNoon, true), halberd: outlines(halberd), pairedNoons: outlines(pairedNoons), raisedCross: outlines(risingNoon.slice(2), true) }
writeFileSync(new URL('../demo/lib/baishi-ten-glyphs.json', import.meta.url), JSON.stringify(output, null, 1) + '\n')
