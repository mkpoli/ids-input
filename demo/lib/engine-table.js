// What each glyph engine reads, writes, composes, costs and licenses. One row per feature, one
// column per engine. Cells say "—" where no public source documents a value; "not documented"
// where the source is silent but a value might exist.
export const ENGINES = [
  { key: 'ours', name: 'IDS Workshop', sub: 'ids-input + han-compose', url: 'https://ids.mkpo.li/' },
  { key: 'kage', name: 'KAGE', sub: 'kage-engine', url: 'https://github.com/kurgm/kage-engine' },
  { key: 'glyphwiki', name: 'GlyphWiki', sub: 'glyphwiki.org', url: 'https://glyphwiki.org/' },
  { key: 'zi', name: 'zi.tools', sub: '字統网', url: 'https://zi.tools/' },
  { key: 'yedict', name: 'yedict', sub: '字海', url: 'http://www.yedict.com/' },
  { key: 'mojidata', name: 'Mojidata', sub: 'IDS Finder', url: 'https://mojidata.ryusei.dev/idsfind' },
  { key: 'metahan', name: 'MetaHan', sub: 'IRG N2968, WIP', url: 'https://web.archive.org/web/20260921043822/https://www.unicode.org/irg/docs/n2968-MetaHanWIP.pdf' },
  { key: 'chise', name: 'CHISE', sub: 'IDS search', url: 'https://www.chise.org/ids-find' },
]

