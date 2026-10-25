<script>
  // A menu's items laid out as a list, for a sheet that holds several menus at once (the phone's menu).
  import Icon from './Icon.svelte'
  import OperatorIcon from '../../src/svelte/OperatorIcon.svelte'
  /** @type {{ items: import('./Menu.svelte').Item[], label: string, onpick?: () => void }} */
  let { items, label, onpick } = $props()
</script>

<div class="list" role="group" aria-label={label}>
  <p class="title">{label}</p>
  {#each items as item, i (i)}
    {#if 'separator' in item}<div class="sep" role="separator"></div>
    {:else if 'heading' in item}<p class="heading">{item.heading}</p>
    {:else}
      <button type="button" class="item" class:rich={item.operator !== undefined || item.leading !== undefined}
        disabled={item.disabled} title={item.hint} onclick={() => { onpick?.(); item.run?.() }}>
        {#if item.operator !== undefined}
          <span class="leading op" aria-hidden="true"><OperatorIcon op={item.operator} size={22} /></span>
        {:else if item.leading !== undefined}
          <span class="leading" lang={item.lang}>{item.leading}</span>
        {:else}
          <span class="mark">{#if item.checked}<Icon name="check" size={14} />{:else if item.icon}<Icon name={item.icon} size={16} />{/if}</span>
        {/if}
        <span class="label" lang={item.lang}>{item.label}</span>
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
  .leading{display:grid;place-items:center;flex:none;box-sizing:border-box;width:40px;height:40px;border:1px solid var(--line);border-radius:10px;
    background:var(--surface-2);color:var(--ink);font-family:var(--cjk);font-size:24px;line-height:1}
  .leading.op{border-style:dashed;border-color:color-mix(in srgb,var(--accent) 38%,transparent);background:var(--accent-soft)}
  .label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .item.rich .label{overflow:visible;text-overflow:clip;white-space:normal;line-height:1.35;word-break:break-word}
  .label:lang(ja){font-family:var(--cjk)}
  .note{flex:none;max-width:96px;padding:2px 6px;border:1px solid var(--line);border-radius:6px;background:var(--surface-2);color:var(--muted);
    font:500 10.5px/1.5 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.02em;white-space:nowrap}
  .note.unencoded{max-width:none;padding:2px 0;border:0;background:none;color:var(--muted);font:inherit;font-size:12px;font-style:italic}
  .sep{height:1px;margin:4px;background:var(--line)}
  .heading{margin:9px 10px 3px;font-size:10.5px;font-weight:650;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
  .title + .heading{margin-top:4px}
</style>
