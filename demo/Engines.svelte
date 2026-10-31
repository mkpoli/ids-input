<script>
  // A feature reference for the engines this site is compared with. One table, one column per
  // engine; cells say "—" where no public source documents a value.
  import { applyTheme, storedTheme } from './lib/theme.js'
  import ThemeSwitch from './ui/ThemeSwitch.svelte'
  import { ENGINES, SECTIONS, SOURCES } from './lib/engine-table.js'

  let theme = $state(storedTheme())
  /** @param {import('./lib/theme.js').Theme} next */
  const setTheme = next => { theme = next; applyTheme(next) }
</script>

<svelte:head>
  <title>Engine comparison — IDS Workshop</title>
</svelte:head>

<div class="page">
  <header class="bar">
    <a class="brand" href="./" aria-label="IDS Workshop">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="var(--ui-color-accent)" /><path d="M7 7h4v10H7zM13 7h4v4h-4zM13 13h4v4h-4z" fill="var(--ui-color-on-accent)" /></svg>
      <span>IDS Workshop</span>
    </a>
    <span class="slash" aria-hidden="true">/</span>
    <h1>Engine comparison</h1>
    <div class="end">
      <a class="back" href="./compare.html">Comparison</a>
      <ThemeSwitch {theme} label="Theme" labels={{ system: 'System', light: 'Light', dark: 'Dark' }} onchange={setTheme} />
      <a class="back" href="./">Workshop</a>
    </div>
  </header>

  <main>
    <p class="lead">What each engine reads and writes, how it composes, what it costs and what it is licensed under. One row per feature; one column per engine.</p>
    <p class="hint">Cells say “—” where no public source documents a value. Numbers marked † were measured on this machine on 2026-10-29; the method is on the <a href="./compare.html">comparison page</a>.</p>

    <p class="scrollhint">Scroll sideways to see every engine.</p>
    <div class="scroll">
      <table>
        <caption class="ui-visually-hidden">Feature comparison of IDS glyph engines</caption>
        <thead>
          <tr>
            <th class="rowhead" scope="col"><span class="ui-visually-hidden">Feature</span></th>
            {#each ENGINES as engine (engine.key)}
              <th scope="col">
                <a href={engine.url} target="_blank" rel="noreferrer">{engine.name}</a>
                <span class="sub">{engine.sub}</span>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each SECTIONS as section (section.title)}
            <tr class="section"><th colspan={ENGINES.length + 1} scope="colgroup">{section.title}</th></tr>
            {#each section.rows as row (row.label)}
              <tr>
                <th scope="row">{row.label}</th>
                {#each ENGINES as engine (engine.key)}
                  <td class:na={row.cells[engine.key] === '—'}>{row.cells[engine.key]}</td>
                {/each}
              </tr>
            {/each}
          {/each}
        </tbody>
      </table>
    </div>

    <p class="note">† Measured here, not by the engines' authors: AMD Ryzen 7 9800X3D, Chrome for Testing 155 on WSL2, network from Tokyo. Latency is the median per glyph; data is the median transferred for one new glyph. KAGE's figure is the renderer alone; zi.tools' includes its server composition and network.</p>

    <h2>Sources</h2>
    <ol class="sources">
      {#each SOURCES as source (source.url)}
        <li><a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> — <span>{source.note}</span></li>
      {/each}
    </ol>
    <p class="note">Read 2026-10-29 unless a source says otherwise. This page describes public behaviour; a feature marked “—” may exist without documentation.</p>
  </main>
</div>

<style>
  .page{display:flex;flex-direction:column;min-height:100dvh}
  .bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px max(18px,env(safe-area-inset-right)) 10px max(18px,env(safe-area-inset-left));
    border-bottom:1px solid var(--ui-color-border);background:color-mix(in srgb,var(--ui-color-canvas) 88%,transparent);backdrop-filter:blur(10px);position:sticky;top:0;z-index:10}
  .brand{display:flex;align-items:center;gap:8px;color:var(--ui-color-ink);text-decoration:none;font-weight:650;font-size:15px;white-space:nowrap}
  .slash{color:var(--ui-color-border-strong)}
  h1{margin:0;font-size:15px;font-weight:600;color:var(--ui-color-ink-muted);white-space:nowrap}
  .end{display:flex;align-items:center;gap:10px;margin-left:auto;flex-wrap:wrap}
  .back{font-size:13px;color:var(--ui-color-accent);text-decoration:none;padding:5px 9px;border-radius:var(--ui-radius-md)}
  .back:hover{background:var(--ui-color-surface-hover)}

  main{width:100%;max-width:1500px;margin:0 auto;padding:26px max(18px,env(safe-area-inset-right)) 60px max(18px,env(safe-area-inset-left))}
  .lead{margin:0 0 6px;max-width:80ch;font-size:17px;line-height:1.55}
  .hint{margin:0 0 18px;max-width:90ch;font-size:13px;color:var(--ui-color-ink-muted)}
  .hint a{color:var(--ui-color-accent)}

  .scrollhint{display:none;margin:0 0 8px;font-size:12.5px;color:var(--ui-color-ink-muted)}
  @media (max-width:900px){.scrollhint{display:block}}
  .scroll{overflow-x:auto;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-xl);background:var(--ui-color-surface);box-shadow:var(--ui-shadow-1)}
  table{border-collapse:separate;border-spacing:0;width:100%;min-width:1240px;font-size:12.5px;line-height:1.45}
  th,td{padding:8px 10px;text-align:left;vertical-align:top;border-bottom:1px solid var(--ui-color-border)}
  thead th{position:sticky;top:0;z-index:2;background:var(--ui-color-surface);border-bottom:2px solid var(--ui-color-border-strong);font-size:13px}
  thead th a{color:var(--ui-color-ink);text-decoration:none;font-weight:650}
  thead th a:hover{color:var(--ui-color-accent)}
  thead .sub{display:block;font-size:11px;color:var(--ui-color-ink-muted);font-weight:400;margin-top:2px}
  .rowhead{width:150px;min-width:150px}
  tbody th[scope="row"]{position:sticky;left:0;z-index:1;background:var(--ui-color-surface);width:150px;min-width:150px;font-weight:600;color:var(--ui-color-ink)}
  tbody tr:nth-child(even) td,tbody tr:nth-child(even) th[scope="row"]{background:var(--ui-color-surface-sunken)}
  tbody tr:hover td,tbody tr:hover th[scope="row"]{background:var(--ui-color-surface-hover)}
  tr.section th{position:sticky;left:0;background:var(--ui-color-surface-sunken)!important;color:var(--ui-color-ink-muted);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:10px}
  td{color:var(--ui-color-ink)}
  td.na{color:var(--ui-color-ink-muted)}

  h2{font-size:18px;margin:36px 0 10px;padding-top:10px;border-top:1px solid var(--ui-color-border)}
  .sources{margin:0;padding-left:22px;font-size:13px;color:var(--ui-color-ink-muted)}
  .sources li{margin:6px 0}
  .sources a{color:var(--ui-color-accent);text-decoration:none}
  .sources a:hover{text-decoration:underline}
  .note{max-width:95ch;font-size:12.5px;color:var(--ui-color-ink-muted);line-height:1.6}
  @media (max-width:640px){
    h1,.slash{display:none}
    .lead{font-size:15.5px}
  }
</style>
