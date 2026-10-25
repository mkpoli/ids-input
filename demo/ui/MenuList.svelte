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
      <button type="button" class="item" disabled={item.disabled} title={item.hint} onclick={() => { onpick?.(); item.run?.() }}>
        <span class="mark">{#if item.checked}<Icon name="check" size={14} />{:else if item.icon}<Icon name={item.icon} size={16} />{/if}</span>
        <span class="label" lang={item.lang}>{item.label}</span>
      </button>
    {/if}
  {/each}
</div>

<style>
  .list{display:flex;flex-direction:column;gap:2px}
  .title{margin:0 0 4px;font-size:11px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
  .item{display:flex;align-items:center;gap:10px;width:100%;min-height:40px;padding:6px 10px;border:0;border-radius:9px;background:none;color:var(--ink);font:inherit;font-size:14px;text-align:left;cursor:pointer}
  .item:not(:disabled):is(:hover,:focus-visible){background:var(--hover);outline:none}
  .item:disabled{opacity:.45;cursor:default}
  .mark{display:grid;place-items:center;width:16px;color:var(--muted)}
  .label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .sep{height:1px;margin:4px;background:var(--line)}
  .heading{margin:6px 10px 2px;font-size:11px;font-weight:600;color:var(--muted)}
</style>
