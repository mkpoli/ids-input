#!/usr/bin/env bun
// Rebuild demo/lib/font-inventory.json from the live composer export manifests in COMPOSER_BASES
// and the per-face cut/form JSON tables bundled in @han-compose/composer.
//
//   bun scripts/build-font-inventory.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COMPOSER_BASES } from '../demo/lib/composer.js'

const FACES = [
  { key: 'sans', name: 'Sans' },
  { key: 'serif', name: 'Serif' },
  { key: 'woodblock', name: 'Woodblock' },
  { key: 'fangsong', name: 'Fangsong' },
  { key: 'regular', name: 'Regular' },
  { key: 'pen-writing', name: 'Pen' },
]

const FACE_KEYS = FACES.map(f => f.key)

const DISPLAY_NAMES = {
  'Nom Na Tong': 'Nôm Na Tống',
}

/** Normalize a manifest outline font entry into a concise display label. */
function normalizeFontName(raw) {
  const cleaned = String(raw).replace(/\s*\([^)]*\)\s*$/, '').trim()
  if (/^Jigmo[23]?$/.test(cleaned)) return 'Jigmo'
  return DISPLAY_NAMES[cleaned] ?? cleaned
}

/** Collapse multi-plane font families (Plangothic P1/P2, TW-Kai-Ext-B/G) while preserving order. */
function collapseFontLabels(labels) {
  const deduped = []
  for (const label of labels) {
    if (label && !deduped.includes(label)) deduped.push(label)
  }

  const out = []
  let i = 0
  while (i < deduped.length) {
    const cur = deduped[i]

    // Plangothic P1, Plangothic P2 -> Plangothic P1/P2
    const planMatch = cur.match(/^Plangothic (P\d+)$/)
    if (planMatch) {
      const planes = [planMatch[1]]
      while (i + 1 < deduped.length) {
        const nextMatch = deduped[i + 1].match(/^Plangothic (P\d+)$/)
        if (!nextMatch) break
        planes.push(nextMatch[1])
        i += 1
      }
      out.push(`Plangothic ${planes.join('/')}`)
      i += 1
      continue
    }

    // TW-Kai-Ext-B, TW-Kai-Ext-G -> Ext-B/G when TW-Kai is already listed
    const twExtMatch = cur.match(/^TW-Kai-Ext-([A-Z])$/)
    if (twExtMatch) {
      const exts = [twExtMatch[1]]
      while (i + 1 < deduped.length) {
        const nextMatch = deduped[i + 1].match(/^TW-Kai-Ext-([A-Z])$/)
        if (!nextMatch) break
        exts.push(nextMatch[1])
        i += 1
      }
      const prefix = out.includes('TW-Kai') ? 'Ext-' : 'TW-Kai-Ext-'
      out.push(`${prefix}${exts.join('/')}`)
      i += 1
      continue
    }

    out.push(cur)
    i += 1
  }
  return out
}

/** Derive display font and fallback strings from a live export manifest. */
export function summarizeOutlineFonts(manifest) {
  const outlineFonts = manifest?.licences?.outlines?.fonts
  const rawNames = Array.isArray(outlineFonts) && outlineFonts.length > 0
    ? outlineFonts.map(entry => entry.name || entry.file)
    : Object.keys(manifest?.composer?.font_sha256 ?? {}).map(file => file.replace(/\.[^.]+$/, ''))

  const labels = collapseFontLabels(rawNames.map(normalizeFontName))
  const [primary, ...rest] = labels
  return {
    font: labels.join(' + '),
    fallback: rest.length > 0 ? rest.join(' + ') : 'None (native only)',
    primary: primary ?? '',
  }
}

/** Fetch one live export manifest.json and extract inventory metrics. */
async function readExport(face) {
  const base = COMPOSER_BASES[face.key]
  const res = await fetch(`${base}manifest.json`)
  if (!res.ok) throw new Error(`${face.key}: HTTP ${res.status} for ${base}manifest.json`)
  const m = await res.json()
  const f = m.files
  const { font, fallback } = summarizeOutlineFonts(m)
  const chars = f.identity?.characters ?? 0
  const records = f.records?.entries ?? 0
  const hostKeys = f.hosts?.entries ?? 0
  const hostCuts = f.hosts?.entries_cut ?? 0
  const variants = f.variants?.characters ?? 0
  const kins = f.kin?.kins ?? 0
  const rooms = Object.keys(m.rooms ?? {}).length
  const facingLeast = m.constants?.FACING_LEAST ?? null
  const gzipBytes = (f.records?.gzip ?? 0) + (f.hosts?.gzip ?? 0) + (f.layout?.gzip ?? 0)
  return {
    ...face,
    font,
    fallback,
    version: m.version,
    commit: m.composer?.commit ?? null,
    format: m.format,
    chars,
    records,
    hostKeys,
    hostCuts,
    cutsPerChar: chars > 0 ? Number((hostCuts / chars).toFixed(2)) : 0,
    variants,
    kins,
    rooms,
    facingLeast,
    gzipMB: Number((gzipBytes / 1e6).toFixed(1)),
  }
}

/** Count entries for a given face key inside a per-face JSON table, recursively. */
function countFaceEntries(value, faceKey) {
  if (!value || typeof value !== 'object') return 0
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countFaceEntries(item, faceKey), 0)
  }
  let total = 0
  for (const [k, v] of Object.entries(value)) {
    if (k === faceKey) {
      if (Array.isArray(v)) total += v.length || 1
      else if (v && typeof v === 'object') total += Object.keys(v).length || 1
      else if (v !== null && v !== undefined && v !== false) total += 1
    } else if (typeof v === 'string' && v === faceKey && (k === 'style' || k === 'face' || k === 'fontStyle')) {
      total += 1
    } else if (v && typeof v === 'object') {
      total += countFaceEntries(v, faceKey)
    }
  }
  return total
}

async function main() {
  const composerRoot = dirname(fileURLToPath(import.meta.resolve('@han-compose/composer/package.json')))
  const composerSrc = join(composerRoot, 'src')

  const exportsList = await Promise.all(FACES.map(readExport))

  const cutTables = []
  for (const file of readdirSync(composerSrc).filter(f => f.endsWith('.json')).sort()) {
    const raw = readFileSync(join(composerSrc, file), 'utf8')
    const present = FACE_KEYS.filter(face => raw.includes(`"${face}"`))
    if (present.length < 2) continue
    let parsed
    try { parsed = JSON.parse(raw) } catch { continue }
    const counts = Object.fromEntries(FACE_KEYS.map(face => [face, present.includes(face) ? Math.max(1, countFaceEntries(parsed, face)) : 0]))
    cutTables.push({
      file,
      name: file.replace(/\.json$/, ''),
      counts,
      covered: FACE_KEYS.filter(face => counts[face] > 0).length,
    })
  }

  const out = {
    generatedAt: new Date().toISOString().slice(0, 10),
    faces: exportsList,
    cutTables,
    cutTotals: Object.fromEntries(FACE_KEYS.map(face => [face, cutTables.filter(t => t.counts[face] > 0).length])),
  }

  const target = new URL('../demo/lib/font-inventory.json', import.meta.url)
  writeFileSync(target, JSON.stringify(out, null, 2) + '\n')
  console.log(`wrote ${exportsList.length} faces and ${cutTables.length} per-face cut tables -> demo/lib/font-inventory.json`)
}

if (import.meta.main) {
  await main()
}
