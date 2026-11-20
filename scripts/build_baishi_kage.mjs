// Gothic strokes for the Baishi forms whose differences survive at tooltip size.
// The snapshots contain the selected KAGE records from the cited GlyphWiki revisions.
// build_baishi_variant_glyphs.py fits each result to the same square as the font excerpts.
import { Kage, Polygons } from '@kurgm/kage-engine'
import { area } from './lib/outline.mjs'

const records = {
  // u90a6-ue0102@12. 邦 (VS19): the top stroke falls left, the lowest rises right.
  "丰ptp": [
    '2:0:7:102:37:70:50:16:60',
    '7:0:7:63:18:63:99:63:169:16:189',
    '1:0:0:23:86:107:86',
    '2:0:7:17:138:57:129:110:116',
  ],
  // u2097d-j@2. 𠥽 = ⿻木y一.; omit the separate lower horizontal.
  "木y": [
    '1:0:0:16:58:185:58',
    '1:0:0:100:15:100:186',
    '2:0:7:76:70:65:123:15:163',
    '2:7:0:125:70:139:122:182:152',
  ],
  // u9580-05-var-002@1. 𢵧(V) → u22d67-v → u9593-var-002. The right jamb ends vertically.
  "門s": [
    '1:12:0:29:27:29:186',
    '1:2:2:29:27:83:27',
    '1:22:32:83:27:83:76',
    '1:2:2:29:51:83:51',
    '1:2:2:29:76:83:76',
    '1:12:32:117:27:117:76',
    '1:2:2:117:27:171:27',
    '1:22:0:171:27:171:186',
    '1:2:2:117:51:171:51',
    '1:2:2:117:76:171:76',
  ],
  // u4ea5-v@3. Vertical first stroke with the bent middle sweep of 𠀔.
  "亥V": [
    '1:0:32:101:15:101:47',
    '1:0:0:15:47:185:47',
    '2:0:7:96:52:75:70:45:89',
    '2:0:7:40:90:75:102:95:112',
    '2:0:7:137:67:94:128:22:154',
    '2:0:7:162:95:107:166:17:187',
    '2:7:8:117:142:148:157:170:183',
  ],
  // u9e7f-var-003@2. 麡(K) preserves the upright dot and the horizontal right 匕T.
  "鹿s.h": [
    '1:0:32:104:14:104:38',
    '1:2:0:34:38:184:38',
    '7:12:7:34:38:34:99:34:161:14:187',
    '1:2:2:34:67:168:67',
    '1:22:23:168:67:168:99',
    '1:0:32:81:42:81:99',
    '1:0:32:125:42:125:99',
    '1:2:2:34:99:168:99',
    '1:2:0:59:134:111:134',
    '1:0:32:59:104:59:170',
    '2:0:7:48:178:74:173:111:162',
    '1:0:0:123:134:178:134',
    '3:0:5:123:104:123:177:178:177',
  ],
  // u9e7f-v01@1. 麒(V) → u9e92-v@1. Both feet of 比th rise.
  "鹿sth": [
    '1:0:32:59:13:59:40',
    '1:0:0:13:40:100:40',
    '7:32:7:27:40:27:99:27:161:12:187',
    '1:2:2:27:67:92:67',
    '1:22:32:92:67:92:99',
    '1:32:32:49:40:49:99',
    '1:32:32:70:40:70:99',
    '1:2:2:25:99:92:99',
    '1:2:0:42:134:66:134',
    '1:0:413:42:103:42:176',
    '2:32:7:42:176:52:170:67:158',
    '1:2:0:74:134:98:134',
    '1:0:413:74:103:74:176',
    '2:32:7:74:176:86:168:100:158',
  ],
  // u5f16-ue0102@2. 𭾤 → u2dfa4-jv@3. The separate bottom 一 of 弖 follows the bow.
  "弓z": [
    '1:0:2:36:31:144:31',
    '1:22:23:144:31:144:67',
    '1:2:2:58:67:144:67',
    '1:12:13:58:67:50:114',
    '1:2:2:50:114:142:114',
    '1:22:32:142:114:142:179',
  ],
  // u4e11-g01@1. 侴 → u4fb4-g@4. Select the three strokes of ユt within 丑.t.
  "ユt": [
    '1:0:2:20:32:90:32',
    '1:22:32:90:32:82:160',
    '2:0:7:15:180:62:167:110:155',
  ],
}

const kage = new Kage()
if (!process.argv.includes('--serif')) {
  kage.kShotai = kage.kGothic
  kage.kFont.kWidth = 5
}
const paths = {}
for (const [key, strokes] of Object.entries(records)) {
  const polygons = new Polygons()
  kage.makeGlyph2(polygons, strokes.join('$'))
  paths[key] = polygons.array.map(polygon => {
    const points = polygon.array.map(({ x, y }) => [x, y])
    if (area(points) < 0) points.reverse()
    return 'M' + points.map(point => point.join(' ')).join('L') + 'Z'
  }).join('')
}
console.log(JSON.stringify(paths))
