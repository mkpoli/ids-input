# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0"]
# ///
"""Bundle supplementary Gongche glyphs from the catalogue, using pinned Plangothic sources."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from fontTools.merge import Merger
from fontTools.ttLib import TTFont
from build_ids_data import fetch
from build_ids_parts import FONTS, subset_piece

ROOT = Path(__file__).resolve().parents[1]

if __name__ == '__main__':
    catalogue = json.loads((ROOT / 'data/gongche-parts.json').read_text())
    wanted = {ord(p['part']) for g in catalogue['groups'] for p in g['parts']
              if len(p['part']) == 1 and ord(p['part']) > 0xFFFF}
    with TemporaryDirectory() as temp:
        folder = Path(temp)
        missing, pieces = set(wanted), []
        for name in ['PlangothicP1-Regular.ttf', 'PlangothicP2-Regular.ttf']:
            url, digest = FONTS[name]
            source = fetch(url, folder / name, digest)
            with TTFont(source) as font:
                codes = sorted(missing & font.getBestCmap().keys())
            if codes:
                pieces.append(str(subset_piece(source, codes, folder / ('subset-' + name))))
                missing.difference_update(codes)
        if missing:
            raise ValueError(f'Missing Gongche glyphs: {sorted(missing)}')
        font = Merger().merge(pieces)
        with TTFont(pieces[0]) as first:
            font['head'].created, font['head'].modified = first['head'].created, first['head'].modified
        font.recalcTimestamp = False
        font.flavor = 'woff2'
        font.save(ROOT / 'fonts/Plangothic-gongche.woff2')
        # Exact ranges are generated with the font so future catalogue updates cannot omit a face range.
        ranges = ','.join(f'U+{code:X}' for code in sorted(wanted))
        (ROOT / 'fonts/gongche.css').write_text(
            '/* Rebuild with uv run scripts/build_gongche_font.py. */\n'
            '@font-face{font-family:"IDS Parts";src:url("./Plangothic-gongche.woff2") format("woff2");font-display:swap;\n'
            f'  unicode-range:{ranges}' + '}\n')
        print(f'{len(wanted)} supplementary Gongche glyphs')
