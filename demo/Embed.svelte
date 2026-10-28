<script>
  import { IdsInput } from '../src/svelte/index.js'
  import { smallSealAdapter } from '../src/adapter/index.js'
  import ids from '../data/babelstone-ids.tsv.gz?url'
  import layers from '../data/tangut-layers.json.gz?url'
  import components from '../data/ids-components.tsv?url'
  import sealData from '../data/small-seal.json.gz?url'
  import parts from '../data/ids-parts.json?url'
  import forms from '../data/component-forms.tsv?url'
  import names from '../data/component-names.tsv?url'
  import folds from '../data/component-name-folds.tsv?url'
  import characterInfo from '../data/character-info.json.gz?url'
  import characters from '../data/character-vocabulary.tsv.gz?url'
  import charactersRare from '../data/character-vocabulary-rare.tsv.gz?url'
  const adapter = smallSealAdapter({ data: sealData, ids, layers, components, parts, forms, names, folds, characters, charactersRare, characterInfo })
  let value = $state('')
  let used = $state('')
</script>

<main>
  <IdsInput {adapter} char="疑" bind:value onuse={sequence => used = sequence} />
  <output class="used" lang="ja">{used}</output>
</main>

<style>
  main{max-width:720px;margin:24px auto;padding:16px;border-radius:14px;background:var(--surface);box-shadow:var(--shadow)}
  .used{display:block;margin-top:8px;font-family:var(--cjk);font-size:20px}
</style>
