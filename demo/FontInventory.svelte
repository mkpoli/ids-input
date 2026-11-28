<script>
  // Appendix comparing the six composer faces by export inventory (characters, records, host keys,
  // host cuts, variants, kins, rooms, least gap, gzip size) and per-face cut-table coverage.
  import PageHeader from './ui/PageHeader.svelte'
  import { appMessages } from './lib/locales.js'
  import data from './lib/font-inventory.json'

  const en = appMessages('en')
  /** @param {string} key */
  const t = key => en[key] ?? key

  const faces = data.faces
  const tables = data.cutTables
  const fmt = new Intl.NumberFormat('en-US')

  /** @type {Array<{ id: string, title: string, value: (f: typeof faces[number]) => number, format: (v: number) => string }>} */
  const CHARTS = [
    { id: 'chars', title: 'Exported characters', value: f => f.chars, format: v => fmt.format(v) },
    { id: 'cuts', title: 'Host cuts', value: f => f.hostCuts, format: v => fmt.format(v) },
    { id: 'yield', title: 'Cuts per character', value: f => f.cutsPerChar, format: v => v.toFixed(2) },
    { id: 'size', title: 'Export size (gzip)', value: f => f.gzipMB, format: v => `${v.toFixed(1)} MB` },
  ]

  /** @param {(f: typeof faces[number]) => number} pick */
  const peakOf = pick => Math.max(1, ...faces.map(pick))

  /** @param {number[] | null} least */
  const formatLeast = least => least ? `[${least[0]}, ${least[1]}]` : '—'
</script>

<svelte:head>
  <title>Font inventory — IDS Workshop</title>
</svelte:head>

