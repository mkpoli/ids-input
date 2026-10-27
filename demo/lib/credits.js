// What the workshop is built from (data and code, with their licences) and what shaped it (tools
// whose ideas it takes), each with a link. Seen on 2026-10-25 unless noted.

/** @typedef {{ name: string, url: string, by?: string, licence?: string, key: string }} Credit */

/** @type {Credit[]} Data, fonts and code the workshop runs on. */
export const SOURCES = [
  { name: 'Script-Hybrid CJK Ideographs', by: 'Gen Kojitani (小路谷源)', url: 'https://sites.google.com/dhii.asia/biangbiangcon/program', key: 'scriptHybrid' },
  { name: 'Brief introduction of IDS system in zi.tools', by: 'Bai Yi (白易)', url: 'https://sites.google.com/dhii.asia/biangbiangcon/program', key: 'ziToolsPresentation' },
  { name: 'An Invitation to Hacking Character Data / 文字情報ハックのすすめ', by: 'Ryusei Yamaguchi', url: 'https://biangbiangcon.ryusei.dev/', key: 'characterDataPresentation' },
  { name: 'CHISE Small Seal IDS', by: 'MORIOKA Tomohiko, CHISE contributors', licence: 'GPL-2.0-or-later', url: 'https://gitlab.chise.org/CHISE/ids', key: 'smallSeal' },
  { name: 'IDS Seal / Kaiyuan Small Seal', by: 'Kaiyuan Small Seal Font Contributors', licence: 'Kaiyuan font license', url: 'https://github.com/frankslin/kaiyuan-small-seal-font/blob/97433695858330ec9fdb7de9c4604da2f635eba6/OFL.txt', key: 'sealFont' },
  { name: 'BabelStone IDS', by: 'Andrew West', licence: 'Public domain', url: 'https://www.babelstone.co.uk/CJK/IDS.TXT', key: 'babelstone' },
  { name: 'han-compose', by: 'mkpoli', licence: 'MIT', url: 'https://github.com/mkpoli/han-compose', key: 'hanCompose' },
  { name: 'Noto Sans CJK JP', by: 'Adobe, Google', licence: 'SIL OFL 1.1', url: 'https://github.com/notofonts/noto-cjk', key: 'noto' },
  { name: 'Noto Serif Tangut', by: 'Google', licence: 'SIL OFL 1.1', url: 'https://github.com/notofonts/noto-fonts/tree/main/unhinted/ttf/NotoSerifTangut', key: 'tangut' },
  { name: 'Plangothic', by: 'Fitzgerald P. Köeingsegg', licence: 'SIL OFL 1.1', url: 'https://github.com/Fitzgerald-Porthmouth-Koenigsegg/Plangothic-Project', key: 'plangothic' },
  { name: 'Rime 五筆畫', by: '四季的風, 雪齋, Kunki Chou, 宋天', licence: 'LGPL-3.0', url: 'https://github.com/rime/rime-stroke', key: 'rime' },
  { name: 'KanjiVG', by: 'Ulrich Apel', licence: 'CC BY-SA 3.0', url: 'https://kanjivg.tagaini.net/', key: 'kanjivg' },
  { name: 'hfhchan/ids', by: 'Henry Chan', licence: 'MIT', url: 'https://github.com/hfhchan/ids', key: 'hfhchan' },
  { name: 'Unihan', by: 'Unicode, Inc.', licence: 'Unicode License v3', url: 'https://www.unicode.org/reports/tr38/', key: 'unihan' },
  { name: 'qrcode-generator', by: 'Kazuhiko Arase', licence: 'MIT', url: 'https://github.com/kazuhikoarase/qrcode-generator', key: 'qrcode' },
]

/** @type {Credit[]} Tools whose ideas the workshop takes. */
export const INSPIRED = [
  { name: '字統网 zi.tools', url: 'https://zi.tools/?secondary=ids', key: 'zitools' },
  { name: '字海网 yedict', url: 'http://www.yedict.com/search/ids', key: 'yedict' },
  { name: 'Mojidata IDS Finder', by: 'Ryusei Yamaguchi (mandel59)', url: 'https://mojidata.ryusei.dev/idsfind', key: 'mojidata' },
  { name: 'CHISE IDS 漢字検索', by: 'MORIOKA Tomohiko', url: 'https://www.chise.org/ids-find', key: 'chise' },
]
