"""Generate runtime-independent Unicode 18.0.0 character tables from pinned UCD snapshots."""
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/unicode-18.0.0'


def text(name):
    raw = gzip.decompress((SOURCE / (name + '.gz')).read_bytes())
    expected = json.loads((SOURCE / 'sources.json').read_text())['files'][name]['sha256']
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError(f'Unicode source checksum mismatch: {name}')
    return raw.decode()


def prop(name, source):
    points = set()
    for line in text(source).splitlines():
        fields = line.split('#')[0].strip().split(';')
        if len(fields) < 2 or fields[1].strip() != name:
            continue
        ends = fields[0].strip().split('..')
        points.update(range(int(ends[0], 16), int(ends[-1], 16) + 1))
    return points


def ranges(points):
    out = []
    for point in sorted(points):
        if out and point == out[-1][1] + 1:
            out[-1][1] = point
        else:
            out.append([point, point])
    return out


def superscript(point):
    """A superscript or subscript digit (No), as a loose mark may be written after a description."""
    return point in (0xB2, 0xB3, 0xB9) or 0x2070 <= point <= 0x209F


def tone_symbol(point):
    """A modifier symbol for an accent or a tone letter (Sk), read as a loose mark."""
    return point in (0xA8, 0xAF, 0xB4, 0xB8) or 0x2D2 <= point <= 0x2DF or 0x2E5 <= point <= 0x2ED \
        or 0x309B <= point <= 0x309C or 0xA700 <= point <= 0xA71F


def build():
    graphic, letters, marks = set(), set(), set()
    start = None
    for line in text('UnicodeData.txt').splitlines():
        code, name, category, *_ = line.split(';')
        point = int(code, 16)
        if name.endswith(', First>'):
            start = point
            continue
        points = range(start if name.endswith(', Last>') else point, point + 1)
        if category[0] in 'LMNPS' or category == 'Co':
            graphic.update(points)
        if category.startswith('L') or category == 'Nd':
            letters.update(points)
        if category.startswith('M') or category == 'Lm' \
                or category == 'No' and all(superscript(p) for p in points) \
                or category == 'Sk' and all(tone_symbol(p) for p in points):
            marks.update(points)
    invisible = prop('Default_Ignorable_Code_Point', 'DerivedCoreProperties.txt')
    ideographic = prop('Ideographic', 'PropList.txt') | prop('Radical', 'PropList.txt')
    return {'version': '18.0.0', 'graphic': ranges(graphic - invisible),
            'letters': ranges(letters - invisible - ideographic), 'ideographic': ranges(ideographic),
            'marks': ranges(marks - invisible)}


if __name__ == '__main__':
    (ROOT / 'data/unicode-properties.json').write_text(json.dumps(build(), separators=(',', ':')) + '\n')
