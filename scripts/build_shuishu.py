# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0", "openpyxl==3.1.5"]
# ///
"""Build the Shuishu (水書) palette data, outlines and font.

uv run scripts/build_shuishu.py
The characters sit at the tentative allocations of the proposed Shuishu block: logograms
U+1B300..U+1B4E5 and radicals U+1B500..U+1B52E. Unicode 18.0.0 leaves them unassigned, so the
offices rendered here are proposals, as the New Korean letters' are; the font is a rendering aid,
not an encoding claim.

Sources, pinned in `data/shuishu/sources.json` with SHA-256 digests:

- the glyphs of `Uni1B300Shuishu`, the font embedded in the ISO/IEC 10646 Amendment 2.2 code charts,
  read through the PDF's own ToUnicode map;
- `Shuishu.xlsx` (Andrew West) for the proposed names, the N4758 readings and the meanings.

`data/shuishu/` is rewritten by `scripts/build_shuishu_sources.py`, which pulls both from the
chart PDF and the BabelStone site.
"""
import base64
import gzip
import hashlib
import json
import re
import struct
from pathlib import Path

import openpyxl
from fontTools.pens.basePen import BasePen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.perimeterPen import PerimeterPen
from fontTools.ttLib import TTFont, newTable
from fontTools.ttLib.tables._c_m_a_p import CmapSubtable

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/shuishu'
FONT = ROOT / 'fonts/IDSShuishu.woff2'
OUTLINES = ROOT / 'data/shuishu-outlines.json.gz'
INDEX = ROOT / 'data/shuishu.json.gz'
LICENCE = ROOT / 'fonts/LICENSE-IDSShuishu.txt'

LOGOGRAMS = range(0x1B300, 0x1B4E6)
RADICALS = range(0x1B500, 0x1B52F)
# The operators `data/shuishu/ids.json` may use: side by side, stacked, and the three enclosures
# that put a part inside another. Every entry has exactly two parts.
IDS_OPS = '⿰⿱⿴⿵⿶'


def packed(values):
    return base64.b64encode(struct.pack('<' + 'h' * len(values), *values)).decode()


class Contours(BasePen):
    def __init__(self, glyphs, scale):
        super().__init__(glyphs)
        self.scale, self.contours = scale, []

    def point(self, p):
        self.points.extend(round(v * self.scale * 4) for v in p)

    def _moveTo(self, p):
        self.ops, self.points = 'M', []
        self.point(p)

    def _lineTo(self, p):
        self.ops += 'L'
        self.point(p)

    def _qCurveToOne(self, control, end):
        self.ops += 'Q2'
        self.point(control)
        self.point(end)

    def _closePath(self):
        self.contours.append([self.ops, packed(self.points), packed([0] * len(self.points))])


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def checked(name):
    """A pinned source file, after its digest is confirmed."""
    path = SOURCE / name
    documented = {row['file']: row['sha256'] for row in json.loads((SOURCE / 'sources.json').read_text())['documents']}
    if digest(path) != documented[name]:
        raise ValueError(f'{name} does not match its recorded digest')
    return path


def text(value):
    return '' if value is None else str(value).strip()


def read_spreadsheet():
    """The logograms the spreadsheet names, by tentative code point."""
    book = openpyxl.load_workbook(checked('Shuishu.xlsx'), read_only=True)
    rows = {}
    for _number, point, _glyph, name, reading, meaning, wsf, _private, _reading, _zh, english, *_ in book['Sheet1'].iter_rows(values_only=True):
        if not isinstance(point, str) or not re.fullmatch(r'[0-9A-F]+', point):
            continue
        code = int(point, 16)
        if code not in LOGOGRAMS:
            continue
        english = text(english)
        rows[code] = {
            'shuiName': re.sub(r'^SHUISHU LOGOGRAM ', '', text(name)),
            'shuiReading': text(reading) or None,
            'shuiMeaning': text(meaning) or None,
            'shuiGloss': english or None,
            # A WSF dictionary number marks the characters the dictionary indexes; the cell holds
            # the number, and "0" means unnumbered.
            'dictionary': bool(wsf) and text(wsf) != '0',
        }
    return rows


def read_points():
    """The tentative code point of each glyph, from the chart PDF's ToUnicode map."""
    return {int(point): int(cid) for cid, point in json.loads(checked('cid-map.json').read_text()).items()}


