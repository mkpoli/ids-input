// The PDF editions of the zi.tools IDS Extension specification: docs/spec/spec.typ set in English,
// Simplified and Traditional Chinese from the appendix page's own data (demo/lib/baishi.js, the
// page's messages and quotations) and grammar (data/baishi-ids*.ebnf), with a railroad diagram per
// rule drawn by the page's generator (demo/lib/railroad.js). Typst and every font are pinned by
// version and SHA-256 and fetched into cache/spec-pdf/; the PDFs go to dist/spec/.
//
//   bun run build:spec-pdf            all three editions
//   bun run build:spec-pdf en         one edition
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as baishi from '../demo/lib/baishi.js'
import { railroad, readGrammar, withoutComments } from '../demo/lib/railroad.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'cache/spec-pdf')
const OUT = join(ROOT, 'dist/spec')
const EDITIONS = ['en', 'zh-Hans', 'zh-Hant']
const NAME = 'zi-tools-ids-extension-spec'

const TYPST = {
  version: '0.15.1',
  url: 'https://github.com/typst/typst/releases/download/v0.15.1/typst-x86_64-unknown-linux-musl.tar.xz',
  sha256: 'a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c',
}
const NOTO_SANS = 'https://github.com/notofonts/noto-cjk/raw/Sans2.004/Sans/SubsetOTF'
const NOTO_SERIF = 'https://github.com/notofonts/noto-cjk/raw/Serif2.003/Serif/SubsetOTF'
const PLANGOTHIC = 'https://github.com/Fitzgerald-Porthmouth-Koenigsegg/Plangothic-Project/releases/download/V2.9.5795'
/** Each font file, where it comes from and its digest. */
const FONTS = [
  ['NotoSansSC-Regular.otf', `${NOTO_SANS}/SC/NotoSansSC-Regular.otf`, 'faa6c9df652116dde789d351359f3d7e5d2285a2b2a1f04a2d7244df706d5ea9'],
  ['NotoSansSC-Bold.otf', `${NOTO_SANS}/SC/NotoSansSC-Bold.otf`, 'c6cb5a93abaa9edc8ee7463b7ebb7f42d618d40e6ed2f7a5371c97b0b64767c0'],
  ['NotoSansTC-Regular.otf', `${NOTO_SANS}/TC/NotoSansTC-Regular.otf`, '5bab0cb3c1cf89dde07c4a95a4054b195afbcfe784d69d75c340780712237537'],
  ['NotoSansTC-Bold.otf', `${NOTO_SANS}/TC/NotoSansTC-Bold.otf`, '55420b259eb119bf5f2a0aadba10cf9d736c12d64ab93e78546d69ef5f43558b'],
  ['NotoSerifSC-Regular.otf', `${NOTO_SERIF}/SC/NotoSerifSC-Regular.otf`, 'e8f396decc1f0963a016a989c3d8852e863d1350996f573860a80767c83a1cd3'],
  ['NotoSerifSC-Bold.otf', `${NOTO_SERIF}/SC/NotoSerifSC-Bold.otf`, '24693d48bdb9152f0a06b02af625638a1097abd6de4010ebba027f6e82710527'],
  ['NotoSerifTC-Regular.otf', `${NOTO_SERIF}/TC/NotoSerifTC-Regular.otf`, '63515eb0622d589a2f4062e8757c598b3da3bffd053f69abd181c210158ef10c'],
  ['NotoSerifTC-Bold.otf', `${NOTO_SERIF}/TC/NotoSerifTC-Bold.otf`, '3ca2b3294ec84b795d0a45695e78e3612a44dce50f9fc776cd40206340a5768d'],
  ['PlangothicP1-Regular.ttf', `${PLANGOTHIC}/PlangothicP1-Regular.ttf`, '550b5d0775b15405946b18f4843df439a51e69508d7e6778d94c1f7a53dc5ad6'],
  ['PlangothicP2-Regular.ttf', `${PLANGOTHIC}/PlangothicP2-Regular.ttf`, '681933370adfe0fc7253f77735275a82fea09fe4f8adba907bdeb46c110daf8f'],
  ['NotoEmoji.ttf', 'https://github.com/google/fonts/raw/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notoemoji/NotoEmoji%5Bwght%5D.ttf', 'de6c18832938afc99caf132b39d6a30a19bac7f2e812e28db2535b4608d27551'],
]

/** Jigmo's three files, which come in one archive. */
const JIGMO = {
  url: 'https://kamichikoichi.github.io/jigmo/Jigmo-20250912.zip',
  sha256: '5744c7386d129475d87607ca66d043c8793c65448adeaedc921b6931890e5d0b',
  files: {
    'Jigmo.ttf': 'c8f295b9bd8f9f117a76b3a454aaaa1bb5b4babc18e254978c6deb88464e40cf',
    'Jigmo2.ttf': '5da3582efe77e22073b86b3b86b556d7111148a76b957cfb53318a91da2efff0',
    'Jigmo3.ttf': '815b18c1c670103723fe743090559208fdea47dc587ecb057a5a4721ee8dfeff',
  },
}

