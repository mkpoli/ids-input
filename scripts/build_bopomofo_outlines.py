# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0"]
# ///
"""Export Bopomofo outlines: uv run scripts/build_bopomofo_outlines.py FONT_DIR."""
import gzip
import hashlib
import json
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.perimeterPen import PerimeterPen
from build_tangut_outlines import Contours
from build_ids_parts import FONTS

ROOT = Path(__file__).resolve().parents[1]


def main():
    directory = Path(sys.argv[1])
    fonts, sources = [], []
    for filename in ['NotoSansCJKjp-VF-2.004.ttf', 'PlangothicP1-Regular.ttf']:
        path = directory / filename
        url, expected = FONTS[filename]
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != expected:
            raise ValueError(f'Checksum mismatch: {filename}')
        font = TTFont(path)
        fonts.append((font.getBestCmap(), font.getGlyphSet(location={'wght': 400}) if 'fvar' in font else font.getGlyphSet(), 1000 / font['head'].unitsPerEm))
        sources.append({'font': filename, 'sha256': digest, 'url': url, 'license': 'SIL OFL 1.1'})
    records = {}
    for point in [*range(0x3105, 0x3130), *range(0x31A0, 0x31C0)]:
        cmap, glyphs, scale = next(item for item in fonts if point in item[0])
        glyph = glyphs[cmap[point]]
        pen, bounds, perimeter = Contours(glyphs, scale), BoundsPen(glyphs), PerimeterPen(glyphs)
        for target in [pen, bounds, perimeter]:
            glyph.draw(target)
        if not bounds.bounds:
            raise ValueError(f'Empty glyph: U+{point:04X}')
        char = chr(point)
        records[char] = {'k': char, 'G': {'v': 0, 'b': [v * scale for v in bounds.bounds], 'p': pen.contours},
                         'ink': perimeter.value * scale, 'o': len(pen.contours)}
    raw = json.dumps({'sources': sources, 'records': records}, ensure_ascii=False, separators=(',', ':')).encode()
    (ROOT / 'data/bopomofo-outlines.json.gz').write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
    print(f'{len(records)} Bopomofo outlines')


if __name__ == '__main__':
    main()