export const SECTIONS = [
  {
    title: 'Role',
    rows: [
      { label: 'Kind', cells: {
        ours: 'IDS→glyph composer and editor', kage: 'glyph renderer', glyphwiki: 'collaborative glyph database',
        zi: 'IDS→glyph service and dictionary', yedict: 'dictionary with IDS search', mojidata: 'IDS search database',
        metahan: 'glyph authoring platform (WIP)', chise: 'IDS search service' } },
      { label: 'Generates glyphs', cells: {
        ours: 'yes, in the browser', kage: 'yes, from KAGE data', glyphwiki: 'yes, through KAGE, authored',
        zi: 'yes, on its server', yedict: 'no', mojidata: 'no', metahan: 'from skeletons (WIP)', chise: 'no' } },
      { label: 'Automatic from an IDS', cells: {
        ours: 'yes', kage: 'no', glyphwiki: 'no', zi: 'yes', yedict: 'no', mojidata: 'no', metahan: 'no', chise: 'no' } },
      { label: 'Where shapes come from', cells: {
        ours: 'font outlines (Noto, Plangothic, GenZui)', kage: 'strokes in KAGE data', glyphwiki: 'strokes authored by contributors',
        zi: 'GlyphWiki parts through KAGE', yedict: 'font or image glyphs in records', mojidata: 'character data, no glyphs',
        metahan: 'stroke library plus skeletons', chise: 'character data, no glyphs' } },
      { label: 'Editor', cells: {
        ours: 'yes, ids-input', kage: 'engine only; kage-editor separate', glyphwiki: 'yes, web editor',
        zi: 'yes, composer UI', yedict: 'structure builder for search only', mojidata: 'query UI',
        metahan: 'not yet', chise: 'no' } },
    ],
  },
  {
    title: 'Input and output',
    rows: [
      { label: 'Input', cells: {
        ours: 'IDS', kage: 'KAGE description', glyphwiki: 'glyph name or KAGE data', zi: 'IDS', yedict: 'IDS query',
        mojidata: 'IDS query', metahan: 'skeleton data, authored', chise: 'component or IDS query' } },
      { label: 'Extended IDS notation', cells: {
        ours: 'zi.tools entry notes, modifiers and chains', kage: 'none', glyphwiki: 'naming convention only',
        zi: 'native source of the notation', yedict: 'aliases, [ ], #() (site help)', mojidata: 'variables, ？, counts',
        metahan: 'none', chise: 'component search only' } },
      { label: 'Output', cells: {
        ours: 'SVG path, PNG', kage: 'SVG, EPS, polygons', glyphwiki: 'SVG, KAGE data', zi: 'SVG path and KAGE data',
        yedict: 'records', mojidata: 'records', metahan: 'font (planned)', chise: 'records' } },
      { label: 'API', cells: {
        ours: 'JS library and Svelte components', kage: 'JS library', glyphwiki: 'wiki pages and API', zi: 'HTTP JSON',
        yedict: 'HTTP JSON', mojidata: 'web app and data package', metahan: 'none yet', chise: 'web pages' } },
    ],
  },
  {
    title: 'Composition and control',
    rows: [
      { label: 'Layout', cells: {
        ours: 'learned from font teachers', kage: 'fixed in the description', glyphwiki: 'authored per glyph',
        zi: 'automatic on the server', yedict: '—', mojidata: '—', metahan: 'authored skeleton positions', chise: '—' } },
      { label: 'Part and character search', cells: {
        ours: 'IDS, names, readings, components', kage: 'glyph name lookup', glyphwiki: 'wiki search', zi: 'IDS and readings',
        yedict: 'IDS, radical, pinyin', mojidata: 'IDS patterns', metahan: '—', chise: 'component search' } },
      { label: 'Enclosures', cells: {
        ours: 'automatic fit (weakest measured area)', kage: 'authored', glyphwiki: 'authored', zi: 'automatic',
        yedict: '—', mojidata: '—', metahan: 'authored', chise: '—' } },
      { label: 'Weight control', cells: {
        ours: 'density model', kage: 'font parameters, then patches', glyphwiki: 'automatic, then patches', zi: 'KAGE parameters',
        yedict: '—', mojidata: '—', metahan: 'per-stroke data and gvar', chise: '—' } },
      { label: 'Stroke order', cells: {
        ours: 'no', kage: 'no', glyphwiki: 'no', zi: 'no', yedict: '—', mojidata: '—', metahan: 'yes, data order', chise: '—' } },
      { label: 'True curves', cells: {
        ours: 'yes, font outlines', kage: 'no, polygons', glyphwiki: 'no, pseudo-curves', zi: 'no, KAGE polygons',
        yedict: '—', mojidata: '—', metahan: 'yes, Bézier (claimed)', chise: '—' } },
      { label: 'Variable weights', cells: {
        ours: 'no', kage: 'no', glyphwiki: 'no', zi: 'no', yedict: '—', mojidata: '—', metahan: 'planned gvar', chise: '—' } },
      { label: 'Fine adjustment', cells: {
        ours: 'layers and part transforms in the editor', kage: 'kage-editor', glyphwiki: 'glyph editing', zi: 'composer editor',
        yedict: '—', mojidata: '—', metahan: 'skeleton text only, no visual editor', chise: '—' } },
    ],
  },
  {
    title: 'Coverage',
    rows: [
      { label: 'Han characters', cells: {
        ours: 'yes', kage: 'yes', glyphwiki: 'yes', zi: 'yes', yedict: 'yes', mojidata: 'yes', metahan: 'planned', chise: 'yes' } },
      { label: 'Other scripts', cells: {
        ours: 'Tangut, Bopomofo, Small Seal', kage: 'any stroke-composable glyph', glyphwiki: 'some non-Han glyphs',
        zi: 'some hybrid and kana parts', yedict: 'Han', mojidata: 'Han', metahan: 'siniform scripts; Hangul font shipped', chise: 'multi-script data' } },
      { label: 'Regional variants', cells: {
        ours: 'faces, not regional variants', kage: 'authored variants', glyphwiki: 'authored variants', zi: 'data-dependent',
        yedict: 'dictionary variants', mojidata: '—', metahan: 'regional stroke order planned', chise: 'dictionary variants' } },
      { label: 'Documented size', cells: {
        ours: '1,981/1,981 jōyō drawn; 149/150 KRM sample', kage: '—', glyphwiki: '—',
        zi: '117,044 IDS sequences (audited 2026-10-28)', yedict: '145,503 records, 113,359 with IDS',
        mojidata: '—', metahan: 'URO planned; no CJK font yet', chise: '—' } },
    ],
  },
  {
    title: 'Deployment and measured cost',
    rows: [
      { label: 'Client-side or offline', cells: {
        ours: 'yes, after the export is cached', kage: 'yes, with data', glyphwiki: 'editing needs the site; dumps exist',
        zi: 'no', yedict: 'no', mojidata: 'web app', metahan: 'local tool planned', chise: 'no' } },
      { label: 'Server needed', cells: {
        ours: 'no', kage: 'no', glyphwiki: 'yes, for editing', zi: 'yes', yedict: 'yes', mojidata: 'web service',
        metahan: 'no (planned)', chise: 'yes' } },
      { label: 'Latency †', cells: {
        ours: '5.5 ms compose; 402 ms first draw', kage: '0.10 ms render', glyphwiki: '—', zi: '442 ms API',
        yedict: '2.7 s lookup', mojidata: '—', metahan: '—', chise: '—' } },
      { label: 'Data per glyph †', cells: {
        ours: '203 KB median, cold', kage: '0.4 KB description', glyphwiki: '—', zi: '3.3 KB answer',
        yedict: '0.3 KB answer', mojidata: '—', metahan: '—', chise: '—' } },
    ],
  },
  {
    title: 'Licences',
    rows: [
      { label: 'Engine licence', cells: {
        ours: 'MIT', kage: 'GPL-3.0', glyphwiki: 'KAGE: GPL-3.0; wiki: service', zi: 'service',
        yedict: 'service', mojidata: 'MIT (app and API)', metahan: 'WIP', chise: 'service; data GPL' } },
      { label: 'Data licence', cells: {
        ours: 'mixed: OFL, public domain, GPL, CC BY-SA', kage: 'GlyphWiki terms', glyphwiki: 'free use',
        zi: 'GlyphWiki data', yedict: 'site content', mojidata: 'mixed package terms', metahan: '—', chise: 'GPL' } },
      { label: 'Output use', cells: {
        ours: "the user's, subject to font terms", kage: 'per GlyphWiki and KAGE', glyphwiki: 'free use', zi: 'generated glyphs free to use (site notice)',
        yedict: '—', mojidata: '—', metahan: '—', chise: '—' } },
      { label: 'Source published', cells: {
        ours: 'GitHub', kage: 'GitHub', glyphwiki: 'KAGE public; wiki service', zi: 'no', yedict: 'no',
        mojidata: 'GitHub', metahan: 'no', chise: 'data on GitLab' } },
    ],
  },
  {
    title: 'Limits',
    rows: [
      { label: 'Missing part', cells: {
        ours: 'error, the sequence is not drawn', kage: 'error', glyphwiki: 'glyph gap', zi: 'error or partial',
        yedict: 'no match', mojidata: 'no match', metahan: 'the author must draw it', chise: 'no match' } },
      { label: 'Quality benchmark', cells: {
        ours: 'measured against KAGE', kage: 'reference renderer', glyphwiki: 'authored reference', zi: 'composition reference',
        yedict: '—', mojidata: '—', metahan: '—', chise: '—' } },
    ],
  },
]

