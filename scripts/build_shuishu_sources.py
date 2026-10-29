# /// script
# requires-python = ">=3.11"
# dependencies = ["pikepdf==9.4.2", "openpyxl==3.1.5"]
# ///
"""Pin the Shuishu sources: the chart glyphs, their code point map and the character index.

uv run scripts/build_shuishu_sources.py CHART_PDF
`data/shuishu/` is written here and rewritten by `scripts/build_shuishu.py` afterwards. The chart
is the code chart document of ISO/IEC 10646 Amendment 2.2 (PDAM 2.2, N4922), whose embedded
`Uni1B300Shuishu` font draws the proposed characters at their tentative code points. Only that
font, the PDF's ToUnicode map and the radical names are kept, not the 6 MB document; the radical
names come out of `pdftotext -layout`, which poppler-utils provides, so that binary has to be on
PATH. Download the chart from CHART_URL below and check its SHA-256 first.
"""
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import pikepdf
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/shuishu'
CHART_URL = 'https://www.unicode.org/wg2/docs/n4922-5theditionPdam2-2-charts.pdf'
CHART_SHA256 = 'b200ce0f5ec06bb97a6c16f08507ba531de88b2f88395462a4915be5824ddd6e'
SHEET_URL = 'https://www.babelstone.co.uk/Shuishu/Shuishu.xlsx'
DOCUMENTS = [
    {
        'file': 'Uni1B300Shuishu-subset.ttf',
        'kind': 'font subset',
        'title': 'Uni1B300Shuishu, the font embedded in the ISO/IEC 10646 Amendment 2.2 code charts',
        'chartUrl': CHART_URL,
        'chartSha256': CHART_SHA256,
        'note': 'The chart font draws the proposed characters at their tentative code points. The '
                'subset keeps its glyph order; cid-map.json gives each glyph its code point from the '
                "PDF's ToUnicode map.",
    },
    {
        'file': 'cid-map.json',
        'kind': 'code point map',
        'note': 'Glyph index to tentative code point, read from the ToUnicode CMap of the chart PDF.',
    },
    {
        'file': 'radical-names.json',
        'kind': 'radical names',
        'note': 'The proposed radicals U+1B500..U+1B52E and the names the chart prints for them.',
    },
    {
        'file': 'Shuishu.xlsx',
        'kind': 'character index',
        'title': 'Shuishu.xlsx: names, readings and meanings for the BabelStone Shuishu fonts and '
                 'Mojikyo M113, indexed by N4922 code point',
        'url': SHEET_URL,
        'page': 'https://www.babelstone.co.uk/Fonts/Shuishu.html',
        'note': 'Andrew West (BabelStone). 772 rows: the 486 proposed logograms and 286 further '
                'private-use-only forms. The site states no licence for the file; the names, readings '
                'and meanings it records are facts.',
    },
]
PROPOSAL = {
    'title': 'Proposal for encoding Shuishu (WG2 N4758, L2/18-193, N4922)',
    'url': 'https://www.unicode.org/wg2/docs/n4758-Proposal%20for%20encoding%20Shuishu2016Sep3.pdf',
}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def charts(path):
    """The chart font program, its ToUnicode map and the radical names."""
    data = Path(path).read_bytes()
    if hashlib.sha256(data).hexdigest() != CHART_SHA256:
        raise ValueError('Unexpected chart document')
    with pikepdf.open(path) as pdf:
        fonts = [obj for obj in pdf.objects if isinstance(obj, pikepdf.Dictionary)
                 and 'Shuishu' in str(obj.get('/BaseFont', '')) and '/ToUnicode' in obj]
        if len(fonts) != 1:
            raise ValueError(f'{len(fonts)} Shuishu fonts in the chart')
        font = fonts[0]
        program = bytes(font['/DescendantFonts'][0]['/FontDescriptor']['/FontFile2'].read_bytes())
        cmap = bytes(font['/ToUnicode'].read_bytes()).decode('latin-1')
    with tempfile.NamedTemporaryFile(suffix='.txt') as out:
        subprocess.run(['pdftotext', '-layout', str(path), out.name], check=True)
        chart = Path(out.name).read_text(encoding='utf-8', errors='replace')
    radicals = {point: name for point, name in re.findall(r'\b(1B5[0-9A-F]{2})\b\s+\S+\s+(SHUISHU RADICAL-[0-9A-Z-]+)', chart)}
    if len(radicals) != 47:
        raise ValueError(f'{len(radicals)} radical names in the chart')
    return program, cmap, radicals


def points(cmap):
    """Glyph index to code point, from the PDF's ToUnicode map."""
    mapping = {}
    for block in re.findall(r'beginbfrange(.*?)endbfrange', cmap, re.S):
        for low, high, rest in re.findall(r'<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*(\[[^\]]*\]|<[0-9A-Fa-f]+>)', block):
            low, high = int(low, 16), int(high, 16)
            values = re.findall(r'<([0-9A-Fa-f]+)>', rest)
            for index, value in enumerate(values):
                mapping[low + index] = scalar(int(value, 16)) if rest.startswith('[') else scalar(int(value, 16)) + index
    for block in re.findall(r'beginbfchar(.*?)endbfchar', cmap, re.S):
        for source, target in re.findall(r'<([0-9a-f]+)>\s*<([0-9A-Fa-f]+)>', block):
            mapping[int(source, 16)] = scalar(int(target, 16))
    return mapping


def scalar(value):
    high, low = value >> 16, value & 0xFFFF
    return 0x10000 + ((high - 0xD800) << 10) + (low - 0xDC00) if 0xD800 <= high <= 0xDBFF else value


def main():
    if len(sys.argv) != 2:
        raise SystemExit('usage: build_shuishu_sources.py CHART_PDF')
    chart = Path(sys.argv[1])
    if digest(chart) != CHART_SHA256:
        raise SystemExit(f'{chart} is not chart {CHART_SHA256}')
    program, cmap, radicals = charts(chart)
    mapping = points(cmap)
    expected = [*range(0x1B300, 0x1B4E6), *range(0x1B500, 0x1B52F)]
    if sorted(mapping.values()) != expected:
        raise ValueError('The chart does not cover the proposed block exactly')

    sheet = Path(tempfile.mkdtemp()) / 'Shuishu.xlsx'
    sheet.write_bytes(urlopen(SHEET_URL).read())

    SOURCE.mkdir(parents=True, exist_ok=True)
    (SOURCE / 'Uni1B300Shuishu-subset.ttf').write_bytes(program)
    (SOURCE / 'cid-map.json').write_text(json.dumps({str(cid): point for cid, point in sorted(mapping.items())}) + '\n')
    (SOURCE / 'radical-names.json').write_text(json.dumps(radicals, indent=1) + '\n')
    (SOURCE / 'Shuishu.xlsx').write_bytes(sheet.read_bytes())

    (SOURCE / 'sources.json').write_text(json.dumps({
        'documents': [dict(row, sha256=digest(SOURCE / row['file'])) for row in DOCUMENTS],
        'proposal': PROPOSAL,
        'roadmap': 'http://www.unicode.org/roadmaps/smp/',
    }, indent=2, ensure_ascii=False) + '\n')
    print(f'{len(mapping)} code points, {len(radicals)} radical names')


if __name__ == '__main__':
    main()
