# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0"]
# ///
"""Export bundled Noto Serif Tangut outlines: uv run scripts/build_tangut_outlines.py."""
import base64
import gzip
import hashlib
import json
import struct
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.perimeterPen import PerimeterPen

ROOT = Path(__file__).resolve().parents[1]
FONT = ROOT / 'fonts/NotoSerifTangut-Regular.woff2'


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


def main():
    font = TTFont(FONT)
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
    scale = 1000 / font['head'].unitsPerEm
    records = {}
    for point, name in cmap.items():
        if not (0x17000 <= point <= 0x18AFF or 0x18D00 <= point <= 0x18DFF):
            continue
        glyph = glyphs[name]
        pen, bounds, perimeter = Contours(glyphs, scale), BoundsPen(glyphs), PerimeterPen(glyphs)
        for target in [pen, bounds, perimeter]:
            glyph.draw(target)
        if not bounds.bounds:
            continue
        char = chr(point)
        records[char] = {'k': char, 'G': {'v': 0, 'b': [v * scale for v in bounds.bounds], 'p': pen.contours},
                         'ink': perimeter.value * scale, 'o': len(pen.contours)}
    # Exact recorded descriptions can use the complete character's designed glyph.
    # Malformed source records are left out of this index.
    arities = {c: 2 for c in '⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽㇯'} | {c: 3 for c in '⿲⿳'} | {c: 1 for c in '⿾⿿〾'}
    table = gzip.decompress((ROOT / 'data/babelstone-ids.tsv.gz').read_bytes()).decode()
    for line in table.splitlines():
        if not line or line.startswith('#'):
            continue
        char, sequences = line.split('\t')
        if char not in records:
            continue
        for sequence in sequences.split():
            remaining = 1
            for c in sequence:
                if remaining == 0 or c not in arities and c not in records:
                    break
                remaining += arities.get(c, 0) - 1
            else:
                if remaining == 0 and sequence[0] in arities:
                    records.setdefault(sequence, {'e': char})
    document = {'font': 'Noto Serif Tangut 2.168', 'license': 'SIL OFL 1.1',
                'fontSha256': hashlib.sha256(FONT.read_bytes()).hexdigest(), 'records': records}
    raw = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    target = ROOT / 'data/tangut-outlines.json.gz'
    target.write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
    print(f'{len(records)} records; {len(raw)} bytes; {target.stat().st_size} compressed')


if __name__ == '__main__':
    main()
