# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0"]
# ///
"""Build the Jurchen palette data, outlines and font.

uv run scripts/build_jurchen.py
Unicode 18.0 encodes 914 Jurchen characters at U+18E00..U+19191 and 51 radicals at U+191A0..U+191D2.

Sources, pinned in `data/jurchen/sources.json` with SHA-256 digests:

- `JurchenSources-18.0.0.txt` for radical, total strokes, source reference, reading and numeric value;
- `Alari_jurc.dict.yaml` for the stroke codes;
- `AlariXuwasunJurchen-Regular.otf` for the outlines.

The font keeps the characters, radicals and variant sequences and is converted from cubic to quadratic
outlines, which the composer's records and the card renderer read. A variant sequence is a base
character and a selector from U+FE00..U+FE04, reached through a format 14 cmap and recorded under the
pair; a sequence the table and the font do not both give stops the build.
"""
import base64
import gzip
import hashlib
import json
import re
import struct
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.basePen import BasePen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.perimeterPen import PerimeterPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

from engine_data import WRITE_DATA

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/jurchen'
FONT = ROOT / 'fonts/IDSJurchen.woff2'
OUTLINES = WRITE_DATA / 'sources/jurchen/outlines.json.gz'
INDEX = ROOT / 'data/jurchen.json.gz'
LICENCE = ROOT / 'fonts/LICENSE-IDSJurchen.txt'

CHARS = range(0x18E00, 0x19192)
RADICALS = range(0x191A0, 0x191D3)
SELECTORS = range(0xFE00, 0xFE05)
# The operators `ids.json` may use: side by side and stacked.
IDS_OPS = '⿰⿱'
# In font units of a 1000-unit em: small enough to keep the corners, large enough to keep the file down.
MAX_ERROR = 1.0


def packed(values):
    return base64.b64encode(struct.pack('<' + 'h' * len(values), *values)).decode()


class Contours(BasePen):
    def __init__(self, glyphs):
        super().__init__(glyphs)
        self.contours = []

    def point(self, p):
        self.points.extend(round(v * 4) for v in p)

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


def checked(name):
    """A pinned source file, after its digest is confirmed."""
    path = SOURCE / name
    documented = {row['file']: row['sha256'] for row in json.loads((SOURCE / 'sources.json').read_text())['documents']}
    if hashlib.sha256(path.read_bytes()).hexdigest() != documented[name]:
        raise ValueError(f'{name} does not match its recorded digest')
    return path


def records():
    found = {}
    for line in checked('JurchenSources-18.0.0.txt').read_text(encoding='utf-8').splitlines():
        if line.startswith('U+'):
            code, tag, value = line.split('\t')
            found.setdefault(int(code[2:], 16), {})[tag] = value
    if set(found) != set(CHARS):
        raise ValueError('JurchenSources should cover the 914 characters')
    return found


def stroke_codes():
    """The stroke code of each row, by its text. The table's placeholder row for U+25A1 is dropped."""
    body = checked('Alari_jurc.dict.yaml').read_text(encoding='utf-8').replace('\r', '').split('...\n', 1)[1]
    codes = {}
    for line in body.splitlines():
        if not line.strip():
            continue
        text, code = line.split('\t')
        if text == '□':
            continue
        letters = re.sub(r'[^a-z]', '', code)
        if not re.fullmatch(r'[hspdz]+b?', letters):
            raise ValueError(f'Unreadable stroke code: {line!r}')
        if not (len(text) == 1 or len(text) == 2 and ord(text[1]) in SELECTORS):
            raise ValueError(f'Unreadable row: {line!r}')
        if text in codes:
            raise ValueError(f'Two codes for {text!r}')
        codes[text] = letters
    if {ord(text) for text in codes if len(text) == 1} != set(CHARS) | set(RADICALS):
        raise ValueError('The table should give a code for every character and radical')
    return codes


def build_font(codes):
    source = TTFont(checked('AlariXuwasunJurchen-Regular.otf'))
    if source['head'].unitsPerEm != 1000:
        raise ValueError('The conversion assumes 1000 units per em')
    cmap, glyphs, metrics = source.getBestCmap(), source.getGlyphSet(), source['hmtx']
    points = [*CHARS, *RADICALS]
    # Each text the font draws, with the source glyph and the name it takes here.
    drawn = {}
    for point in points:
        if point not in cmap:
            raise ValueError(f'The font does not draw U+{point:04X}')
        drawn[chr(point)] = (cmap[point], f'u{point:05X}')
    for selector, rows in next(table for table in source['cmap'].tables if table.format == 14).uvsDict.items():
        for point, glyph in rows:
            drawn[chr(point) + chr(selector)] = (glyph or cmap[point], f'u{point:05X}.{selector:04x}')
    if set(drawn) != set(codes):
        raise ValueError(f'The table and the font differ on {sorted(set(drawn) ^ set(codes))[:5]}')
    outlines, widths = {'.notdef': TTGlyphPen(None).glyph()}, {'.notdef': (1000, 0)}
    for glyph, name in drawn.values():
        pen = TTGlyphPen(None)
        # PostScript outlines wind the other way from TrueType's.
        glyphs[glyph].draw(Cu2QuPen(pen, MAX_ERROR, reverse_direction=True))
        outlines[name] = pen.glyph()
        widths[name] = (metrics[glyph][0], 0)

    builder = FontBuilder(1000, isTTF=True)
    builder.setupGlyphOrder(list(outlines))
    builder.setupCharacterMap({ord(text): name for text, (_, name) in drawn.items() if len(text) == 1},
                              uvs=[(ord(text[0]), ord(text[1]), name) for text, (_, name) in drawn.items() if len(text) == 2])
    builder.setupGlyf(outlines)
    builder.setupHorizontalMetrics({name: (width, outlines[name].xMin if outlines[name].numberOfContours else 0)
                                    for name, (width, _) in widths.items()})
    builder.setupHorizontalHeader(ascent=source['hhea'].ascent, descent=source['hhea'].descent)
    builder.setupOS2(sTypoAscender=source['OS/2'].sTypoAscender, sTypoDescender=source['OS/2'].sTypoDescender,
                     usWinAscent=source['OS/2'].usWinAscent, usWinDescent=source['OS/2'].usWinDescent)
    builder.setupNameTable({
        'familyName': 'IDS Jurchen',
        'styleName': 'Regular',
        'uniqueFontIdentifier': 'IDS Jurchen Regular 1.0',
        'fullName': 'IDS Jurchen Regular',
        'psName': 'IDSJurchen-Regular',
        'version': 'Version 1.0',
        'designer': 'Sulfa, Dooran, Raxon7',
        'description': 'The characters, radicals and variant sequences of Alari Xuwasun Jurchen, converted to TrueType outlines.',
        'licenseDescription': LICENCE.read_text(encoding='utf-8'),
        'licenseInfoURL': 'https://openfontlicense.org',
    })
    builder.setupPost(keepGlyphNames=False)
    font = builder.font
    # A fixed timestamp keeps the font byte-identical between rebuilds.
    font['head'].created = font['head'].modified = 2082844800
    font.recalcTimestamp = False
    font.flavor = 'woff2'
    FONT.parent.mkdir(parents=True, exist_ok=True)
    font.save(FONT)
    return font, {text: name for text, (_, name) in drawn.items()}


