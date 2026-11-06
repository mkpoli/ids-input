"""Index exact scalar outline keys for the preview's offline routing."""
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
coverage = {}
for name in ['tangut', 'small-seal', 'bopomofo', 'shuishu', 'jurchen']:
    source = ROOT / f'data/{name}-outlines.json.gz'
    records = json.loads(gzip.decompress(source.read_bytes()))['records']
    points = sorted(ord(key) for key, record in records.items()
                    if len(key) == 1 and record.get('G', {}).get('p'))
    ranges = []
    for cp in points:
        if ranges and cp == ranges[-1][1] + 1:
            ranges[-1][1] = cp
        else:
            ranges.append([cp, cp])
    coverage[name] = ranges
    # Variant sequences, by selector, under `<bundle>:<selector>`.
    selectors = sorted({ord(key[1]) for key in records if len(key) == 2})
    for selector in selectors:
        points = sorted(ord(key[0]) for key, record in records.items()
                        if len(key) == 2 and ord(key[1]) == selector and record.get('G', {}).get('p'))
        ranges = []
        for cp in points:
            if ranges and cp == ranges[-1][1] + 1:
                ranges[-1][1] = cp
            else:
                ranges.append([cp, cp])
        coverage[f'{name}:{selector:x}'] = ranges
(ROOT / 'data/bundled-coverage.json').write_text(
    json.dumps(coverage, separators=(',', ':')) + '\n')
