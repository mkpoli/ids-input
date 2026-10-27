# /// script
# requires-python = ">=3.11"
# ///
"""Compile CHISE's Jiguge seal IDS using explicit same-record Unicode mappings.

Run: python3 scripts/build_small_seal.py [--cache DIRECTORY]
The output retains every source row, including unresolved and empty descriptions.
Only complete Unicode descriptions enter the editor's table.
"""
import argparse
from collections import Counter, defaultdict
import gzip
import io
import json
from pathlib import Path
import re
import tarfile
from build_ids_data import fetch

ROOT = Path(__file__).resolve().parents[1]
IDS_REV = 'ac35413635608512f5e10187812cfab3b6ea47c1'
MAP_REV = '0dc65c74293d3b74eda1a9861273675a5b26fd99'
IDS_URL = f'https://gitlab.chise.org/api/v4/projects/CHISE%2Fids/repository/files/IDS-SW-JIGUGE.txt/raw?ref={IDS_REV}'
MAP_URL = f'https://gitlab.chise.org/api/v4/projects/CHISE%2Fxemacs-chise/repository/archive.tar.gz?sha={MAP_REV}&path=lisp/utf-2000'
IDS_SHA = 'ad63ab00a768e097ad0030f1e4714e4d556b7bef171de407bc0828d3e20bd074'
MAP_SHA = 'c4c1062d38487299b37dc27c3a090416bfdea6571ca523845fbd7a850f2fa92a'
ARITY = {c: 2 for c in '⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽㇯'} | {c: 3 for c in '⿲⿳'} | {c: 1 for c in '⿾⿿〾'}
ENTITY = re.compile(r'&[^;]+;')
TOKENS = re.compile(r';[^\n]*|"(?:\\.|[^"\\])*"|[()\']|[^\s()\';]+')


def sexps(text):
    """Read the data subset of Lisp, without evaluating any source code."""
    tokens = iter(t for t in TOKENS.findall(text) if not t.startswith(';'))
    def read(t):
        if t == '(':
            result = []
            for t in tokens:
                if t == ')': return result
                result.append(read(t))
            raise ValueError('Unclosed Lisp list')
        if t == ')': raise ValueError('Unexpected closing parenthesis')
        if t == "'": return ['quote', read(next(tokens))]
        return t
    return [read(t) for t in tokens]


def properties(record):
    return {p[0]: p[2] for p in record if isinstance(p, list) and len(p) == 3 and p[1] == '.'}


def mappings(sources):
    found = defaultdict(set)
    modern = defaultdict(set)
    for text in sources:
        for form in sexps(text):
            if not isinstance(form, list) or form[0] != 'define-char': continue
            record = form[1][1]
            props = properties(record)
            point = props.get('=ucs', '')
            if not point.startswith('#x'): continue
            point = int(point[2:], 16)
            if not 0x3D000 <= point <= 0x3FC3F: continue
            char = chr(point)
            # Only co-occurring, exact properties. No inheritance through glyph variants,
            # denotational/subsumptive relationships, or modern-character equivalence.
            for key, prefix in [('=shuowen-jiguge', 'SW-JIGUGE'), ('=shuowen-jiguge5', 'SW-JIGUGE5'),
                                ('=shuowen-jiguge4', 'SW-JIGUGE4'), ('=shuowen-jiguge-A30', 'SW-JIGUGE30')]:
                if key in props: found[f'&{prefix}-{int(props[key]):05d};'].add(char)
            for prop in record:
                if isinstance(prop, list) and prop[0] == '<-Small-Seal@shuowen':
                    for entry in prop[1:]:
                        value = properties(entry).get('=ucs', '')
                        if value.startswith('#x'): modern[char].add(chr(int(value[2:], 16)))
    return {k: next(iter(v)) for k, v in found.items() if len(v) == 1}, modern


