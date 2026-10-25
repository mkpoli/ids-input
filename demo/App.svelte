<script>
  import { IdsInput } from '../src/svelte/index.js'
  import { babelStoneAdapter } from '../src/adapter/index.js'
  import { composerPreview } from '../src/composer/index.js'
  import en from '../messages/en.json' with { type: 'json' }
  import ja from '../messages/ja.json' with { type: 'json' }
  import zhHans from '../messages/zh-Hans.json' with { type: 'json' }
  import zhHant from '../messages/zh-Hant.json' with { type: 'json' }
  import ko from '../messages/ko.json' with { type: 'json' }
  import ids from '../data/babelstone-ids.tsv.gz?url'
  import parts from '../data/ids-parts.json?url'

  const LOCALES = [['en', 'English', en], ['ja', '日本語', ja], ['zh-Hans', '简体中文', zhHans], ['zh-Hant', '繁體中文', zhHant], ['ko', '한국어', ko]]
  const params = new URLSearchParams(location.search)
  // The han-compose export the preview draws from: `?composer=` or VITE_COMPOSER_BASE points it at another copy.
  const COMPOSER = 'https://glyphatlas.org/atlas/composer/bd0829bc6fbf-compose-layout-v4-f4/'
  const base = params.get('composer') || import.meta.env.VITE_COMPOSER_BASE || COMPOSER
  const adapter = { ...babelStoneAdapter({ ids, parts }), preview: composerPreview({ base }) }
  let locale = $state(LOCALES.some(([code]) => code === params.get('lang')) ? params.get('lang') : 'en')
  let char = $state(params.get('char') ?? '疑')
  let value = $state(params.get('ids') ?? '')
  let used = $state('')
  const messages = $derived(LOCALES.find(([code]) => code === locale)?.[2] ?? en)
</script>

<main>
  <header>
    <h1>IDS Input</h1>
    <p>Type an ideographic description sequence, or build it as a tree: operators by keyboard, parts from the palette, or parts taken from any character. Decompositions come from BabelStone IDS, loaded in the browser.</p>
    <div class="controls">
      <label>Start from <input class="start" bind:value={char} maxlength="2" lang="ja" /></label>
      <label>Language
        <select bind:value={locale}>
          {#each LOCALES as [code, label] (code)}<option value={code}>{label}</option>{/each}
        </select>
      </label>
    </div>
  </header>
  <section class="editor" lang={locale}>
    <IdsInput {adapter} {char} bind:value {messages} {locale} onuse={sequence => used = sequence} />
  </section>
  <section class="out" aria-live="polite">
    <span>Draft</span><code lang="ja">{value || '—'}</code>
    <span>Used</span><code lang="ja">{used || '—'}</code>
  </section>
  <footer>
    <p>
      <a href="https://github.com/mkpoli/ids-input">Source</a> (MIT) ·
      IDS data: <a href="https://www.babelstone.co.uk/CJK/IDS.TXT">BabelStone IDS</a> by Andrew West (public domain) ·
      Parts palette: BabelStone IDS, hfhchan/ids (MIT), Unihan (Unicode License v3), KanjiVG (CC BY-SA 3.0) ·
      Fonts: Plangothic, Noto Sans CJK JP (SIL OFL 1.1) ·
      Preview: <a href="https://github.com/mkpoli/han-compose">han-compose</a> (MIT), outlines from Noto Sans CJK JP and Plangothic (SIL OFL 1.1), cuts along KanjiVG (CC BY-SA 3.0) ·
      Operator names after <a href="https://zi.tools/?secondary=ids">字統网</a>
    </p>
  </footer>
</main>

<style>
  :global(:root){color-scheme:light dark;--bg:light-dark(#fbfbfc,#121215);--fg:light-dark(#1d1d21,#ececf1);--muted:light-dark(#696973,#9c9ca8);--line:light-dark(#d8d8de,#3a3a43)}
  :global(body){margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
  main{max-width:760px;margin:0 auto;padding:24px 16px 40px;display:flex;flex-direction:column;gap:18px}
  h1{margin:0 0 4px;font-size:24px;letter-spacing:-.01em}
  header p{margin:0;color:var(--muted)}
  .controls{display:flex;flex-wrap:wrap;gap:16px;margin-top:12px;font-size:13px;color:var(--muted)}
  .controls label{display:flex;align-items:center;gap:6px}
  .controls :is(input,select){font:inherit;color:var(--fg);background:transparent;border:1px solid var(--line);border-radius:6px;padding:4px 6px}
  .start{width:3em;font-size:16px;text-align:center}
  .editor{padding:16px;border:1px solid var(--line);border-radius:12px;background:light-dark(#fff,#1a1a1f)}
  .out{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:13px;color:var(--muted)}
  .out code{font-size:18px;color:var(--fg);word-break:break-all}
  footer{font-size:12px;color:var(--muted)}
  footer a{color:inherit}
</style>
