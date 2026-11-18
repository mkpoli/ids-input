// @ts-check

/** @typedef {import('./model.js').Node} Node */
/** @typedef {import('./model.js').Document} Document */
/** @typedef {import('./model.js').DocumentFace} DocumentFace */

/** @param {Node} layer @param {DocumentFace} [face] */
export function transformForFace(layer, face) {
  return (face ? layer.faceTransforms?.[face] : undefined) ?? layer.transform
}

/** Resolve the authored placement before handing the document to a renderer.
 * @param {Document} document @param {DocumentFace} [face] @returns {Document} */
export function documentForFace(document, face) {
  if (!face) return document
  /** @param {Node} layer @returns {Node} */
  const resolve = layer => {
    const transform = layer.faceTransforms?.[face]
    const resolved = transform === undefined ? layer : { ...layer, transform }
    if (resolved.kind === 'operator') return { ...resolved, children: resolved.children.map(resolve) }
    if (resolved.kind === 'group') return { ...resolved, child: resolve(resolved.child) }
    return resolved
  }
  return { ...document, root: resolve(document.root) }
}