def valid(sequence):
    remaining = 1
    if not sequence or sequence[0] not in ARITY: return False
    for c in sequence:
        if remaining <= 0: return False
        if c not in ARITY and not (0x2E80 <= ord(c) <= 0x2FDF or 0x31C0 <= ord(c) <= 0x31EE or
            0x3400 <= ord(c) <= 0x9FFF or 0x20000 <= ord(c) <= 0x3FFFD): return False
        remaining += ARITY.get(c, 0) - 1
    return remaining == 0 and len(sequence) <= 64


def compile_data(text, mapping, modern):
    rows, table, uses = [], defaultdict(list), Counter()
    for line in text.splitlines():
        if not line or line.startswith(';'): continue
        ident, entity, original, *extra = line.split('\t')
        char = mapping.get(entity)
        row = {'id': ident, 'char': char, 'original': original, 'descriptions': []}
        for index, written in enumerate([original, *[s.removeprefix('@apparent=') for s in extra]]):
            resolved = ENTITY.sub(lambda m: mapping.get(m[0], m[0]), written)
            unresolved = sorted(set(ENTITY.findall(resolved)))
            status = 'empty' if not written else 'unmapped-head' if not char else 'unresolved' if unresolved else 'ready' if valid(resolved) else 'unsupported'
            item = {'original': written, 'kind': 'apparent' if index else 'structural', 'text': resolved, 'status': status}
            if unresolved: item['unresolved'] = unresolved
            row['descriptions'].append(item)
            if status == 'ready' and resolved not in table[char]: table[char].append(resolved)
        rows.append(row)
    for sequences in table.values():
        for c in set(''.join(sequences)):
            if 0x3D000 <= ord(c) <= 0x3FC3F: uses[c] += 1
    return {'format': 1, 'license': 'GPL-2.0-or-later',
            'sources': [{'url': IDS_URL, 'revision': IDS_REV, 'sha256': IDS_SHA}, {'url': MAP_URL, 'revision': MAP_REV, 'sha256': MAP_SHA}],
            'table': dict(sorted(table.items())), 'modern': {c: sorted(v) for c, v in sorted(modern.items())},
            'parts': [{'part': c, 'uses': n, 'strokes': None, 'first': None, 'kind': 'seal'} for c, n in sorted(uses.items())],
            'records': rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=ROOT / 'cache/small-seal')
    parser.add_argument('--out', type=Path, default=ROOT / 'data/small-seal.json.gz')
    args = parser.parse_args()
    ids = fetch(IDS_URL, args.cache / 'IDS-SW-JIGUGE.txt', IDS_SHA).read_text()
    archive = fetch(MAP_URL, args.cache / 'chise.tar.gz', MAP_SHA).read_bytes()
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as tar:
        source_files = {Path(m.name).name: tar.extractfile(m).read() for m in tar if re.search(r'/ShuoWen-SR\d{3}\.el$', m.name)}
    sources = [raw.decode() for raw in source_files.values()]
    if len(sources) != 540: raise ValueError('Expected the 540 Shuowen radical files')
    source_files['IDS-SW-JIGUGE.txt'] = ids.encode()
    source_files['COPYING'] = (ROOT / 'data/COPYING-small-seal.txt').read_bytes()
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode='w') as tar:
        for name, raw in sorted(source_files.items()):
            info = tarfile.TarInfo(name)
            info.size, info.mode = len(raw), 0o644
            tar.addfile(info, io.BytesIO(raw))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.with_name('small-seal-sources.tar.gz').write_bytes(gzip.compress(buffer.getvalue(), mtime=0))
    mapping, modern = mappings(sources)
    doc = compile_data(ids, mapping, modern)
    from build_small_seal_palette import augment_palette
    augment_palette(doc)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(gzip.compress(json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps({'mappedEntities': len(mapping), 'characters': len(doc['table']), 'parts': len(doc['parts']),
        'statuses': Counter(d['status'] for r in doc['records'] for d in r['descriptions'])}))


if __name__ == '__main__': main()
