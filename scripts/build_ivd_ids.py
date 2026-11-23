"""Describe every sequence of the Ideographic Variation Database by an IDS, from three witnesses.

A witness is a drawing of the sequence: GlyphWiki's glyph (whose drawings Jigmo also carries), the
glyph Noto Sans and Noto Serif CJK map the sequence to, and the glyph IPAmj明朝 maps it to. Each
witness reads the sequence two ways where it can:

- `same-glyph`: the witness draws the sequence with the very glyph it draws for an encoded
  character, in a face of a region (Noto's Korean face draws 臭 U+81ED with the glyph of 臭 E0101).
  BabelStone's IDS for that character in that region then describes the sequence.
- `components`: GlyphWiki builds the glyph from other glyphs, and their characters and places give
  an IDS (u81ed-j is u81ea-j above u5927-04-var-002: ⿱自大). A component that is itself a variation
  sequence in GlyphWiki stays one (邦 E0105 as ⿰丰󠄁阝).

A sequence's IDS is `agreed` where two witnesses give it, `single` where one does, and empty with
the status `conflict` or `unread` otherwise. Witnesses are compared with compatibility ideographs
read as their unified ones and with the selectors inside a description dropped.

    uv run --with fonttools python scripts/build_ivd_ids.py IVD_Sequences.txt \\
      dump_newest_only.txt IDS.TXT NotoSansCJK-Regular.ttc NotoSerifCJK-Regular.ttc ipamjm.ttf

Writes data/open-data/ivd/: sequences.tsv.gz, readings.tsv.gz, relations.tsv.gz and manifest.json.
"""
import collections
import gzip
import hashlib
import io
import json
import re
import sys
import unicodedata
from pathlib import Path

