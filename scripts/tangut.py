"""Pinned BabelStone Tangut IDS shared by the data builders."""
from collections import Counter
from build_ids_data import fetch

URL = 'https://www.babelstone.co.uk/Tangut/TangutIDS.txt'
DIGEST = '6d3e24241ce608590b1bce249a8367e8371a34b61e59b150e50c51b639eabd44'
SOURCE = f'BabelStone Tangut IDS, Andrew West, {URL}, sha256:{DIGEST}'


def read_tangut(cache):
    raw = fetch(URL, cache / 'TangutIDS.txt', DIGEST).read_bytes()
    rows = []
    for line in raw.decode('utf-8-sig').splitlines():
        code, char, sequence = line.split('\t')
        if ord(char) != int(code, 16):
            raise ValueError(f'Invalid Tangut code point: {code}')
        rows.append((char, sequence))
    return rows


def tangut_parts(rows):
    uses = Counter(c for _, sequence in rows for c in set(sequence) if 0x18800 <= ord(c) <= 0x18AFF)
    # Include all 768 original encoded components, even those absent from this IDS edition.
    return [[chr(c), uses[chr(c)], None, 0, None, 't'] for c in range(0x18800, 0x18B00)]
