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
const rising = () => outlines(risingNoon, true)
const output = { risingNoon: rising(), pairedNoons: outlines(pairedNoons) }
writeFileSync(new URL('../demo/lib/baishi-ten-glyphs.json', import.meta.url), JSON.stringify(output, null, 1) + '\n')

// The same records rendered in Mincho for the Serif sheet.
engine.kShotai = engine.kMincho
engine.kBuhin.push('u65e5-j', '1:12:13:46:32:46:168$1:2:2:46:32:154:32$1:22:23:154:32:154:168$1:2:2:46:98:154:98$1:2:2:46:168:154:168') // @10
engine.kBuhin.push('u767d-07-var-002', '2:0:7:104:15:96:29:72:62$99:0:0:-8:37:208:194:u65e5-j:0:0:0') // @3
engine.kBuhin.push('cdp-8bc4', '99:0:0:5:6:195:127:u767d-07-var-002:0:0:0$1:32:4:100:110:100:182$2:0:7:66:131:47:161:14:179$2:7:8:124:129:164:152:175:172') // @7
engine.kBuhin.push('u5c0f-03', '1:0:4:100:14:100:96$2:0:7:72:33:55:65:21:90$2:7:8:120:33:154:53:177:85') // @8
engine.kBuhin.push('u6728-04', '1:0:0:18:114:182:114$1:0:0:100:85:100:186$2:32:7:94:114:67:158:13:180$2:7:0:105:114:135:152:180:172') // @6
engine.kBuhin.push('u9e7f-03', '1:0:32:104:13:104:31$1:2:0:32:31:184:31$7:12:7:32:31:32:71:32:108:13:131$1:2:2:32:48:166:48$1:22:23:166:48:166:67$1:32:32:80:31:80:67$1:32:32:124:31:124:67$1:2:2:32:67:166:67$1:2:0:62:87:108:87$1:0:32:62:70:62:107$2:0:7:41:113:73:109:113:100$2:0:7:167:81:153:87:123:92$3:0:5:123:70:123:110:180:110') // @7
engine.kBuhin.push('u9e7f-t03', '2:7:8:88:12:104:19:110:27$1:2:0:32:31:184:31$7:12:7:32:31:32:71:32:108:13:131$1:32:32:80:31:80:67$1:32:32:124:31:124:67$1:0:2:39:48:166:48$1:22:23:166:48:166:67$1:0:2:39:67:166:67$1:2:0:56:87:106:87$1:0:32:56:70:56:107$2:0:7:49:111:60:109:111:100$1:0:0:123:87:171:87$3:0:5:123:70:123:110:180:110') // @3
engine.kBuhin.push('koseki-085450', '99:0:0:0:4:200:128:u5c0f-03:0:0:0$99:0:0:-2:64:210:193:cdp-8bc4:0:0:0') // @6
engine.kBuhin.push('u4d22-var-001', '99:0:0:0:0:200:200:u9e7f-03$99:0:0:0:42:200:197:u6728-04') // @1
const strokesOf = name => engine.kBuhin.search(name).split('$')
engine.kBuhin.push('deer-upper', [strokesOf('u9e7f-t03')[0], ...strokesOf('u9e7f-03').slice(1)].join('$'))
const serif = {
  risingNoon: rising(),
  smallJ: outlines(strokesOf('koseki-085450')),
  deerUpper: outlines(strokesOf('u4d22-var-001').map(line => line.replace('u9e7f-03', 'deer-upper'))),
}
writeFileSync(new URL('../demo/lib/baishi-serif-kage.json', import.meta.url), JSON.stringify(serif, null, 1) + '\n')
