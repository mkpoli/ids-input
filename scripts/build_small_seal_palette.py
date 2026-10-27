"""Build a seal palette independently of fully resolved seal decompositions.

python3 scripts/build_small_seal_palette.py --upstream cache/small-seal/kaiyuan.tar.gz
The optional pinned upstream archive refreshes the bundled SVG subset and Unicode data.
Without it, rebuilding uses only bundled inputs.
"""
import argparse
from collections import Counter, defaultdict
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile

ROOT = Path(__file__).resolve().parents[1]
REV = '97433695858330ec9fdb7de9c4604da2f635eba6'
ARCHIVE_SHA = '6249a03976bb0f3bc2fb5d13185d909b3444c1f90b8a7d56dfe8629d1d56577a'
SEAL_SHA = '05ba2c220c4f34a0f1ef54676e7d2033963a9baed1acafd079f00f13da11aa90'
# An editorial starter set of familiar pictographic/elementary components. Only
# their encoded Shuowen radical heads qualify; modern lookalikes are not enough.
BASIC = set('一丨丶丿乙二人儿入八冂冖冫几凵刀力勹匕匚十卜卩厂厶又口囗土士夕大女子宀寸小尸屮山川巛工己巾干幺广弋弓彐彡彳心戈戶手攴文斗斤方日曰月木欠止歹殳毛氏气水火爪父爿片牙牛犬玉瓜瓦田疋疒白皮皿目矛矢石示禾穴立竹米糸缶网羊羽耒耳聿肉臣自臼舌舟艮艸虍虫血衣角言谷豆豕豸貝走足身車辛辰辵邑酉金門阜隹雨革韋頁風馬骨髟鬲鬼魚鳥鹿麥麻黍黽鼎鼠齒龍龜')
# MOE Dictionary of Chinese Character Variants, A00480-001: 𠙵 is a variant of 口.
PALETTE_ALIASES = {'𠙵': '口'}
OPS = set('⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽㇯⿲⿳⿾⿿〾')


def unicode_records(raw):
    if hashlib.sha256(raw).hexdigest() != SEAL_SHA: raise ValueError('SealSources checksum mismatch')
    records = defaultdict(dict)
    for line in raw.decode().splitlines():
        if not line or line.startswith('#'): continue
        cp, key, value = line.split('\t')
        records[chr(int(cp[2:], 16))][key] = value
    return records


def names_of(record):
    return [chr(int(cp, 16)) for cp in record.get('kSEAL_MCJK', '').split()]


def radical_heads(records):
    return {c for c, r in records.items() if any(int(v.split('.')[1], 16) == ord(c) for v in r.get('kSEAL_Rad', '').split())}


def candidates(doc, records):
    # Always derive the CHISE set from source records, not the previously augmented
    # modern mapping, so repeated builds have identical membership.
    return {r['char'] for r in doc['records'] if r['char']} | radical_heads(records) | set(doc['table'])


def compile_palette(doc, records, available, cjk):
    heads = radical_heads(records)
    source = {r['char']: r for r in doc['records'] if r['char']}
    uses = Counter()
    for row in doc['records']:
        uses.update({c for d in row['descriptions'] for c in d['text'] if 0x3D000 <= ord(c) <= 0x3FC3F})
    parts = []
    for char in sorted(candidates(doc, records) & available):
        names = list(dict.fromkeys(doc['modern'].get(char) or names_of(records.get(char, {}))))
        names += [alias for name in list(names) if (alias := PALETTE_ALIASES.get(name)) and alias not in names]
        if names: doc['modern'][char] = names
        seal = [d['original'] for d in source.get(char, {}).get('descriptions', []) if d['original'] and (d['original'][0] in OPS or re.match(r'^&(?:U-i\d+|A-IWDSU)\+2FF[0-F];', d['original']))]
        modern = list(dict.fromkeys(s for name in names for s in cjk.get(name, []) if s and s[0] in OPS))
        if char in heads and BASIC.intersection(names):
            group, basis = 'basic', 'selected'
        elif seal:
            group, basis = 'compound', 'seal-ids'
        elif modern:
            group, basis = 'compound', 'cjk-ids'
        else:
            group, basis = 'other', 'unknown'
        part = {'part': char, 'uses': uses[char], 'strokes': None, 'first': None, 'kind': 'seal',
                'sealGroup': group, 'sealBasis': basis, 'modern': names}
        if basis == 'cjk-ids': part['modernIds'] = modern
        parts.append(part)
    doc['parts'] = parts
    doc['paletteSources'] = [
        {'url': 'https://dict.variants.moe.edu.tw/dictView.jsp?educode=A00480-001', 'use': 'Palette lookup alias: 𠙵 → 口'},
        {'url': f'https://github.com/frankslin/kaiyuan-small-seal-font/blob/{REV}/third_party/unicode/ucd/SealSources.txt', 'sha256': SEAL_SHA, 'license': 'Unicode-3.0'},
        {'file': 'babelstone-ids.tsv.gz', 'sha256': hashlib.sha256((ROOT / 'data/babelstone-ids.tsv.gz').read_bytes()).hexdigest(), 'use': 'Provisional compound grouping only'},
    ]
    return doc


