#!/usr/bin/env python3
"""Compile sourced character meanings, readings and explicit editorial meaning aids."""
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
UNIHAN_URL = 'https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip'
TANGUT_COMMIT = 'f523fd524003d83ec91c7ba1e76f60808a6be6f9'
TANGUT_SHA = '8b5ed40d93e9cb82fdc5743b30090d31fdc1c24f9654b0958c9290ce360a4d0d'
TANGUT_URL = f'https://raw.githubusercontent.com/imlooh/open-tangut/{TANGUT_COMMIT}/final_dict.json'
TANGUT_BLOCKS = ((0x17000, 0x187FF), (0x18D00, 0x18DFF))
# The eight reconstructions and two sound glosses the Tangut records carry, in the order the card
# shows them. The keys are Open Tangut's.
SYSTEMS = ['li_fanwen', 'gong_huangcheng', 'gong_xun_202411', 'arakawa_shintaro', 'miyake', 'nishida',
           'kychanov', 'sofronov']
SOUNDS = [('li_fanwen', 'sound_li_fanwen'), ('nie_lishan', 'sound_nie_lishan')]
# Open Tangut writes a missing Chinese explanation and a pointer to another entry in the meaning
# field. Neither is a meaning; they stay out of the card. Parenthesised editorial notes do too.
ZH_PLACEHOLDERS = {'暫無解釋', '（訛體）'}
ZH_PREFIXES = ('重定向至', '（按：')


def is_tangut(char):
    point = ord(char)
    return any(start <= point <= end for start, end in TANGUT_BLOCKS)


def fetch(url, path, digest):
    if not path.exists():
        path.parent.mkdir(exist_ok=True)
        path.write_bytes(urllib.request.urlopen(url, timeout=300).read())
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != digest:
        raise ValueError(f'{url}: digest mismatch')
    return raw


def clean(values, language):
    cleaned = []
    for value in values or []:
        text = value.strip()
        if not text:
            continue
        if language == 'zh' and (text in ZH_PLACEHOLDERS or text.startswith(ZH_PREFIXES)):
            continue
        cleaned.append(text)
    return cleaned


def open_tangut():
    raw = fetch(TANGUT_URL, ROOT / 'cache/open-tangut-final_dict.json', TANGUT_SHA)
    entries = {}
    for row in json.loads(raw):
        char = row['char']
        if len(char) != 1 or not is_tangut(char):
            raise ValueError(f'Open Tangut: {char!r} is not a Tangut character')
        if char in entries:
            raise ValueError(f'Open Tangut: {char} appears twice')
        definitions = row.get('definitions') or {}
        pronunciations = row.get('pronunciations') or {}
        entry = {'source': 'openTangut', 'en': clean(definitions.get('en'), 'en')}
        ja = clean(definitions.get('ja'), 'ja')
        if ja:
            entry['ja'] = ja
        zh = clean(definitions.get('zh'), 'zh')
        if zh:
            entry['zh'] = zh
        readings = {key: pronunciations[key] for key in SYSTEMS if pronunciations.get(key)}
        if readings:
            entry['readings'] = readings
        sounds = {name: pronunciations[key] for name, key in SOUNDS if pronunciations.get(key)}
        if sounds:
            entry['sounds'] = sounds
        entries[char] = entry
    return entries


def build():
    fetch(UNIHAN_URL, ROOT / 'cache/Unihan.zip', UNIHAN_SHA)
    entries = {}
    with zipfile.ZipFile(ROOT / 'cache/Unihan.zip') as archive:
        for line in archive.read('Unihan_Readings.txt').decode().splitlines():
            if not line or line.startswith('#'):
                continue
            cp, field, value = line.split('\t', 2)
            if field == 'kDefinition':
                entries[chr(int(cp[2:], 16))] = {'en': [value], 'source': 'unihan'}
    tangut_entries = open_tangut()
    entries.update(tangut_entries)
    aids = json.loads((DATA / 'character-meaning-aids.json').read_text())
    # Match complete dictionary senses; substring/shape/component matching is not evidence.
    for char, entry in entries.items():
        senses = {s.strip().lower() for g in entry['en'] for s in re.split(r';\s*', g)}
        entry['aids'] = [i for i, aid in enumerate(aids['meanings'])
                         if (entry['source'] == 'openTangut' and senses.intersection(aid['en']))
                         or (entry['source'] == 'unihan' and char in aid['han'])]
        if not entry['aids']:
            del entry['aids']
    doc = {'format': 'ids-character-info-2', 'sources': {
        'unihan': {'name': 'Unicode Unihan 18.0.0 · kDefinition', 'url': UNIHAN_URL, 'sha256': UNIHAN_SHA, 'license': 'Unicode-3.0', 'copyright': 'Copyright Unicode, Inc.'},
        'openTangut': {'name': 'Open Tangut', 'url': TANGUT_URL, 'commit': TANGUT_COMMIT, 'sha256': TANGUT_SHA, 'license': 'MIT (compilation); Wiktionary rows CC-BY-SA-4.0 (https://en.wiktionary.org/); CCAMC rows no licence stated (http://ccamc.org/)', 'copyright': 'Copyright (c) 2026 Leah; Wiktionary contributors; CCAMC',
                       'modifications': 'English, Japanese and Chinese meanings, reconstructions and sound glosses selected; empty readings, missing-explanation placeholders and editorial-only notes left out.'},
        'aids': {'file': 'character-meaning-aids.json', 'license': 'MIT', 'kind': 'editorial Chinese translations and emoji mnemonics'},
    }, 'entries': entries, 'aids': aids['meanings'], 'components': aids['components']}
    raw = (json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    (DATA / 'character-info.json.gz').write_bytes(gzip.compress(raw, mtime=0))
    tangut = list(tangut_entries.values())
    print(json.dumps({
        'han': sum(entry['source'] == 'unihan' for entry in entries.values()),
        'tangut': len(tangut),
        'tangut_en': sum(bool(entry['en']) for entry in tangut),
        'tangut_ja': sum(bool(entry.get('ja')) for entry in tangut),
        'tangut_zh': sum(bool(entry.get('zh')) for entry in tangut),
        'tangut_readings': sum(bool(entry.get('readings')) for entry in tangut),
        'meaning_aids': len(aids['meanings']),
        'bytes': len(gzip.compress(raw, mtime=0)),
    }))


if __name__ == '__main__':
    build()
