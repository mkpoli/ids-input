<script>
  // The IRG's unifiable (UCV) and non-unifiable (NUCV) component variations as a list: each entry's
  // forms drawn from the source's glyphs, the criterion it cites and its example characters. Typing
  // a character or an entry number narrows it. A form or an example that is text is a link where
  // `href` names one for it, or a button that hands it to `ontake`.
  import { loadUcvIndex, loadUcvOutlines } from './ucv.js'

  /** @type {{ t: (key: string, values?: Record<string, string | number>) => string, query?: string, disabled?: boolean, ontake?: ((text: string) => void) | null, href?: ((text: string) => string) | null }} */
  let { t, query = $bindable(''), disabled = false, ontake = null, href = null } = $props()
  const PAGE = 24

  // The entries make the list; the drawings fill in when they arrive, and a form that is text shows
  // as text without them.
  /** @type {{ status: 'loading' | 'ready' | 'failed', index: import('../core/ucv.js').UcvIndex | null }} */
  let list = $state.raw({ status: 'loading', index: null })
  let outlines = $state.raw(/** @type {Record<string, string>} */ ({}))
  $effect(() => {
    loadUcvIndex().then(index => { list = { status: 'ready', index } }, () => { list = { status: 'failed', index: null } })
    loadUcvOutlines().then(loaded => { outlines = loaded }, () => {})
  })

  let kind = $state(/** @type {import('../core/ucv.js').UcvEntry['kind'] | null} */ (null))
  const asked = $derived(query.trim())
  const found = $derived(list.index ? list.index.find(asked, { kind }) : [])
  // Entries are drawn a page at a time; the end of the page coming into view draws the next, and a
  // new question starts again from the first page.
  let pages = $state({ asked: '', kind: /** @type {string | null} */ (null), count: 1 })
  const limit = $derived(pages.asked === asked && pages.kind === kind ? pages.count * PAGE : PAGE)
  const shown = $derived(found.slice(0, limit))
  /** @param {HTMLElement} node */
  function more(node) {
    const grow = (/** @type {number} */ by) => { pages = { asked, kind, count: Math.ceil(limit / PAGE) + by } }
    if (typeof IntersectionObserver === 'undefined') { grow(Infinity); return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) grow(1)
    }, { rootMargin: '200px' })
    observer.observe(node)
    return { destroy: () => observer.disconnect() }
  }

  /** @param {import('../core/ucv.js').UcvEntry} entry */
  const rows = entry => /** @type {{ key: string, groups: string[][] }[]} */ ([
    { key: 'unified', groups: (entry.unified ?? []).map(char => [char]) },
    { key: 'compatibility', groups: entry.compatibility ?? [] },
    { key: 'disunified', groups: entry.disunified ?? [] },
    { key: 'separated', groups: entry.sourceSeparations ?? [] },
    { key: 'single', groups: (entry.single ?? []).map(single => [...single.char ? [single.char] : [], ...single.examples]).filter(group => group.length) },
  ]).filter(row => row.groups.length)
  /** @param {string} char */
  const code = char => [...char].map(point => `U+${/** @type {number} */ (point.codePointAt(0)).toString(16).toUpperCase().padStart(4, '0')}`).join(' ')
  const KINDS = /** @type {const} */ ([[null, null], ['unifiable', 'UCV'], ['not-unifiable', 'NUCV']])
</script>