export const SOURCES = [
  { label: 'KAGE engine, kurgm fork', url: 'https://github.com/kurgm/kage-engine', note: 'README, API and licence, read 2026-10-29' },
  { label: 'KAGE engine, Koichi Kamichi', url: 'https://github.com/kamichikoichi/kage-engine', note: 'original engine' },
  { label: 'GlyphWiki licence', url: 'https://glyphwiki.org/wiki/GlyphWiki:License', note: 'free use of glyph data and articles, read 2010 text via archive' },
  { label: 'zi.tools', url: 'https://zi.tools/?secondary=ids', note: 'IDS composer; its result-panel notice covers generated glyphs' },
  { label: 'yedict about', url: 'http://www.yedict.com/about', note: 'site history and character set, read 2026-10-29' },
  { label: 'yedict IDS API', url: 'http://www.yedict.com/api/search/ids?expr=%E2%BF%B0%E6%9C%A8%E6%9C%A8', note: 'record counts in the response' },
  { label: 'Mojidata', url: 'https://mojidata.ryusei.dev/about', note: 'IDS Finder and data package' },
  { label: 'CHISE IDS search', url: 'https://www.chise.org/ids-find', note: 'component search' },
  { label: 'MetaHan, IRG N2968', url: 'https://web.archive.org/web/20260921043822/https://www.unicode.org/irg/docs/n2968-MetaHanWIP.pdf', note: 'individual contribution, 2026-08-18; the live URL is 404' },
  { label: 'han-compose design notes', url: 'https://github.com/mkpoli/han-compose/blob/main/docs/design/ids-composer.md', note: 'layout, weight, and the jōyō bench' },
  { label: 'Composer measurements', url: '/compare.html', note: 'the 149-sequence comparison and its method' },
]
