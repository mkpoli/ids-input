#!/usr/bin/env bun
// The files a share card is drawn with, into `dist/og`: the bundled faces as TrueType (resvg reads
// no WOFF2), the outlines of the bundled scripts, and the table from an IDS to the character it
// describes. Run after `build:demo`, from `build:site`.
//
//   bun scripts/og-assets.mjs
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

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
  'parts.ttf': 'Plangothic-ids-parts.woff2',
  'strokes.ttf': 'NotoSansCJKjp-ids-strokes.woff2',
  'seal.ttf': 'IDSSeal-Regular.woff2',
  'tangut.ttf': 'NotoSerifTangut-Regular.woff2',
  'shuishu.ttf': 'IDSShuishu.woff2',
  'new-korean.ttf': 'IDSNewKorean.woff2',
}
// Two faces are too big to keep in the repository: fetched at pinned releases, checked, then
// converted like the rest. The general face is for the Basic Multilingual Plane, the planes face for
// the supplementary planes the parts subset leaves out.
/** @param {string} address @param {string} sha256 @param {string} into */
async function fetchFace(address, sha256, into) {
  const bytes = new Uint8Array(await (await fetch(address)).arrayBuffer())
  const digest = createHash('sha256').update(bytes).digest('hex')
  if (digest !== sha256) throw new Error(`${into}: sha256 ${digest}, not ${sha256}`)
  writeFileSync(join(out, into), bytes)
  return join(out, into)
}
const NOTO = 'https://github.com/notofonts/noto-cjk/raw/Sans2.004/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf'
const PLANES = 'https://github.com/Fitzgerald-Porthmouth-Koenigsegg/Plangothic_Project/releases/download/V2.9.5795/PlangothicP1-Regular.ttf'
const fetched = [
  await fetchFace(NOTO, '68a3fc98800b2a27b371f2fb79991daf3633bd89309d4ffaa6946fd587f375b5', 'fonts/general.otf'),
  await fetchFace(PLANES, '550b5d0775b15405946b18f4843df439a51e69508d7e6778d94c1f7a53dc5ad6', 'fonts/planes.ttf'),
]
copyFileSync(join(import.meta.dirname, '../fonts/OFL-NotoSansCJK.txt'), join(out, 'fonts/OFL-NotoSansCJK.txt'))
copyFileSync(join(import.meta.dirname, '../fonts/OFL-Plangothic.txt'), join(out, 'fonts/OFL-Plangothic.txt'))
const pairs = Object.entries(FONTS).map(([name, file]) => [join(out, 'fonts', name), join(import.meta.dirname, '../fonts', file)])
pairs.push([fetched[0], fetched[0]], [fetched[1], fetched[1]])
/** The family each face is named in the build; the sources' own names differ or collide. */
const FAMILY = { parts: 'IDS Parts', strokes: 'IDS Strokes', seal: 'IDS Seal', tangut: 'IDS Tangut', shuishu: 'IDS Shuishu', 'new-korean': 'IDS New Korean', planes: 'Plangothic Planes' }
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
families = ${JSON.stringify(FAMILY)}
for target, source in ${JSON.stringify(pairs)}:
    font = TTFont(source)
    font.flavor = None
    family = families.get(target.rsplit('/', 1)[-1].removesuffix('.ttf') if '/unicode/' not in target else 'IDS Fallback ' + target.rsplit('/', 1)[-1].removesuffix('.ttf'))
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
const DATA = ['tangut-outlines', 'bopomofo-outlines', 'small-seal-outlines', 'new-korean-outlines', 'shuishu-outlines', 'palette-outlines']
for (const name of DATA) {
  copyFileSync(join(import.meta.dirname, `../data/${name}.json.gz`), join(out, `data/${name}.json.gz`))
  console.log(`data ${name}`)
}
const shards = join(import.meta.dirname, '../data/unicode-outlines')
for (const file of (await Array.fromAsync(new Bun.Glob('*.json.gz').scan(shards)))) {
  copyFileSync(join(shards, file), join(out, 'data/unicode-outlines', file))
}
console.log(`data ${(await Array.fromAsync(new Bun.Glob('*.json.gz').scan(shards))).length} unicode shards`)

// An IDS to the character it describes, from BabelStone's table: `一\t一(GHTJKPV)` is 一 under 一,
// `鎶\t⿰釒哥(GTJV)` 鎶 under ⿰釒哥. A row may list several descriptions, each followed by the regions
// that record it; the first character listed for a description stays its own.
const table = await new Response(Bun.file(join(import.meta.dirname, '../data/babelstone-ids.tsv.gz')).stream()
  .pipeThrough(new DecompressionStream('gzip'))).text()
/** @type {Record<string, string>} */
const index = {}
let rows = 0
for (const line of table.split('\n')) {
  if (!line || line.startsWith('#')) continue
  const [char, written] = line.split('\t')
  if (!char || !written) continue
  rows++
  for (const listed of written.split(' ')) {
    const ids = listed.replace(/\([A-Z]+\)$/, '')
    if (ids) index[ids] ??= char
  }
}
writeFileSync(join(out, 'data/ids-index.json.gz'), gzipSync(JSON.stringify(index)))
console.log(`index ${Object.keys(index).length} descriptions of ${rows} rows`)
