#!/usr/bin/env bun
// The files a share card is drawn with, into `dist/og`: the bundled faces as TrueType (resvg reads
// no WOFF2), the outlines of the bundled scripts, and the table from an IDS to the character it
// describes. Run after `build:demo`, from `build:site`.
//
//   bun scripts/og-assets.mjs
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { join } from 'node:path'
import { buildIdsIndex } from './lib/ids-index.mjs'

const out = join(import.meta.dirname, '../dist/og')
if (!existsSync(join(import.meta.dirname, '../dist/index.html'))) {
  console.error('dist is not built: run `bun run build:demo` first')
  process.exit(1)
}
rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, 'fonts/unicode'), { recursive: true })
mkdirSync(join(out, 'data/unicode-outlines'), { recursive: true })

// resvg's font database reads TrueType and OpenType only, so the faces are unpacked from WOFF2.
const FONTS = {
  'operators.ttf': 'GenZuiSans-Regular.woff2',
  'parts.ttf': 'Plangothic-ids-parts.woff2',
  'strokes.ttf': 'NotoSansCJKjp-ids-strokes.woff2',
  'seal.ttf': 'IDSSeal-Regular.woff2',
  'tangut.ttf': 'NotoSerifTangut-Regular.woff2',
  'shuishu.ttf': 'IDSShuishu.woff2',
  'jurchen.ttf': 'IDSJurchen.woff2',
  'new-korean.ttf': 'IDSNewKorean.woff2',
}
// Two faces are too big to keep in the repository: fetched at pinned tags, checked, then converted
// like the rest. The general face is for the Basic Multilingual Plane, the planes face for the
// supplementary planes the parts subset leaves out. github.com's `/raw/` and `/releases/download/`
// redirects answered 504s to the builds, so the files are read from raw.githubusercontent.com.
//
// That host still answers 5xx under load, so a failed fetch is tried again with a longer wait. A
// file that arrives whole and hashes differently is a real change and is reported at once.
const FETCH_ATTEMPTS = 4
/** @param {string} address @param {string} sha256 @param {string} into */
async function fetchFace(address, sha256, into) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(address)
    if (response.ok) {
      const bytes = new Uint8Array(await response.arrayBuffer())
      const digest = createHash('sha256').update(bytes).digest('hex')
      if (digest !== sha256) throw new Error(`${into}: sha256 ${digest}, not ${sha256}`)
      writeFileSync(join(out, into), bytes)
      return join(out, into)
    }
    if (attempt === FETCH_ATTEMPTS) throw new Error(`${into}: HTTP ${response.status} from ${address}`)
    console.warn(`${into}: HTTP ${response.status} from ${address}, retrying`)
    await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** (attempt - 1)))
  }
}
const NOTO = 'https://raw.githubusercontent.com/notofonts/noto-cjk/Sans2.004/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf'
const PLANES = 'https://raw.githubusercontent.com/Fitzgerald-Porthmouth-Koenigsegg/Plangothic_Project/V2.9.5795/fonts/static/PlangothicP1-Regular.ttf'
const fetched = [
  await fetchFace(NOTO, '68a3fc98800b2a27b371f2fb79991daf3633bd89309d4ffaa6946fd587f375b5', 'fonts/general.otf'),
  await fetchFace(PLANES, '550b5d0775b15405946b18f4843df439a51e69508d7e6778d94c1f7a53dc5ad6', 'fonts/planes.ttf'),
]
copyFileSync(join(import.meta.dirname, '../fonts/OFL-NotoSansCJK.txt'), join(out, 'fonts/OFL-NotoSansCJK.txt'))
copyFileSync(join(import.meta.dirname, '../fonts/OFL-Plangothic.txt'), join(out, 'fonts/OFL-Plangothic.txt'))
copyFileSync(join(import.meta.dirname, '../fonts/OFL-GenZuiSans.txt'), join(out, 'fonts/OFL-GenZuiSans.txt'))
const pairs = Object.entries(FONTS).map(([name, file]) => [join(out, 'fonts', name), join(import.meta.dirname, '../fonts', file)])
pairs.push([fetched[0], fetched[0]], [fetched[1], fetched[1]])
/** The family each face is named in the build; the sources' own names differ or collide. */
const FAMILY = { operators: 'IDS Operators', parts: 'IDS Parts', strokes: 'IDS Strokes', seal: 'IDS Seal', tangut: 'IDS Tangut', shuishu: 'IDS Shuishu', jurchen: 'IDS Jurchen', 'new-korean': 'IDS New Korean', planes: 'Plangothic Planes' }
// The shard faces of the bundled glyphs are one family upstream; each is given its own name here so
// a character resolves to the shard that has it.
const shardFonts = join(import.meta.dirname, '../fonts/unicode')
for (const file of await Array.fromAsync(new Bun.Glob('*.woff2').scan(shardFonts))) {
  const name = file.replace(/\.woff2$/, '')
  pairs.push([join(out, `fonts/unicode/${name}.ttf`), join(shardFonts, file)])
}
execFileSync('uv', ['run', '--quiet', '--with', 'fonttools', '--with', 'brotli', 'python', '-'], {
  input: `
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter
families = ${JSON.stringify(FAMILY)}
for target, source in ${JSON.stringify(pairs)}:
    font = TTFont(source)
    font.flavor = None
    name = target.rsplit('/', 1)[-1].removesuffix('.ttf')
    if name == 'operators':
        operators = set(range(0x2FF0, 0x3000)) | {0x303E, 0x31EF}
        if not operators <= font.getBestCmap().keys():
            raise ValueError('The operator font must cover all 18 IDS operators')
        subset = Subsetter()
        subset.populate(unicodes=operators)
        subset.subset(font)
    family = 'IDS Fallback ' + name if '/unicode/' in target else families.get(name)
    if family:
        for record in font['name'].names:
            if record.nameID in (1, 4, 16):
                record.string = family
            elif record.nameID == 6:
                record.string = family.replace(' ', '')
    font.save(target)
`,
  stdio: ['pipe', 'inherit', 'inherit'],
})
for (const file of Object.keys(FONTS)) console.log(`font ${file} ${readFileSync(join(out, 'fonts', file)).length} bytes`)
console.log(`fonts general.otf, planes.ttf, ${pairs.length - Object.keys(FONTS).length} shards`)

