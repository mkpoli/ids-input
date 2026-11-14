"""Index single-scalar outlines of the pinned default composer export.

Build from the verified HTTP cache populated by audit_render_coverage.mjs.

    python3 scripts/build_host_glyph_coverage.py CACHE_DIR
"""
import gzip
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPOSER = (ROOT / 'demo/lib/composer.js').read_text()
style = sys.argv[2] if len(sys.argv) > 2 else 'sans'
if style == 'sans':
    match = re.search(r"export const COMPOSER_BASE = '([^']+)'", COMPOSER)
    if match is None:
        raise SystemExit('COMPOSER_BASE is missing from demo/lib/composer.js')
else:
    match = re.search(rf"{style}: '([^']+)'", COMPOSER)
    if match is None:
        raise SystemExit(f'COMPOSER_BASES.{style} is missing from demo/lib/composer.js')
base = match.group(1)
cache = Path(sys.argv[1])
hashes = {}
points = set()
# A record shard is named by four hex digits of its keys' hash, in a folder of the first two, and
# holds its records by key. The report names how many shards were read and one hash over them all
# (of each `name hash` line in order).
shards = hashlib.sha256()
read = 0
for name in ['manifest.json'] + [f'g/{i >> 8:02x}/{i:04x}.json' for i in range(65536)]:
    path = cache / hashlib.sha256((base + name).encode()).hexdigest()
    if not path.exists():
        # audit_render_coverage.mjs marks an absent shard with `<hash>.404`.
        if Path(f'{path}.404').exists():
            continue
        raise SystemExit(f'missing cache entry for {name}; run the audit first')
    raw = path.read_bytes()
    if name == 'manifest.json':
        hashes[name] = hashlib.sha256(raw).hexdigest()
        continue
    shards.update(f'{name} {hashlib.sha256(raw).hexdigest()}\n'.encode())
    read += 1
    data = json.loads(gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw)
    for key, record in data.items():
        glyph = record.get('G')
        if len(key) == 1 and glyph and glyph.get('p'):
            points.add(ord(key))
ranges = []
for cp in sorted(points):
    if ranges and cp == ranges[-1][1] + 1:
        ranges[-1][1] = cp
    else:
        ranges.append([cp, cp])
report = {
    'base': base,
    'scope': 'Single-scalar records with direct outlines in the pinned default export; excludes composed or host-cut results.',
    'count': len(points),
    'ranges': ranges,
    'sha256': hashes,
    'shards': {'read': read, 'sha256': shards.hexdigest()},
}
out = ROOT / ('data/host-glyph-coverage.json' if style == 'sans' else f'data/host-glyph-coverage-{style}.json')
out.write_text(json.dumps(report, separators=(',', ':')) + '\n')
print(len(points), 'host glyphs', f'({style})')
