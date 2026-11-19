<script>
  // A character drawn in any blend of the five faces: a pad and five shares set the blend, a
  // range sets the stroke weight, and a tour plays the blend along the pad's edges, across it and
  // through its interior.
  import { onMount } from 'svelte'
  import PageHeader from './ui/PageHeader.svelte'
  import Segmented from './ui/controls/Segmented.svelte'
  import Icon from './ui/Icon.svelte'
  import { translator } from '../src/svelte/index.js'
  import { LOCALES, appMessages } from './lib/locales.js'
  import { load, save } from './lib/storage.js'
  import { composerPreview } from '@han-compose/composer'
  import { FONT_STYLES } from '@han-compose/composer/font-mix'
  import { drawingSvg } from '@han-compose/composer/drawing-svg'
  import { COMPOSER_BASES } from './lib/composer.js'
  import engineOutlines from 'ids-engine-outlines'
  import { MIXER_EXAMPLES } from './lib/font-mixer/examples.js'
  import { createPlayback } from './lib/font-mixer/playback.js'
  import { tour } from './lib/font-mixer/route.js'
  import { pointAt, vertices, weightsAt } from './lib/font-mixer/pentagon.js'

  const params = new URLSearchParams(location.search)
  const wanted = String(params.get('lang') ?? load('locale', null) ?? navigator.language ?? '')
  const traditional = /^zh-(?:Hant|TW|HK|MO)\b/i
  let locale = $state(
    LOCALES.find(([code]) => code === wanted)?.[0]
    ?? (traditional.test(wanted) ? 'zh-Hant' : undefined)
    ?? LOCALES.find(([code]) => wanted.startsWith(code.split('-')[0]))?.[0] ?? 'en')
  $effect(() => save('locale', locale))
  $effect(() => { document.documentElement.lang = locale })
  const messages = $derived(LOCALES.find(([code]) => code === locale)?.[2])
  const t = $derived(translator({ ...appMessages('en'), ...messages, ...appMessages(locale) }, locale))

  const preview = composerPreview({
    base: COMPOSER_BASES.sans,
    faceBases: Object.fromEntries(FONT_STYLES.map(style => [style, COMPOSER_BASES[style]])),
    separate: true,
    loaders: engineOutlines,
  })

  let sequence = $state(params.get('ids')?.trim() || MIXER_EXAMPLES[0][1])
  /** Each face's share of the blend, in percent. @type {Record<string, number>} */
  let shares = $state(Object.fromEntries(FONT_STYLES.map(style => [style, 20])))
  let weight = $state(100)
  // The blend is kept between visits, and the workshop's Mix option draws in it.
  const kept = load('font-mix', null)
  if (FONT_STYLES.every(style => Number.isFinite(kept?.shares?.[style]) && kept.shares[style] >= 0)) {
    const total = FONT_STYLES.reduce((sum, style) => sum + kept.shares[style], 0)
    if (total > 0) for (const style of FONT_STYLES) shares[style] = (kept.shares[style] / total) * 100
  }
  if (Number.isFinite(kept?.weight)) weight = Math.round(Math.min(1.5, Math.max(0.65, kept.weight)) * 100)
  /** Keep the blend once the reader lets go of a control, so another tab hears of it once. */
  const keep = () => save('font-mix', { shares: Object.fromEntries(FONT_STYLES.map(style => [style, shares[style] / 100])), weight: weight / 100 })
  let pace = $state(3)
  let phase = $state('neighbours')
  /** @type {'idle' | 'preparing' | 'playing' | 'paused'} */
  let playing = $state('idle')
  /** What the specimen says in place of, or over, a drawing. @type {'' | 'composing' | 'empty' | 'preparing' | string} */
  let status = $state('composing')
  /** The tour's position, or how far its preparation is; null when no tour is loaded. @type {number | null} */
  let position = $state(null)
  let drawn = $state(false)
  /** Whether the drawing shown is of the newest request, so Save writes what the controls say. */
  let current = $state(false)
  /** The pad positions of the tour's current part. */
  let trail = $state('')
  /** @type {HTMLElement} */
  let glyph
  /** @type {SVGSVGElement} */
  let pad

  const weights = $derived(FONT_STYLES.map(style => shares[style] / 100))
  const cursor = $derived(pointAt(weights))
  const percent = (/** @type {number} */ value) => `${Math.round(value * 10) / 10}%`
  const statusText = $derived(
    status === 'composing' ? t('fontMixer.composing')
    : status === 'empty' ? t('fontMixer.empty')
    : status === 'preparing' ? t('fontMixer.preparing')
    : status)

  /** @param {any} drawing */
  const svgNode = drawing => document.importNode(
    new DOMParser().parseFromString(drawingSvg(drawing, { ink: 'currentColor' }), 'image/svg+xml').documentElement, true)

  // While a mix is in flight, only the newest request is kept: each finished drawing of the
  // current description is shown, and the newest shares are drawn on the next frame.
  let frame = 0, revision = 0, visible = ''
  /** @type {{ sequence: string, version: number, mix: { shares: Record<string, number>, weight: number } } | null} */
  let pending = null
  /** @type {{ sequence: string, controller: AbortController } | null} */
  let running = null

  function schedule() {
    if (playback.state !== 'idle') playback.stop()
    const wanted = sequence.trim(), version = ++revision
    pending = wanted ? { sequence: wanted, version, mix: { shares: { ...shares }, weight: weight / 100 } } : null
    if (running && running.sequence !== wanted) running.controller.abort()
    if (wanted !== visible) {
      glyph?.replaceChildren()
      drawn = false
      visible = ''
      status = wanted ? 'composing' : 'empty'
    } else status = ''
    if (!wanted) status = 'empty'
    current = false
    if (!frame && !running && pending) frame = requestAnimationFrame(render)
  }
  async function render() {
    frame = 0
    const request = pending
    pending = null
    if (!request) return
    const controller = new AbortController()
    running = { sequence: request.sequence, controller }
    try {
      const drawing = await preview(request.sequence, { signal: controller.signal, mix: request.mix })
      if (controller.signal.aborted || !glyph) return
      glyph.replaceChildren(svgNode(drawing))
      visible = request.sequence
      drawn = true
      current = request.version === revision
      status = drawing.missing?.length ? t('fontMixer.missing', { glyphs: drawing.missing.join(' ') }) : ''
    } catch (error) {
      if (!controller.signal.aborted && request.version === revision && glyph) {
        glyph.replaceChildren()
        drawn = false
        visible = ''
        status = /** @type {Error} */ (error).message
      }
    } finally {
      running = null
      if (pending && !frame) frame = requestAnimationFrame(render)
    }
  }

  /** @param {string} style @param {number} value */
  function setShare(style, value) {
    const others = FONT_STYLES.filter(face => face !== style)
    const total = others.reduce((sum, face) => sum + shares[face], 0)
    for (const face of others) shares[face] = (100 - value) * (total > 0 ? shares[face] / total : 1 / others.length)
    shares[style] = value
    schedule()
  }
  /** @param {PointerEvent} event */
  function movePad(event) {
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(/** @type {DOMMatrix} */ (pad.getScreenCTM()).inverse())
    weightsAt([point.x, point.y]).forEach((share, i) => { shares[FONT_STYLES[i]] = share * 100 })
    schedule()
  }

  /** @type {ReturnType<typeof tour>} */
  let route = { frames: [], phases: [] }
  let recorded = '', recordedWeight = 1
  /** @type {{ name: string, start: number, end: number } | undefined} */
  let shown
  let scrubbing = false, scrubbed = false
  // Until a tour shows its first frame the bar shows how far its preparation is; after that it
  // stays the reader's place in the tour, also while a jump ahead is being prepared.
  let started = false
  const weightsOf = (/** @type {Record<string, number>} */ mix) => FONT_STYLES.map(style => mix[style] ?? 0)
  /** @param {{ name: string, start: number, end: number } | undefined} part */
  function showPhase(part) {
    if (part === shown) return
    shown = part
    trail = part ? route.frames.slice(part.start - 1, part.end).map(mix => pointAt(weightsOf(mix)).join(',')).join(' ') : ''
    if (part) phase = part.name
  }
  const playback = createPlayback({
    kind: mix => Object.values(mix).filter(Boolean).length,
    draw: async (mix, signal) => {
      const drawing = await preview(recorded, { signal, mix: { shares: mix, weight: recordedWeight } })
      if (drawing.missing?.length) throw new Error(t('fontMixer.missing', { glyphs: drawing.missing.join(' ') }))
      return svgNode(drawing)
    },
    paint: (shot, index) => {
      glyph.replaceChildren(shot.image)
      visible = recorded
      drawn = true
      current = true
      started = true
      for (const style of FONT_STYLES) shares[style] = (shot.mix[style] ?? 0) * 100
      showPhase(route.phases.findLast(part => index >= part.start - 1) ?? route.phases[0])
      if (!scrubbing) position = index / Math.max(1, route.frames.length - 1)
    },
    progress: fraction => { if (!scrubbing && !started) position = fraction },
    prepared: () => { if (status === 'preparing') status = '' },
    stateChanged: state => {
      playing = state
      if (state === 'preparing') status = 'preparing'
      if (state === 'idle') {
        if (status === 'preparing') status = ''
        showPhase(undefined)
        position = null
        scrubbing = false
      }
    },
    failed: error => { status = error.message },
  })
  const phaseStart = () => (route.phases.find(part => part.name === phase)?.start ?? 1) - 1
  function play() {
    if (playback.state === 'playing') return playback.pause()
    if (playback.state === 'paused') return playback.resume()
    if (playback.state === 'preparing') return schedule()
    recorded = sequence.trim()
    if (!recorded) return
    recordedWeight = weight / 100
    cancelAnimationFrame(frame)
    frame = 0
    pending = null
    revision++
    running?.controller.abort()
    route = tour(FONT_STYLES, pace)
    started = false
    playback.start(route.frames, phaseStart())
  }
  function setPace() {
    const state = playback.state
    if (state === 'idle') return
    schedule()
    // A tour that was running starts again at the new pace.
    if (state !== 'paused') play()
  }
  const lastFrame = $derived(position === null ? 1 : Math.max(1, route.frames.length - 1))
  /** @param {number} index */
  function scrub(index) {
    position = index / lastFrame
    if (route.frames.length) playback.seek(index)
  }
  function endScrub() {
    if (scrubbing && scrubbed) playback.resume()
    scrubbing = false
  }
  function saveSvg() {
    const svg = glyph.firstElementChild
    if (!svg) return
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }))
    const link = document.createElement('a')
    link.download = 'ids-font-mix.svg'
    link.href = url
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  onMount(() => {
    const hide = () => { if (document.hidden) playback.pause() }
    document.addEventListener('visibilitychange', hide)
    schedule()
    return () => {
      document.removeEventListener('visibilitychange', hide)
      playback.stop()
      cancelAnimationFrame(frame)
      running?.controller.abort()
    }
  })

  const playLabel = $derived(t(`fontMixer.${playing === 'idle' ? 'play' : playing === 'preparing' ? 'cancel' : playing === 'playing' ? 'pause' : 'resume'}`))
  const phases = $derived(['neighbours', 'distant', 'free'].map(value => ({ value, label: t(`fontMixer.phase.${value}`) })))
  const fill = (/** @type {number} */ value, /** @type {number} */ min, /** @type {number} */ max) => `${((value - min) / (max - min)) * 100}%`
