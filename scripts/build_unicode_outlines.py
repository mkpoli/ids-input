# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0"]
# ///
"""Build sharded fallback outlines from the pinned fonts in data/unicode-fonts.json.

uv run scripts/build_unicode_outlines.py FONT_DIR [FONT_DIR ...]
Source directories may be extracted Ubuntu Noto packages and the Noto CJK cache.
"""
import gzip
import hashlib
import json
import subprocess
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.perimeterPen import PerimeterPen
from build_tangut_outlines import Contours

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/unicode-outlines'


def main():
    directories = [Path(arg) for arg in sys.argv[1:]]
    lock = json.loads((ROOT / 'data/unicode-fonts.json').read_text())
    sources = lock['fonts']
    bun = subprocess.check_output(['bun', '--version'], text=True).strip()
    if bun != lock['bun']:
        raise ValueError(f"Bun {lock['bun']} is required for reproducible Unicode coverage (found {bun})")
    # Share the runtime's Unicode version and the editor's exclusions. Existing ideograph,
    # radical, stroke, Tangut, Bopomofo and Small Seal sources already cover their ranges.
    allowed = set(json.loads(subprocess.check_output(['bun', '-e', '''
import { isComponent } from './src/core/ids.js';
const existing = /[\\u2E80-\\u2FDF\\u3105-\\u312F\\u31A0-\\u31EF\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF\\u{17000}-\\u{18AFF}\\u{18D00}-\\u{18DFF}\\u{20000}-\\u{3FFFD}]/u;
const points=[];
for(let cp=0;cp<=0x10FFFF;cp++){const ch=String.fromCodePoint(cp);if(isComponent(ch)&&!existing.test(ch))points.push(cp)}
console.log(JSON.stringify(points));
'''], cwd=ROOT, text=True)))
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
    (ROOT / 'data/unicode-outlines.json').write_text(json.dumps({'build': {'bun': bun, 'fonttools': '4.63.0', 'quantization': 4}, 'count': len(records), 'ranges': ranges,
        'shards': metadata, 'sources': provenance}, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'{len(records)} outlines, {len(shards)} shards, {sum(x["bytes"] for x in metadata.values())} compressed bytes', flush=True)


if __name__ == '__main__':
    main()
