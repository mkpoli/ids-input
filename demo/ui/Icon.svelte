<script>
  // The workshop's icons, drawn on a 24-unit grid in strokes of the current colour.
  /** @type {{ name: string, size?: number }} */
  let { name, size = 18 } = $props()
  /** @type {Record<string, string>} */
  const PATHS = {
    undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
    redo: 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
    history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
    share: 'M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
    settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 7.5v.5',
    sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
    system: 'M3 5h18v11H3zM8 20h8M12 16v4',
    cut: 'M9 9l11 11M9 15 20 4M5 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    paste: 'M9 5H5v16h14V5h-4M9 3h6v4H9zM9 12h6M9 16h6',
    copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
    check: 'm5 12 5 5 9-10',
    download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
    folder: 'M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z',
    plus: 'M12 5v14M5 12h14',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    upload: 'M12 15V3M7 8l5-5 5 5M5 21h14',
    book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Zm0 16a2 2 0 0 1 2-2h13',
    globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z',
    qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2v2h-2zM18 14h2v2h-2z',
    chevron: 'm6 9 6 6 6-6',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    close: 'M6 6l12 12M18 6 6 18',
    'arrow-right': 'M4 12h15M13 6l6 6-6 6',
    mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
    heart: 'M12 20s-7-4.3-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.7 12 20 12 20Z',
    coffee: 'M4 9h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4ZM16 11h2a2.5 2.5 0 0 1 0 5h-2M7 3v3M11 2v3M15 3v3',
    menu: 'M4 7h16M4 12h16M4 17h16',
    list: 'M4 6h1M4 12h1M4 18h1M9 6h11M9 12h11M9 18h11',
    grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    save: 'M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2ZM8 3v5h7V3M8 21v-7h8v7',
    scales: 'M12 3v18M7 21h10M4 7h16M5 7l-3 7h6L5 7Zm14 0-3 7h6l-3-7ZM2 14a3 3 0 0 0 6 0M16 14a3 3 0 0 0 6 0',
    github: 'M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
  }
</script>

<svg class="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><path d={PATHS[name] ?? ''} /></svg>

<style>
  .icon{display:block;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
</style>
