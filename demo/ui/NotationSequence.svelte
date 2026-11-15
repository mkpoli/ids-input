<script>
  // A quoted sequence of the zi.tools notation as tokens a reader can point at: each token is a
  // button, a component with its identifier one token, a stroke with its marks one token. Under an
  // entry of more than one operator run the scope lines of the workshop's own sequence field
  // (src/svelte/sequence-scopes.js): a lead from each operator and a segment under each operand. A
  // long sequence breaks only between the top-level operands of an entry, and each line keeps the
  // scope lines of the tokens on it.
  import { sequenceScopes } from '../../src/svelte/sequence-scopes.js'

  /**
   * @typedef {import('../lib/baishi-cheatsheet.js').Token & { slot: number | null, subject: boolean[] }} Shown
   * @type {{ tokens: Shown[], active?: number | null, lit?: number[] | null, numbered?: boolean, large?: boolean,
   *   onpoint?: (index: number | null, element: HTMLElement | null) => void, tip?: string }}
   */
  let { tokens, active = null, lit = null, numbered = false, large = false, onpoint, tip } = $props()

  // Where a line may break: after the row's character and each separator, and between the
  // top-level operands of an entry.
  const chunks = $derived.by(() => {
    /** @type {{ key: string, items: { token: Shown, index: number }[] }[]} */
    const out = []
    tokens.forEach((token, index) => {
      const key = token.kind === 'head' ? 'head' : token.kind === 'tab' || token.kind === 'sep' ? out.at(-1)?.key ?? 'head' : `${token.entry}:${token.top}`
      if (out.at(-1)?.key !== key) out.push({ key, items: [] })
      out[out.length - 1].items.push({ token, index })
    })
    return out
  })
  // The nodes of each entry's tree: its operators and its operands, a chain being one operand.
  const nodes = $derived(tokens.flatMap((token, index) => token.kind === 'op' || token.kind === 'part' || token.kind === 'open'
    ? [{ index, entry: token.entry, path: /** @type {number[]} */ (token.path), text: token.text, chain: token.kind === 'open' ? token.chain : undefined }] : []))
  // Scope lines are for an entry that nests: one operator needs none.
  const scoped = $derived(new Set(tokens.filter(token => token.kind === 'op' && (token.path?.length ?? 0) > 0).map(token => token.entry)))

  /** @type {HTMLElement | null} */ let root = $state(null)
  /** @type {{ key: string, top: number, height: number, scopes: ReturnType<typeof sequenceScopes> }[]} */
  let lines = $state([])
  let scopeHeight = $state(0)
  const measure = document.createElement('canvas').getContext('2d')

  $effect(() => {
    const run = root
    if (!run || !scoped.size) { lines = []; scopeHeight = 0; return }
    const list = nodes, shown = tokens, wanted = scoped
    let frame = 0, alive = true
    const read = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!alive) return
        const origin = run.getBoundingClientRect()
        const buttons = /** @type {HTMLElement[]} */ ([...run.querySelectorAll('[data-token]')])
        /** @param {number} index */
        const rectOf = index => buttons[index].getBoundingClientRect()
        const boxes = list.map(node => {
          // A chain's box runs from its `#(` to its `)`.
          const rects = node.chain === undefined ? [rectOf(node.index)]
            : shown.flatMap((token, index) => token.entry === node.entry && token.chain === node.chain ? [rectOf(index)] : [])
          const left = Math.min(...rects.map(rect => rect.left)) - origin.left, right = Math.max(...rects.map(rect => rect.right)) - origin.left
          let inkLeft = 0
          if (shown[node.index].kind === 'op' && measure) {
            const style = getComputedStyle(buttons[node.index])
            measure.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
            inkLeft = Math.max(0, -measure.measureText([...node.text][0]).actualBoundingBoxLeft)
          }
          return { left, right, inkLeft, line: 0, middle: (rects[0].top + rects[0].bottom) / 2 - origin.top, bottom: Math.max(...rects.map(rect => rect.bottom)) - origin.top }
        })
        // Tokens whose middles lie within most of a line's height of each other stand on one line.
        const reach = parseFloat(getComputedStyle(run).fontSize) * 1.1
        /** @type {number[]} */
        const rows = []
        for (const box of [...boxes].sort((a, b) => a.middle - b.middle)) {
          if (!rows.length || box.middle - rows[rows.length - 1] > reach) rows.push(box.middle)
          box.line = rows.length - 1
        }
        /** @type {typeof lines} */
        const next = []
        for (const entry of wanted) {
          const own = list.map((node, at) => ({ node, at })).filter(({ node }) => node.entry === entry)
          for (const line of new Set(own.map(({ at }) => boxes[at].line))) {
            const here = own.filter(({ at }) => boxes[at].line === line)
            // An operator on an earlier line still holds its operands here: it takes a place off the
            // line's start, and only its segments are drawn.
            const above = own.filter(({ node, at }) => boxes[at].line !== line && here.some(one => one.node.path.length > node.path.length && node.path.every((step, depth) => one.node.path[depth] === step)))
            const bounds = own.map(({ at }) => boxes[at].line === line ? boxes[at] : above.some(one => one.at === at) ? { left: -24, right: -23 } : undefined)
            const scopes = sequenceScopes(/** @type {any} */ (own.map(({ node }) => node)), /** @type {any} */ (bounds))
              .map(scope => above.some(one => one.node.path.join('.') === scope.path.join('.')) ? { ...scope, lead: '' } : scope)
            next.push({ key: `${entry}/${line}`, top: Math.max(...here.map(({ at }) => boxes[at].bottom)), height: scopes.length ? 12 + Math.max(...scopes.map(scope => scope.lane)) * 6 : 0, scopes })
          }
        }
        lines = next
        scopeHeight = Math.max(0, ...next.map(line => line.height))
      })
    }
    const observer = new ResizeObserver(read)
    observer.observe(run)
    document.fonts.addEventListener('loadingdone', read)
    void document.fonts.ready.then(read)
    read()
    return () => { alive = false; cancelAnimationFrame(frame); observer.disconnect(); document.fonts.removeEventListener('loadingdone', read) }
  })

  const pointed = $derived(active === null ? null : tokens[active])
  /** @param {number[]} path @param {number} entry */
  const hot = (path, entry) => Boolean(pointed && pointed.entry === entry && pointed.path && pointed.path.join('.') === path.join('.') && pointed.kind !== 'stroke')
