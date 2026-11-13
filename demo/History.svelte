<script>
  // The systems that describe a Han character by its parts, in the order they appeared: a line
  // down the page, each entry with who made it, what it writes, and where that is read from.
  import PageHeader from './ui/PageHeader.svelte'
  import { translator } from '../src/svelte/index.js'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { load, save } from './lib/storage.js'
  import { HISTORY, UNDATED } from './lib/history.js'

  const params = new URLSearchParams(location.search)
  const wanted = String(params.get('lang') ?? load('locale', null) ?? navigator.language ?? '')
  const traditional = /^zh-(?:Hant|TW|HK|MO)\b/i
  let locale = $state(LOCALES.find(([code]) => code === wanted)?.[0]
    ?? (traditional.test(wanted) ? 'zh-Hant' : undefined)
    ?? LOCALES.find(([code]) => wanted.startsWith(code.split('-')[0]))?.[0] ?? 'en')
  $effect(() => save('locale', locale))
  $effect(() => { document.documentElement.lang = locale })
  const messages = $derived(LOCALES.find(([code]) => code === locale)?.[2])
  const t = $derived(translator({ ...appMessages('en'), ...messages, ...appMessages(locale) }, locale))
  /** @param {import('./lib/history.js').HistoryEntry} entry */
  const said = entry => entry.text[/** @type {'en'} */ (locale)] ?? entry.text.en
</script>

{#snippet card(/** @type {import('./lib/history.js').HistoryEntry} */ entry)}
  <article>
    <header>
      <h2 lang="ja">{entry.title}</h2>
      <span class="who" lang="ja">{entry.who}</span>
    </header>
    {#if entry.sample}<p class="sample" lang="ja">{entry.sample}</p>{/if}
    <p class="said">{said(entry)}</p>
    <p class="sources">
      {#each entry.sources as source (source.url)}<a href={source.url} target="_blank" rel="noreferrer" lang="ja">{source.label}</a>{/each}
    </p>
  </article>
{/snippet}

<div class="page">
  <PageHeader title={t('history.title')} {t} bind:locale links={[{ href: `./unencoded.html?lang=${locale}`, label: t('appendix.title') }, { href: `./normalization.html?lang=${locale}`, label: t('normalization.title') }]} />
  <main>
    <ol class="line">
      {#each HISTORY as entry (entry.year + entry.title)}
        <li>
          <time title={entry.from ? t('history.earliest') : undefined}>{#if entry.from}<span class="from" aria-label={t('history.earliest')}>≤</span>{/if}{entry.year}</time>
          {@render card(entry)}
        </li>
      {/each}
    </ol>
    <h2 class="undated">{t('history.undated')}</h2>
    <ol class="line">
      {#each UNDATED as entry (entry.title)}
        <li><time aria-hidden="true">—</time>{@render card(entry)}</li>
      {/each}
    </ol>
  </main>
</div>

<style>
  .page{display:flex;flex-direction:column;min-height:100dvh}
  main{width:100%;max-width:880px;box-sizing:border-box;margin:0 auto;padding:28px max(18px,env(safe-area-inset-right)) 64px max(18px,env(safe-area-inset-left))}
  .line{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
  .line li{position:relative;display:grid;grid-template-columns:76px minmax(0,1fr);gap:0 20px;padding-bottom:16px}
  /* The line itself, with a dot at each entry. */
  .line li::before{content:'';position:absolute;inset-inline-start:85px;top:0;bottom:0;width:2px;background:var(--ui-color-border)}
  .line li:last-child::before{bottom:auto;height:22px}
  .line li::after{content:'';position:absolute;inset-inline-start:80px;top:16px;width:12px;height:12px;box-sizing:border-box;border:2px solid var(--ui-color-accent);border-radius:50%;background:var(--ui-color-canvas)}
  time{padding-top:11px;text-align:end;font:600 15px/1.4 var(--ui-font-sans);font-variant-numeric:tabular-nums;color:var(--ui-color-ink)}
  .from{margin-inline-end:1px;color:var(--ui-color-ink-muted);font-weight:400}
  article{margin-inline-start:14px;padding:12px 16px 14px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface)}
  header{display:flex;align-items:baseline;gap:6px 12px;flex-wrap:wrap}
  article h2{margin:0;font-size:16px;font-weight:650;color:var(--ui-color-ink)}
  .who{font-size:12.5px;color:var(--ui-color-ink-muted)}
  .sample{margin:8px 0 0;font:18px/1.4 var(--ids-font),var(--ids-glyph-fallback),var(--ui-font-mono);color:var(--ui-color-accent);overflow-wrap:anywhere}
  .said{margin:8px 0 0;font-size:14px;line-height:1.65;color:var(--ui-color-ink-soft)}
  .sources{display:flex;flex-wrap:wrap;gap:4px 14px;margin:10px 0 0;font-size:12px}
  .sources a{color:var(--ui-color-accent);text-decoration:none}
  .sources a:hover{text-decoration:underline}
  .undated{margin:14px 0 12px;font-size:12px;font-weight:600;color:var(--ui-color-ink-muted)}
  @media (max-width:560px) {
    .line li{grid-template-columns:minmax(0,1fr);padding-inline-start:22px}
    .line li::before{inset-inline-start:5px}
    .line li::after{inset-inline-start:0;top:6px}
    time{padding-top:0;text-align:start}
    article{margin:6px 0 0}
  }
</style>
