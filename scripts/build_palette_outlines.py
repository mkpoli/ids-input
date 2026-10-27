# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0"]
# ///
"""Build palette fallback outlines: uv run scripts/build_palette_outlines.py NOTO_CJK_TTC."""
import gzip, hashlib, json, sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.perimeterPen import PerimeterPen
from build_tangut_outlines import Contours

root = Path(__file__).resolve().parents[1]
ttc = Path(sys.argv[1])
if hashlib.sha256(ttc.read_bytes()).hexdigest() != 'b76b0433203017ca80401b2ee0dd69350349871c4b19d504c34dbdd80541690a':
    raise ValueError('Unexpected Noto Sans CJK Regular TTC; see data/README.md')
fonts = [(root / 'fonts/Plangothic-gongche.woff2', None), (root / 'fonts/Plangothic-ids-parts.woff2', None), (root / 'fonts/NotoSansCJKjp-ids-strokes.woff2', None), (ttc, 0)]
missing = set(json.loads((root / 'data/palette-fallback-characters.json').read_text()))
records = {}
for path, index in fonts:
    with TTFont(path, **({'fontNumber': index} if index is not None else {})) as font:
        cmap = font.getBestCmap(); glyphs = font.getGlyphSet(); scale = 1000 / font['head'].unitsPerEm
        for char in sorted(missing):
            if ord(char) not in cmap: continue
            glyph = glyphs[cmap[ord(char)]]; bounds = BoundsPen(glyphs); glyph.draw(bounds)
            if not bounds.bounds: continue
            pen, perimeter = Contours(glyphs, scale), PerimeterPen(glyphs)
            glyph.draw(Cu2QuPen(pen, max_err=0.5 / scale)); glyph.draw(perimeter)
            if not pen.contours: continue
            records[char] = {'k': char, 'G': {'v': 0, 'b': [round(v * scale, 4) for v in bounds.bounds], 'p': pen.contours}, 'ink': round(perimeter.value * scale, 4), 'o': len(pen.contours)}
        missing.difference_update(records)
if missing: raise ValueError(f'Missing outlines: {sorted(missing)}')
raw = json.dumps({'records': records}, ensure_ascii=False, separators=(',', ':')).encode()
out = bytearray(gzip.compress(raw, compresslevel=9, mtime=0)); out[9] = 255
(root / 'data/palette-outlines.json.gz').write_bytes(out)
print(f'{len(records)} glyphs, {len(out)} bytes')
