#!/usr/bin/env python3
"""Compile sourced English glosses and explicit editorial meaning aids."""
import gzip
import hashlib
import json
import re
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
UNIHAN_SHA = '4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e'
TANGUT_SHA = '22be674102e57eb54d94b4bd9d0e32d28b608037cf02accea4c264d022e20acf'
UNIHAN_URL = 'https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip'


def build():
    path = ROOT / 'cache/Unihan.zip'
    if not path.exists():
        path.parent.mkdir(exist_ok=True)
        path.write_bytes(urllib.request.urlopen(UNIHAN_URL, timeout=120).read())
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != UNIHAN_SHA:
        raise ValueError('Unihan digest mismatch')
    entries = {}
    with zipfile.ZipFile(path) as archive:
        for line in archive.read('Unihan_Readings.txt').decode().splitlines():
            if not line or line.startswith('#'):
                continue
            cp, field, value = line.split('\t', 2)
            if field == 'kDefinition':
                entries[chr(int(cp[2:], 16))] = {'en': [value], 'source': 'unihan'}
    raw = gzip.decompress((DATA / 'tangut-glosses-en-source.jsonl.gz').read_bytes())
    if hashlib.sha256(raw).hexdigest() != TANGUT_SHA:
        raise ValueError('Tangut source digest mismatch')
    for line in raw.decode().splitlines():
        row = json.loads(line)
        char = row['word']
        if row.get('lang_code') != 'txg' or len(char) != 1:
            continue
        glosses = [g for s in row.get('senses', []) if 'no-gloss' not in s.get('tags', []) for g in s.get('raw_glosses', s.get('glosses', []))]
        if glosses:
            entry = entries.setdefault(char, {'en': [], 'source': 'wiktionary'})
            entry['en'] = list(dict.fromkeys(entry['en'] + glosses))
    aids = json.loads((DATA / 'character-meaning-aids.json').read_text())
    # Match complete dictionary senses; substring/shape/component matching is not evidence.
    for char, entry in entries.items():
        senses = {s.strip().lower() for g in entry['en'] for s in re.split(r';\s*', g)}
        entry['aids'] = [i for i, aid in enumerate(aids['meanings']) if (entry['source'] == 'wiktionary' and senses.intersection(aid['en'])) or (entry['source'] == 'unihan' and char in aid['han'])]
        if not entry['aids']:
            del entry['aids']
    doc = {'format': 'ids-character-info-1', 'sources': {
        'unihan': {'name': 'Unicode Unihan 18.0.0 · kDefinition', 'url': UNIHAN_URL, 'sha256': UNIHAN_SHA, 'license': 'Unicode-3.0', 'copyright': 'Copyright Unicode, Inc.'},
        'wiktionary': {'name': 'English Wiktionary contributors / Kaikki / Wiktextract (Tatu Ylonen)', 'url': 'https://kaikki.org/dictionary/Tangut/kaikki.org-dictionary-Tangut.jsonl', 'sha256': TANGUT_SHA, 'license': 'CC-BY-SA-4.0', 'retrieved': '2026-10-27', 'dump': '2026-09-02', 'extracted': '2026-09-09', 'modifications': 'Single-character glosses selected, duplicate glosses combined, raw qualifiers preserved.'},
        'aids': {'file': 'character-meaning-aids.json', 'license': 'MIT', 'kind': 'editorial Chinese translations and emoji mnemonics'},
    }, 'entries': entries, 'aids': aids['meanings'], 'components': aids['components']}
    raw = (json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    (DATA / 'character-info.json.gz').write_bytes(gzip.compress(raw, mtime=0))
    print(json.dumps({'han': sum(e['source'] == 'unihan' for e in entries.values()), 'tangut': sum(e['source'] == 'wiktionary' for e in entries.values()), 'meaning_aids': len(aids['meanings']), 'bytes': len(gzip.compress(raw, mtime=0))}))


if __name__ == '__main__':
    build()
