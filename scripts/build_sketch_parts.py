# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==13.0.0", "fonttools[woff]==4.68.0", "brotli==1.2.1"]
# ///
"""Build `data/sketch-parts.json.gz`, the glyph masks the Find tab's drawing search compares with.

The palette's parts used in at least 50 descriptions, and every CJK stroke, are drawn once at 64 px
from Noto Sans CJK JP and the bundled faces. Each glyph is fitted to the 40×40 square twice, stretched and with its own
proportions, and packed as 200 bytes of bits. The page decodes the masks and describes them for
matching, so the drawing pad does not depend on the host's loaded fonts.

Fonts, in order: Noto Sans CJK JP, GenZui Sans, Kureedo, then the Plangothic subset of the palette's
rare parts. A part no face draws, or one that comes out as the face's notdef box, is left out.
"""
import base64
import gzip
import hashlib
import json
import os
import re
import tempfile
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/sketch-parts.json.gz'
SIZE = 40
RENDER = 64
FONT_SIZE = round(RENDER * 0.86)
MARGIN = 2
THRESHOLD = 24
MIN_USES = 50
EXPECTED_NOTO = 'b76b0433203017ca80401b2ee0dd69350349871c4b19d504c34dbdd80541690a'
FONTS = [
    ('Noto Sans CJK JP', os.environ.get('NOTO_SANS_CJK', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')),
    ('GenZui Sans', 'fonts/GenZuiSans-Regular.woff2'),
    ('Kureedo', 'fonts/Kureedo-Regular.woff2'),
    ('IDS Parts', 'fonts/Plangothic-ids-parts.woff2'),
]
# Decompressed faces live here until the process exits.
TEMPS = tempfile.TemporaryDirectory()

# The fallback webfont is split by code-point ranges; it covers the Chinese forms the Japanese
# faces lack, such as 户 and 吕.
SHARDS = {}

for _shard, _range in re.findall(r'url\("\./unicode/([0-9a-f]{3})\.woff2"\).*?unicode-range:([^;}]+)', (ROOT / 'fonts/unicode.css').read_text()):
    for _part in _range.split(','):
        _part = _part.strip().removeprefix('U+')
        _start, _, _end = _part.partition('-')
        SHARDS.setdefault((int(_start, 16), int(_end or _start, 16)), _shard + '.woff2')


def face(path: Path):
    """A Pillow face and its character map, from a bundled WOFF2 or a Noto collection."""
    font = TTFont(path, fontNumber=0 if path.suffix == '.ttc' else -1)
    cmap = font.getBestCmap() or {}
    font.flavor = None
    suffix = '.otf' if 'CFF ' in font else '.ttf'
    out = Path(TEMPS.name) / (path.stem + suffix)
    font.save(out)
    return ImageFont.truetype(str(out), FONT_SIZE), cmap


FALLBACK = {}


def fallback(cp: int):
    """The fallback face for a code point, loaded from its shard once."""
    for (start, end), shard in SHARDS.items():
        if start <= cp <= end:
            if shard not in FALLBACK:
                path = ROOT / 'fonts/unicode' / shard
                FALLBACK[shard] = face(path) if path.exists() else None
            return FALLBACK[shard]
    return None


def render(text: str, font: ImageFont.FreeTypeFont) -> bytes:
    image = Image.new('L', (RENDER, RENDER), 0)
    ImageDraw.Draw(image).text((RENDER / 2, RENDER / 2), text, font=font, fill=255, anchor='mm')
    return image.tobytes()


def lopsided(w: int, h: int) -> bool:
    return min(w, h) < 3 or min(w, h) < max(w, h) * 0.2


def fit(alpha: bytes, stretch: bool) -> bytearray | None:
    """The same fit as `fitMask` in `src/core/sketch.js`."""
    x0, y0, x1, y1 = RENDER, RENDER, -1, -1
    for y in range(RENDER):
        row = y * RENDER
        for x in range(RENDER):
            if alpha[row + x] <= THRESHOLD:
                continue
            if x < x0:
                x0 = x
            if x > x1:
                x1 = x
            if y < y0:
                y0 = y
            if y > y1:
                y1 = y
    if x1 < x0 or y1 < y0:
        return None
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    room = SIZE - 2 * MARGIN
    uniform = room / max(bw, bh)
    flat = lopsided(bw, bh)
    sx = room / bw if stretch and not flat else uniform
    sy = room / bh if stretch and not flat else uniform
    left, top = (SIZE - bw * sx) / 2, (SIZE - bh * sy) / 2
    mask = bytearray(SIZE * SIZE)
    for y in range(SIZE):
        for x in range(SIZE):
            px0 = x0 + (x - left) / sx
            py0 = y0 + (y - top) / sy
            if px0 < x0 - 1 or px0 > x1 + 1 or py0 < y0 - 1 or py0 > y1 + 1:
                continue
            most = 0
            for oy in (0, 1):
                for ox in (0, 1):
                    px, py = int(px0) + ox, int(py0) + oy
                    if 0 <= px < RENDER and 0 <= py < RENDER:
                        most = max(most, alpha[py * RENDER + px])
            if most > THRESHOLD:
                mask[y * SIZE + x] = 1
    return mask


def pack(mask: bytearray) -> str:
    bits = bytearray(SIZE * SIZE // 8)
    for i, ink in enumerate(mask):
        if ink:
            bits[i >> 3] |= 1 << (i & 7)
    return base64.b64encode(bits).decode('ascii')


def alike(a: bytearray, b: bytearray) -> float:
    return sum(x == y for x, y in zip(a, b)) / len(a)


def main():
    document = json.loads((ROOT / 'data/ids-parts.json').read_text())
    columns = document['columns']
    rows = [dict(zip(columns, row)) for row in document['parts']]
    faces, missing, notdef = [], [], {}
    for name, relative in FONTS:
        path = Path(relative) if Path(relative).is_absolute() else ROOT / relative
        if not path.exists():
            if name == 'Noto Sans CJK JP':
                raise SystemExit(f'missing {path}; set NOTO_SANS_CJK to Noto Sans CJK JP 2.004')
            raise SystemExit(f'missing font: {path}')
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if name == 'Noto Sans CJK JP' and digest != EXPECTED_NOTO:
            raise SystemExit(f'{path} is not the Noto Sans CJK JP 2.004 this data was built from')
        font, cmap = face(path)
        faces.append((name, font, cmap, path))
        box = (fit(render('\U0010FFFF', font), True), fit(render('\U0010FFFF', font), False))
        if box[0]:
            notdef[name] = box

    parts, skipped = [], 0
    for row in rows:
        part = row['part']
        kind = row.get('kind')
        if len(part) != 1 or kind not in ('c', 'd', 's'):
            continue
        if kind != 's' and row.get('uses') is not None and row['uses'] < MIN_USES:
            continue
        chosen = next(((name, font, mask) for name, font, cmap, _ in faces
                       if ord(part) in cmap and (mask := fit(render(part, font), True)) is not None), None)
        if chosen is None:
            other = fallback(ord(part))
            if other and ord(part) in other[1]:
                mask = fit(render(part, other[0]), True)
                if mask is not None:
                    chosen = ('IDS Fallback', other[0], mask)
        if chosen is None:
            missing.append(part)
            continue
        name, font, stretched = chosen
        box = notdef.get(name)
        if box and box[0] and alike(stretched, box[0]) >= 0.98:
            skipped += 1
            continue
        kept = fit(render(part, font), False)
        if kept is not None and box and box[1] and alike(kept, box[1]) >= 0.98:
            kept = None
        parts.append([part, row.get('strokes'), row.get('uses') or 0, pack(stretched), pack(kept) if kept else None])

    data = {
        'format': 'ids-input/sketch-parts',
        'version': 1,
        'size': SIZE,
        'font': ', '.join([name for name, _, _, _ in faces] + ['IDS Fallback']),
        'fonts': {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for _, _, _, path in faces}
        | {'unicode.json': hashlib.sha256((ROOT / 'fonts/unicode.json').read_bytes()).hexdigest()},
        'parts': parts,
    }
    raw = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode()
    OUT.write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
    print(f'{len(parts)} parts, {skipped} notdef skipped, {len(missing)} no glyph; '
          f'{len(raw)} bytes raw, {OUT.stat().st_size} bytes gzipped -> {OUT.relative_to(ROOT)}')
    if missing:
        print('no glyph:', ' '.join(missing[:40]))


if __name__ == '__main__':
    main()
