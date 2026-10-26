<script>
  // A menu's items laid out as a list, for a sheet that holds several menus at once (the phone's menu).
  import Icon from './Icon.svelte'
  /** @type {{ items: import('./Menu.svelte').Item[], label: string, onpick?: () => void }} */
  let { items, label, onpick } = $props()
</script>

<div class="list" role="group" aria-label={label}>
  <p class="title">{label}</p>
  {#each items as item, i (i)}
    {#if 'separator' in item}<div class="sep" role="separator"></div>
    {:else if 'heading' in item}<p class="heading">{item.heading}</p>
    {:else}
      <button type="button" class="item" class:rich={item.sequence !== undefined}
        disabled={item.disabled} aria-label={item.sequence !== undefined ? `${item.leading ?? ''} ${item.label} ${item.note ?? ''}`.trim() : undefined}
        title={item.hint} onclick={() => { onpick?.(); item.run?.() }}>
        {#if item.leading !== undefined}
          <span class="leading" lang={item.lang}>{item.leading}</span>
        {:else if item.sequence !== undefined}
          <span class="leading spacer" aria-hidden="true"></span>
        {:else}
          <span class="mark">{#if item.checked}<Icon name="check" size={14} />{:else if item.icon}<Icon name={item.icon} size={16} />{/if}</span>
        {/if}
        <span class="label" lang={item.lang}>{item.sequence ?? item.label}</span>
        {#if item.note !== undefined}<span class="note" class:unencoded={item.unencoded}>{item.note}</span>{/if}
      </button>
    {/if}
  {/each}
</div>

<style>
  .list{display:flex;flex-direction:column;gap:2px}
  .title{margin:0 0 4px;font-size:11px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
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
  .title + .heading{margin-top:4px}
</style>
