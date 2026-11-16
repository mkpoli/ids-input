// The section anchors of the zi.tools IDS Extension, shared by its specification (/baishi) and its
// cheatsheet (/baishi-cheatsheet). Every rule of data/baishi-ids.ebnf is a section, its id the rule
// name in kebab case and its parent the rule that first names it, in the order the grammar nests
// from `row`; a few constructs that are no rule of their own and the prose sections follow. Both
// pages take their anchors from here, so a link from one page lands on the same id on the other.
import ebnf from '../../data/baishi-ids.ebnf?raw'
import { readGrammar, references } from './railroad.js'

/** @typedef {{ id: string, rule: string | null, parent: string | null, title: string | null }} Section */

/** A rule's anchor. @param {string} rule */
export const ruleId = rule => rule.replaceAll(' ', '-')

const grammar = readGrammar(ebnf)
/** @type {Section[]} */
const rules = []
/** @param {string} name @param {string | null} parent */
function visit(name, parent) {
  if (rules.some(one => one.rule === name)) return
  // The rule name is the section's title on both pages.
  rules.push({ id: ruleId(name), rule: name, parent: parent && ruleId(parent), title: null })
  const rule = grammar.get(name)
  if (rule) for (const child of references(rule.expr)) visit(child, name)
}
visit('row', null)
for (const name of grammar.keys()) visit(name, null)

/** Constructs that are part of a rule rather than a rule, with the rule they belong to. */
const CONSTRUCTS = /** @type {Section[]} */ ([
  { id: 'entry-separator', rule: null, parent: 'primary-group', title: 'baishi.heading.entrySeparator' },
  { id: 'katakana', rule: null, parent: 'component', title: 'baishi.heading.katakana' },
  { id: 'ucv-position', rule: null, parent: 'style-tag', title: 'baishi.heading.ucv' },
  { id: 'imaginary-ucv', rule: null, parent: 'style-tag', title: 'baishi.heading.imaginary' },
  { id: 'closing', rule: null, parent: 'stroke-chain', title: 'baishi.heading.closed' },
  { id: 'reverse-matrix', rule: null, parent: 'overlap-modifier', title: 'baishi.heading.reverseMatrix' },
])

/** The prose sections of the specification. */
const PROSE = /** @type {Section[]} */ ([
  { id: 'parser', rule: null, parent: null, title: 'baishi.heading.parser' },
  { id: 'differences', rule: null, parent: null, title: 'baishi.heading.data' },
  { id: 'unsettled', rule: null, parent: null, title: 'baishi.heading.unsettled' },
  { id: 'sources', rule: null, parent: null, title: 'baishi.heading.documents' },
  { id: 'other-sources', rule: null, parent: null, title: 'baishi.heading.otherSources' },
])

/** Every shared anchor, top down. */
export const SECTIONS = [...rules, ...CONSTRUCTS, ...PROSE]

/** The anchors the cheatsheet has, so the specification links only to those. */
export const CHEATSHEET_SECTIONS = /** @type {const} */ ([
  'row', 'primary-group', 'alternative-group', 'entry-separator', 'entry', 'uniqueness-prefix', 'sequence-variants',
  'ids', 'unary-operator', 'binary-operator', 'overlap-operator', 'indexed-operator', 'ternary-operator',
  'component', 'taggable-char', 'katakana',
  'variant-id', 'component-variant', 'source-letter', 'style-tag', 'ucv-position', 'imaginary-ucv',
  'stroke-chain', 'stroke-letter', 'reversal', 'crossing', 'break', 'closing', 'curve',
  'overlap-modifier', 'slice', 'crossing-matrix', 'reverse-matrix', 'index-modifier',
])

/**
 * A link to a section on one of the two pages, keeping the address's query (its language).
 * @param {'spec' | 'cheatsheet'} page @param {string} id
 */
export const sectionHref = (page, id) =>
  `${page === 'spec' ? './baishi.html' : './baishi-cheatsheet.html'}${typeof location === 'undefined' ? '' : location.search}#${id}`
