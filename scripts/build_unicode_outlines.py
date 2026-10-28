# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0"]
# ///
"""Build sharded fallback outlines from the pinned fonts in data/unicode-fonts.json.

uv run scripts/build_unicode_outlines.py FONT_DIR [FONT_DIR ...]
Source directories contain the pinned Noto, Jigmo and Unifont files.
"""
import gzip
import hashlib
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.perimeterPen import PerimeterPen
from build_tangut_outlines import Contours

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/unicode-outlines'


def main():
    directories = [Path(arg) for arg in sys.argv[1:]]
    lock = json.loads((ROOT / 'data/unicode-fonts.json').read_text())
    sources = lock['fonts']
    # Eligibility is the same pinned Unicode table used by the parser.
    properties = json.loads((ROOT / 'data/unicode-properties.json').read_text())
    allowed = {cp for lo, hi in properties['graphic'] for cp in range(lo, hi + 1)}
    # Preserve existing fallbacks; omit host CJK glyphs only when an actual record exists.
    host = json.loads((ROOT / 'data/host-glyph-coverage.json').read_text())
    host_points = {cp for lo, hi in host['ranges'] for cp in range(lo, hi + 1)}
    host_ranges = [(0x2E80, 0x2FDF), (0x3400, 0x4DBF), (0x4E00, 0x9FFF),
                   (0xF900, 0xFAFF), (0x20000, 0x323AF), (0x33480, 0x3CFFF)]
    for lo, hi in host_ranges:
        allowed.difference_update(host_points.intersection(range(lo, hi + 1)))
    # Dedicated bundles have holes too. Their exact records are the coverage boundary.
    for name in ['tangut', 'bopomofo', 'small-seal', 'palette']:
        bundle = json.loads(gzip.decompress((ROOT / f'data/{name}-outlines.json.gz').read_bytes()))
        allowed.difference_update(ord(key) for key, record in bundle['records'].items()
                                  if len(key) == 1 and record.get('G', {}).get('p'))
    for lo, hi in [(0xE000, 0xF8FF), (0xF0000, 0xFFFFD), (0x100000, 0x10FFFD)]:
        allowed.difference_update(range(lo, hi + 1))
    allowed.difference_update([0x2B1A, 0xFF0B, 0x303E, *range(0x2FF0, 0x3000)])
    records, provenance = {}, []
    for source in sources:
        path = next((directory / source['file'] for directory in directories if (directory / source['file']).is_file()), None)
        if path is None:
            raise ValueError(f"Missing font: {source['file']}")
        if hashlib.sha256(path.read_bytes()).hexdigest() != source['sha256']:
            raise ValueError(f"Checksum mismatch: {source['file']}")
        with TTFont(path) as font:
            cmap = font.getBestCmap()
            points = sorted(allowed.intersection(cmap).difference(records))
            if not points:
                continue
            scale = 1000 / font['head'].unitsPerEm
            glyphs = font.getGlyphSet(location={'wght': 400}) if 'fvar' in font else font.getGlyphSet()
            count = 0
            for point in points:
                glyph = glyphs[cmap[point]]
                bounds = BoundsPen(glyphs)
                glyph.draw(bounds)
                if not bounds.bounds or bounds.bounds[0] == bounds.bounds[2] or bounds.bounds[1] == bounds.bounds[3]:
                    continue
                pen, perimeter = Contours(glyphs, scale), PerimeterPen(glyphs)
                # https://fonttools.readthedocs.io/en/latest/pens/cu2quPen.html
                glyph.draw(Cu2QuPen(pen, max_err=0.5 / scale))
                glyph.draw(perimeter)
                if not pen.contours:
                    continue
                char = chr(point)
                records[point] = {'k': char, 'G': {'v': 0, 'b': [round(v * scale, 4) for v in bounds.bounds], 'p': pen.contours},
                                  'ink': round(perimeter.value * scale, 4), 'o': len(pen.contours)}
                count += 1
            if count:
                provenance.append({**source, 'count': count, 'copyright': font['name'].getDebugName(0)})
    for source in lock.get('svgSources', []):
        raw = (ROOT / 'data' / source['file']).read_bytes()
        if hashlib.sha256(raw).hexdigest() != source['sha256']:
            raise ValueError(f"Checksum mismatch: {source['file']}")
        rows = json.loads(gzip.decompress(raw))
        count = 0
        for char, row in rows.items():
            point = ord(char)
            if point not in allowed or point in records:
                continue
            if hashlib.sha256(row['svg'].encode()).hexdigest() != row['sha256']:
                raise ValueError(f'SVG checksum mismatch: U+{point:04X}')
            svg = ET.fromstring(row['svg'])
            if svg.attrib.get('viewBox') != '0 0 200 200':
                raise ValueError('Unexpected GlyphWiki viewBox')
            pen, bounds, perimeter = Contours(None, 1), BoundsPen(None), PerimeterPen(None)
            paths = list(svg.iter('{http://www.w3.org/2000/svg}path'))
            if any('transform' in element.attrib for element in svg.iter()):
                raise ValueError('SVG transform needs explicit handling')
            for path in paths:
                for target in [Cu2QuPen(pen, max_err=0.5), bounds, perimeter]:
                    parse_path(path.attrib['d'], TransformPen(target, (5, 0, 0, -5, 0, 880)))
            if not pen.contours or not bounds.bounds:
                raise ValueError(f'Empty SVG: U+{point:04X}')
            records[point] = {'k': char, 'G': {'v': 0, 'b': list(bounds.bounds), 'p': pen.contours},
                              'ink': round(perimeter.value, 4), 'o': len(pen.contours)}
            count += 1
        provenance.append({**source, 'count': count})
    shards, ranges = {}, []
    for point, record in sorted(records.items()):
        shards.setdefault(f'{point >> 8:03x}', {})[chr(point)] = record
        if ranges and point == ranges[-1][1] + 1:
            ranges[-1][1] = point
        else:
            ranges.append([point, point])
    OUT.mkdir(exist_ok=True)
    # This directory contains generated shards only.
    for path in OUT.glob('*.json.gz'):
        path.unlink()
    metadata = {}
    for name, rows in shards.items():
        raw = json.dumps(rows, ensure_ascii=False, separators=(',', ':')).encode()
        data = bytearray(gzip.compress(raw, compresslevel=9, mtime=0))
        data[9] = 255  # Stable OS header across Python 3.11+ and operating systems.
        data = bytes(data)
        (OUT / f'{name}.json.gz').write_bytes(data)
        metadata[name] = {'count': len(rows), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    (ROOT / 'data/unicode-coverage.json').write_text(json.dumps(ranges, separators=(',', ':')) + '\n')
    (ROOT / 'data/unicode-outlines.json').write_text(json.dumps({'build': {'unicode': properties['version'], 'fonttools': '4.63.0', 'quantization': 4}, 'count': len(records), 'ranges': ranges,
        'shards': metadata, 'sources': provenance}, ensure_ascii=False, separators=(',', ':')) + '\n')
    # Report every remaining assigned candidate, rather than hiding holes behind block ranges.
    missing = allowed.difference(records)
    blocks = []
    from build_unicode_properties import text as unicode_text, ranges as compact_ranges
    for line in unicode_text('Blocks.txt').splitlines():
        content = line.split('#')[0].strip()
        if not content:
            continue
        span, name = content.split(';')
        lo, hi = (int(value, 16) for value in span.strip().split('..'))
        points = missing.intersection(range(lo, hi + 1))
        if points:
            blocks.append({'block': name.strip(), 'count': len(points), 'ranges': compact_ranges(points)})
    (ROOT / 'data/unicode-outline-gaps.json').write_text(json.dumps({
        'unicode': properties['version'], 'scope': 'Assigned fallback candidates excluding exact dedicated-bundle records and pinned host CJK outlines; private use excluded',
        'count': len(missing), 'blocks': blocks}, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(records)} outlines, {len(shards)} shards, {sum(x["bytes"] for x in metadata.values())} compressed bytes', flush=True)


if __name__ == '__main__':
    main()