def editorial(parts):
    """The decompositions of `ids.json`, each checked against the parts it names and their strokes."""
    by_part = {part['part']: part for part in parts}

    def strokes(part):
        # Unicode counts no radical's strokes; a code spells out up to four strokes and the last.
        if part['strokes'] is not None:
            return part['strokes']
        letters = part['jurCode'].removesuffix('b')
        if len(letters) >= 5:
            raise ValueError(f"{part['part']!r}: its code does not give a stroke count")
        return len(letters)

    document = json.loads((SOURCE / 'ids.json').read_text(encoding='utf-8'))
    for point, text in document['entries'].items():
        target = by_part.get(chr(int(point, 16)))
        if target is None or target['jurGroup'] != 'character':
            raise ValueError(f'ids.json names U+{point}, which is not a character')
        if len(text) != 3 or text[0] not in IDS_OPS:
            raise ValueError(f'{point}: {text} is not an operator with two parts')
        if target['part'] in text[1:] or not all(char in by_part for char in text[1:]):
            raise ValueError(f'{point}: {text} names a part it cannot')
        if sum(strokes(by_part[char]) for char in text[1:]) != target['strokes']:
            raise ValueError(f'{point}: the strokes of {text} do not add up')
        target['ids'] = text
    return {'note': document['note'], 'count': len(document['entries'])}


def write(path, document):
    raw = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    data = bytearray(gzip.compress(raw, compresslevel=9, mtime=0))
    data[9] = 255
    path.write_bytes(bytes(data))


def main():
    source, codes = records(), stroke_codes()
    font, names = build_font(codes)
    glyphs = font.getGlyphSet()
    outlines = {}
    for char, name in names.items():
        glyph = glyphs[name]
        pen, bounds, perimeter = Contours(glyphs), BoundsPen(glyphs), PerimeterPen(glyphs)
        for target in (pen, bounds, perimeter):
            glyph.draw(target)
        if bounds.bounds is None:
            raise ValueError(f'Empty glyph for {char!r}')
        outlines[char] = {'k': char, 'G': {'v': 0, 'b': [round(value, 4) for value in bounds.bounds], 'p': pen.contours},
                          'ink': round(perimeter.value, 4), 'o': len(pen.contours)}

    variants = {}
    for text in codes:
        if len(text) == 2:
            variants.setdefault(ord(text[0]), []).append(text)
    if not set(variants) <= set(CHARS):
        raise ValueError('The conversion assumes only characters have variant sequences')
    parts = []
    for point in CHARS:
        entry = source[point]
        radical, strokes = entry['kJURC_RSUnicode'].split('.')
        numeric = entry.get('kJURC_Numeric')
        record = {
            'kind': 'jur',
            'jurRadical': int(radical),
            'jurReading': entry.get('kJURC_NCReading'),
            'jurNumeric': int(numeric) if numeric else None,
            'jurSource': entry['kJURC_Src'],
            'strokes': int(strokes),
        }
        parts.append({'part': chr(point), 'jurGroup': 'character', 'jurCode': codes[chr(point)], **record})
        # A variant follows its base, so that a search lists them together.
        for text in sorted(variants.get(point, [])):
            parts.append({'part': text, 'jurGroup': 'variant', 'jurCode': codes[text], **record})
    for index, point in enumerate(RADICALS, 1):
        parts.append({
            'part': chr(point),
            'kind': 'jur',
            'jurGroup': 'radical',
            'jurRadical': index,
            'jurCode': codes[chr(point)],
            'strokes': None,
        })
    ids = editorial(parts)
    write(INDEX, {'format': 1, 'unicode': '18.0.0', 'sources': json.loads((SOURCE / 'sources.json').read_text()), 'ids': ids, 'parts': parts})
    write(OUTLINES, {'records': outlines, 'font': 'IDS Jurchen', 'fontSha256': hashlib.sha256(FONT.read_bytes()).hexdigest()})
    print(f'{len(parts)} parts, {len(outlines)} outlines; font {FONT.stat().st_size} bytes')


if __name__ == '__main__':
    main()
