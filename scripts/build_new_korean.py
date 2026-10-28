# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0"]
# ///
"""Build the IDS New Korean webfont and its outline records from the bundled Commons SVGs.

uv run scripts/build_new_korean.py
The letters are the four unencoded letters of the New Korean Orthography. Their code points
are the positions proposed in L2/19-230R; Unicode 18.0.0 leaves them unassigned. The font is
a rendering aid, not an encoding proposal. Initial and final forms share one drawing.
"""
import gzip
import hashlib
import json
import re
from pathlib import Path
from xml.etree import ElementTree

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.perimeterPen import PerimeterPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.svgLib.path import parse_path

from build_tangut_outlines import Contours

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/new-korean'
FONT = ROOT / 'fonts/IDSNewKorean.woff2'
OUTLINES = ROOT / 'data/new-korean-outlines.json.gz'
VIEW_BOX = 708.66142
SCALE = 1000 / VIEW_BOX


def multiply(a, b):
    a1, b1, c1, d1, e1, f1 = a
    a2, b2, c2, d2, e2, f2 = b
    return (a1 * a2 + c1 * b2, b1 * a2 + d1 * b2,
            a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
            a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1)


def parseTransform(value):
    matrix = re.fullmatch(r'matrix\(([^)]+)\)', value)
    if matrix:
        return tuple(float(v) for v in matrix.group(1).split(','))
    translate = re.fullmatch(r'translate\(([^,]+),?\s*([^)]*)\)', value)
    if translate:
        return (1, 0, 0, 1, float(translate.group(1)), float(translate.group(2) or 0))
    raise ValueError(f'Unsupported transform: {value}')


def glyphFor(path):
    root = ElementTree.parse(path).getroot()
    if root.attrib.get('viewBox') != f'0 0 {VIEW_BOX} {VIEW_BOX}':
        raise ValueError(f'Unexpected viewBox in {path.name}')
    paths = [node for node in root.iter() if node.tag.endswith('path')]
    if len(paths) != 1:
        raise ValueError(f'Expected one path in {path.name}')
    groups = [node for node in root.iter() if node.tag.endswith('g') and 'transform' in node.attrib]
    # SVG is y-down and the font is y-up; the groups apply outside-in.
    matrix = (SCALE, 0, 0, -SCALE, 0, VIEW_BOX * SCALE)
    for group in groups:
        matrix = multiply(matrix, parseTransform(group.attrib['transform']))
    pen = TTGlyphPen(None)
    parse_path(paths[0].attrib['d'], TransformPen(Cu2QuPen(pen, max_err=0.5, reverse_direction=True), matrix))
    return pen.glyph()


def main():
    sources = json.loads((SOURCE / 'sources.json').read_text())
    glyphs = {'.notdef': TTGlyphPen(None).glyph()}
    codePoints = {}
    provenance = {}
    for letter in sources['letters']:
        source = SOURCE / letter['file']
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        if digest != letter['sha256']:
            raise ValueError(f'Checksum mismatch: {letter["file"]}')
        glyph = glyphFor(source)
        glyphs[letter['glyph']] = glyph
        provenance[letter['file']] = {'title': letter['title'], 'url': letter['url'], 'sha256': digest}
        for point in letter['codePoints']:
            codePoints[int(point, 16)] = letter['glyph']
    if set(codePoints) != {0xA97D, 0xA97E, 0xA97F, 0xD7C7, 0xD7FC, 0xD7FD, 0xD7FE}:
        raise ValueError('Unexpected code points')

    builder = FontBuilder(1000, isTTF=True)
    builder.setupGlyphOrder(list(glyphs))
    builder.setupCharacterMap(codePoints)
    builder.setupGlyf(glyphs)
    builder.setupHorizontalMetrics({name: (1000, 0) for name in glyphs})
    builder.setupHorizontalHeader(ascent=1000, descent=0)
    builder.setupOS2(sTypoAscender=1000, sTypoDescender=0, usWinAscent=1000, usWinDescent=0,
                     sxHeight=500, sCapHeight=800)
    builder.setupNameTable({
        'familyName': 'IDS New Korean', 'styleName': 'Regular',
        'uniqueFontIdentifier': 'IDS New Korean 1.0', 'fullName': 'IDS New Korean Regular',
        'psName': 'IDSNewKorean-Regular', 'version': 'Version 1.0',
        'copyright': ('Letter outlines derived from Nanuun-saram, Wikimedia Commons, '
                      'CC BY-SA 4.0. Code points follow L2/19-230R.'),
        'licenseDescription': (ROOT / 'fonts/LICENSE-IDSNewKorean.txt').read_text(),
    })
    builder.setupPost()
    builder.font['head'].created = builder.font['head'].modified = 2082844800
    builder.font.recalcTimestamp = False
    builder.font.flavor = 'woff2'
    builder.font.save(FONT)

    glyphSet = builder.font.getGlyphSet()
    records = {}
    for point, name in codePoints.items():
        glyph = glyphSet[name]
        pen, bounds, perimeter = Contours(glyphSet, 1), BoundsPen(glyphSet), PerimeterPen(glyphSet)
        for target in (pen, bounds, perimeter):
            glyph.draw(target)
        if not bounds.bounds:
            raise ValueError(f'Empty glyph: U+{point:04X}')
        char = chr(point)
        records[char] = {'k': char, 'G': {'v': 0, 'b': list(bounds.bounds), 'p': pen.contours},
                         'ink': perimeter.value, 'o': len(pen.contours)}
    document = {
        'font': 'IDS New Korean',
        'license': sources['license'],
        'licenseUrl': sources['licenseUrl'],
        'author': sources['author'],
        'authorUrl': sources['authorUrl'],
        'proposal': sources['proposal'],
        'response': sources['response'],
        'fontSha256': hashlib.sha256(FONT.read_bytes()).hexdigest(),
        'provenance': provenance,
        'records': records,
    }
    raw = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    OUTLINES.write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
    print(f'{len(records)} outlines from {len(provenance)} drawings; {FONT.stat().st_size} + {OUTLINES.stat().st_size} bytes')


if __name__ == '__main__':
    main()
