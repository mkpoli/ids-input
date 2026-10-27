<script>
  import { STRUCTURE_TEMPLATES } from '../core/templates.js'
  import { templateDiagram } from './template-diagram.js'

  /** @type {{ editor: import('./editor.svelte.js').Editor }} */
  let { editor } = $props()
  const t = $derived(editor.t)
  const uid = $props.id()
  const groups = [2, 3, 4].map(slots => ({ slots, templates: STRUCTURE_TEMPLATES.filter(item => item.slots === slots)
    .map(item => ({ ...item, shapes: templateDiagram(item.sequence) })) }))
</script>

<div class="ids-templates">
  {#each groups as group (group.slots)}
    <div class="ids-template-group" role="group" aria-labelledby={`${uid}-${group.slots}`}>
      <span class="ids-template-label" id={`${uid}-${group.slots}`}>{t(`ids.group.${group.slots}`)}</span>
      <div class="ids-template-grid">
        {#each group.templates as template (template.id)}
          <button type="button" disabled={editor.disabled} data-template={template.id}
            aria-label={t('ids.templates.insert', { sequence: template.sequence })} title={`${template.sequence} · ${t('ids.templates.usage', { count: template.count })}`}
            draggable={!editor.disabled} ondragstart={event => event.dataTransfer?.setData('text/plain', template.sequence)}
            onclick={() => editor.take(template.sequence)}>
            <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
              {#each template.shapes as shape, i (i)}
                {#if shape.kind === 'slot'}
                  <rect class:accent={shape.accent} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx=".7" />
                {:else}<path class:accent={shape.accent} d={shape.d} />{/if}
              {/each}
            </svg>
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .ids-templates{display:flex;flex-direction:column;gap:12px;padding:4px 0;color:var(--ids-ink,light-dark(#1d1d21,#ececf1))}
  .ids-template-group{display:flex;flex-direction:column;gap:5px;min-width:0}
  .ids-template-label{font-size:11px;color:var(--ids-muted,light-dark(#696973,#9c9ca8))}
  .ids-template-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(48px,1fr));gap:5px}
  button{display:grid;place-items:center;height:48px;padding:0;border:1px solid var(--ids-line,light-dark(#d8d8de,#3a3a43));
    border-radius:8px;background:var(--ids-surface,light-dark(#fff,#202026));color:inherit;cursor:pointer}
  button:not(:disabled):hover{border-color:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));background:var(--ids-accent-light,light-dark(#e7edfc,#24304f))}
  button:focus-visible{outline:2px solid var(--ids-accent,light-dark(#2f5fd0,#8fb0ff));outline-offset:2px}
  button:disabled{opacity:.55;cursor:default}
  path{fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
  .accent{color:var(--ids-accent,light-dark(#2f5fd0,#8fb0ff))}
  rect{fill:color-mix(in srgb,currentColor 10%,transparent);stroke:currentColor;stroke-width:1;stroke-dasharray:1.5 1.2}
</style>