// The scripts with bundled outlines, and the glyphs of the parts beyond what an installed font draws.
// They are the drawing engine's data, so they come from its package.
const ENGINE = join(import.meta.dirname, '../node_modules/@han-compose/composer/data')
const DATA = ['tangut', 'bopomofo', 'small-seal', 'new-korean', 'shuishu', 'jurchen', 'palette']
const NUMBERED = 'numbered-sans-outlines.json.gz'
for (const name of DATA) {
  copyFileSync(join(ENGINE, `sources/${name}/outlines.json.gz`), join(out, `data/${name}-outlines.json.gz`))
  console.log(`data ${name}`)
}
// The Sans cuts of the numbered components, which the palette lays over its own outlines.
copyFileSync(join(ENGINE, NUMBERED), join(out, `data/${NUMBERED}`))
console.log(`data ${NUMBERED}`)
const shards = join(ENGINE, 'unicode/outlines')
for (const file of (await Array.fromAsync(new Bun.Glob('*.json.gz').scan(shards)))) {
  copyFileSync(join(shards, file), join(out, 'data/unicode-outlines', file))
}
console.log(`data ${(await Array.fromAsync(new Bun.Glob('*.json.gz').scan(shards))).length} unicode shards`)

// An IDS to the character it describes, from BabelStone's table and the editorial descriptions.
const table = await new Response(Bun.file(join(import.meta.dirname, '../data/babelstone-ids.tsv.gz')).stream()
  .pipeThrough(new DecompressionStream('gzip'))).text()
const editorial = ['shuishu', 'jurchen'].map(name => JSON.parse(gunzipSync(readFileSync(join(import.meta.dirname, `../data/${name}.json.gz`)))))
const { index, rows } = buildIdsIndex(table, editorial)
writeFileSync(join(out, 'data/ids-index.json.gz'), gzipSync(JSON.stringify(index)))
console.log(`index ${Object.keys(index).length} descriptions of ${rows} rows`)