from fontTools.ttLib import TTCollection, TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/open-data/ivd'
IVD, DUMP, BABELSTONE, NOTO_SANS, NOTO_SERIF, IPAMJ = sys.argv[1:7]
SELECTOR = range(0xE0100, 0xE01F0)
# BabelStone's source letters by the GlyphWiki suffix and the Noto face that draws a region's form.
GW_REGION = {'g': 'G', 'h': 'H', 'm': 'M', 't': 'T', 'j': 'J', 'k': 'K', 'kp': 'P', 'v': 'V', 'u': 'U'}
FACE_REGION = {'SC': 'G', 'HK': 'H', 'TC': 'T', 'JP': 'J', 'KR': 'K'}


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as file:
        for block in iter(lambda: file.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def key(base, selector):
    return f'{base:04X} {selector:04X}'


# The registry: each sequence once, with every collection that registers it.
registrations = collections.defaultdict(list)
for line in open(IVD, encoding='utf-8'):
    if line.startswith('#') or not line.strip():
        continue
    points, collection, identifier = (field.strip() for field in line.split(';'))
    base, selector = (int(point, 16) for point in points.split())
    registrations[(base, selector)].append(f'{collection}:{identifier}')
sequences = sorted(registrations)

# BabelStone: each character's IDS by region.
babelstone = collections.defaultdict(dict)
for line in open(BABELSTONE, encoding='utf-8-sig'):
    if not line.startswith('U+'):
        continue
    fields = line.rstrip('\r\n').split('\t')
    for item in fields[2:]:
        found = re.fullmatch(r'\^(.+)\$\(([A-Z]+)\)', item)
        if found:
            for region in found.group(2):
                babelstone[fields[1]].setdefault(region, found.group(1))


ARITY = {**dict.fromkeys('⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻', 2), **dict.fromkeys('⿲⿳', 3)}


def whole(text):
    """Whether `text` is one complete description with an operator: each operator has its parts, and
    every part is a character, a character with a selector or a numbered component like {48}."""
    tokens = re.findall(r'\{\d+\}|.[\U000E0100-\U000E01EF]?', text or '')
    if not tokens or tokens[0] not in ARITY or '？' in text:
        return False
    need = 1
    for token in tokens:
        if need == 0:
            return False
        need += ARITY.get(token, 0) - 1
    return need == 0


def stated(char, region):
    """BabelStone's IDS for `char` in `region`, where it is a description; a compatibility
    ideograph has none."""
    found = babelstone.get(char, {}).get(region)
    return found if whole(found) else None


# GlyphWiki: every glyph's KAGE data.
glyphs, related = {}, {}
for line in open(DUMP, encoding='utf-8'):
    fields = line.split('|')
    if len(fields) != 3:
        continue
    name = fields[0].strip()
    if name and name != 'name' and not name.startswith('-'):
        glyphs[name] = fields[2].strip()
        related[name] = fields[1].strip()
ALIAS = re.compile(r'99:0:0:0:0:200:200:([^:$]+)(?::0:0:0)?')


def head(name):
    """The glyph a name stands for after its aliases, without a revision pin."""
    seen = set()
    name = name.split('@')[0]
    while name not in seen:
        seen.add(name)
        found = ALIAS.fullmatch(glyphs.get(name, ''))
        if not found:
            return name
        name = found.group(1).split('@')[0]
    return name


def component_char(name, of):
    """The character a component glyph writes: a variation sequence, a character, or the one
    GlyphWiki relates it to. A part of the character being described writes nothing."""
    name = name.split('@')[0]
    found = re.fullmatch(r'u([0-9a-f]{4,6})-u(e01[0-9a-f]{2})', name)
    if found:
        text = chr(int(found.group(1), 16)) + chr(int(found.group(2), 16))
    else:
        found = re.match(r'u([0-9a-f]{4,6})(?:-|$)', name)
        rel = related.get(name, 'u3013')
        if found:
            text = chr(int(found.group(1), 16))
        elif rel != 'u3013' and re.fullmatch(r'u[0-9a-f]{4,6}', rel):
            text = chr(int(rel[1:], 16))
        else:
            return None
    return None if text[0] == of else text


def named_ids(name):
    """The IDS a glyph's name spells, as in u2ff1-u81ea-u72ae."""
    name = re.sub(r'-var-\d+$', '', name.split('@')[0])
    if not name.startswith('u2ff'):
        return None
    parts = [re.fullmatch(r'u([0-9a-f]{4,6})', part) for part in name.split('-')]
    return ''.join(chr(int(part.group(1), 16)) for part in parts) if all(parts) else None


ink_boxes = {}


def ink(name, depth=0):
    """A glyph's ink box in its own 200-unit square, from its strokes' points."""
    name = head(name)
    if name in ink_boxes:
        return ink_boxes[name]
    ink_boxes[name] = None
    xs, ys = [], []
    for row in glyphs.get(name, '').split('$') if depth < 12 else ():
        fields = row.split(':')
        try:
            if fields[0] == '99':
                x1, y1, x2, y2 = map(float, fields[3:7])
                box = ink(fields[7], depth + 1)
                if box:
                    sx, sy = (x2 - x1) / 200, (y2 - y1) / 200
                    xs += [x1 + box[0] * sx, x1 + box[2] * sx]
                    ys += [y1 + box[1] * sy, y1 + box[3] * sy]
            elif fields[0] not in ('0', ''):
                points = list(map(float, fields[3:]))
                xs += points[0::2]
                ys += points[1::2]
        except ValueError:
            continue
    ink_boxes[name] = (min(xs), min(ys), max(xs), max(ys)) if xs else None
    return ink_boxes[name]


# GlyphWiki names a component by the place it takes: 01 and 02 side by side, 03 and 04 one above the
# other, 05, 06, 10 and 11 around another part.
ACROSS, DOWN, AROUND = {'01', '02', '07', '08'}, {'03', '04', '09', '14'}, {'05', '06', '10', '11'}
TOLERANCE = 12


def place(name):
    found = re.match(r'u[0-9a-f]+-(?:[a-z]+)?(\d\d)', name.split('@')[0])
    return found.group(1) if found else ''


def cut(items, axis, loose):
    """The parts in order along an axis, and where a line between them falls."""
    low, high = axis, axis + 2
    order = sorted(items, key=lambda item: (item[0][low] + item[0][high]) / 2)
    cuts = []
    for at in range(1, len(order)):
        before, after = order[:at], order[at:]
        end, start = max(i[0][high] for i in before), min(i[0][low] for i in after)
        extent = min(end - min(i[0][low] for i in before), max(i[0][high] for i in after) - start)
        if end - start <= (max(TOLERANCE, 0.45 * extent) if loose else TOLERANCE):
            cuts.append(at)
    return order, cuts


def arrange(items):
    """An IDS from placed parts, each (ink box, text, glyph name)."""
    if len(items) == 1:
        return items[0][1]
    places = {place(item[2]) for item in items}
    around = [item for item in items if place(item[2]) in AROUND]
    if not around:
        axes = [1] if places & DOWN and not places & ACROSS else [0] if places & ACROSS and not places & DOWN else [1, 0]
        for loose in (False, True):
            for axis in axes:
                two, three = ('⿱', '⿳') if axis else ('⿰', '⿲')
                order, cuts = cut(items, axis, loose or len(axes) == 1)
                if not cuts:
                    continue
                if len(order) == 3 and cuts == [1, 2]:
                    parts = [arrange([item]) for item in order]
                    return three + ''.join(parts) if all(parts) else None
                first, rest = arrange(order[:cuts[0]]), arrange(order[cuts[0]:])
                return two + first + rest if first and rest else None
    outer = around[0] if around else max(items, key=lambda item: (item[0][2] - item[0][0]) * (item[0][3] - item[0][1]))
    inner = [item for item in items if item is not outer]
    inside = arrange(inner)
    if not inside:
        return None
    x1, y1, x2, y2 = outer[0]
    w, h = x2 - x1, y2 - y1
    open_sides = ''.join(side for side, gap in (
        ('l', min(i[0][0] for i in inner) - x1), ('t', min(i[0][1] for i in inner) - y1),
        ('r', x2 - max(i[0][2] for i in inner)), ('b', y2 - max(i[0][3] for i in inner))) if gap < 0.12 * (w if side in 'lr' else h))
    operator = {'': '⿴', 'b': '⿵', 't': '⿶', 'r': '⿷', 'rb': '⿸', 'lb': '⿹', 'tr': '⿺'}.get(open_sides, '⿻')
    return operator + outer[1] + inside


def components(name, of):
    """The IDS a GlyphWiki glyph's components give, or None where it has strokes of its own."""
    name = head(name)
    spelled = named_ids(name)
    if spelled:
        return spelled
    rows = glyphs.get(name, '').split('$')
    if not rows or any(not row.startswith('99:') for row in rows):
        return None
    items = []
    for row in rows:
        fields = row.split(':')
        x1, y1, x2, y2 = map(float, fields[3:7])
        box, text = ink(fields[7]), named_ids(head(fields[7])) or component_char(fields[7], of)
        if not box or not text:
            return None
        sx, sy = (x2 - x1) / 200, (y2 - y1) / 200
        items.append(((x1 + box[0] * sx, y1 + box[1] * sy, x1 + box[2] * sx, y1 + box[3] * sy), text, fields[7]))
    return arrange(items)


# The encoded forms each GlyphWiki glyph is: a character's own glyph, its glyph for a region, or a
# compatibility ideograph's.
ENCODED = re.compile(r'u([0-9a-f]{4,5})(?:-(g|h|m|t|j|k|kp|v|u))?')
gw_encoded = collections.defaultdict(list)
for name in glyphs:
    found = ENCODED.fullmatch(name)
    if found:
        code = int(found.group(1), 16)
        if unicodedata.category(chr(code)) == 'Lo' and 'CJK' in unicodedata.name(chr(code), ''):
            gw_encoded[head(name)].append((chr(code), GW_REGION.get(found.group(2) or '')))


def font_faces(path):
    if path.endswith('.ttc'):
        collection = TTCollection(path, lazy=True)
        return [(font['name'].getDebugName(4), font) for font in collection.fonts]
    font = TTFont(path, lazy=True)
    return [(font['name'].getDebugName(4), font)]


def font_witness(paths, name, region_of):
    """Each sequence's glyph in a family of faces that share one glyph table, and the encoded forms
    that glyph is in any of those faces."""
    drawn, encoded = {}, collections.defaultdict(list)
    for path in paths:
        for face, font in font_faces(path):
            if 'Mono' in face:
                continue
            cmap = font.getBestCmap()
            for code, glyph in cmap.items():
                char = chr(code)
                if 'CJK' in unicodedata.name(char, '') and unicodedata.category(char) == 'Lo':
                    encoded[(Path(path).name, glyph)].append((char, region_of(face)))
            for table in font['cmap'].tables:
                if table.format != 14:
                    continue
                for selector, pairs in table.uvsDict.items():
                    for base, glyph in pairs:
                        if (base, selector) in registrations:
                            drawn.setdefault((base, selector), (Path(path).name, glyph if glyph is not None else cmap.get(base)))
    return {'name': name, 'drawn': drawn, 'encoded': encoded}


noto = font_witness([NOTO_SANS, NOTO_SERIF], 'noto', lambda face: FACE_REGION.get(face.split()[-1]))
ipamj = font_witness([IPAMJ], 'ipamj', lambda face: 'J')


def plain(text):
    """A description as witnesses are compared: compatibility ideographs read as unified ones, no
    selector inside it, and every part written out to the end of BabelStone's descriptions (its
    Japanese one where it has one), so ⿰氵卂 and ⿰氵⿹⺄𠂇 compare equal."""
    text = ''.join(unicodedata.normalize('NFC', char) for char in text if ord(char) not in SELECTOR)
    return ''.join(spelled(char, 0) for char in text)


def spelled(char, depth):
    found = babelstone.get(char, {})
    description = found.get('J') or next(iter(found.values()), None)
    if depth > 20 or not description or description == char or len(description) < 2 or not description[0] in '⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻':
        return char
    return ''.join(spelled(part, depth + 1) for part in description)


readings, relations, records = [], [], []
by_glyph = collections.defaultdict(list)
for base, selector in sequences:
    sequence = key(base, selector)
    char = chr(base)
    found = []
    # GlyphWiki.
    gw_name = f'u{base:x}-u{selector:x}'
    if gw_name in glyphs:
        glyph = head(gw_name)
        by_glyph[('glyphwiki', glyph)].append((base, selector))
        for other, region in gw_encoded.get(glyph, []):
            relations.append((sequence, 'same-glyph', f'U+{ord(other):04X}' + (f'({region})' if region else ''), 'glyphwiki', glyph))
            if region and stated(other, region):
                found.append(('glyphwiki', glyph, 'same-glyph', f'U+{ord(other):04X}({region})', stated(other, region)))
        read = components(gw_name, char)
        if whole(read):
            found.append(('glyphwiki', glyph, 'components', '', read))
    # The fonts.
    for witness in (noto, ipamj):
        drawn = witness['drawn'].get((base, selector))
        if not drawn:
            continue
        file, glyph = drawn
        by_glyph[(witness['name'], f'{file}:{glyph}')].append((base, selector))
        for other, region in witness['encoded'].get(drawn, []):
            relations.append((sequence, 'same-glyph', f'U+{ord(other):04X}' + (f'({region})' if region else ''), witness['name'], f'{file}:{glyph}'))
            if region and stated(other, region):
                found.append((witness['name'], f'{file}:{glyph}', 'same-glyph', f'U+{ord(other):04X}({region})', stated(other, region)))
    for witness, glyph, method, anchor, ids in found:
        readings.append((sequence, witness, glyph, method, anchor, ids))
    # Each witness gives one IDS: its same-glyph readings where they agree, else its components.
    given = {}
    for witness in ('glyphwiki', 'noto', 'ipamj'):
        mine = [r for r in found if r[0] == witness]
        transfers = {plain(r[4]) for r in mine if r[2] == 'same-glyph'}
        read = [r[4] for r in mine if r[2] == 'components']
        if len(transfers) == 1:
            given[witness] = next(r[4] for r in mine if r[2] == 'same-glyph')
        elif not transfers and read:
            given[witness] = read[0]
    agreeing = collections.Counter(plain(ids) for ids in given.values())
    if not given:
        status, ids = 'unread', ''
    elif len(agreeing) > 1:
        status, ids = 'conflict', ''
    else:
        status = 'agreed' if len(given) > 1 else 'single'
        ids = next(iter(given.values()))
    # A finer description: GlyphWiki's components, where they name a component's form and agree.
    finer = next((r[4] for r in found if r[2] == 'components' and any(ord(c) in SELECTOR for c in r[4]) and plain(r[4]) == plain(ids)), '') if ids else ''
    records.append({'sequence': sequence, 'text': char + chr(selector), 'registrations': registrations[(base, selector)],
                    'ids': ids, 'finer': finer, 'status': status, 'witnesses': sorted(given)})

# Two sequences one witness draws with one glyph are one form there.
for (witness, glyph), members in by_glyph.items():
    for (b1, s1), (b2, s2) in zip(members, members[1:]):
        relations.append((key(b1, s1), 'same-glyph', key(b2, s2), witness, glyph))

# A sequence whose IDS a sibling shares though some witness draws the two differently is not told
# apart by it.
glyph_of = collections.defaultdict(dict)
for (witness, glyph), members in by_glyph.items():
    for member in members:
        glyph_of[member][witness] = glyph
by_base = collections.defaultdict(list)
for record, (base, selector) in zip(records, sequences):
    by_base[base].append((record, (base, selector)))
for siblings in by_base.values():
    for record, pair in siblings:
        record['undistinguished'] = [
            other['sequence'] for other, other_pair in siblings if other is not record and record['ids'] and
            plain(record['finer'] or record['ids']) == plain(other['finer'] or other['ids']) and
            any(glyph_of[pair].get(w) and glyph_of[other_pair].get(w) and glyph_of[pair][w] != glyph_of[other_pair][w] for w in ('glyphwiki', 'noto', 'ipamj'))]

OUT.mkdir(parents=True, exist_ok=True)


def table(name):
    """A gzipped table that is the same bytes for the same rows."""
    return io.TextIOWrapper(gzip.GzipFile(OUT / name, 'wb', mtime=0), encoding='utf-8', newline='')


with table('sequences.tsv.gz') as file:
    file.write('sequence\ttext\tregistrations\tids\tfiner\tstatus\twitnesses\tundistinguished\n')
    for r in records:
        file.write('\t'.join([r['sequence'], r['text'], ' '.join(r['registrations']), r['ids'], r['finer'], r['status'],
                              ' '.join(r['witnesses']), ';'.join(r['undistinguished'])]) + '\n')
with table('readings.tsv.gz') as file:
    file.write('sequence\twitness\tglyph\tmethod\tanchor\tids\n')
    for row in readings:
        file.write('\t'.join(row) + '\n')
with table('relations.tsv.gz') as file:
    file.write('sequence\trelation\tother\twitness\tglyph\n')
    for row in sorted(set(relations)):
        file.write('\t'.join(row) + '\n')
counts = collections.Counter(r['status'] for r in records)
manifest = {
    'format': 'ids-input/ivd-ids', 'version': 1, 'licence': 'CC0-1.0',
    'sequences': len(records), 'registrations': sum(len(v) for v in registrations.values()),
    'status': dict(sorted(counts.items())),
    'finer': sum(bool(r['finer']) for r in records),
    'undistinguished': sum(bool(r['undistinguished']) for r in records),
    'inputs': {Path(path).name: sha256(path) for path in (IVD, DUMP, BABELSTONE, NOTO_SANS, NOTO_SERIF, IPAMJ)},
}
(OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in manifest.items() if k != 'inputs'}, ensure_ascii=False))