</script>

<span class="sequence" class:large lang="ja" bind:this={root} style:--scope-height={`${scopeHeight}px`}>{#each chunks as chunk (chunk.key)}<span class="chunk">{#each chunk.items as { token, index } (index)}<button
  type="button" data-token={index} class={['token', token.kind, token.slot !== null && `s${token.slot}`]} class:active={active === index}
  class:related={active !== index && lit !== null && token.slot !== null && pointed?.entry === token.entry && lit.includes(token.slot)}
  aria-describedby={active === index ? tip : undefined}
  onpointerenter={event => onpoint?.(index, /** @type {HTMLElement} */ (event.currentTarget))} onpointerleave={() => onpoint?.(null, null)}
  onfocus={event => onpoint?.(index, /** @type {HTMLElement} */ (event.currentTarget))} onblur={() => onpoint?.(null, null)}
  >{#if numbered && token.kind === 'stroke'}<ruby>{#each token.stretches as stretch, at (at)}<span class={['stretch', stretch.role]} class:subject={token.subject[at]}>{stretch.text}</span>{/each}<rt>{token.order}</rt></ruby>{:else}{#each token.stretches as stretch, at (at)}<span class={['stretch', stretch.role]} class:subject={token.subject[at]}>{token.kind === 'tab' ? '⇥' : stretch.text}</span>{/each}{/if}</button>{/each}</span>{/each}{#each lines as line (line.key)}{#if line.scopes.length}<svg
  class="sequence-scopes" style:top={`${line.top}px`} width="100%" height={line.height} aria-hidden="true">{#each line.scopes as scope (scope.path.join('.'))}{@const entry = Number(line.key.split('/')[0])}<g>{#if scope.lead}<path class="scope-lead" class:scope-hovered={hot(scope.path, entry)} d={scope.lead} />{/if}{#each scope.segments as segment (segment.path.join('.'))}<path class="scope-segment" class:scope-hovered={hot(segment.path, entry) || hot(scope.path, entry)} d={segment.d} />{/each}</g>{/each}</svg>{/if}{/each}</span>

<style>
  .sequence{position:relative;display:inline-flex;flex-wrap:wrap;align-items:baseline;max-width:100%;font-family:var(--ids-font),var(--ids-glyph-fallback);font-size:20px;line-height:1.5;color:var(--ui-color-ink)}
  .sequence.large{font-size:26px}
  .chunk{display:inline-block;white-space:nowrap;padding-bottom:var(--scope-height,0px)}
  .token{all:unset;box-sizing:border-box;display:inline-block;padding:0 1px;border-radius:4px;font:inherit;line-height:inherit;color:inherit;cursor:help;
    transition:background-color var(--ui-duration-fast) var(--ui-ease),color var(--ui-duration-fast) var(--ui-ease),box-shadow var(--ui-duration-fast) var(--ui-ease)}
  .token:is(.tab,.sep,.open,.shut,.close,.list,.prefix){color:var(--ui-color-ink-muted)}
  .token.tab{padding-inline:3px}
  .stretch.mod{color:var(--ui-color-ink-soft)}
  /* A written part: its colour, and under it a bar of that colour in the slot's own pattern. */
  .token:is(.s0,.s1,.s2,.s3){--part:var(--part-0);font-weight:700;color:var(--part);background-image:var(--bar);background-repeat:repeat-x;background-position:0 100%;background-size:auto 3px}
  .token.s0{--bar:linear-gradient(var(--part),var(--part))}
  .token.s1{--part:var(--part-1);--bar:repeating-linear-gradient(90deg,var(--part) 0 7px,transparent 7px 10px)}
  .token.s2{--part:var(--part-2);--bar:repeating-linear-gradient(90deg,var(--part) 0 3px,transparent 3px 6px)}
  .token.s3{--part:var(--part-3);--bar:linear-gradient(var(--part) 0 1px,transparent 1px 2px,var(--part) 2px 3px)}
  /* What the card is about: a marker over the piece. */
  .stretch.subject{border-radius:3px;background:var(--mark);box-shadow:0 0 0 2px var(--mark);color:var(--ui-color-ink)}
  .token:is(.s0,.s1,.s2,.s3) .stretch.subject{color:var(--part)}
  /* Pointed at or focused: the token inverts, and the parts under an operator answer it. */
  .token.related{background-color:color-mix(in srgb,var(--part) 16%,transparent)}
  .token.active,.token:focus-visible{background:var(--ui-color-ink);color:var(--ui-color-canvas);box-shadow:0 0 0 2px var(--ui-color-ink)}
  .token:is(.s0,.s1,.s2,.s3):is(.active,:focus-visible){background:var(--part);color:var(--ui-color-surface);box-shadow:0 0 0 2px var(--part)}
  .token:is(.active,:focus-visible) .stretch{color:inherit;background:none;box-shadow:none}
  ruby{ruby-position:over;ruby-align:center}
  rt{font-family:var(--ui-font-sans);font-size:10px;font-weight:600;line-height:1;color:var(--ui-color-ink-muted);user-select:none}
  .token:is(.active,:focus-visible) rt{color:inherit}
  /* The scope lines of the workshop's sequence field. */
  .sequence-scopes{position:absolute;left:0;overflow:visible;fill:none;pointer-events:none}
  .sequence-scopes path{stroke:var(--ui-color-ink-muted);stroke-width:1;stroke-linecap:round;stroke-linejoin:round}
  .sequence-scopes path.scope-hovered{stroke:var(--ui-color-accent);stroke-width:1.6}
  .sequence-scopes path.scope-segment.scope-hovered{stroke-width:2}
  @media (forced-colors:active){
    .sequence-scopes path{stroke:CanvasText;stroke-width:1.5}
    .sequence-scopes path.scope-hovered{stroke:Highlight;stroke-width:2}
    .token:is(.active,:focus-visible){background:Highlight;color:HighlightText}
  }
  @media (prefers-reduced-motion:reduce){.token{transition:none}}
</style>
