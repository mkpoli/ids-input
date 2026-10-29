<script>
  // The design system in one page: the palette with live contrast, the type scale, every control
  // in its states, and the accessibility rules behind them. It uses the same design/ CSS and the
  // same Svelte controls as the workshop, so a regression here is a regression in the app.
  import Checkbox from './controls/Checkbox.svelte'
  import RadioGroup from './controls/RadioGroup.svelte'
  import Segmented from './controls/Segmented.svelte'
  import Swatches from './controls/Swatches.svelte'
  import SelectField from './controls/SelectField.svelte'
  import Switch from './controls/Switch.svelte'
  import TextField from './controls/TextField.svelte'
  import Icon from './Icon.svelte'

  const THEME_KEY = 'ids-input:theme'
  /** @typedef {'system' | 'light' | 'dark'} Theme */
  /** @returns {Theme} */
  function readTheme() {
    try {
      const kept = JSON.parse(localStorage.getItem(THEME_KEY) ?? 'null')
      return kept === 'light' || kept === 'dark' ? kept : 'system'
    } catch { return 'system' }
  }
  /** @type {Theme} */
  let theme = $state(readTheme())
  const themeOptions = [
    { value: 'system', icon: 'system', ariaLabel: 'System theme', title: 'System theme' },
    { value: 'light', icon: 'sun', ariaLabel: 'Light theme', title: 'Light theme' },
    { value: 'dark', icon: 'moon', ariaLabel: 'Dark theme', title: 'Dark theme' },
  ]

  /** @param {Theme} next */
  function setTheme(next) {
    theme = next
    const root = document.documentElement
    if (next === 'system') { delete root.dataset.theme; localStorage.removeItem(THEME_KEY) }
    else { root.dataset.theme = next; localStorage.setItem(THEME_KEY, JSON.stringify(next)) }
  }

  // Every control on the page is live state, so the states shown are the states the system has.
  let text = $state('⿰亻⿱七木')
  let hinted = $state('')
  let bad = $state('not a description')
  let disabledText = $state('Disabled')
  let readOnly = $state('https://ids.mkpo.li/?ids=⿰亻⿱七木')
  let select = $state('balanced')
  let textarea = $state('A draft of the sequence.\nA second line.')
  let checked = $state(true)
  let unchecked = $state(false)
  let mixed = $state(true)
  let switchOn = $state(true)
  let choice = $state('new')
  let segmented = $state('svg')
  let icons = $state('tree')
  let swatch = $state('none')
  let range = $state(0.06)
  let colour = $state('#2944c7')

  /** @type {{ title: string, items: { token: string, name: string, pair?: string, pairName?: string, threshold?: number, note?: string, value?: string, ratio?: number }[] }[]} */
  const COLOURS = [
    { title: 'Surfaces', items: [
      { token: '--ui-color-canvas', name: 'Canvas', pair: '--ui-color-ink', pairName: 'ink', threshold: 4.5 },
      { token: '--ui-color-surface', name: 'Surface', pair: '--ui-color-ink', pairName: 'ink', threshold: 4.5 },
      { token: '--ui-color-surface-sunken', name: 'Sunken', pair: '--ui-color-ink-muted', pairName: 'muted', threshold: 4.5 },
      { token: '--ui-color-surface-hover', name: 'Hover', pair: '--ui-color-ink', pairName: 'ink', threshold: 4.5 },
      { token: '--ui-color-surface-active', name: 'Pressed', pair: '--ui-color-ink', pairName: 'ink', threshold: 4.5 },
    ] },
    { title: 'Text', items: [
      { token: '--ui-color-ink', name: 'Ink', pair: '--ui-color-surface', pairName: 'surface', threshold: 4.5 },
      { token: '--ui-color-ink-soft', name: 'Ink soft', pair: '--ui-color-surface', pairName: 'surface', threshold: 4.5 },
      { token: '--ui-color-ink-muted', name: 'Ink muted', pair: '--ui-color-surface', pairName: 'surface', threshold: 4.5 },
      { token: '--ui-color-focus', name: 'Focus', pair: '--ui-color-surface', pairName: 'surface', threshold: 3 },
    ] },
    { title: 'Lines and controls', items: [
      { token: '--ui-color-border', name: 'Border', pair: '--ui-color-surface', pairName: 'surface', threshold: 1.2, note: 'decorative' },
      { token: '--ui-color-border-strong', name: 'Border strong', pair: '--ui-color-surface', pairName: 'surface', threshold: 1.2, note: 'decorative' },
      { token: '--ui-color-control-border', name: 'Control border', pair: '--ui-color-surface', pairName: 'surface', threshold: 3 },
      { token: '--ui-color-control-border-hover', name: 'Control hover', pair: '--ui-color-surface', pairName: 'surface', threshold: 3 },
    ] },
    { title: 'Accent and danger', items: [
      { token: '--ui-color-accent', name: 'Accent', pair: '--ui-color-surface', pairName: 'surface', threshold: 4.5 },
      { token: '--ui-color-accent-hover', name: 'Accent hover', pair: '--ui-color-surface', pairName: 'surface', threshold: 4.5 },
      { token: '--ui-color-accent-soft', name: 'Accent soft', pair: '--ui-color-accent', pairName: 'accent', threshold: 4.5 },
      { token: '--ui-color-on-accent', name: 'On accent', pair: '--ui-color-accent', pairName: 'accent', threshold: 4.5 },
      { token: '--ui-color-danger', name: 'Danger', pair: '--ui-color-surface', pairName: 'surface', threshold: 4.5 },
      { token: '--ui-color-danger-soft', name: 'Danger soft', pair: '--ui-color-danger', pairName: 'danger', threshold: 4.5 },
    ] },
  ]

  const TYPE = [
    { token: '2xl', size: '28px', use: 'A sequence, a dialog title' },
    { token: 'xl', size: '20px', use: 'A page section' },
    { token: 'lg', size: '16px', use: 'A dialog title' },
    { token: 'md', size: '14px', use: 'Body' },
    { token: 'sm', size: '13px', use: 'Controls, dense rows' },
    { token: 'xs', size: '12px', use: 'Labels, hints' },
    { token: '2xs', size: '11px', use: 'Overlines, key caps' },
  ]

  let chips = $state(COLOURS)
  let measured = $state(false)
  const failures = $derived(chips.flatMap(group => group.items).filter(item => item.threshold !== undefined && (item.ratio === undefined || item.ratio < item.threshold)).length)

  /** Read a token's resolved colour in the active scheme. @param {string} token */
  function resolve(token) {
    const probe = document.createElement('span')
    probe.style.cssText = 'position:absolute;width:0;height:0;background-color:var(' + token + ')'
    document.body.append(probe)
    const value = getComputedStyle(probe).backgroundColor
    probe.remove()
    return value
  }

  /** @param {string} value */
  function channels(value) {
    if (!value) return null
    const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/)
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
  }

  /** @param {string} value */
  function hex(value) {
    const rgb = channels(value)
    return rgb ? '#' + rgb.map(n => Math.round(n).toString(16).padStart(2, '0')).join('') : value ?? ''
  }

  /** @param {number[]} rgb */
  function luminance(rgb) {
    const [r, g, b] = rgb.map(value => {
      const c = value / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  /** @param {string} a @param {string} b */
  function contrast(a, b) {
    const [one, two] = [channels(a), channels(b)]
    if (!one || !two) return undefined
    const [light, dark] = [luminance(one), luminance(two)].sort((x, y) => y - x)
    return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100
  }

  function measure() {
    chips = COLOURS.map(group => ({
      title: group.title,
      items: group.items.map(item => ({
        ...item,
        value: resolve(item.token),
        ratio: item.pair ? contrast(resolve(item.token), resolve(item.pair)) : undefined,
      })),
    }))
    measured = true
  }

  $effect(() => {
    // Measure after the DOM has the new scheme, including when System mode follows the OS.
    theme
    let frame = 0
    const schedule = () => {
      measured = false
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    schedule()
    const scheme = matchMedia('(prefers-color-scheme: dark)')
    scheme.addEventListener('change', schedule)
    return () => {
      cancelAnimationFrame(frame)
      scheme.removeEventListener('change', schedule)
    }
  })
</script>

<svelte:head>
  <title>IDS UI — the workshop's design system</title>
</svelte:head>

<div class="page">
  <header class="top">
    <div class="brand">
      <span class="mark" aria-hidden="true">⿰</span>
      <span>
        <strong>IDS UI</strong>
        <small>The workshop's design system</small>
      </span>
    </div>
    <div class="top-actions">
      <span class="scheme" aria-live="polite">{theme === 'system' ? 'Following the system' : `${theme[0].toUpperCase()}${theme.slice(1)} theme`}</span>
      <Segmented label="Theme" value={theme} options={themeOptions} onchange={setTheme} />
    </div>
  </header>

  <main>
    <section class="hero" aria-labelledby="intro">
      <p class="eyebrow">Tokens · states · native controls</p>
      <h1 id="intro">The workshop's colours, states and form controls.</h1>
      <p class="lede">
        Colours are stated once as light/dark pairs. Every form control is a native element with
        one set of states on top. The figures below are measured in the scheme you are viewing,
        not copied from a document.
      </p>
      <div class="summary" class:fail={measured && failures > 0}>
        <span class="dot" aria-hidden="true"></span>
        {#if !measured}
          <strong>Measuring contrast</strong> in this scheme.
        {:else if failures}
          <strong>{failures} contrast {failures === 1 ? 'check' : 'checks'} below target</strong> in this scheme.
        {:else}
          <strong>All {chips.flatMap(group => group.items).filter(item => item.threshold !== undefined).length} contrast checks pass</strong> in this scheme.
        {/if}
        <a href="#colours">Jump to the palette</a>
      </div>
    </section>

    <section id="colours" class="section" aria-labelledby="colours-title">
      <div class="section-head">
        <h2 id="colours-title">Colour</h2>
        <p>The ratio is against each token's stated pair. Text needs 4.5:1; a control boundary needs 3:1.</p>
      </div>
      {#each chips as group (group.title)}
        <h3>{group.title}</h3>
        <div class="swatches">
          {#each group.items as item (item.token)}
            <div class="swatch">
              <span class="chip" style:background={`var(${item.token})`} aria-hidden="true"></span>
              <div class="swatch-text">
                <span class="name">{item.name}</span>
                <code>{item.token}</code>
                <span class="value">{hex(item.value)}</span>
                {#if item.ratio !== undefined && item.threshold !== undefined}
                  <span class="ratio" class:fail={item.ratio < item.threshold}>
                    {item.ratio}:1 vs {item.pairName}{#if item.note} · {item.note}{/if}
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </section>

    <section id="type" class="section" aria-labelledby="type-title">
      <div class="section-head">
        <h2 id="type-title">Type</h2>
        <p>The interface face is the host's; CJK text uses the workshop's glyph stack.</p>
      </div>
      <div class="ui-card type-list">
        {#each TYPE as row (row.token)}
          <div class="type-row">
            <code>--ui-text-{row.token}</code>
            <span class="sample" style:font-size={row.size}>思わず記したい字 <span class="latin">The quick brown fox</span></span>
            <span class="use">{row.use}</span>
          </div>
        {/each}
      </div>
    </section>

    <section id="surfaces" class="section" aria-labelledby="surfaces-title">
      <div class="section-head">
        <h2 id="surfaces-title">Surfaces</h2>
        <p>A card groups content on a surface. It is a container; the controls stay controls.</p>
      </div>
      <div class="grid">
        <div class="ui-card">
          <span class="kicker">Default</span>
          <h3 class="card-title">A panel</h3>
          <p class="note">A bordered surface with a resting shadow, for settings, previews and forms.</p>
          <div class="row">
            <button type="button" class="ui-button">Action</button>
            <button type="button" class="ui-button" data-variant="quiet">Cancel</button>
          </div>
        </div>
        <div class="ui-card" data-variant="sunken">
          <span class="kicker">Sunken</span>
          <h3 class="card-title">A well</h3>
          <p class="note">The same padding and radius without a shadow, for a nested group or a quiet area.</p>
        </div>
        <a class="ui-card" data-interactive href="#colours">
          <span class="kicker">Interactive</span>
          <h3 class="card-title">The palette</h3>
          <p class="note">A card that is itself the target; the border and shadow answer the pointer.</p>
          <span class="linkish">Back to the colours</span>
        </a>
      </div>
    </section>

    <section id="buttons" class="section" aria-labelledby="buttons-title">
      <div class="section-head">
        <h2 id="buttons-title">Buttons</h2>
        <p>Hover, press and Tab through these; the states are the same ones the controls use.</p>
      </div>
      <div class="ui-card">
        <h3>Variants</h3>
        <div class="row">
          <button type="button" class="ui-button">Default</button>
          <button type="button" class="ui-button" data-variant="primary">Primary</button>
          <button type="button" class="ui-button" data-variant="danger">Danger</button>
          <button type="button" class="ui-button" data-variant="quiet">Quiet</button>
          <button type="button" class="ui-button" aria-pressed="true">Pressed</button>
          <button type="button" class="ui-button" disabled>Disabled</button>
        </div>
        <h3>Sizes</h3>
        <div class="row">
          <button type="button" class="ui-button" data-size="sm">Small</button>
          <button type="button" class="ui-button">Medium</button>
          <button type="button" class="ui-button" data-size="lg">Large</button>
          <button type="button" class="ui-button" data-size="icon" aria-label="Copy"><Icon name="copy" /></button>
          <button type="button" class="ui-button"><Icon name="download" size={16} />With an icon</button>
        </div>
        <p class="note">A pressed button is <code>aria-pressed="true"</code>; a disabled one is <code>disabled</code>, never a fake class.</p>
      </div>
    </section>

    <section id="forms" class="section" aria-labelledby="forms-title">
      <div class="section-head">
        <h2 id="forms-title">Forms</h2>
        <p>Native inputs, one visual layer. Labels are real labels; hints and errors are wired with <code>aria-describedby</code>.</p>
      </div>

      <div class="grid">
        <div class="ui-card">
          <h3>Text fields</h3>
          <TextField label="Sequence" bind:value={text} hint="An IDS description, written as the tree is edited." />
          <TextField label="A longer field" bind:value={readOnly} type="url" mono hint="The field is read-only; its text stays selectable." readonly />
          <TextField label="Disabled field" bind:value={disabledText} disabled hint="Disabled means unavailable now, not invalid." />
          <TextField label="Description" bind:value={bad} error="This description is missing a part." hint="The error text is announced with the field." />
          <div class="tall">
            <label class="ui-label" for="demo-textarea">A textarea</label>
            <textarea id="demo-textarea" class="ui-textarea" bind:value={textarea}></textarea>
          </div>
          <SelectField label="Default layout" bind:value={select} options={[
            { value: 'balanced', label: 'Balanced' },
            { value: 'compact', label: 'Compact' },
            { value: 'loose', label: 'Loose' },
          ]} hint="A native select is best when the list is longer than four." />
        </div>

        <div class="ui-card">
          <h3>Checkbox</h3>
          <Checkbox bind:checked={checked} label="Include empty slots" hint="A checkbox is one option among several." />
          <Checkbox bind:checked={unchecked} label="Copy the outline" />
          <Checkbox bind:checked={mixed} indeterminate label="Some layers" hint="Indeterminate is a native state, not a third checkbox." />
          <Checkbox checked disabled label="A checked, disabled option" />
          <Checkbox checked={false} disabled label="Unavailable option" hint="Disabled options keep their label and hint." />

          <h3>Switch</h3>
          <Switch bind:checked={switchOn} label="Key hints on buttons" hint="A switch applies an on/off setting at once." />
          <Switch checked={false} disabled label="A disabled switch" />
          <p class="note">A switch is for an immediate setting; a checkbox is for an option that is collected or submitted.</p>
        </div>
      </div>

      <div class="grid">
        <div class="ui-card">
          <h3>Radio group</h3>
          <RadioGroup label="Which operator starts the sequence?" bind:value={choice} options={[
            { value: 'new', label: 'Left and right', hint: '⿰ follows with two parts.' },
            { value: 'stack', label: 'Above and below', hint: 'Five segments, arrow keys move between them.' },
            { value: 'frame', label: 'Enclosure' },
            { value: 'off', label: 'Unavailable choice', disabled: true },
          ]} />
        </div>

        <div class="ui-card">
          <h3>Segmented</h3>
          <div class="field">
            <span class="ui-label">Format</span>
            <Segmented label="Format" bind:value={segmented} options={[{ value: 'svg', label: 'SVG' }, { value: 'png', label: 'PNG' }]} />
          </div>
          <div class="field">
            <span class="ui-label">Tree or shape</span>
            <Segmented label="Tree or shape" bind:value={icons} options={[
              { value: 'tree', label: 'Tree', icon: 'menu' },
              { value: 'shape', label: 'Shape', icon: 'system', hint: 'The box layout, for dense descriptions.' },
            ]} />
          </div>
          <div class="field">
            <span class="ui-label">Background</span>
            <Swatches label="Background" bind:value={swatch} options={[
              { value: 'none', swatch: 'none', ariaLabel: 'No background', title: 'No background' },
              { value: 'white', swatch: 'white', ariaLabel: 'White', title: 'White' },
              { value: 'black', swatch: 'black', ariaLabel: 'Black', title: 'Black' },
              { value: 'custom', swatch: 'custom', ariaLabel: 'A custom colour', title: 'A custom colour' },
            ]} />
          </div>
          <p class="note">A swatch group is for colour choices; a segmented control is for labelled choices or icons. Both are native radio groups.</p>
        </div>
      </div>

      <div class="grid">
        <div class="ui-card">
          <h3>Range and colour</h3>
          <div class="field">
            <label class="ui-label" for="demo-range">Margin <span class="value">{Math.round(range * 100)}%</span></label>
            <input id="demo-range" class="ui-range" type="range" min="0" max="0.25" step="0.01" bind:value={range} />
            <span class="ui-hint">The control is 24 px tall; the track is not the target.</span>
          </div>
          <div class="field">
            <label class="ui-label" for="demo-colour">Background colour</label>
            <input id="demo-colour" class="ui-color" type="color" bind:value={colour} />
          </div>
          <div class="field">
            <label class="ui-label" for="demo-range-off">Disabled range</label>
            <input id="demo-range-off" class="ui-range" type="range" min="0" max="1" step="0.1" value={0.4} disabled />
          </div>
        </div>

        <div class="ui-card">
          <h3>States and targets</h3>
          <dl class="facts">
            <div><dt>Focus</dt><dd>One 2 px ring with a 2 px offset, on every control.</dd></div>
            <div><dt>Hover</dt><dd>Border and surface shift, text does not.</dd></div>
            <div><dt>Pressed</dt><dd>Only for toggle buttons, as <code>aria-pressed</code>.</dd></div>
            <div><dt>Disabled</dt><dd>45% opacity, the label stays readable.</dd></div>
            <div><dt>Invalid</dt><dd>A 3:1 danger border, a soft fill and an error sentence.</dd></div>
            <div><dt>Target</dt><dd>24 × 24 px minimum; a checkbox row is 32 px tall.</dd></div>
            <div><dt>Forced colours</dt><dd>System colours replace the fills; shapes stay.</dd></div>
            <div><dt>Motion</dt><dd>Control transitions collapse under <code>prefers-reduced-motion</code>.</dd></div>
          </dl>
        </div>
      </div>
    </section>

    <section id="a11y" class="section" aria-labelledby="a11y-title">
      <div class="section-head">
        <h2 id="a11y-title">What to check before shipping</h2>
        <p>The short list this system is built against.</p>
      </div>
      <div class="ui-card prose">
        <ul>
          <li>Every control has a visible label; an icon-only button has an <code>aria-label</code> and a tooltip.</li>
          <li>Tab reaches every control once; Space toggles a checkbox or switch; arrows move within a radio group or segmented control.</li>
          <li>The focus ring stays visible on every surface and in both schemes, at 3:1 or better.</li>
          <li>State is never told by colour alone: a check mark, a thumb position, a dot or a word carries it too.</li>
          <li>Text meets 4.5:1; boundaries that identify a control meet 3:1.</li>
          <li>The control and its label together meet the 24 px target, with room around it.</li>
          <li>Nothing moves for a reader who asked for reduced motion, and forced colours keep the shape.</li>
        </ul>
        <p class="refs">
          <a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html" target="_blank" rel="noreferrer">WCAG 2.2 contrast (minimum)</a> ·
          <a href="https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html" target="_blank" rel="noreferrer">non-text contrast</a> ·
          <a href="https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html" target="_blank" rel="noreferrer">target size (minimum)</a> ·
          <a href="https://www.w3.org/WAI/ARIA/apg/patterns/switch/" target="_blank" rel="noreferrer">APG switch pattern</a>
        </p>
      </div>
    </section>
  </main>

  <footer class="foot">
    <span>IDS UI · the tokens and controls behind <a href="/">the workshop</a></span>
    <a href="https://github.com/mkpoli/ids-input">Source</a>
  </footer>
</div>

<style>
  .page{max-width:1120px;margin:0 auto;padding:0 clamp(16px,4vw,40px) 64px}
  .top{position:sticky;z-index:var(--ui-z-chrome);top:0;display:flex;align-items:center;justify-content:space-between;gap:16px;
    margin-inline:calc(clamp(16px,4vw,40px) * -1);padding:12px clamp(16px,4vw,40px);
    border-bottom:1px solid var(--ui-color-border);background:color-mix(in srgb,var(--ui-color-canvas) 88%,transparent);backdrop-filter:blur(10px)}
  .brand{display:flex;align-items:center;gap:10px;min-width:0}
  .mark{display:grid;place-items:center;width:34px;height:34px;border-radius:var(--ui-radius-lg);background:var(--ui-color-accent);color:var(--ui-color-on-accent);font-family:var(--cjk);font-size:22px;line-height:1}
  .brand strong{display:block;font-size:var(--ui-text-md);font-weight:var(--ui-weight-bold)}
  .brand small{display:block;color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs)}
  .top-actions{display:flex;align-items:center;gap:12px;flex:none}
  .scheme{color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);white-space:nowrap}
  main{display:flex;flex-direction:column;gap:clamp(40px,6vw,64px);padding-block:clamp(32px,5vw,56px) 0}
  .hero{display:flex;flex-direction:column;gap:14px;max-width:780px}
  .eyebrow{margin:0;color:var(--ui-color-accent);font-size:var(--ui-text-xs);font-weight:var(--ui-weight-semibold);letter-spacing:var(--ui-tracking-caps);text-transform:uppercase}
  h1{margin:0;font-size:clamp(28px,4.6vw,44px);font-weight:var(--ui-weight-bold);letter-spacing:-.02em;line-height:1.12;text-wrap:balance}
  .lede{max-width:68ch;margin:0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-lg);line-height:1.55}
  .summary{display:flex;align-items:center;flex-wrap:wrap;gap:8px;width:fit-content;max-width:100%;padding:9px 12px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface);font-size:var(--ui-text-sm)}
  .summary .dot{width:8px;height:8px;border-radius:50%;background:var(--ui-color-accent);box-shadow:0 0 0 3px var(--ui-color-accent-soft)}
  .summary.fail .dot{background:var(--ui-color-danger);box-shadow:0 0 0 3px var(--ui-color-danger-soft)}
  .summary a{margin-inline-start:4px;font-size:var(--ui-text-xs)}
  .section{display:flex;flex-direction:column;gap:18px;scroll-margin-top:88px}
  .section-head{display:flex;flex-direction:column;gap:4px}
  h2{margin:0;font-size:var(--ui-text-xl);font-weight:var(--ui-weight-bold);letter-spacing:-.01em}
  .section-head p{margin:0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-sm);line-height:1.5}
  h3{margin:0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);font-weight:var(--ui-weight-semibold);letter-spacing:.06em;text-transform:uppercase}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;align-items:start}
  .row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
  .field{display:flex;flex-direction:column;gap:6px;min-width:0}
  .tall{display:flex;flex-direction:column;gap:6px}
  .note{margin:0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);line-height:1.5}
  .kicker{color:var(--ui-color-accent);font-size:var(--ui-text-2xs);font-weight:var(--ui-weight-semibold);letter-spacing:.06em;text-transform:uppercase}
  .card-title{margin:0;color:var(--ui-color-ink);font-size:var(--ui-text-lg);font-weight:var(--ui-weight-semibold);letter-spacing:-.01em;text-transform:none}
  .linkish{color:var(--ui-color-accent);font-size:var(--ui-text-sm);font-weight:var(--ui-weight-medium)}
  .note code,.facts code{font-family:var(--ui-font-mono);font-size:.95em;color:var(--ui-color-ink-soft)}
  .value{color:var(--ui-color-ink-muted);font-variant-numeric:tabular-nums}
  .swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(216px,1fr));gap:8px}
  .swatch{display:flex;align-items:flex-start;gap:10px;padding:8px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface)}
  .chip{flex:none;width:44px;height:44px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);box-shadow:inset 0 0 0 1px rgb(0 0 0 / .04)}
  .swatch-text{display:flex;flex-direction:column;gap:1px;min-width:0;font-size:var(--ui-text-2xs);line-height:1.4}
  .swatch-text .name{color:var(--ui-color-ink);font-size:var(--ui-text-xs);font-weight:var(--ui-weight-semibold)}
  .swatch-text code{overflow:hidden;color:var(--ui-color-ink-muted);font-family:var(--ui-font-mono);font-size:10.5px;text-overflow:ellipsis;white-space:nowrap}
  .swatch-text .value{color:var(--ui-color-ink-soft);font-family:var(--ui-font-mono)}
  .ratio{margin-top:2px;color:var(--ui-color-ink-muted)}
  .ratio.fail{color:var(--ui-color-danger);font-weight:var(--ui-weight-semibold)}
  .type-list{gap:0;padding:0;overflow:hidden}
  .type-row{display:grid;grid-template-columns:96px minmax(0,1fr) 170px;align-items:baseline;gap:16px;padding:11px 20px;border-bottom:1px solid var(--ui-color-border)}
  .type-row:last-child{border-bottom:0}
  .type-row code{color:var(--ui-color-ink-muted);font-family:var(--ui-font-mono);font-size:11px}
  .type-row .sample{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--cjk)}
  .type-row .latin{font-family:var(--ui-font-sans);color:var(--ui-color-ink-muted)}
  .type-row .use{color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs)}
  .facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px 20px;margin:0}
  .facts div{display:flex;flex-direction:column;gap:2px}
  .facts dt{color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);font-weight:var(--ui-weight-semibold);letter-spacing:.05em;text-transform:uppercase}
  .facts dd{margin:0;font-size:var(--ui-text-sm);line-height:1.5}
  .prose{font-size:var(--ui-text-sm);line-height:1.6}
  .prose ul{display:flex;flex-direction:column;gap:8px;margin:0;padding-inline-start:20px}
  .prose li::marker{color:var(--ui-color-accent)}
  .prose code{padding:1px 4px;border-radius:var(--ui-radius-xs);background:var(--ui-color-surface-sunken);font-family:var(--ui-font-mono);font-size:12px}
  .refs{margin:0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);line-height:1.8}
  .foot{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:56px;padding-top:18px;border-top:1px solid var(--ui-color-border);color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs)}
  @media (max-width:640px){
    .top{gap:8px;padding-block:10px}
    .scheme{display:none}
    .brand small{display:none}
    .type-row{grid-template-columns:minmax(0,1fr);gap:2px}
    .type-row code{order:3}
    .type-row .use{order:2}
    .swatches{grid-template-columns:1fr}
    .ui-card{padding:var(--ui-space-xl)}
  }
</style>
