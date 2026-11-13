// @ts-check
// The workshop's data adapter: every bundled table the editor, the palette and the pages beside
// them read, each fetched when first asked for.
import { smallSealAdapter } from '../../src/adapter/index.js'
import ids from '../../data/babelstone-ids.tsv.gz?url'
import layers from '../../data/tangut-layers.json.gz?url'
import zitools from '../../data/yi-bai-ids.tsv.gz?url'
import corpus from '../../data/ids-corpus.json.gz?url'
import projectIds from '../../data/ids-project.tsv.gz?url'
import overwriteIds from '../../data/ids-overwrites.tsv?url'
import components from '../../data/ids-components.tsv?url'
import sealData from '../../data/small-seal.json.gz?url'
import shuishuData from '../../data/shuishu.json.gz?url'
import jurchenData from '../../data/jurchen.json.gz?url'
import sealExtraParts from '../../data/seal-extra-parts.json'
import parts from '../../data/ids-parts.json?url'
import sketches from '../../data/sketch-parts.json.gz?url'
import forms from '../../data/component-forms.tsv?url'
import names from '../../data/component-names.tsv?url'
import folds from '../../data/component-name-folds.tsv?url'
import characterInfo from '../../data/character-info.json.gz?url'
import chains from '../../data/zi-tools-chains.tsv.gz?url'
import custom from '../../data/custom-components.json.gz?url'
import customOutlines from '../../data/custom-outlines.json.gz?url'
import characters from '../../data/character-vocabulary.tsv.gz?url'

const sealAdapter = smallSealAdapter({ data: sealData, shuishu: shuishuData, jurchen: jurchenData, ids, layers, zitools, chise: corpus, project: projectIds, overwrite: overwriteIds, components, parts, sketches, forms, names, folds, characters, customOutlines, characterInfo, chains, custom })

/** The adapter, with the Small Seal forms the curated palette leaves out added to its parts. */
export const dataAdapter = { ...sealAdapter, parts: async () => {
  const curated = await sealAdapter.parts()
  const seen = new Set(curated.map(part => part.part))
  return [...curated, ...sealExtraParts.filter(part => !seen.has(part)).map(part => ({ part, kind: /** @type {const} */ ('seal'), sealGroup: /** @type {const} */ ('other') }))]
} }
