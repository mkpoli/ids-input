// Local editorial decisions are exported independently of the attested IDS data.
import { isNode, parse } from '../../src/core/ids.js'
export const SEAL_REVIEW_KEY = 'ids-input.seal-reviews.v1'

export function reviewKey(comparison, candidate) {
  return JSON.stringify([comparison.char, comparison.generator, comparison.sources, comparison.modernSource, candidate])
}

export function validReviewIds(text, char) {
  const parsed = parse(text)
  const complete = part => isNode(part) ? part.parts.every(complete) : Boolean(part && [...part][0] !== '？' && [...part][0] !== [...char][0])
  return !parsed.problem && isNode(parsed.tree) && complete(parsed.tree)
}

export function makeReview(comparison, candidate, text, note, decision, now = new Date().toISOString()) {
  if (!['accepted', 'rejected'].includes(decision)) throw new Error('Invalid review decision')
  if (decision === 'accepted' && !validReviewIds(text, comparison.char)) throw new Error('A complete IDS without self-reference is required')
  return { id: reviewKey(comparison, candidate), char: comparison.char, decision, text, note, reviewedAt: now,
    candidate, evidence: { generator: comparison.generator, modern: comparison.modern,
      attested: comparison.attested, records: comparison.records, sources: comparison.sources, modernSource: comparison.modernSource } }
}

export function readReviews(raw) {
  if (!raw) return []
  const doc = JSON.parse(raw)
  if (doc.format !== 1 || !Array.isArray(doc.reviews) || doc.reviews.some(r =>
    !r || typeof r.id !== 'string' || typeof r.char !== 'string' || !['accepted', 'rejected'].includes(r.decision)
    || typeof r.text !== 'string' || typeof r.note !== 'string' || typeof r.reviewedAt !== 'string' || !Number.isFinite(Date.parse(r.reviewedAt))
    || !r.candidate || !r.evidence || r.decision === 'accepted' && !validReviewIds(r.text, r.char))) throw new Error('Invalid seal review journal')
  return doc.reviews
}

export function mergeReviews(...lists) {
  const byId = new Map()
  for (const review of lists.flat()) {
    const previous = byId.get(review.id)
    if (!previous || Date.parse(review.reviewedAt) >= Date.parse(previous.reviewedAt)) byId.set(review.id, review)
  }
  return [...byId.values()]
}
export const exportReviews = reviews => JSON.stringify({ format: 1, kind: 'small-seal-editorial-reviews', reviews }, null, 2)

export function persistReview(storage, current, review) {
  const latest = readReviews(storage.getItem(SEAL_REVIEW_KEY))
  const merged = mergeReviews(latest, current, [review])
  storage.setItem(SEAL_REVIEW_KEY, exportReviews(merged))
  return merged
}