def augment_palette(doc):
    records = unicode_records(gzip.decompress((ROOT / 'data/seal-sources.txt.gz').read_bytes()))
    files = json.loads((ROOT / 'fonts/small-seal-sources.json').read_text())['files']
    available = {chr(int(Path(name).stem[1:], 16)) for name in files if name.startswith('glyphs/')}
    cjk = {}
    for line in gzip.decompress((ROOT / 'data/babelstone-ids.tsv.gz').read_bytes()).decode().splitlines():
        if not line or line.startswith('#'): continue
        char, text = line.split('\t')
        cjk[char] = [re.sub(r'\([^)]*\)$', '', s) for s in text.split()]
    return compile_palette(doc, records, available, cjk)


def bundle(upstream, doc):
    raw = upstream.read_bytes()
    if hashlib.sha256(raw).hexdigest() != ARCHIVE_SHA: raise ValueError('Upstream archive checksum mismatch')
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as tar:
        prefix = tar.getnames()[0] + '/'
        def read(name): return tar.extractfile(prefix + name).read()
        seal = read('third_party/unicode/ucd/SealSources.txt')
        records = unicode_records(seal)
        (ROOT / 'data/seal-sources.txt.gz').write_bytes(gzip.compress(seal, mtime=0))
        (ROOT / 'data/COPYING-seal-sources.txt').write_bytes(read('third_party/unicode/ucd/LICENSE.txt'))
        members = set(tar.getnames())
        files = {name: read(name) for name in ['OFL.txt', 'data/approved.csv', 'data/provenance/glyphs.csv']}
        for c in sorted(candidates(doc, records)):
            name = f'glyphs/u{ord(c):X}.svg'
            if prefix + name in members: files[name] = read(name)
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode='w') as tar:
        for name, content in sorted(files.items()):
            info = tarfile.TarInfo(name)
            info.size, info.mode = len(content), 0o644
            tar.addfile(info, io.BytesIO(content))
    packed = gzip.compress(buffer.getvalue(), mtime=0)
    (ROOT / 'fonts/IDSSeal-sources.tar.gz').write_bytes(packed)
    meta = {'repository': 'https://github.com/frankslin/kaiyuan-small-seal-font', 'revision': REV,
            'upstreamArchiveSha256': ARCHIVE_SHA, 'archiveSha256': hashlib.sha256(packed).hexdigest(),
            'files': {n: hashlib.sha256(b).hexdigest() for n, b in sorted(files.items())}}
    (ROOT / 'fonts/small-seal-sources.json').write_text(json.dumps(meta, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--upstream', type=Path)
    args = parser.parse_args()
    path = ROOT / 'data/small-seal.json.gz'
    doc = json.loads(gzip.decompress(path.read_bytes()))
    if args.upstream: bundle(args.upstream, doc)
    augment_palette(doc)
    path.write_bytes(gzip.compress(json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))
    print(len(doc['parts']), dict(Counter(p['sealGroup'] for p in doc['parts'])), dict(Counter(p['sealBasis'] for p in doc['parts'])))


if __name__ == '__main__': main()