</script>

<svelte:head>
  <title>{t('fontMixer.title')} — {t('app.title')}</title>
</svelte:head>

<div class="page">
  <PageHeader page="font-mixer" title={t('fontMixer.title')} {t} bind:locale />

  <main>
    <section class="stage" aria-label={t('fontMixer.specimen')}>
      <div class="frame">
        <div class="proof">
          <div class="glyph" bind:this={glyph}></div>
          <p class="status" role="status">{statusText}</p>
          {#if position !== null}
            <input class="ui-range scrub" type="range" min="0" max={lastFrame} step="1" value={Math.round(position * lastFrame)}
              style:--fill={`${position * 100}%`} aria-label={t('fontMixer.position')}
              aria-valuetext={`${t(`fontMixer.phase.${phase}`)} ${percent(position * 100)}`}
              onpointerdown={event => { if (!event.isPrimary || event.button !== 0) return; scrubbing = true; scrubbed = playback.state === 'playing' || playback.state === 'preparing'; playback.pause() }}
              oninput={event => scrub(event.currentTarget.valueAsNumber)}
              onchange={endScrub} onpointerup={endScrub} onpointercancel={endScrub} />
          {/if}
        </div>
      </div>
      <div class="transport">
        <button type="button" class="ui-button play" data-variant="primary" disabled={!sequence.trim()} onclick={play}>
          {#if playing === 'playing'}<Icon name="pause" size={14} />{:else if playing !== 'preparing'}<Icon name="play" size={14} />{/if}
          <span>{playLabel}</span>
        </button>
        <Segmented label={t('fontMixer.route')} bind:value={phase} options={phases}
          onchange={() => { if (playback.state !== 'idle') playback.seek(phaseStart()) }} />
        <label class="pace">
          <span>{t('fontMixer.pace')}</span>
          <input class="ui-range" type="range" min="0.25" max="20" step="0.25" bind:value={pace}
            style:--fill={fill(pace, 0.25, 20)} aria-valuetext={t('fontMixer.seconds', { seconds: pace })} onchange={setPace} />
          <output>{t('fontMixer.seconds', { seconds: pace })}</output>
        </label>
      </div>
      <div class="examples" role="group" aria-label={t('fontMixer.examples')}>
        {#each MIXER_EXAMPLES as [label, ids] (ids)}
          <button type="button" class="ui-button" data-size="sm" lang="zh" title={ids} aria-pressed={sequence.trim() === ids}
            onclick={() => { sequence = ids; schedule() }}>{label}</button>
        {/each}
      </div>
    </section>

    <section class="panel" aria-label={t('fontMixer.controls')}>
      <label class="ui-field">
        <span class="ui-label">{t('fontMixer.description')}</span>
        <input class="ui-input ids" type="text" lang="zh" spellcheck="false" bind:value={sequence} oninput={schedule} />
      </label>

      <fieldset>
        <legend class="ui-label">{t('fontMixer.faces')}</legend>
        <div class="pad">
          <svg bind:this={pad} viewBox="-150 -112 300 214" role="img" aria-label={t('fontMixer.pad')}
            onpointerdown={event => { if (!event.isPrimary || event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); movePad(event) }}
            onpointermove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) movePad(event) }}
            onpointerup={keep} onpointercancel={keep}>
            <polygon class="field" points={vertices.map(p => p.join(',')).join(' ')} />
            {#each vertices as [x, y] (x)}<line class="spoke" x1="0" y1="0" x2={x} y2={y} />{/each}
            <polyline class="trail" points={trail} />
            {#each vertices as [x, y], i (x)}
              <circle class="pole" cx={x} cy={y} r="3" />
              <text x={x * 1.12} y={y * 1.12 + (y < -80 ? -4 : y > 0 ? 14 : 4)}
                text-anchor={Math.abs(x) < 1 || y > 0 ? 'middle' : x > 0 ? 'start' : 'end'}
                font-weight={weights[i] > 0.5 ? 650 : 400}>{t(`app.font.${FONT_STYLES[i]}`)}</text>
            {/each}
            <circle class="cursor" cx={cursor[0]} cy={cursor[1]} r="7" />
          </svg>
        </div>
        <div class="faces">
          {#each FONT_STYLES as style (style)}
            <label>
              <span>{t(`app.font.${style}`)}</span>
              <input class="ui-range" type="range" min="0" max="100" step="0.1" value={shares[style]}
                style:--fill={`${shares[style]}%`} aria-valuetext={percent(shares[style])}
                oninput={event => setShare(style, event.currentTarget.valueAsNumber)} onchange={keep} />
              <output>{percent(shares[style])}</output>
            </label>
          {/each}
        </div>
      </fieldset>

      <label class="weight">
        <span>{t('fontMixer.weight')}</span>
        <input class="ui-range" type="range" min="65" max="150" bind:value={weight}
          style:--fill={fill(weight, 65, 150)} aria-valuetext={percent(weight)} oninput={schedule} onchange={keep} />
        <output>{percent(weight)}</output>
      </label>

      <button type="button" class="ui-button save" disabled={!drawn || !current} onclick={saveSvg}>
        <Icon name="download" size={14} /><span>{t('fontMixer.save')}</span>
      </button>
    </section>
  </main>
</div>

<style>
  .page{display:grid;grid-template-rows:auto minmax(0,1fr);min-block-size:100dvh}
  main{display:grid;grid-template-columns:minmax(0,1fr) minmax(20rem,26rem);min-block-size:0}
  .stage{display:grid;grid-template-rows:minmax(0,1fr) auto auto;gap:var(--ui-space-xl);min-block-size:0;padding:var(--ui-space-3xl)}
  .frame{display:grid;place-items:center;min-block-size:min(60dvh,32rem);container-type:size}
  .proof{position:relative;inline-size:min(100cqw,100cqh);aspect-ratio:1;display:grid;place-items:center;overflow:hidden;
    border:1px solid var(--ui-color-border-strong);border-radius:var(--ui-radius-lg);background-color:var(--ui-color-surface);
    background-image:linear-gradient(to right,transparent calc(50% - .5px),var(--ui-color-border) 0 calc(50% + .5px),transparent 0),
      linear-gradient(transparent calc(50% - .5px),var(--ui-color-border) 0 calc(50% + .5px),transparent 0)}
  .glyph{display:grid;place-items:center;inline-size:100%;block-size:100%}
  .glyph :global(svg){inline-size:88%;block-size:88%}
  .status:empty{display:none}
  .status{position:absolute;inset:auto 0 var(--ui-space-2xl);margin:0;text-align:center;color:var(--ui-color-ink-muted);font-size:var(--ui-text-sm)}
  .scrub{position:absolute;inset:auto 0 0;block-size:16px;cursor:ew-resize}
  .scrub::-webkit-slider-runnable-track{border-radius:0;margin-block-start:8px}
  .scrub::-moz-range-track,.scrub::-moz-range-progress{border-radius:0;transform:translateY(2px)}
  .scrub::-webkit-slider-thumb{inline-size:12px;block-size:12px;margin-block-start:-4px}
  .scrub::-moz-range-thumb{inline-size:12px;block-size:12px;transform:translateY(2px)}
  .transport{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:var(--ui-space-lg)}
  .play{min-inline-size:7rem}
  .pace{display:grid;grid-template-columns:auto 9rem 3.2rem;align-items:center;gap:var(--ui-space-sm)}
  .pace span{color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);font-weight:var(--ui-weight-semibold)}
  .examples{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--ui-space-2xs)}
  .examples button{font-family:var(--cjk);font-size:var(--ui-text-lg)}
  .panel{display:flex;flex-direction:column;gap:var(--ui-space-3xl);padding:var(--ui-space-3xl);overflow-y:auto;
    border-inline-start:1px solid var(--ui-color-border);background:var(--ui-color-surface);
    scrollbar-color:var(--ui-color-scrollbar) transparent;scrollbar-width:thin}
  .ids{font-family:var(--cjk);font-size:var(--ui-text-xl);block-size:var(--ui-control-h-lg)}
  fieldset{display:grid;gap:var(--ui-space-lg);min-inline-size:0;margin:0;padding:0;border:0}
  .pad{border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface-sunken)}
  .pad svg{display:block;inline-size:100%;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}
  .pad svg:active{cursor:grabbing}
  .field{fill:var(--ui-color-surface);stroke:var(--ui-color-control-border)}
  .spoke{stroke:var(--ui-color-border)}
  .trail{fill:none;stroke:var(--ui-color-accent);stroke-width:1.5;stroke-linejoin:round;opacity:.45}
  .pole{fill:var(--ui-color-ink-muted)}
  .pad text{fill:currentColor;font-size:11px}
  .cursor{fill:var(--ui-color-accent);stroke:var(--ui-color-surface);stroke-width:2.5}
  .faces{display:grid;gap:var(--ui-space-xs)}
  .faces label,.weight{display:grid;grid-template-columns:5.5rem minmax(0,1fr) 3.2rem;align-items:center;gap:var(--ui-space-lg)}
  .faces span,.weight span{font-size:var(--ui-text-sm);font-weight:var(--ui-weight-medium)}
  output{text-align:end;color:var(--ui-color-ink-muted);font:var(--ui-text-xs) var(--ui-font-mono);font-variant-numeric:tabular-nums}
  .ui-range{--fill:50%;touch-action:pan-y}
  .ui-range::-webkit-slider-runnable-track{background:linear-gradient(to right,var(--ui-color-accent) var(--fill),var(--ui-color-border-strong) var(--fill))}
  .ui-range::-moz-range-progress{block-size:4px;border-radius:var(--ui-radius-pill);background:var(--ui-color-accent)}
  .save{align-self:start}
  @media (max-width:760px){
    main{grid-template-columns:1fr}
    .stage,.panel{padding:var(--ui-space-xl)}
    .frame{container-type:inline-size;min-block-size:0}
    .proof{inline-size:min(100cqw,46svh)}
    .examples{flex-wrap:nowrap;justify-content:start;overflow-x:auto;margin-inline:calc(-1 * var(--ui-space-xl));padding-inline:var(--ui-space-xl);scrollbar-width:none}
    .examples button{flex:none}
    .panel{overflow:visible;border-inline-start:0;border-block-start:1px solid var(--ui-color-border)}
  }
</style>
