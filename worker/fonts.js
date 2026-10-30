// @ts-nocheck
// The faces a card's text is set in, read once each from the built assets: the general face and the
// two subsets for strokes and supplementary parts, the characters' own script faces, and the shard
// face that draws a component no general face has. Which face a character takes is decided here, so
// `card.js` only asks.
import { hasUnicodeGlyph } from '../src/composer/unicode.js'

const GENERAL = 'general'
const SHARDS = 'unicode'
const ALWAYS = [GENERAL, 'parts', 'strokes']
const FAMILY = { general: 'Noto Sans CJK JP', planes: 'Plangothic Planes', parts: 'IDS Parts', strokes: 'IDS Strokes', seal: 'IDS Seal', tangut: 'IDS Tangut', shuishu: 'IDS Shuishu', 'new-korean': 'IDS New Korean' }
const SCRIPTS = [
  { face: 'seal', range: [0x3D000, 0x3FC3F] },
  { face: 'tangut', range: [0x17000, 0x18DFF] },
  { face: 'shuishu', range: [0x1B300, 0x1B52E] },
  { face: 'new-korean', range: [0xA97D, 0xA97F] },
]

/** @type {Map<string, Promise<Uint8Array | null>>} */
const kept = new Map()

/** A face's file name in the build: the general face is OpenType, every other one TrueType. @param {string} name */
const fileOf = name => name === GENERAL ? `${GENERAL}.otf` : `${name}.ttf`

/** A face's bytes, or null where the build left it out. @param {any} env @param {string} name */
function face(env, name) {
  if (!kept.has(name)) {
    kept.set(name, env.ASSETS.fetch(new URL(`/og/fonts/${fileOf(name)}`, 'https://assets/'))
      .then(answer => answer.ok ? answer.arrayBuffer() : null)
      .then(bytes => bytes === null ? null : new Uint8Array(bytes))
      .catch(() => null))
  }
  return kept.get(name)
}

const within = (point, [from, to]) => point >= from && point <= to
const shardOf = character => /** @type {number} */ (character.codePointAt(0) >> 8).toString(16).padStart(3, '0')

/** The face a character is set in: its script's, the parts subset outside the plane fonts cover, or a shard face. @param {string} character */
function nameOf(character) {
  const point = character.codePointAt(0) ?? 0
  const script = SCRIPTS.find(({ range }) => within(point, range))
  if (script) return script.face
  if (within(point, [0x2E80, 0x2EFF]) || within(point, [0x31E4, 0x31EF])) return 'parts'
  if (point > 0xFFFF) return 'planes'
  if (point === 0x2B1A || within(point, [0x31C0, 0x31E3])) return 'strokes'
  if (hasUnicodeGlyph(character)) return `${SHARDS}/${shardOf(character)}`
  return GENERAL
}

/**
 * The faces for `sequence`, and the face each of its characters is set in.
 * @param {any} env @param {string} sequence
 * @returns {Promise<{ buffers: Uint8Array[], familyOf: (character: string) => string }>}
 */
export async function facesFor(env, sequence) {
  const names = new Set(ALWAYS)
  for (const character of sequence) names.add(nameOf(character))
  const ordered = [...names]
  const bytes = await Promise.all(ordered.map(name => face(env, name)))
  return {
    buffers: bytes.filter(Boolean),
    familyOf: character => { const name = nameOf(character); return FAMILY[name] ?? `IDS Fallback ${name.slice(SHARDS.length + 1)}` },
  }
}
