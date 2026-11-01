<script>
  // The viewer's settings: the theme, the key hints on buttons, and where the preview's drawings come from.
  import Dialog from './Dialog.svelte'
  import Switch from './controls/Switch.svelte'
  import TextField from './controls/TextField.svelte'
  import ThemeSwitch from './ThemeSwitch.svelte'
  /** @type {{ open: boolean, anchor?: HTMLElement | null, theme: import('../lib/theme.js').Theme, keyHints: boolean, tintMode: import('../../src/svelte/editor.svelte.js').TintMode, composer: string, defaultComposer: string,
   *   sans?: boolean, t: (key: string, params?: Record<string, string | number>) => string, ontheme: (theme: import('../lib/theme.js').Theme) => void }} */
  let { open = $bindable(false), anchor = null, theme, keyHints = $bindable(true), tintMode = $bindable('hover'), composer = $bindable(''), defaultComposer, t, ontheme } = $props()
</script>

<Dialog bind:open {anchor} popover title={t('app.prefs.title')} closeLabel={t('app.close')}>
  <div class="prefs">
    <div class="pref">
      <span>{t('app.prefs.theme')}</span>
      <ThemeSwitch {theme} label={t('app.prefs.theme')} labels={{ system: t('app.theme.system'), light: t('app.theme.light'), dark: t('app.theme.dark') }} onchange={ontheme} />
    </div>
    <div class="pref switch">
      <Switch bind:checked={keyHints} label={t('app.prefs.keyHints')} />
    </div>
    <label class="pref">
      <span>{t('app.prefs.tint.label')}</span>
      <span class="ui-select-wrap compact">
        <select class="ui-select" bind:value={tintMode}>
          <option value="hover">{t('app.prefs.tint.hover')}</option>
          <option value="on">{t('app.prefs.tint.on')}</option>
          <option value="off">{t('app.prefs.tint.off')}</option>
        </select>
      </span>
    </label>
    <div class="pref column">
      <TextField label={t('app.prefs.composer')} value={composer} placeholder={defaultComposer} type="url" mono spellcheck={false}
        hint={t('app.prefs.composerHint')}
        onchange={event => { composer = /** @type {HTMLInputElement} */ (event.currentTarget).value }}
        onkeydown={event => { if (event.key === 'Enter') composer = /** @type {HTMLInputElement} */ (event.currentTarget).value }} />
    </div>
  </div>
</Dialog>

<style>
  .prefs{display:flex;flex-direction:column;gap:2px}
  .pref{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-xl);padding-block:var(--ui-space-sm);border-bottom:1px solid var(--ui-color-border);font-size:var(--ui-text-md)}
  .pref:last-child{border-bottom:0}
  .switch{padding-block:2px}
  .column{flex-direction:column;align-items:stretch;gap:var(--ui-space-xs)}
  .compact{inline-size:auto;min-inline-size:132px}
</style>