<div class="ids-ucv">
  <div class="ids-ucv-row">
    <input type="search" bind:value={query} {disabled} lang="ja" spellcheck="false" autocomplete="off"
      aria-label={t('ids.ucv.search')} placeholder={t('ids.ucv.search')} />
    <div class="ids-ucv-kinds" role="group" aria-label={t('ids.ucv.kind')}>
      {#each KINDS as [value, label] (label)}
        <button type="button" class:active={kind === value} aria-pressed={kind === value} onclick={() => kind = value}>{label ?? t('ids.ucv.all')}</button>
      {/each}
    </div>
  </div>
  {#if list.status === 'loading'}<p class="ids-ucv-note">{t('ids.ucv.loading')}</p>
  {:else if list.status === 'failed'}<p class="ids-ucv-note fault">{t('ids.ucv.failed')}</p>
  {:else if !found.length}<p class="ids-ucv-note">{t('ids.ucv.none')}</p>
  {:else}
    <ol class="ids-ucv-list">
      {#each shown as entry (entry.id)}
        <li class="ids-ucv-entry" id={`ucv-${entry.id}`} data-entry={entry.id}>
          <div class="ids-ucv-head">
            <span class="ids-ucv-id">{entry.id}</span>
            {#if entry.kind === 'not-unifiable'}<span class="ids-ucv-badge strong">NUCV</span>{/if}
            {#if entry.level}<span class="ids-ucv-badge">{t('ids.ucv.level', { level: entry.level })}</span>{/if}
            {#if entry.jis}<span class="ids-ucv-badge">JIS {entry.jis}</span>{/if}
            {#if entry.hydcd}<span class="ids-ucv-badge">HYDCD {entry.hydcd}</span>{/if}
            {#if entry.annexS}<span class="ids-ucv-badge">Annex {entry.annexS}</span>{/if}
          </div>
          <div class="ids-ucv-forms">
            {#each entry.forms as form, slot (slot)}
              {@const outline = outlines[form.glyph]}
              {@const label = form.text ? `${form.text} ${code(form.text)}` : t('ids.ucv.form', { name: form.glyph })}
              {#if form.text && href}
                <a class="ids-ucv-form" data-form={form.glyph} href={href(form.text)} title={label} aria-label={label}>
                  {#if outline}<svg viewBox="0 0 200 200" aria-hidden="true"><path d={outline} /></svg>{:else}<span lang="ja">{form.text}</span>{/if}
                </a>
              {:else if form.text && ontake}
                <button type="button" class="ids-ucv-form" data-form={form.glyph} {disabled} title={label} aria-label={label}
                  onclick={() => ontake(/** @type {string} */ (form.text))}>
                  {#if outline}<svg viewBox="0 0 200 200" aria-hidden="true"><path d={outline} /></svg>{:else}<span lang="ja">{form.text}</span>{/if}
                </button>
              {:else}
                <span class="ids-ucv-form" data-form={form.glyph} role="img" title={label} aria-label={label}>
                  {#if outline}<svg viewBox="0 0 200 200" aria-hidden="true"><path d={outline} /></svg>{:else if form.text}<span lang="ja">{form.text}</span>{:else}<span class="ids-ucv-name">{form.glyph}</span>{/if}
                </span>
              {/if}
            {/each}
          </div>
          {#each rows(entry) as row (row.key)}
            <div class="ids-ucv-examples">
              <span class="ids-ucv-label">{t(`ids.ucv.${row.key}`)}</span>
              <span class="ids-ucv-groups">
                {#each row.groups as group, at (at)}
                  <span class="ids-ucv-group">
                    {#each group as char, place (place)}
                      {#if href}<a class="ids-ucv-char" data-character={char} href={href(char)} lang="ja" title={`${char} ${code(char)}`}>{char}</a>
                      {:else if ontake}<button type="button" class="ids-ucv-char" data-character={char} {disabled} lang="ja" title={`${char} ${code(char)}`} onclick={() => ontake(char)}>{char}</button>
                      {:else}<span class="ids-ucv-char" data-character={char} lang="ja" title={`${char} ${code(char)}`}>{char}</span>{/if}
                    {/each}
                  </span>
                {/each}
                {#if row.key === 'unified' && entry.unifiedMore}<span class="ids-ucv-more" aria-hidden="true">…</span>{/if}
                {#if row.key === 'single'}{#each entry.single ?? [] as single, at (at)}{#if single.count}<span class="ids-ucv-more">{single.char} {single.count}</span>{/if}{/each}{/if}
              </span>
            </div>
          {/each}
        </li>
      {/each}
    </ol>
    {#if shown.length < found.length}{#key limit}<div class="ids-ucv-sentinel" use:more></div>{/key}{/if}
  {/if}
</div>

<style>
  .ids-ucv{
    --_ink:var(--ids-ink,light-dark(#1c1c22,#ececf2));--_muted:var(--ids-muted,light-dark(#686874,#9d9daa));
    --_line:var(--ids-line,light-dark(#e1e1e8,#2e2e36));--_line-strong:var(--ids-line-strong,light-dark(#c2c2cc,#4a4a55));
    --_control-border:var(--ids-control-border,light-dark(#8a8a96,#6f6f7e));
    --_surface:var(--ids-surface,light-dark(#fff,#1b1b20));--_surface-subtle:var(--ids-surface-subtle,light-dark(#f6f6f9,#16161a));
    --_accent:var(--ids-accent,light-dark(#2944c7,#8ea8ff));--_accent-light:var(--ids-accent-light,light-dark(#e9edfd,#232c4c));
    --_focus:var(--ids-focus,light-dark(#2944c7,#8ea8ff));--_fault:var(--ids-fault,light-dark(#b42318,#ff8a80));
    --_font:var(--ids-font,"IDS Numbered","IDS Strokes","IDS Parts","IDS Operators","Noto Sans CJK JP","Noto Sans JP","Hiragino Sans","Yu Gothic","Microsoft YaHei","PingFang SC",var(--ids-glyph-fallback, var(--fallback-font, "IDS Fallback")),sans-serif);
    display:flex;flex-direction:column;gap:6px;min-width:0;color:var(--_ink)}
  :where(.ids-ucv) :is(button,input){font:inherit;color:inherit;border:1px solid var(--_line);border-radius:8px;background:var(--_surface)}
  :where(.ids-ucv) input{border-color:var(--_control-border)}
  :where(.ids-ucv) button{cursor:pointer}
  :where(.ids-ucv) :is(button,input,a):focus-visible{outline:2px solid var(--_focus);outline-offset:1px}
  .ids-ucv-row{display:flex;gap:6px;align-items:stretch}
  .ids-ucv-row input{flex:1;min-width:0;font-size:14px;padding:7px 10px}
  .ids-ucv-kinds{display:flex;flex:none;padding:2px;gap:2px;border:1px solid var(--_line);border-radius:8px;background:var(--_surface-subtle)}
  .ids-ucv-kinds button{border:0;background:transparent;padding:0 9px;font-size:12px;border-radius:6px;color:var(--_muted)}
  .ids-ucv-kinds button.active{background:var(--_surface);color:var(--_ink);box-shadow:0 1px 2px rgb(0 0 0 / .12)}
  .ids-ucv-note{margin:0;font-size:11px;color:var(--_muted)}
  .ids-ucv-note.fault{color:var(--_fault)}
  .ids-ucv-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
  .ids-ucv-entry{scroll-margin-top:12px;display:flex;flex-direction:column;gap:5px;padding:8px 10px;border:1px solid var(--_line);border-radius:10px;background:var(--_surface)}
  .ids-ucv-head{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
  .ids-ucv-id{font-weight:650;font-size:14px;font-variant-numeric:tabular-nums;margin-right:2px}
  .ids-ucv-badge{font-size:11px;line-height:1;padding:3px 6px;border:1px solid var(--_line-strong);border-radius:5px;color:var(--_muted);white-space:nowrap}
  .ids-ucv-badge.strong{border-color:var(--_accent);color:var(--_accent)}
  .ids-ucv-forms{display:flex;flex-wrap:wrap;gap:4px}
  .ids-ucv-form{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:46px;height:46px;padding:3px;border:1px solid transparent;border-radius:8px;background:var(--_surface-subtle);font-family:var(--_font);font-size:26px;color:var(--_ink)}
  :is(button,a).ids-ucv-form:not(:disabled):hover{border-color:var(--_accent)}
  a.ids-ucv-form{text-decoration:none}
  span.ids-ucv-form{background:transparent;border-color:var(--_line)}
  .ids-ucv-form svg{width:100%;height:100%;fill:currentColor}
  .ids-ucv-name{font-size:9px;font-family:ui-monospace,monospace;overflow-wrap:anywhere;line-height:1.1;color:var(--_muted)}
  .ids-ucv-examples{display:grid;grid-template-columns:minmax(4.5em,max-content) 1fr;gap:8px;align-items:baseline}
  .ids-ucv-label{font-size:11px;color:var(--_muted)}
  .ids-ucv-groups{display:flex;flex-wrap:wrap;gap:2px 8px;min-width:0}
  .ids-ucv-group{display:inline-flex;flex-wrap:wrap;min-width:0}
  .ids-ucv-char{border:0;background:transparent;padding:0 1px;font-family:var(--_font);font-size:20px;line-height:1.25;border-radius:4px;color:inherit;text-decoration:none}
  :is(button,a).ids-ucv-char:not(:disabled):hover{background:var(--_accent-light);color:var(--_accent)}
  .ids-ucv-more{color:var(--_muted)}
  .ids-ucv-sentinel{height:1px}
</style>