def main():
    points = read_points()
    if sorted(points) != [*LOGOGRAMS, *RADICALS]:
        raise ValueError('The code point map does not cover the proposed block exactly')
    logograms = read_spreadsheet()
    if len(logograms) != len(LOGOGRAMS):
        raise ValueError(f'{len(logograms)} logograms read, {len(LOGOGRAMS)} proposed')
    radicals = json.loads(checked('radical-names.json').read_text())

    font = TTFont(checked('Uni1B300Shuishu-subset.ttf'))
    order = font.getGlyphOrder()
    scale = 1000 / font['head'].unitsPerEm
    cmap = {point: order[cid] for point, cid in points.items()}
    table = newTable('cmap')
    table.tableVersion = 0
    subtable = CmapSubtable.newSubtable(12)
    subtable.platformID, subtable.platEncID, subtable.language = 3, 10, 0
    subtable.cmap = cmap
    table.tables = [subtable]
    font['cmap'] = table
    # The chart font has no `post`; browsers want one. Version 3 keeps no glyph names, and the
    # records below keep the source names instead.
    if 'post' not in font:
        post = newTable('post')
        post.formatType, post.italicAngle, post.isFixedPitch = 3.0, 0, 0
        post.underlinePosition, post.underlineThickness = -100, 50
        post.minMemType42 = post.maxMemType42 = post.minMemType1 = post.maxMemType1 = 0
        font['post'] = post
    font['name'].setName('IDS Shuishu', 1, 3, 1, 0x409)
    font['name'].setName('Regular', 2, 3, 1, 0x409)
    font['name'].setName('IDS Shuishu Regular', 4, 3, 1, 0x409)
    font['name'].setName('Version 1.0', 5, 3, 1, 0x409)
    font['name'].setName('IDSShuishu-Regular', 6, 3, 1, 0x409)
    font['name'].setName(
        'Tentative allocations U+1B300..U+1B4E5 and U+1B500..U+1B52E of the proposed Shuishu '
        'block; Unicode 18.0.0 leaves them unassigned.', 10, 3, 1, 0x409)
    font['name'].setName(LICENCE.read_text(encoding='utf-8'), 13, 3, 1, 0x409)
    # A fixed timestamp keeps the font byte-identical between rebuilds.
    font['head'].created = font['head'].modified = 2082844800
    font.recalcTimestamp = False
    font.flavor = 'woff2'
    FONT.parent.mkdir(parents=True, exist_ok=True)
    font.save(FONT)

    glyphs = font.getGlyphSet()
    records = {}
    for point, cid in points.items():
        glyph = glyphs[order[cid]]
        pen, bounds, perimeter = Contours(glyphs, scale), BoundsPen(glyphs), PerimeterPen(glyphs)
        for target in (pen, bounds, perimeter):
            glyph.draw(target)
        if not bound_ink(bounds):
            raise ValueError(f'Empty glyph for U+{point:04X}')
        char = chr(point)
        records[char] = {'k': char, 'G': {'v': 0, 'b': [round(value * scale, 4) for value in bounds.bounds],
                                          'p': pen.contours},
                         'ink': round(perimeter.value * scale, 4), 'o': len(pen.contours)}

    parts = []
    for point in LOGOGRAMS:
        row = logograms[point]
        parts.append({
            'part': chr(point),
            'kind': 'shui',
            'shuiGroup': 'dictionary' if row['dictionary'] else 'logogram',
            'shuiName': row['shuiName'],
            'shuiReading': row['shuiReading'],
            'shuiMeaning': row['shuiMeaning'],
            'shuiGloss': row['shuiGloss'],
            'modern': [row['shuiMeaning']] if row['shuiMeaning'] and len(row['shuiMeaning']) == 1 else [],
        })
    for point in RADICALS:
        parts.append({
            'part': chr(point),
            'kind': 'shui',
            'shuiGroup': 'radical',
            'shuiName': re.sub(r'^SHUISHU RADICAL-', '', radicals[f'{point:X}']),
        })
    known = {part['part'] for part in parts}
    editorial = json.loads((SOURCE / 'ids.json').read_text())
    ids = editorial['entries']
    for point, ids_text in ids.items():
        target = chr(int(point, 16))
        if target not in known:
            raise ValueError(f'ids.json names U+{point}, which is not a part')
        if ids_text[0] not in IDS_OPS or len(ids_text) != 3:
            raise ValueError(f'{point}: {ids_text} is not an operator with two parts')
        for component in ids_text[1:]:
            if component not in known:
                raise ValueError(f'{point}: component U+{ord(component):04X} is not a part')
        if target in ids_text[1:]:
            raise ValueError(f'{point}: {ids_text} contains its own character')
    for part in parts:
        part.setdefault('shuiReading', None)
        part.setdefault('shuiMeaning', None)
        part.setdefault('shuiGloss', None)
        part.setdefault('modern', [])
        part['ids'] = ids.get(f'{ord(part["part"]):X}')
        part['strokes'] = None

    document = {
        'format': 1,
        'proposal': json.loads((SOURCE / 'sources.json').read_text()),
        'ids': {'note': editorial['note'], 'count': len(ids)},
        'parts': parts,
    }
    raw = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    write(INDEX, raw)

    outlines = {'records': records, 'font': 'IDS Shuishu', 'fontSha256': digest(FONT)}
    raw = json.dumps(outlines, ensure_ascii=False, separators=(',', ':')).encode()
    write(OUTLINES, raw)
    print(f'{len(parts)} parts, {len(records)} outlines; font {FONT.stat().st_size} bytes')


def bound_ink(bounds):
    return bounds.bounds is not None and bounds.bounds[2] > bounds.bounds[0]


def write(path, raw):
    data = bytearray(gzip.compress(raw, compresslevel=9, mtime=0))
    data[9] = 255
    path.write_bytes(bytes(data))


if __name__ == '__main__':
    main()
