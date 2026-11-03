# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0"]
# ///
"""Build the fallback webfont from the bundled Unicode outline shards.

uv run scripts/build_unicode_font.py

The composer already draws these characters as outlines; this writes the same shapes as a webfont,
one file per 256-code-point shard, so text surfaces fall back to them when no installed font has the
character. Coverage, metrics and provenance come from data/unicode-outlines.json and its shards.

Characters the app shows but cannot draw -- palette parts, the empty-slot mark and the radicals --
come from Jigmo, the CC0 glyphs of GlyphWiki, with `--jigmo JIGMO.ttf`. The app asks for the shard of
a character only when it first shows one the reader's fonts lack, so the whole set never loads at once.
"""
import argparse
import base64
import gzip
import hashlib
import json
import struct
import urllib.request
import zipfile
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
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


# The shards are cut from the pinned sources for everything but the CJK area: their radicals sit
# between the Unified Ideographs and Extension A, and their compatibility ideographs take no
# outlines, so these are filled from Jigmo and Unifont instead.
UNIFONT_CREDIT = 'Compatibility ideographs: Unifont 18.0.01, SIL OFL 1.1'
JIGMO = 'https://kamichikoichi.github.io/jigmo/Jigmo-20250912.zip'
JIGMO_CACHE = Path.home() / '.cache/ids-input/Jigmo-20250912'
UNIFONT = 'https://unifoundry.com/pub/unifont/unifont-18.0.01/font-builds/unifont-18.0.01.otf'
UNIFONT_CACHE = Path.home() / '.cache/ids-input/unifont-18.0.01.otf'
EMPTY = ROOT / 'fonts/NotoSansCJKjp-ids-operators.woff2'



def jigmo():
    """Jigmo's glyph set and its cubic glyphs, fetched and unpacked once."""
    if not JIGMO_CACHE.exists():
        JIGMO_CACHE.mkdir(parents=True, exist_ok=True)
        archive = JIGMO_CACHE / 'Jigmo.zip'
        if not archive.exists():
            urllib.request.urlretrieve(JIGMO, archive)
        with zipfile.ZipFile(archive) as bundle:
            for name in ('Jigmo.ttf', 'LICENSE.txt', 'README.txt'):
                bundle.extract(name, JIGMO_CACHE)
    return TTFont(JIGMO_CACHE / 'Jigmo.ttf')


def unifont():
    """Unifont's glyphs, fetched once: it draws the CJK radicals between the Unified Ideographs and
    Extension A, and the compatibility ideographs, that Jigmo leaves out."""
    if not UNIFONT_CACHE.exists():
        UNIFONT_CACHE.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(UNIFONT, UNIFONT_CACHE)
    return TTFont(UNIFONT_CACHE)


def han_ideographs():
    """The Han ideographs the app shows that a reader's own CJK font may lack: the standard ones (CJK
    Unified Ideographs, Extension A and Compatibility Ideographs). The extensions of the supplementary
    planes stay with the reader's font; the composer's own characters already have outlines."""
    return [chr(code) for code in (*range(0x9FFF + 1), *range(0xF900, 0xFADA)) if code >= 0x4E00]


VISIBLE = set()


def characters_without_outline(metadata):
    """The characters the app shows that no bundled outline draws: palette parts, their fallbacks,
    the characters the palette draws from its own outlines, the empty-slot mark, the description
    characters, the bopomofo bundle and the standard Han ideographs."""
    drawn = set()
    drawn.update(VISIBLE)
    palette = json.loads((ROOT / 'data/ids-parts.json').read_text())
    records = palette if isinstance(palette, list) else palette['parts']
    needed = {'⬚'}
    for record in records:
        value = record[0] if isinstance(record, list) else record.get('part')
        if isinstance(value, str):
            needed.update(value)
    needed.update(json.loads((ROOT / 'data/palette-fallback-characters.json').read_text()))
    needed.update(json.loads(gzip.decompress((ROOT / 'data/palette-outlines.json.gz').read_bytes()))['records'])
    # The bopomofo palette draws from its own outline bundle, which no webfont face carries.
    needed.update(json.loads(gzip.decompress((ROOT / 'data/bopomofo-outlines.json.gz').read_bytes()))['records'])
    needed.update(chr(code) for code in range(0x2FF0, 0x2FFC))
    needed.update(han_ideographs())
    return sorted(char for char in needed if char not in drawn)


class ScalePen:
    """A glyph drawn at another size, through the pen it is drawn into."""

    def __init__(self, glyph, scale):
        self.glyph, self.scale = glyph, scale

    def draw(self, pen):
        self.glyph.draw(TransformPen(pen, (self.scale, 0, 0, self.scale, 0, 0)))


