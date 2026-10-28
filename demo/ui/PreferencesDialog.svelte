<script>
  // The viewer's settings: the theme, the key hints on buttons, and where the preview's drawings come from.
  import Dialog from './Dialog.svelte'
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
    <label class="pref">
      <span>{t('app.prefs.keyHints')}</span>
      <input type="checkbox" role="switch" bind:checked={keyHints} />
    </label>
    <label class="pref">
      <span>{t('app.prefs.tint.label')}</span>
      <select bind:value={tintMode}>
        <option value="hover">{t('app.prefs.tint.hover')}</option>
        <option value="on">{t('app.prefs.tint.on')}</option>
        <option value="off">{t('app.prefs.tint.off')}</option>
      </select>
    </label>
    <label class="pref column">
      <span>{t('app.prefs.composer')}</span>
      <input type="url" value={composer} placeholder={defaultComposer} spellcheck="false"
        onchange={event => { composer = event.currentTarget.value }}
        onkeydown={event => { if (event.key === 'Enter') composer = event.currentTarget.value }} />
      <small>{t('app.prefs.composerHint')}</small>
    </label>
  </div>
</Dialog>

<style>
  .prefs{display:flex;flex-direction:column;gap:4px}
  .pref{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid var(--line);font-size:14px}
  .pref:last-child{border-bottom:0}
  .column{flex-direction:column;align-items:stretch;gap:6px}
  input[type="checkbox"]{width:36px;height:20px;margin:0;appearance:none;border-radius:999px;background:var(--line-strong);position:relative;cursor:pointer;transition:background-color .15s}
  input[type="checkbox"]::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s}
  input[type="checkbox"]:checked{background:var(--accent)}
  input[type="checkbox"]:checked::after{transform:translateX(16px)}
  input[type="url"]{height:34px;padding:0 10px;border:1px solid var(--line);border-radius:9px;background:var(--surface-2);color:var(--ink);font:12px ui-monospace,"SF Mono",Menlo,Consolas,monospace}
  small{font-size:12px;color:var(--muted)}
  select{min-height:34px;padding:0 8px;border:1px solid var(--line);border-radius:6px;background:var(--surface-2);color:var(--ink);font:inherit}
  select:focus-visible,input:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
</style>
