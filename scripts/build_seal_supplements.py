"""Extend curated seal crosswalks for components the bundled data leaves unmapped.

python3 scripts/build_seal_supplements.py REPORT_JSON
The report comes from `node scripts/check_small_seal.mjs`. Each added entry needs
a Unicode SealSources kSEAL_MCJK value and one CHISE ShuoWen record that lists the
mapped modern characters together. Missing glyphs are fetched from the pinned
Kaiyuan revision, four requests at a time. Existing entries are preserved.
"""
import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import gzip
import hashlib
import json
from pathlib import Path
import tarfile
from urllib.request import urlopen
from build_small_seal import sexps, properties, MAP_REV
from build_small_seal_palette import REV

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / 'scripts/data/small-seal'
UNICODE_FILE = 'data/seal-sources.txt.gz'
CHISE_FILE = 'data/small-seal-sources.tar.gz'
LICENSE = 'fonts/LICENSE-IDSSeal.txt'


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def evidence():
    unicode = {}
    for line in gzip.decompress((ROOT / UNICODE_FILE).read_bytes()).decode().splitlines():
        if not line or line.startswith('#'): continue
        cp, key, value = line.split('\t')
        if key == 'kSEAL_MCJK': unicode[chr(int(cp[2:], 16))] = value
    by_modern = defaultdict(list)
    with tarfile.open(ROOT / CHISE_FILE) as tar:
        for member in tar.getmembers():
            if not member.name.endswith('.el'): continue
            for form in sexps(tar.extractfile(member).read().decode()):
                if not isinstance(form, list) or form[0] != 'define-char': continue
                record = form[1][1]
                number = properties(record).get('=shuowen-jiguge')
                if not number: continue
                names = []
                for prop in record:
                    if not isinstance(prop, list) or prop[0] != '<-Small-Seal@shuowen': continue
                    for entry in prop[1:]:
                        cp = properties(entry).get('=ucs', '')
                        if cp.startswith('#x'): names.append(chr(int(cp[2:], 16)))
                if not names: continue
                item = {'file': member.name, 'record': 'SW-JIGUGE-' + number.zfill(5), 'modern': sorted(set(names))}
                for name in set(names): by_modern[name].append(item)
    return unicode, by_modern


def unresolved(report, doc, curated=()):
    """Modern components that the current data cannot map to any seal form.

    Unmapped components count whether they appear directly or inside a nested
    expansion. Rows with a recorded IDS and no complete candidate count too.
    Only original dataset heads contribute. Curated crosswalk rows stay out even
    after the palette build adds them, so a rebuild keeps the same scope.
    """
    known = {name for names in doc['modern'].values() for name in names}
    skip = set(curated)
    needed = set()
    for row in report['rows']:
        if row['char'] in skip: continue
        if row['char'] not in doc['modern']: continue
        if row['status'] not in ('source-only', 'incomplete', 'no-candidate'): continue
        for candidate in row['candidates']:
            needed.update(candidate['unmapped'])
            needed.update(expansion['component'] for expansion in candidate['expansions'])
    return needed - known


def crosswalk(value, by_modern):
    """Return the modern group and its single CHISE record, or no record."""
    names = {chr(int(cp, 16)) for cp in value.split()}
    records = {}
    for name in list(names):
        found = by_modern.get(name, [])
        if len(found) == 1:
            names.update(found[0]['modern'])
            records[found[0]['record']] = found[0]
    if len(records) != 1: return None
    record = next(iter(records.values()))
    if chr(int(value.split()[0], 16)) not in record['modern']: return None
    return record['modern'], record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('report', type=Path)
    args = parser.parse_args()
    report = json.loads(args.report.read_text(encoding='utf-8'))
    inputs = report.get('inputs', {})
    for name in ('data/small-seal.json.gz', 'data/babelstone-ids.tsv.gz', 'data/yi-bai-ids.tsv.gz', 'data/component-forms.tsv'):
        if inputs.get(name) != digest((ROOT / name).read_bytes()):
            raise ValueError(f'Report inputs do not match {name}; rerun check_small_seal.mjs')
    doc = json.loads(gzip.decompress((ROOT / 'data/small-seal.json.gz').read_bytes()))
    manifest = json.loads((DIRECTORY / 'supplements.json').read_text(encoding='utf-8'))
    if manifest['format'] != 1: raise ValueError('Unsupported seal supplement format')
    existing = {entry['char']: entry for entry in manifest['entries']}
    needed = unresolved(report, doc, existing)
    unicode, by_modern = evidence()
    unicodeSha, archiveSha = digest((ROOT / UNICODE_FILE).read_bytes()), digest((ROOT / CHISE_FILE).read_bytes())

    entries = []
    for char, value in unicode.items():
        if char in doc['modern'] or char in existing: continue
        found = crosswalk(value, by_modern)
        if not found: continue
        modern, record = found
        if not needed.intersection(modern): continue
        entries.append({'char': char, 'modern': modern, 'unicode': value, 'record': record})

    def fetch(item):
        char, record = item['char'], item['record']
        name = f'u{ord(char):X}.svg'
        path = DIRECTORY / name
        if not path.exists():
            url = f'https://raw.githubusercontent.com/frankslin/kaiyuan-small-seal-font/{REV}/glyphs/{name}'
            with urlopen(url, timeout=60) as response: raw = response.read()
            if b'<svg ' not in raw or b'<path ' not in raw: raise ValueError('Invalid SVG: ' + name)
            path.write_bytes(raw)
        anchor = chr(int(item['unicode'].split()[0], 16))
        return {'char': char,
                'modern': item['modern'],
                'glyph': name,
                'glyphSha256': digest(path.read_bytes()),
                'glyphSource': f'https://github.com/frankslin/kaiyuan-small-seal-font/blob/{REV}/glyphs/{name}',
                'unicodeEvidence': {'file': UNICODE_FILE, 'field': 'kSEAL_MCJK', 'value': item['unicode'], 'sha256': unicodeSha},
                'chiseEvidence': {'file': record['file'], 'record': record['record'], 'relation': '<-Small-Seal@shuowen',
                                  'revision': MAP_REV, 'archiveSha256': archiveSha},
                'basis': f"Unicode SealSources maps U+{ord(char):X} to {anchor}; "
                         f"CHISE {record['record']} lists {'、'.join(item['modern'])} in one record.",
                'license': LICENSE}

    with ThreadPoolExecutor(max_workers=4) as pool:
        added = list(pool.map(fetch, entries))
    merged = sorted([*existing.values(), *added], key=lambda entry: entry['char'])
    (DIRECTORY / 'supplements.json').write_text(json.dumps({'format': 1, 'entries': merged}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(added)} entries added, {len(merged)} total; {len(needed)} unresolved components before')


if __name__ == '__main__':
    main()
