<script>
  // A menu's items laid out as a list, for a sheet that holds several menus at once (the phone's menu).
  import Icon from './Icon.svelte'
  /** @type {{ items: import('./Menu.svelte').Item[], label: string, onpick?: () => void, view?: { list: string, cards: string, cardsSelected: boolean, onchange: (cards: boolean) => void } | null }} */
  let { items, label, onpick, view = null } = $props()
  const groups = $derived.by(() => {
    /** @type {{ heading: string, items: import('./Menu.svelte').Item[] }[]} */
    const out = []
    let group = { heading: '', items: /** @type {import('./Menu.svelte').Item[]} */ ([]) }
    for (const item of items) {
      if ('heading' in item) {
        if (group.items.length) out.push(group)
        group = { heading: item.heading, items: [] }
      } else if (!('separator' in item)) group.items.push(item)
    }
    if (group.items.length) out.push(group)
    return out
  })
</script>

<div class="list" role="group" aria-label={label}>
  <div class="title-row">
    <p class="title">{label}</p>
    {#if view}
      <div class="views">
        <button type="button" class="view" aria-pressed={!view.cardsSelected} onclick={() => view?.onchange(false)}><Icon name="list" size={13} /><span>{view.list}</span></button>
        <button type="button" class="view" aria-pressed={view.cardsSelected} onclick={() => view?.onchange(true)}><Icon name="grid" size={13} /><span>{view.cards}</span></button>
      </div>
    {/if}
  </div>
  {#if view?.cardsSelected}
    {#each groups as group (group.heading)}
      {#if group.heading}<p class="heading">{group.heading}</p>{/if}
      <div class="cards">
        {#each group.items as item (item.sequence ?? item.label)}
          <button type="button" class="card" disabled={item.disabled}
            aria-label={item.sequence !== undefined && item.reading === undefined ? `${item.leading ?? ''} ${item.label} ${item.note ?? ''}`.trim() : undefined}
            title={item.hint} onclick={() => { onpick?.(); item.run?.() }}>
            {#if item.drawing?.d}
              <svg class="card-art" viewBox="0 0 1000 1000" aria-hidden="true"><path d={item.drawing.d} /></svg>
            {:else}
              <span class="card-glyph" lang={item.lang}>{item.leading ?? item.sequence ?? item.label}</span>
            {/if}
            <span class="card-text">
                  {#if item.reading !== undefined && item.leading !== undefined}<span class="sr" lang={item.lang}>{item.leading}</span>{/if}
              <span class="card-label" lang={item.lang}>{item.sequence ?? item.label}</span>
              {#if item.note !== undefined || item.reading !== undefined}<span class="card-note" class:unencoded={item.unencoded}>{#if item.reading !== undefined}<span lang="ko">{item.reading}</span>{' · '}{/if}{item.note}</span>{/if}
            </span>
          </button>
        {/each}
      </div>
    {/each}
  {:else}
    {#each items as item, i (i)}
      {#if 'separator' in item}<div class="sep" role="separator"></div>
      {:else if 'heading' in item}<p class="heading">{item.heading}</p>
      {:else}
        <button type="button" class="item" class:rich={item.sequence !== undefined}
          disabled={item.disabled} aria-label={item.sequence !== undefined && item.reading === undefined ? `${item.leading ?? ''} ${item.label} ${item.note ?? ''}`.trim() : undefined}
          title={item.hint} onclick={() => { onpick?.(); item.run?.() }}>
          {#if item.leading !== undefined}
            <span class="leading" lang={item.lang}>{item.leading}</span>
          {:else if item.sequence !== undefined}
            <span class="leading spacer" aria-hidden="true"></span>
          {:else}
            <span class="mark">{#if item.checked}<Icon name="check" size={14} />{:else if item.icon}<Icon name={item.icon} size={16} />{/if}</span>
          {/if}
          <span class="label" lang={item.lang}>{item.sequence ?? item.label}</span>
          {#if item.note !== undefined || item.reading !== undefined}<span class="note" class:unencoded={item.unencoded}>{#if item.reading !== undefined}<span lang="ko">{item.reading}</span>{' · '}{/if}{item.note}</span>{/if}
        </button>
      {/if}
    {/each}
  {/if}
</div>

<style>
  .list{display:flex;flex-direction:column;gap:2px}
  .title-row{display:flex;align-items:center;gap:8px;margin:0 0 4px}
  .title{flex:1;margin:0;font-size:11px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
  .item{display:flex;align-items:center;gap:10px;width:100%;min-height:40px;padding:6px 10px;border:0;border-radius:9px;background:none;color:var(--ink);font:inherit;font-size:14px;text-align:left;cursor:pointer}
  .item.rich{min-height:52px;padding:5px 8px;gap:11px;border-radius:10px}
  .item:not(:disabled):is(:hover,:focus-visible){background:var(--hover);outline:none}
  .item.rich:focus-visible{outline:2px solid var(--focus);outline-offset:-2px}
  .item:disabled{opacity:.45;cursor:default}
  .mark{display:grid;place-items:center;width:16px;color:var(--muted)}
  .leading{display:grid;place-items:center;flex:none;width:40px;height:40px;color:var(--ink);font-family:var(--cjk);font-size:26px;line-height:1}
  .leading.spacer{visibility:hidden}
  .label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .item.rich .label{overflow:visible;text-overflow:clip;white-space:normal;line-height:1.35;word-break:break-word}
  .label:is(:lang(ja),:lang(txg)){font-family:var(--cjk)}
  .note{flex:none;color:var(--muted);font:500 11px/1.5 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.02em;white-space:nowrap}
  .note.unencoded{font:inherit;font-size:12px;font-style:italic}
  .sep{height:1px;margin:4px;background:var(--line)}
  .heading{margin:9px 10px 3px;font-size:10.5px;font-weight:650;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
  .title-row + .heading{margin-top:4px}
  .views{display:flex;gap:2px;padding:2px;border-radius:8px;background:var(--hover)}
  .view{display:flex;align-items:center;gap:4px;padding:3px 7px;border:0;border-radius:6px;background:none;color:var(--muted);font:inherit;font-size:11px;font-weight:600;cursor:pointer}
  .view[aria-pressed="true"]{background:var(--surface);color:var(--ink)}
  .view:focus-visible{outline:2px solid var(--focus);outline-offset:-2px}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;padding:2px 2px 6px}
  .card{display:flex;align-items:center;gap:6px;min-width:0;min-height:48px;padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;text-align:left;cursor:pointer}
  .card:not(:disabled):is(:hover,:focus-visible){background:var(--hover);outline:none}
  .card:focus-visible{outline:2px solid var(--focus);outline-offset:-2px}
  .card:disabled{opacity:.45;cursor:default}
  .card-art{display:block;flex:none;width:36px;height:36px;color:var(--ink)}
  .card-art path{fill:currentColor}
  .card-glyph{display:block;flex:none;width:36px;height:36px;overflow:hidden;font-family:var(--cjk);font-size:20px;line-height:36px;color:var(--ink);text-align:center;white-space:nowrap;text-overflow:ellipsis}
  .card-text{display:flex;flex:1;flex-direction:column;gap:1px;min-width:0}
  .card-label{font-family:var(--cjk);font-size:10.5px;line-height:1.35;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-note{color:var(--muted);font:500 9.5px/1.4 ui-monospace,"SF Mono",Menlo,Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-note.unencoded{font:inherit;font-size:10px;font-style:italic}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
</style>
