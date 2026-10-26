# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0"]
# ///
"""Build IDS Seal webfont and outlines from the bundled, pinned Kaiyuan SVG sources.

uv run scripts/build_small_seal_font.py
Includes the expanded palette and the head characters in the compiled IDS table.
Glyphs retain Kaiyuan's CCZ provenance; the font is a rendering aid for Jiguge IDS.
"""
import csv
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile
from xml.etree import ElementTree
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.perimeterPen import PerimeterPen
from fontTools.svgLib.path import parse_path
from build_tangut_outlines import Contours

ROOT = Path(__file__).resolve().parents[1]


def main():
    source = json.loads((ROOT / 'fonts/small-seal-sources.json').read_text())
    raw = (ROOT / 'fonts/IDSSeal-sources.tar.gz').read_bytes()
    if hashlib.sha256(raw).hexdigest() != source['archiveSha256']: raise ValueError('SVG source archive checksum mismatch')
    data = json.loads(gzip.decompress((ROOT / 'data/small-seal.json.gz').read_bytes()))
    chars = sorted(set(data['table']) | {p['part'] for p in data['parts']})
    glyphs = {'.notdef': TTGlyphPen(None).glyph()}
    provenance = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as tar:
        review = {row['codepoint']: row for row in csv.DictReader(io.StringIO(tar.extractfile('data/provenance/glyphs.csv').read().decode()))}
        for c in chars:
            name = f'glyphs/u{ord(c):X}.svg'
            svg = tar.extractfile(name).read()
            if hashlib.sha256(svg).hexdigest() != source['files'][name]: raise ValueError('SVG checksum mismatch')
            root = ElementTree.fromstring(svg)
            if root.attrib['viewBox'] != '0 -880 1000 1000': raise ValueError('Unexpected SVG viewBox')
            pen = TTGlyphPen(None)
            # SVG uses y down; TrueType and the composer's glyph records use y up.
            target = TransformPen(Cu2QuPen(pen, max_err=0.5, reverse_direction=True), (1, 0, 0, -1, 0, 0))
            for path in root.findall('{http://www.w3.org/2000/svg}path'):
                if 'transform' in path.attrib: raise ValueError('Unsupported path transform')
                parse_path(path.attrib['d'], target)
            glyphs[f'u{ord(c):X}'] = pen.glyph()
            provenance[c] = {**root.attrib, 'review': review[f'{ord(c):X}']}
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(list(glyphs))
    fb.setupCharacterMap({ord(c): f'u{ord(c):X}' for c in chars})
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics({name: (1000, 0 if name == '.notdef' else glyph.xMin) for name, glyph in glyphs.items()})
    fb.setupHorizontalHeader(ascent=880, descent=-120)
    fb.setupNameTable({'familyName': 'IDS Seal', 'styleName': 'Regular', 'uniqueFontIdentifier': 'IDS Seal 1.0',
        'fullName': 'IDS Seal Regular', 'psName': 'IDSSeal-Regular', 'version': 'Version 1.0',
        'copyright': 'Copyright (c) 2026 Kaiyuan Small Seal Font Contributors. Derived font: IDS Seal.',
        'licenseDescription': (ROOT / 'fonts/LICENSE-IDSSeal.txt').read_text()})
    fb.font['name'].setName('Kaiyuan Small Seal', 18, 3, 1, 0x409)
    fb.font['name'].setName('Kaiyuan Small Seal', 18, 1, 0, 0)
    fb.setupOS2(sTypoAscender=880, sTypoDescender=-120, usWinAscent=1000, usWinDescent=200)
    fb.setupPost()
    fb.font['head'].created = fb.font['head'].modified = 2082844800
    fb.font.recalcTimestamp = False
    fb.font.flavor = 'woff2'
    target = ROOT / 'fonts/IDSSeal-Regular.woff2'
    fb.font.save(target)
    outlines = {}
    glyph_set = fb.font.getGlyphSet()
    for c in chars:
        glyph = glyph_set[f'u{ord(c):X}']
        pen, bounds, perimeter = Contours(glyph_set, 1), BoundsPen(glyph_set), PerimeterPen(glyph_set)
        for p in [pen, bounds, perimeter]: glyph.draw(p)
        if not bounds.bounds: raise ValueError('Empty seal glyph')
        outlines[c] = {'k': c, 'G': {'v': 0, 'b': list(bounds.bounds), 'p': pen.contours}, 'ink': perimeter.value, 'o': len(pen.contours)}
    # Exact descriptions use their Unicode glyph; edited trees use geometric placement.
    by_sequence = {}
    for c, sequences in data['table'].items():
        for s in sequences: by_sequence.setdefault(s, []).append(c)
    for s, heads in by_sequence.items():
        if len(heads) == 1 and any(c in outlines for c in s): outlines[s] = {'e': heads[0]}
    doc = {'font': 'IDS Seal', 'license': 'See fonts/LICENSE-IDSSeal.txt', 'source': source,
           'fontSha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'provenance': provenance,
           'descriptionLicense': data['license'], 'descriptionSources': data['sources'], 'records': outlines}
    (ROOT / 'data/small-seal-outlines.json.gz').write_bytes(gzip.compress(json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))
    print(f'{len(chars)} glyphs; {len(outlines)} outline records')


if __name__ == '__main__': main()
