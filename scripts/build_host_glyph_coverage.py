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
match = re.search(r"export const COMPOSER_BASE = '([^']+)'", COMPOSER)
if match is None:
    raise SystemExit('COMPOSER_BASE is missing from demo/lib/composer.js')
base = match.group(1)
cache = Path(sys.argv[1])
hashes = {}
points = set()
for name in ['manifest.json'] + [f'g/{i:03x}.json' for i in range(4096)]:
    path = cache / hashlib.sha256((base + name).encode()).hexdigest()
    if not path.exists():
        # audit_render_coverage.mjs marks an absent shard with `<hash>.404`.
        if Path(f'{path}.404').exists():
            continue
        raise SystemExit(f'missing cache entry for {name}; run the audit first')
    raw = path.read_bytes()
    hashes[name] = hashlib.sha256(raw).hexdigest()
    if name == 'manifest.json':
        continue
    data = json.loads(gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw)
    for record in data.values():
        key = record.get('k', '')
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
}
(ROOT / 'data/host-glyph-coverage.json').write_text(
    json.dumps(report, separators=(',', ':')) + '\n')
print(len(points), 'host glyphs')