<div class="page">
  <PageHeader page="font-inventory" title="Font inventory" {t} />

  <main>
    <p class="lead">Component counts, host cuts, export sizes and per-face cut tables across the six composer faces.</p>
    <p class="meta">Measured {data.generatedAt} from live exports in <a href="./font-compare.html">Font comparison</a> and <code>@han-compose/composer</code>.</p>

    <section aria-labelledby="bars-heading">
      <h2 id="bars-heading">Scale and cut yield</h2>
      <div class="charts">
        {#each CHARTS as chart (chart.id)}
          {@const peak = peakOf(chart.value)}
          <article class="card">
            <h3>{chart.title}</h3>
            <dl class="bars">
              {#each faces as face (face.key)}
                {@const v = chart.value(face)}
                <div class="bar-row">
                  <dt>{face.name}</dt>
                  <dd class="track" aria-hidden="true">
                    <span class="fill" style:inline-size={`${Math.max(1.5, (v / peak) * 100)}%`}></span>
                  </dd>
                  <dd class="num">{chart.format(v)}</dd>
                </div>
              {/each}
            </dl>
          </article>
        {/each}
      </div>
    </section>

    <section aria-labelledby="exports-heading">
      <h2 id="exports-heading">Live web exports</h2>
      <div tabindex="0" role="region" aria-labelledby="exports-heading" class="table-wrapper">
        <table class="exports-table">
          <caption class="ui-visually-hidden">Live web export metrics for each composer face</caption>
          <thead>
            <tr>
              <th scope="col">Face</th>
              <th scope="col">Source font</th>
              <th scope="col" class="num">Chars</th>
              <th scope="col" class="num">Records</th>
              <th scope="col" class="num">Host keys</th>
              <th scope="col" class="num">Host cuts</th>
              <th scope="col" class="num">Cuts/char</th>
              <th scope="col" class="num">Variants</th>
              <th scope="col" class="num">Kins</th>
              <th scope="col" class="num">Rooms</th>
              <th scope="col" class="num">Least gap</th>
              <th scope="col" class="num">Gzip</th>
            </tr>
          </thead>
          <tbody>
            {#each faces as face (face.key)}
              <tr>
                <th scope="row">
                  <span class="face-name">{face.name}</span>
                  <span class="sub">{face.commit ?? '—'}</span>
                </th>
                <td>{face.font}</td>
                <td class="num">{fmt.format(face.chars)}</td>
                <td class="num">{fmt.format(face.records)}</td>
                <td class="num">{fmt.format(face.hostKeys)}</td>
                <td class="num">{fmt.format(face.hostCuts)}</td>
                <td class="num">{face.cutsPerChar.toFixed(2)}</td>
                <td class="num" class:na={face.variants === 0}>{face.variants ? fmt.format(face.variants) : '—'}</td>
                <td class="num">{fmt.format(face.kins)}</td>
                <td class="num" class:na={face.rooms === 0}>{face.rooms ? fmt.format(face.rooms) : '—'}</td>
                <td class="num" class:na={!face.facingLeast}>{formatLeast(face.facingLeast)}</td>
                <td class="num">{face.gzipMB.toFixed(1)} MB</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section aria-labelledby="cuts-heading">
      <h2 id="cuts-heading">Per-face cut and form tables ({tables.length})</h2>
      <div class="summary-strip" aria-label="Tables covered per face">
        {#each faces as face (face.key)}
          {@const count = data.cutTotals[face.key] ?? 0}
          <div class="chip" class:empty={count === 0}>
            <span class="chip-name">{face.name}</span>
            <span class="chip-val">{count} / {tables.length}</span>
          </div>
        {/each}
      </div>
      <div tabindex="0" role="region" aria-labelledby="cuts-heading" class="table-wrapper">
        <table class="cuts-table">
          <caption class="ui-visually-hidden">Per-face cut and form JSON tables bundled in han-compose</caption>
          <thead>
            <tr>
              <th scope="col">Table</th>
              {#each faces as face (face.key)}
                <th scope="col" class="num">{face.name}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each tables as table (table.file)}
              <tr>
                <th scope="row"><code>{table.name}</code></th>
                {#each faces as face (face.key)}
                  {@const n = table.counts[face.key] ?? 0}
                  <td class="num" class:hit={n > 0} class:na={n === 0}>
                    {n > 0 ? fmt.format(n) : '—'}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  </main>
</div>

<style>
  .page{display:flex;flex-direction:column;min-height:100dvh}
  main{width:100%;max-width:1320px;margin:0 auto;padding:24px max(18px,env(safe-area-inset-right)) 60px max(18px,env(safe-area-inset-left))}
  .lead{margin:0 0 6px;max-width:74ch;font-size:16.5px;line-height:1.5}
  .meta{margin:0 0 24px;font-size:12.5px;color:var(--ui-color-ink-muted)}
  .meta a{color:var(--ui-color-accent);text-decoration:none}
  .meta a:hover{text-decoration:underline}
  .meta code{font-family:var(--ui-font-mono);font-size:12px}

  section{margin-block-end:34px}
  h2{font-size:16px;font-weight:650;margin:0 0 12px;letter-spacing:-.01em}

  .charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
  .card{padding:14px 16px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface)}
  .card h3{margin:0 0 10px;font-size:12.5px;font-weight:600;color:var(--ui-color-ink-muted);text-transform:uppercase;letter-spacing:.04em}
  .bars{margin:0;display:grid;gap:7px}
  .bar-row{display:grid;grid-template-columns:76px 1fr 70px;align-items:center;gap:8px;font-size:12.5px}
  .bar-row dt{margin:0;color:var(--ui-color-ink);font-weight:500;white-space:nowrap}
  .bar-row dd{margin:0}
  .track{height:10px;border-radius:999px;background:var(--ui-color-surface-sunken);overflow:hidden}
  .fill{display:block;height:100%;border-radius:999px;background:var(--ui-color-accent)}
  .num{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}

  .summary-strip{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
  .chip{display:inline-flex;align-items:baseline;gap:6px;padding:5px 10px;border:1px solid var(--ui-color-border);border-radius:999px;background:var(--ui-color-surface);font-size:12px}
  .chip-name{font-weight:600;color:var(--ui-color-ink)}
  .chip-val{font-variant-numeric:tabular-nums;color:var(--ui-color-ink-muted)}
  .chip.empty{border-color:var(--ui-color-border-strong);background:var(--ui-color-surface-sunken)}
  .chip.empty .chip-val{color:var(--ui-color-ink);font-weight:600}

  .table-wrapper{overflow:auto;max-inline-size:100%;max-block-size:min(640px,80vh);container-type:inline-size;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface)}
  .table-wrapper:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:2px}
  table{border-collapse:separate;border-spacing:0;width:100%;font-size:12.5px;line-height:1.45}
  .exports-table{min-width:980px}
  .cuts-table{min-width:660px}
  th,td{padding:8px 10px;text-align:left;vertical-align:middle;border-bottom:1px solid var(--ui-color-border-faint);white-space:nowrap}
  thead{position:sticky;inset-block-start:0;z-index:2}
  thead th{background:var(--ui-color-surface);border-bottom:1px solid var(--ui-color-border);font-size:11.5px;font-weight:650;color:var(--ui-color-ink-muted);text-transform:uppercase;letter-spacing:.03em}
  tbody th[scope="row"]{position:sticky;inset-inline-start:0;z-index:1;background:var(--ui-color-surface);font-weight:600;color:var(--ui-color-ink);border-inline-end:1px solid var(--ui-color-border-faint)}
  tbody tr:nth-child(even) td,tbody tr:nth-child(even) th[scope="row"]{background:var(--ui-color-surface-sunken)}
  tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}
  .face-name{display:block}
  .sub{display:block;font-size:10.5px;font-family:var(--ui-font-mono);font-weight:400;color:var(--ui-color-ink-muted)}
  tbody th code{font-family:var(--ui-font-mono);font-size:12px;font-weight:500}
  td.na{color:var(--ui-color-ink-muted)}
  td.hit{color:var(--ui-color-ink);font-weight:500}

  @container (width < 600px) {
    .exports-table{min-width:0}
    .exports-table,.exports-table thead,.exports-table tbody,.exports-table tr,.exports-table th,.exports-table td{display:block}
    .exports-table thead{display:none}
    .exports-table tr{padding:8px 12px;border-bottom:1px solid var(--ui-color-border)}
    .exports-table tbody th[scope="row"]{position:sticky;inset-block-start:0;z-index:2;border-inline-end:0;padding:4px 0 6px;border-bottom:1px solid var(--ui-color-border-faint)}
    .exports-table td{display:flex;justify-content:space-between;gap:12px;padding:4px 0;border-bottom:0;text-align:right}
    .exports-table{
      --label-2:"Source font";--label-3:"Chars";--label-4:"Records";--label-5:"Host keys";
      --label-6:"Host cuts";--label-7:"Cuts/char";--label-8:"Variants";--label-9:"Kins";
      --label-10:"Rooms";--label-11:"Least gap";--label-12:"Gzip";
    }
    .exports-table td::before{color:var(--ui-color-ink-muted);font-weight:500}
    .exports-table td:nth-child(2)::before{content:var(--label-2)}
    .exports-table td:nth-child(3)::before{content:var(--label-3)}
    .exports-table td:nth-child(4)::before{content:var(--label-4)}
    .exports-table td:nth-child(5)::before{content:var(--label-5)}
    .exports-table td:nth-child(6)::before{content:var(--label-6)}
    .exports-table td:nth-child(7)::before{content:var(--label-7)}
    .exports-table td:nth-child(8)::before{content:var(--label-8)}
    .exports-table td:nth-child(9)::before{content:var(--label-9)}
    .exports-table td:nth-child(10)::before{content:var(--label-10)}
    .exports-table td:nth-child(11)::before{content:var(--label-11)}
    .exports-table td:nth-child(12)::before{content:var(--label-12)}
  }
</style>
