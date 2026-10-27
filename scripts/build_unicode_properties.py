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


def build():
    graphic, letters = set(), set()
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
    invisible = prop('Default_Ignorable_Code_Point', 'DerivedCoreProperties.txt')
    ideographic = prop('Ideographic', 'PropList.txt') | prop('Radical', 'PropList.txt')
    return {'version': '18.0.0', 'graphic': ranges(graphic - invisible),
            'letters': ranges(letters - invisible - ideographic), 'ideographic': ranges(ideographic)}


if __name__ == '__main__':
    (ROOT / 'data/unicode-properties.json').write_text(json.dumps(build(), separators=(',', ':')) + '\n')