const sha256 = (/** @type {Buffer} */ bytes) => createHash('sha256').update(bytes).digest('hex')

/** A pinned file in the cache, downloaded once and checked every time. @param {string} path @param {string} url @param {string} digest */
async function fetchPinned(path, url, digest) {
  if (!existsSync(path)) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
    writeFileSync(path, Buffer.from(await response.arrayBuffer()))
  }
  const got = sha256(readFileSync(path))
  if (got !== digest) { rmSync(path); throw new Error(`${path}: SHA-256 ${got}, expected ${digest}`) }
}

/** The pinned compiler: the one on PATH if it reports that version, otherwise the release build,
 * which exists for x86-64 Linux only here. */
async function typst() {
  const found = spawnSync('typst', ['--version'], { encoding: 'utf8' })
  if (found.status === 0 && found.stdout.startsWith(`typst ${TYPST.version} `)) return 'typst'
  if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error(`Install Typst ${TYPST.version} on PATH; the pinned download is for x86-64 Linux`)
  const dir = join(CACHE, `typst-${TYPST.version}`)
  const binary = join(dir, 'typst-x86_64-unknown-linux-musl/typst')
  if (!existsSync(binary)) {
    mkdirSync(dir, { recursive: true })
    await fetchPinned(join(dir, 'typst.tar.xz'), TYPST.url, TYPST.sha256)
    execFileSync('tar', ['-xJf', 'typst.tar.xz'], { cwd: dir })
  }
  return binary
}

/** The font folder Typst reads, holding the pinned files and nothing else. */
async function fonts() {
  const dir = join(CACHE, 'fonts')
  mkdirSync(dir, { recursive: true })
  for (const [file, url, digest] of FONTS) await fetchPinned(join(dir, file), url, digest)
  const names = Object.keys(JIGMO.files)
  if (names.some(name => !existsSync(join(dir, name)))) {
    const archive = join(CACHE, 'Jigmo-20250912.zip')
    await fetchPinned(archive, JIGMO.url, JIGMO.sha256)
    execFileSync('unzip', ['-o', '-q', archive, ...names, '-d', dir])
  }
  for (const [name, digest] of Object.entries(JIGMO.files)) {
    const got = sha256(readFileSync(join(dir, name)))
    if (got !== digest) throw new Error(`${name}: SHA-256 ${got}, expected ${digest}`)
  }
  const pinned = new Set([...FONTS.map(([file]) => file), ...names])
  for (const file of readdirSync(dir)) if (!pinned.has(file)) rmSync(join(dir, file), { recursive: true })
  return dir
}

const read = (/** @type {string} */ path) => readFileSync(join(ROOT, path), 'utf8')
const json = (/** @type {string} */ path) => JSON.parse(read(path))
/** A rule's file name. @param {string} name */
const slug = name => name.replace(/ /g, '-')

// The diagrams in print: the page's colours (demo/Baishi.svelte, .railroad) as fixed values, and
// the monospace face the generator measures its boxes for.
const STYLE = `<style>
path{stroke:#5c6370;stroke-width:1.5;fill:none}
rect{stroke:#8a9099;stroke-width:1.2;fill:#ffffff}
.terminal rect,.special rect{fill:#eef0f3}
.special rect{stroke-dasharray:4 3}
text{font-family:'DejaVu Sans Mono','Noto Sans SC','Plangothic P1','Plangothic P2';font-size:12.5px;text-anchor:middle;fill:#1d2128}
.non-terminal text{fill:#1f5fa8}
</style>`

/** Every rule of the grammar file, its text and its diagram written beside the data. */
function grammar() {
  const english = read('data/baishi-ids.ebnf')
  const rules = readGrammar(english)
  for (const file of ['data/baishi-ids.zh-Hans.ebnf', 'data/baishi-ids.zh-Hant.ebnf']) {
    const other = readFileSync(join(ROOT, file), 'utf8')
    const flat = (/** @type {string} */ text) => withoutComments(text).replace(/\s+/g, ' ').trim()
    if (flat(other) !== flat(english)) throw new Error(`${file}: its rules differ from data/baishi-ids.ebnf`)
  }
  const dir = join(CACHE, 'railroad')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return [...rules].map(([name, rule]) => {
    const { svg, width, height } = railroad(rules, name)
    const file = `${slug(name)}.svg`
    writeFileSync(join(dir, file), svg.replace(/^(<svg[^>]*>)/, `$1${STYLE}`))
    return { name, text: rule.text, file, width, height }
  })
}

/**
 * What the page renders, in its order: each quotation, example list, rule list and citation it
 * places, read from demo/Baishi.svelte and from docs/spec/spec.typ the same way. The PDF must say
 * what the page says, so any difference stops the build.
 * @param {string} source @param {RegExp} call
 */
