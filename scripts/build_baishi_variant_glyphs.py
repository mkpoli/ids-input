# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0"]
# ///
"""Rebuild the variant outlines in the Baishi component tooltips.

    uv run scripts/build_baishi_variant_glyphs.py [font-cache-directory]

Sources are pinned below. Cut contour numbers refer to the source font before
any transform; each cut keeps its holes, proportions and direction.
"""
import base64
import gzip
import json
import struct
import sys
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen, RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib import TTCollection, TTFont

from build_ids_data import fetch
from build_ids_parts import FONTS

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'demo/lib/baishi-variant-glyphs.json'
NOTO = ('https://raw.githubusercontent.com/notofonts/noto-cjk/Sans2.004/Sans/OTC/NotoSansCJK-Regular.ttc',
        'b76b0433203017ca80401b2ee0dd69350349871c4b19d504c34dbdd80541690a')
GUIDE = ('https://raw.githubusercontent.com/NightFurySL2001/bai-ids/0ca5ed48f51821d4d54246196f1f5f38c9d6bd6a/fonts/example.woff2',
         '8eacc086a34e81e922516a405482d02cdc16c11e33c503516827b41816671432')

# (char + variant ID, face, source character, selected contours). The component
# appears in the source character's ids_lv0 row at the indicated tag; the cut was
# checked against the actual face. Several regional fonts share the code point
# but draw a different variant. None denotes the whole character.
WITNESSES = [
    ('二t', 'Plangothic', '𠚧', [0, 1]),       # ⿰二t刂
    ('七T', 'TC', '七', None),                 # rounded turn, no hook
    ('小s', 'SC', '少', [0, 1, 3]),            # ⿱小s丿
    ('𤽄V', 'Plangothic', '𪿧', [2, 3, 4, 5, 6]),  # ⿰石𤽄V
    ('月z', 'Plangothic', '𡦇', [0, 1, 6]),   # ⿰⿱子.日⿱𠂉月z
    ('夂d', 'Plangothic', '𫯎', [2]),         # ⿰夂d每
    ('矢d', 'JP', '知', [2]),                  # ⿰矢d口.
    ('玨h', 'Plangothic', '𫜻', [0, 2]),      # ⿱玨h丁
    ('丰H', 'HK', '丰', None),
    ('丰..p', 'I26', '\ue003', None),           # guide §4.3.3
    ('丰.t.', 'JP', '彗', [0]),                # ⿱⿰丰.t.丰.⺕(J)
    ('亥.', 'SC', '亥', None),                 # slanting top dot
    ('鹿.', 'SC', '鹿', None),
    ('鹿H', 'HK', '鹿', None),
    ('鹿.th', 'Plangothic', '𢿇', [0, 1, 2, 3, 4, 6, 7, 8]),  # ⿰鹿.th攴.
    ('木d', 'JP', '朴', [1]),                  # ⿰木d卜.
    ('止t', 'JP', '此', [0]),                  # ⿰止t匕.
    ('止y', 'Plangothic', '𠣏', [0]),         # ⿹勹止y(.)
    ('儿t', 'Plangothic', '𬷼', [0, 1]),      # ⿰儿t鸟.
    ('儿w', 'TC', '㓁', [1, 2]),               # the curved leg ends flat in this face
    ('干p', 'SC', '幵', [1]),                  # guide appendix, ⿰干p干.
    ('亠.', 'SC', '亠', None),
    ('亠jh', 'JP', '言', [2, 3]),             # ⿳亠jh二.口.(J)
    ('旦t', 'Plangothic', '𠛣', [0, 1, 2, 3]),  # ⿰旦t刂
    ('亘t', 'Plangothic', '𡷆', [0, 1, 2, 3, 4]),  # ⿰亘t山
]

# Rule, one-based form index, and its identifier in ids_lv0. Rule 128's
# second drawing is the Taiwan form of 㠯.
UCV_FORMS = [('口q3162', '316', 2, 'cdp-89cc'), ('㠯T', '128', 2, 'u382f-t'), ('㠯q1283', '128', 3, 'u382f-ja')]

# Isolated colored parts in the cheatsheet's cited 耳, 久 and 亡 cards.
CARD_FORMS = [('干t', '耳', [0, 3, 5]), ('スn', '久', [2, 3, 1]), ('𠃊w', '亡', [2])]


def outline(font, char, indices):
    glyphs = font.getGlyphSet()
    pen = DecomposingRecordingPen(glyphs)
    glyphs[font.getBestCmap()[ord(char)]].draw(pen)
    cut = RecordingPen()
    index = 0
    for command, args in pen.value:
        if indices is None or index in indices:
            cut.value.append((command, args))
        if command in ('closePath', 'endPath'):
            index += 1
    return fitted(cut, -1)


def fitted(cut, direction):
    bounds = BoundsPen(None)
    cut.replay(bounds)
    left, bottom, right, top = bounds.bounds
    # Show the individual form at tile size, including a crop from a compound.
    scale = 900 / max(right - left, top - bottom)
    transform = (scale, 0, 0, direction * scale, 500 - (left + right) * scale / 2,
                 500 - direction * (top + bottom) * scale / 2)
    path = SVGPathPen(None, ntos=lambda n: f'{n:.1f}'.removesuffix('.0'))
    cut.replay(TransformPen(path, transform))
    return path.getCommands()


def main():
    cache = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'cache'
    url, sha = FONTS['PlangothicP1-Regular.ttf']
    noto = TTCollection(fetch(NOTO[0], cache / 'NotoSansCJK-Regular.ttc', NOTO[1]))
    faces = {region: noto.fonts[i] for i, region in enumerate(('JP', 'KR', 'SC', 'TC', 'HK'))}
    faces['Plangothic'] = TTFont(fetch(url, cache / 'PlangothicP1-Regular.ttf', sha))
    faces['I26'] = TTFont(fetch(GUIDE[0], cache / 'bai-ids-example.woff2', GUIDE[1]))
    paths = {key: outline(faces[face], char, indices) for key, face, char, indices in WITNESSES}
    entries = {entry['id']: entry for entry in json.loads((ROOT / 'data/ucv.json').read_text())['entries']}
    records = json.loads(gzip.decompress((ROOT / 'data/ucv-outlines-sans.json.gz').read_bytes()))['records']
    card_glyphs = json.loads((ROOT / 'demo/lib/baishi-cheatsheet-outlines.json').read_text())['glyphs']
    for key, char, indices in CARD_FORMS:
        cut = RecordingPen()
        for idx in indices:
            parse_path(card_glyphs[char][idx], cut)
        paths[key] = fitted(cut, 1)
    for key, rule, position, expected in UCV_FORMS:
        name = entries[rule]['forms'][position - 1]['glyph']
        if name != expected:
            raise ValueError(f'UCV {rule} form {position}: expected {expected}, found {name}')
        contours = records[f'&GW-{name};']['G']['p']
        polygons = []
        for commands, points, _delta in contours:
            pairs = struct.iter_unpack('<hh', base64.b64decode(points))
            polygons.append(''.join(f'{op}{x / 4:g} {880 - y / 4:g}' for op, (x, y) in zip(commands, pairs, strict=True)) + 'Z')
        paths[key] = ''.join(polygons)
    TARGET.write_text(json.dumps(paths, ensure_ascii=False, indent=1) + '\n')


if __name__ == '__main__':
    main()
