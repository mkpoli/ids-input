<script>
  // The open data release: what it holds, where the files are and what may be done with them. The
  // counts come from the manifest the build writes beside the files, so the page cannot claim more
  // than the dataset carries.
  import SiteSelect from './ui/SiteSelect.svelte'
  import { appMessages } from './lib/locales.js'
  import { applyTheme, storedTheme } from './lib/theme.js'
  import ThemeSwitch from './ui/ThemeSwitch.svelte'
  import manifest from '../data/open-data/manifest.json'

  const en = appMessages('en')

  let theme = $state(storedTheme())
  /** @param {import('./lib/theme.js').Theme} next */
  const setTheme = next => { theme = next; applyTheme(next) }

  /** @param {number} bytes */
  const size = bytes => bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`
</script>

<svelte:head>
  <title>Open data — IDS Workshop</title>
</svelte:head>

<div class="page">
  <header class="bar">
    <SiteSelect title="IDS Workshop" label={en['app.sitesLabel']} more={en['app.sitesMore']} locale="en" href="/" />
    <span class="slash" aria-hidden="true">/</span>
    <h1>Open data</h1>
    <span class="version">version {manifest.version}</span>
    <div class="end">
      <a class="back" href="/data/open-data/README.md">README</a>
      <a class="back" href="/sources.html">Sources</a>
      <ThemeSwitch {theme} label="Theme" labels={{ system: 'System', light: 'Light', dark: 'Dark' }} onchange={setTheme} />
      <a class="back" href="/">Workshop</a>
    </div>
  </header>

  <main>
    <p class="lead">The IDS descriptions this project transcribed or read, and the kana and Hangul
      shapes the search reads as component spellings, each with the source behind it. The release is
      dedicated to the public domain under CC0 1.0.</p>

    <ul class="stats">
      <li><b>{manifest.counts.descriptions}</b><span>descriptions</span></li>
      <li><b>{manifest.counts.unencoded}</b><span>without a code point</span></li>
      <li><b>{manifest.counts.editorial}</b><span>editorial readings</span></li>
      <li><b>{manifest.counts.sources}</b><span>sources</span></li>
    </ul>

    <h2>Files</h2>
    <ul class="files">
      {#each manifest.files as file (file.name)}
        <li>
          <a href={`/data/open-data/${file.name}`}>{file.name}</a>
          <span class="meta">{size(file.bytes)}</span>
        </li>
      {/each}
    </ul>
    <p class="note">The JSON carries the sources and their notes; the TSV repeats the records as one
      row per description. <code>components.tsv</code> lists BabelStone's numbered components and the
      fragment that writes each out. <code>equivalences.tsv</code> lists the kana and Hangul shapes
      the search reads as component spellings, and <code>equivalences.json</code> is the same table
      with arrays.</p>
    <p class="note">For scripts and agents: <a href="/data/open-data/manifest.json">manifest.json</a>
      is the index; read the files rather than scraping this page. <a href="/llms.txt">llms.txt</a>.</p>

    <h2>Groups</h2>
    <div class="scroll">
      <table>
        <caption class="ui-visually-hidden">Descriptions by group</caption>
        <thead>
          <tr><th scope="col">Group</th><th scope="col">Key</th><th scope="col" class="num">Descriptions</th><th scope="col" class="num">No code point</th></tr>
        </thead>
        <tbody>
          {#each manifest.groups as group (group.key)}
            <tr>
              <td>{group.title}</td>
              <td><code>{group.key}</code></td>
              <td class="num">{group.count}</td>
              <td class="num">{group.unencoded}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <h2>Licence</h2>
    <p><a href={manifest.licence.url}>CC0 1.0 Universal</a>. This project's selection, arrangement,
      source notes and editorial readings are in the public domain. Some records transcribe material
      under other terms; the source records name those terms where the project records them. Small Seal
      descriptions stay in the GPL corpus and are not part of this release.</p>

    <h2>Cite</h2>
    <p class="cite">IDS Input. Open IDS descriptions, version {manifest.version}.
      <a href="https://ids.mkpo.li/open-data">https://ids.mkpo.li/open-data</a></p>

    <h2>Rebuild</h2>
    <p>The files are built from this repository with <code>bun scripts/build_open_ids.mjs</code>;
      <code>--check</code> fails when a committed file differs.</p>
  </main>
</div>

<style>
  .page{display:flex;flex-direction:column;min-height:100dvh}
  .bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px max(18px,env(safe-area-inset-right)) 10px max(18px,env(safe-area-inset-left));
    border-bottom:1px solid var(--ui-color-border);background:color-mix(in srgb,var(--ui-color-canvas) 88%,transparent);backdrop-filter:blur(10px);position:sticky;top:0;z-index:10}
  .slash{color:var(--ui-color-border-strong)}
  h1{margin:0;font-size:15px;font-weight:600;color:var(--ui-color-ink-muted);white-space:nowrap}
  .version{font-size:11.5px;color:var(--ui-color-ink-muted);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-pill);padding:2px 8px;font-variant-numeric:tabular-nums}
  .end{display:flex;align-items:center;gap:10px;margin-left:auto;flex-wrap:wrap}
  .back{font-size:13px;color:var(--ui-color-accent);text-decoration:none;padding:5px 9px;border-radius:var(--ui-radius-md)}
  .back:hover{background:var(--ui-color-surface-hover)}

  main{width:100%;max-width:1080px;margin:0 auto;padding:26px max(18px,env(safe-area-inset-right)) 64px max(18px,env(safe-area-inset-left))}
  .lead{margin:0;max-width:74ch;font-size:17px;line-height:1.55}
  .note{margin:10px 0 0;max-width:80ch;font-size:12.5px;line-height:1.6;color:var(--ui-color-ink-muted)}
  .note code,.cite code{font-size:.95em}

  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:20px 0 0;padding:0;list-style:none}
  .stats li{display:grid;gap:2px;padding:12px 14px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface);box-shadow:var(--ui-shadow-1)}
  .stats b{font-size:26px;font-weight:650;line-height:1.1;font-variant-numeric:tabular-nums}
  .stats span{font-size:12.5px;color:var(--ui-color-ink-muted)}

  h2{margin:34px 0 10px;padding-top:10px;border-top:1px solid var(--ui-color-border);font-size:18px}

  .files{display:grid;gap:8px;margin:0;padding:0;list-style:none}
  .files li{display:flex;align-items:baseline;gap:10px;padding:9px 12px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface)}
  .files a{color:var(--ui-color-accent);text-decoration:none;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}
  .files a:hover{text-decoration:underline}
  .files .meta{margin-left:auto;font-size:12px;color:var(--ui-color-ink-muted);font-variant-numeric:tabular-nums}

  .scroll{overflow-x:auto;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface)}
  table{border-collapse:separate;border-spacing:0;width:100%;font-size:13px;line-height:1.45}
  th,td{padding:7px 11px;text-align:left;border-bottom:1px solid var(--ui-color-border)}
  thead th{background:var(--ui-color-surface);font-size:12px;color:var(--ui-color-ink-muted);border-bottom:2px solid var(--ui-color-border-strong)}
  tbody tr:last-child td{border-bottom:none}
  tbody tr:hover td{background:var(--ui-color-surface-hover)}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  code{font-size:.92em;color:var(--ui-color-ink-muted)}

  p{margin:0;max-width:78ch;line-height:1.55;font-size:14px}
  p a{color:var(--ui-color-accent)}
  .cite{font-family:var(--cjk-sans);font-size:13px;color:var(--ui-color-ink-muted)}
  .cite a{color:var(--ui-color-accent);text-decoration:none;overflow-wrap:anywhere}

  @media (max-width:640px){
    h1,.slash,.version{display:none}
    .lead{font-size:15.5px}
    .stats{grid-template-columns:1fr 1fr}
    .stats b{font-size:22px}
  }
</style>
