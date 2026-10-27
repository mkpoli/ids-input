# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0"]
# ///
"""Build the fallback webfont from the bundled Unicode outline shards.

uv run scripts/build_unicode_font.py

The composer already draws these characters as outlines; this writes the same shapes as a webfont,
one file per 256-code-point shard, so text surfaces fall back to them when no installed font has the
character. Coverage, metrics and provenance come from data/unicode-outlines.json and its shards.
"""
import base64
import gzip
import hashlib
import json
import struct
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUTLINES = ROOT / 'data/unicode-outlines'
OUT = ROOT / 'fonts/unicode'
FAMILY = 'IDS Fallback'
UPEM = 1000
ASCENT, DESCENT = 880, -120
COPYRIGHT = ('Outline sources: Noto fonts (c) Google LLC, SIL OFL 1.1; Jigmo by Kamichi Chizuko, '
             'CC0 1.0; GNU Unifont and GlyphWiki contributors, see their licence files. Full notices: '
             'fonts/README.md and data/unicode-outlines.json.')


def int16(text):
    raw = base64.b64decode(text + '=' * (-len(text) % 4))
    return struct.unpack(f'<{len(raw) // 2}h', raw)


def commands(text):
    """The pen commands of a contour: M and L take one point, Q takes the count it names."""
    out, at = [], 0
    while at < len(text):
        op = text[at]
        at += 1
        digits = ''
        while at < len(text) and text[at].isdigit():
            digits += text[at]
            at += 1
        implied = at < len(text) and text[at] == '*'
        at += implied
        out.append((op, int(digits) if op == 'Q' else 1, implied))
    return out


def draw(pen, record):
    """The record's contours onto a TrueType pen, implied on-curve points made explicit."""
    for ops, light, _ in record['G']['p']:
        points = [value / 4 for value in int16(light)]
        at, open_ = 0, False
        for op, count, implied in commands(ops):
            if op == 'M':
                x, y = points[2 * at], points[2 * at + 1]
                at += 1
                if open_:
                    pen.closePath()
                pen.moveTo((x, y))
                open_ = True
            elif op == 'L':
                pen.lineTo((points[2 * at], points[2 * at + 1]))
                at += 1
            else:
                seg = [(points[2 * (at + k)], points[2 * (at + k) + 1]) for k in range(count)]
                at += count
                if implied:
                    start = ((seg[-1][0] + seg[0][0]) / 2, (seg[-1][1] + seg[0][1]) / 2)
                    if open_:
                        pen.closePath()
                    pen.moveTo(start)
                    seg.append(start)
                    open_ = True
                offs, end = seg[:-1], seg[-1]
                for k, off in enumerate(offs):
                    on = end if k + 1 == len(offs) else ((off[0] + offs[k + 1][0]) / 2, (off[1] + offs[k + 1][1]) / 2)
                    pen.qCurveTo(off, on)
        if open_:
            pen.closePath()


def ranges_of(points):
    """Sorted code points as compact CSS ranges."""
    out = []
    for point in points:
        if out and point == out[-1][1] + 1:
            out[-1][1] = point
        else:
            out.append([point, point])
    return out


def build(rows):
    """One shard's records as a font."""
    glyphs, cmap = {'.notdef': TTGlyphPen(None).glyph()}, {}
    for char in sorted(rows):
        pen = TTGlyphPen(None)
        draw(pen, rows[char])
        name = f'u{ord(char):05X}'
        glyphs[name] = pen.glyph()
        cmap[ord(char)] = name
    builder = FontBuilder(UPEM, isTTF=True)
    builder.setupGlyphOrder(list(glyphs))
    builder.setupCharacterMap(cmap)
    builder.setupGlyf(glyphs)
    # The ink's width plus its side bearings: a glyph never draws into its neighbour, and a box
    # centred in the em keeps equal bearings.
    glyf = builder.font['glyf']
    metrics = {}
    for name, glyph in glyphs.items():
        glyph.recalcBounds(glyf)
        if name == '.notdef' or glyph.xMin is None:
            metrics[name] = (UPEM, 0)
            continue
        bearing = max(0, glyph.xMin)
        metrics[name] = (max(1, glyph.xMax - glyph.xMin + 2 * bearing), glyph.xMin)
    builder.setupHorizontalMetrics(metrics)
    builder.setupHorizontalHeader(ascent=ASCENT, descent=DESCENT)
    builder.setupNameTable({'familyName': FAMILY, 'styleName': 'Regular',
                            'uniqueFontIdentifier': 'IDS Fallback', 'fullName': 'IDS Fallback',
                            'psName': 'IDSFallback-Regular', 'version': 'Version 1.0',
                            'copyright': COPYRIGHT,
                            'licenseDescription': COPYRIGHT})
    builder.setupOS2(sTypoAscender=ASCENT, sTypoDescender=DESCENT, usWinAscent=UPEM, usWinDescent=200)
    builder.setupPost(keepGlyphNames=False)
    builder.font['head'].created = builder.font['head'].modified = 2082844800
    builder.font.recalcTimestamp = False
    builder.font.flavor = 'woff2'
    return builder.font


def main():
    metadata = json.loads((ROOT / 'data/unicode-outlines.json').read_text())
    OUT.mkdir(exist_ok=True)
    for path in OUT.glob('*.woff2'):
        path.unlink()
    faces, files, points = [], {}, []
    for name in sorted(metadata['shards']):
        rows = json.loads(gzip.decompress((OUTLINES / f'{name}.json.gz').read_bytes()))
        target = OUT / f'{name}.woff2'
        build(rows).save(target)
        with TTFont(target) as font:
            if set(font.getBestCmap()) != {ord(char) for char in rows}:
                raise ValueError(f'{name}.woff2 does not carry every character of its shard')
        codes = sorted(ord(char) for char in rows)
        points.extend(codes)
        files[name] = {'count': len(rows), 'bytes': target.stat().st_size,
                       'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
        ranges = ','.join(f'U+{lo:X}' if lo == hi else f'U+{lo:X}-{hi:X}' for lo, hi in ranges_of(codes))
        faces.append(f'@font-face{{font-family:"{FAMILY}";src:url("./unicode/{name}.woff2") format("woff2");'
                     f'font-display:swap;unicode-range:{ranges}}}')
    css = ('/* The characters the composer can draw, as a webfont for text no installed font covers.\n'
           f'   Generated by scripts/build_unicode_font.py from {len(files)} shards; do not edit. */\n'
           + '\n'.join(faces) + '\n')
    (ROOT / 'fonts/unicode.css').write_text(css)
    doc = {'family': FAMILY, 'upem': UPEM, 'ascent': ASCENT, 'descent': DESCENT,
           'count': len(points), 'files': files,
           'sources': metadata['sources'], 'build': metadata['build']}
    (ROOT / 'fonts/unicode.json').write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n')
    total = sum(entry['bytes'] for entry in files.values())
    print(f'{len(points)} glyphs in {len(files)} shards, {total / 1e6:.2f} MB')


if __name__ == '__main__':
    main()