def jigmo_glyphs(font, chars):
    """The glyphs Jigmo draws among `chars`, converted from its cubic contours."""
    glyphs, cmap, scale = font.getGlyphSet(), font.getBestCmap(), UPEM / font['head'].unitsPerEm
    found = {char: ScalePen(glyphs[cmap[ord(char)]], scale) for char in chars if ord(char) in cmap}
    # The empty-slot mark comes from Noto Sans CJK, which draws it as a dashed box.
    with TTFont(EMPTY) as noto:
        found['⬚'] = ScalePen(noto.getGlyphSet()[noto.getBestCmap()[0x2FFB]], UPEM / noto['head'].unitsPerEm)
    return found


def build(rows, extra=None, family=FAMILY):
    """One shard's records as a font, with any extra characters' glyphs drawn by `extra`."""
    glyphs, cmap = {'.notdef': TTGlyphPen(None).glyph()}, {}
    for char in sorted({**rows, **(extra or {})}):
        pen = TTGlyphPen(None)
        if char in rows:
            draw(pen, rows[char])
        else:
            # Jigmo draws on a 1024-unit em; the metrics below scale every glyph to the shard's 1000.
            (extra or {})[char].draw(TransformPen(pen, (1, 0, 0, 1, 0, 0)))
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
    builder.setupNameTable({'familyName': family, 'styleName': 'Regular',
                            'uniqueFontIdentifier': family.replace(' ', ''), 'fullName': family,
                            'psName': family.replace(' ', '') + '-Regular', 'version': 'Version 1.0',
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
    outlines = {path.name.split('.')[0] for path in OUTLINES.glob('*.json.gz')}
    global VISIBLE
    VISIBLE = {char for name in outlines
               for char in json.loads(gzip.decompress((OUTLINES / f'{name}.json.gz').read_bytes()))}
    needed = characters_without_outline(metadata)
    fill = jigmo_glyphs(jigmo(), needed)
    wanted = [char for char in needed if char not in fill]
    fill.update(jigmo_glyphs(unifont(), wanted))
    # A shard per range that holds anything: the composer's outlines, or the characters a font fills
    # in. The app finds a character's shard by its range, so every filled range needs its own file.
    by_shard = {}
    for char, glyph in fill.items():
        by_shard.setdefault(f'{ord(char) >> 8:03x}', {})[char] = glyph
    shard_names = outlines | set(by_shard)
    for path in OUT.glob('*.woff2'):
        path.unlink()
    faces, files, points = [], {}, []
    for name in sorted(shard_names):
        rows = (json.loads(gzip.decompress((OUTLINES / f'{name}.json.gz').read_bytes()))
                if name in outlines else {})
        extra = {char: glyph for char, glyph in by_shard.pop(name, {}).items() if char not in rows}
        target = OUT / f'{name}.woff2'
        build(rows, extra).save(target)
        with TTFont(target) as font:
            if set(font.getBestCmap()) != {ord(char) for char in rows} | {ord(char) for char in extra}:
                raise ValueError(f'{name}.woff2 does not carry every character of its shard')
        # The range the shard declares is what it holds: the faces carry no range of their own, and a
        # character outside the declared range would fall to the next face instead of this one.
        codes = sorted({ord(char) for char in rows} | {ord(char) for char in extra})
        files[name] = {'count': len(rows) + len(extra), 'bytes': target.stat().st_size,
                       'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
        if extra:
            files[name]['fill'] = len(extra)
        ranges = ','.join(f'U+{lo:X}' if lo == hi else f'U+{lo:X}-{hi:X}' for lo, hi in ranges_of(codes))
        faces.append(f'@font-face{{font-family:"{FAMILY}";font-style:oblique 0deg;'
                     f'src:url("./unicode/{name}.woff2") format("woff2");font-display:swap;unicode-range:{ranges}}}')
    if by_shard:
        raise ValueError(f'glyphs outside the shards: {sorted(by_shard)}')
    css = ('/* The characters the composer can draw, as a webfont for text no installed font covers.\n'
           f'   Generated by scripts/build_unicode_font.py from {len(files)} shards; do not edit. */\n'
           + '\n'.join(faces) + '\n')
    (ROOT / 'fonts/unicode.css').write_text(css)
    doc = {'family': FAMILY, 'upem': UPEM, 'ascent': ASCENT, 'descent': DESCENT,
           'count': sum(entry['count'] for entry in files.values()), 'fill': len(fill),
           'files': files, 'sources': metadata['sources'], 'build': metadata['build']}
    (ROOT / 'fonts/unicode.json').write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n')
    total = sum(entry['bytes'] for entry in files.values())
    print(f'{doc["count"]} glyphs in {len(files)} shards, {total / 1e6:.2f} MB, {len(fill)} filled')


if __name__ == '__main__':
    main()