function placements(source, call) {
  return [...source.matchAll(call)]
    .map(match => `${match[1]}(${match[2].replace(/'/g, '"').replace(/[[\]()]/g, '').replace(/\s+/g, ' ').replace(/, ?/g, ',').replace(/,$/, '').replace('current: ', '').trim()})`)
    // Calls inside the snippets themselves, which place whatever they are handed.
    .filter(one => !/^(said|examples|grammar|at)\((id|key|names|cite|one|doc)\b/.test(one))
}
/** The line in docs/spec/spec.typ after which the sections are the edition's own. */
const OWN = "// ---------------------------------------------------------------- the edition's own sections"
function checkParity() {
  const own = placements(read('demo/Baishi.svelte'), /@render (said|examples|grammar|at)\(([^)]*\)?)\)/g)
  const ours = placements(read('docs/spec/spec.typ').split(OWN)[0], /#(said|examples|grammar|at)\(([^)]*\)?)\)/g)
  const width = Math.max(own.length, ours.length)
  for (let i = 0; i < width; i++) {
    if (own[i] !== ours[i]) throw new Error(`docs/spec/spec.typ parts from the page at placement ${i + 1}: page ${own[i] ?? '(end)'}, spec ${ours[i] ?? '(end)'}`)
  }
  // Every message the page names outright (keys built from data are the tables', checked above
  // through the data), in the same order. Left out: the page's title bar, its contents list and
  // the label of the contents list, the accessible names of its rule list and of the → between a
  // text and what it becomes (the PDF shows the arrow), the links to the cheatsheet and to the
  // diagram's own page, and the heading of the parser, which reads text typed into the page.
  const PAGE_ONLY = new Set(['baishi.title', 'baishi.contents', 'baishi.grammar', 'baishi.becomes', 'baishi.toCheatsheet', 'baishi.grand.page', 'baishi.heading.parser'])
  const keys = (/** @type {string} */ text) => [...text.matchAll(/\bt\(\s*['"](baishi\.[\w.]+)['"]/g)]
    .map(match => match[1]).filter(key => !key.endsWith('.') && !PAGE_ONLY.has(key))
  const pageKeys = keys(read('demo/Baishi.svelte'))
  const specKeys = keys(read('docs/spec/spec.typ').split(OWN)[0])
  for (let i = 0; i < Math.max(pageKeys.length, specKeys.length); i++) {
    if (pageKeys[i] !== specKeys[i]) throw new Error(`docs/spec/spec.typ parts from the page at message ${i + 1}: page ${pageKeys[i] ?? '(end)'}, spec ${specKeys[i] ?? '(end)'}`)
  }
  return own.length + pageKeys.length
}

/** The data the document reads: the page's tables, examples and quotations, its messages, the grammar. */
function data() {
  const spec = json('docs/spec/messages.json')
  /** @type {Record<string, Record<string, string>>} */
  const messages = {}
  const english = json('demo/messages/en.json')
  for (const edition of EDITIONS) {
    const own = json(`demo/messages/${edition}.json`)
    const pick = (/** @type {Record<string, string>} */ all) => Object.fromEntries(Object.entries(all).filter(([key]) => key.startsWith('baishi.')))
    messages[edition] = { ...pick(english), ...pick(own), ...spec[edition] }
    for (const key of Object.keys(spec.en)) if (!(key in spec[edition])) throw new Error(`docs/spec/messages.json: ${edition} lacks ${key}`)
  }
  const { splitTag: _split, descriptionsOf: _descriptions, ...tables } = baishi
  return { ...tables, messages, glosses: json('demo/lib/baishi-quotes/en.json'), rules: grammar() }
}

function commit() {
  const git = (/** @type {string[]} */ args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
  // A build from uncommitted changes names its commit as git describe does, with -dirty.
  const dirty = git(['status', '--porcelain']) !== ''
  return { hash: git(['rev-parse', 'HEAD']), dirty, time: Number(git(['log', '-1', '--format=%ct'])), date: git(['log', '-1', '--format=%cs']) }
}

const wanted = process.argv.slice(2)
for (const one of wanted) if (!EDITIONS.includes(one)) throw new Error(`Unknown edition ${one}; one of ${EDITIONS.join(', ')}`)
const placed = checkParity()
const compiler = await typst()
const fontDir = await fonts()
mkdirSync(CACHE, { recursive: true })
writeFileSync(join(CACHE, 'data.json'), JSON.stringify(data()))
mkdirSync(OUT, { recursive: true })
const { hash, dirty, time, date } = commit()
if (dirty) console.warn('The working tree has uncommitted changes; the editions name the commit with -dirty.')
for (const edition of wanted.length ? wanted : EDITIONS) {
  const pdf = join(OUT, `${NAME}.${edition}.pdf`)
  execFileSync(compiler, [
    'compile', '--root', ROOT, '--font-path', fontDir, '--ignore-system-fonts',
    '--input', `lang=${edition}`, '--input', `commit=${hash}`, '--input', `dirty=${dirty}`, '--input', `typst=${TYPST.version}`, '--input', `date=${date}`,
    '--creation-timestamp', String(time), '--pdf-standard', 'ua-1',
    join(ROOT, 'docs/spec/spec.typ'), pdf,
  ], { stdio: 'inherit', env: { ...process.env, SOURCE_DATE_EPOCH: String(time) } })
  console.log(`${pdf.slice(ROOT.length + 1)}  ${(readFileSync(pdf).length / 1024).toFixed(0)} KB`)
}
console.log(`${placed} placements and messages match demo/Baishi.svelte`)
