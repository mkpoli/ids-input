// @ts-check
// What one palette cell or one character info card can say about a CJK stroke, a CJK or Kangxi
// radical, and the unified ideograph that stands for it: its Unicode name, the other encoded forms
// Unicode calls visually identical or near-identical, and for a stroke a reading of its name.
//
// The equivalences are the Equivalent_Unified_Ideograph property, which maps CJK radicals and the
// CJK Strokes block to "reasonably equivalent CJK unified ideographs in that they are visually
// identical or near-identical" (EquivalentUnifiedIdeograph.txt, header). Nothing here groups forms
// on any other ground, so visual lookalikes Unicode keeps apart (己 and 已, 日 and 曰) stay apart.
//
// Stroke symbols are U+31C0..U+31E5. U+31EF IDEOGRAPHIC DESCRIPTION CHARACTER SUBTRACTION shares
// the CJK Strokes block but is an operator, not a stroke, and is never treated as one.
//
// Stroke names abbreviate traditional Chinese terms (Unicode 18.0, §18.1.16). The Pīnyīn readings
// follow Appendix F: the 15.1 table for U+31C0..U+31E3, the 18.0 figures for U+31E4 and U+31E5.
// The English descriptions (héng → horizontal, zhé → turn, gōu → hook) are editorial translations.
//
// The table is `component-identity.json`, built from the pinned sources it records, Unicode 18.0.0.
import data from './component-identity.json' with { type: 'json' }

/**
 * @typedef {{ label: string, url: string, license?: string }} IdentitySource
 *
 * @typedef {object} ComponentIdentity What Unicode records about one component's identity.
 * @property {'stroke' | 'radical' | 'ideograph'} type Whether it is a CJK stroke, a CJK or Kangxi radical, or the unified ideograph a family is equivalent to.
 * @property {string} name Its Unicode character name.
 * @property {string} [strokeName] A concise English reading of a stroke's name, strokes only.
 * @property {string[]} equivalents The other encoded forms of the same family, the unified ideograph first.
 * @property {IdentitySource[]} sources The sources the fields are read from.
 */

const STROKE_FIRST = 0x31c0, STROKE_LAST = 0x31e5
/** @type {Record<string, string[]>} */ const FAMILIES = data.families
/** @type {Record<string, string>} */ const NAMES = data.names
/** @type {Record<string, { acronym: string, pinyin: string, english: string, pinyinTier: string }>} */
const STROKES = data.strokes
const [EQUIVALENTS, UNICODE_DATA, CORE_SPEC, APPENDIX_F, , APPENDIX_F_18] = data.sources
/** The English words are this module's gloss of the Pīnyīn, not Unicode's wording. */
const EDITORIAL = {
  label: 'Editorial English stroke glosses',
  url: 'https://github.com/mkpoli/ids-input/blob/main/src/core/component-identity.js',
}

/** @type {Map<string, string>} Member code point to the code point of its equivalent ideograph. */
const target = new Map()
for (const [ideograph, members] of Object.entries(FAMILIES)) for (const member of members) target.set(member, ideograph)

/** @param {string} char @returns {string | null} */
const point = char => [...char].length === 1 ? (char.codePointAt(0) ?? 0).toString(16).toUpperCase() : null
/** @param {string} hex */
const isStrokePoint = hex => { const cp = parseInt(hex, 16); return cp >= STROKE_FIRST && cp <= STROKE_LAST }
/** @param {string} hex */
const char = hex => String.fromCodePoint(parseInt(hex, 16))

/** The Equivalent_Unified_Ideograph family one component belongs to, by the ideograph's code point.
 * @param {string} component @returns {string | null} */
export function familyPoint(component) {
  const hex = point(component)
  if (hex === null) return null
  return hex in FAMILIES ? hex : target.get(hex) ?? null
}

/** Whether a component is a CJK stroke symbol; U+31EF, the subtraction operator, is not one.
 * @param {string} component */
export const isStroke = component => { const hex = point(component); return hex !== null && isStrokePoint(hex) }

/** What Unicode records about one component, or null where it records no stroke, radical or
 * equivalence for it. Read-only: nothing here depends on or changes editor state.
 * @param {string} component @returns {ComponentIdentity | null} */
export function componentIdentity(component) {
  const hex = point(component)
  if (hex === null) return null
  const family = hex in FAMILIES ? hex : target.get(hex)
  const members = (family === undefined ? [] : FAMILIES[family]).filter(member => member !== hex)
  /** @type {string[]} */
  const equivalents = (family === undefined || family === hex ? [] : [char(family)]).concat(members.map(char))
  if (isStrokePoint(hex)) {
    const stroke = STROKES[hex]
    return {
      type: 'stroke', name: NAMES[hex], strokeName: stroke.english, equivalents,
      sources: [UNICODE_DATA, CORE_SPEC, stroke.pinyinTier === 'appendix-f' ? APPENDIX_F : APPENDIX_F_18, EDITORIAL]
        .concat(equivalents.length ? [EQUIVALENTS] : []),
    }
  }
  if (hex in NAMES) return { type: 'radical', name: NAMES[hex], equivalents, sources: [UNICODE_DATA].concat(equivalents.length ? [EQUIVALENTS] : []) }
  if (family === hex || /^\p{Unified_Ideograph}$/u.test(component)) return {
    type: 'ideograph', name: `${parseInt(hex, 16) >= 0xf900 && parseInt(hex, 16) <= 0xfaff ? 'CJK COMPATIBILITY IDEOGRAPH' : 'CJK UNIFIED IDEOGRAPH'}-${hex}`, equivalents,
    sources: [UNICODE_DATA].concat(equivalents.length ? [EQUIVALENTS] : []),
  }
  return null
}

/** Keep a stroke and the radicals and ideograph it is equivalent to adjacent in the parts palette,
 * at the family's first existing position, most-used form first.
 *
 * Only families with a stroke symbol among the given parts move; an ordinary variant family (馬马,
 * 金釒钅) keeps the order the palette gave it. The caller supplies one visible group, so a filtered
 * palette groups only what it shows. The parts come back as the same objects, strings untouched.
 * @param {import('../adapter/types.js').PalettePart[]} parts
 */
export function adjacentStrokeForms(parts) {
  const families = parts.map(part => familyPoint(part.part))
  const grouped = new Set(families.filter((family, at) => family !== null && isStroke(parts[at].part)))
  /** @type {Map<string, [import('../adapter/types.js').PalettePart, number][]>} */
  const groups = new Map()
  parts.forEach((part, at) => {
    const family = families[at]
    const key = family !== null && grouped.has(family) ? `family ${family}` : `part ${at}`
    const group = groups.get(key)
    if (group) group.push([part, at])
    else groups.set(key, [[part, at]])
  })
  return [...groups.values()].flatMap(group => [...group]
    .sort(([a, at], [b, bt]) => (b.uses ?? 0) - (a.uses ?? 0) || at - bt)
    .map(([part]) => part))
}

/** The sources the table is built from, pinned to one Unicode version. */
export const IDENTITY_SOURCES = /** @type {readonly IdentitySource[]} */ (data.sources)
export const IDENTITY_UNICODE_VERSION = data.unicodeVersion
