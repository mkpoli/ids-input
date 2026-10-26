# /// script
# requires-python = ">=3.11"
# ///
"""Build `data/babelstone-ids.tsv.gz`, the compact copy of BabelStone IDS the default adapter reads.

One line per ideograph, `char<TAB>sequences`: every alternative IDS.TXT gives, space-separated, each
with the source regions it describes (`⿰氵骨(GHTJKPV)`). The maintainer's `*` notes on unifications
and earlier sequences are left out. Unencoded components keep BabelStone's numbers (`{108}`) and an
unrepresentable one stays `？`. Lines starting with `#` name the source.

    uv run scripts/build_ids_data.py [--ids path/to/IDS.TXT]

IDS.TXT is not versioned upstream, so its `File Date` header and the digest of the copy read go into
the output's header. Without `--ids` the file is fetched into `cache/`.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IDS_URL = "https://www.babelstone.co.uk/CJK/IDS.TXT"
TARGET = ROOT / "data" / "babelstone-ids.tsv.gz"
SEQUENCE = re.compile(r"^\^(?P<ids>[^$]+)\$(?:\((?P<regions>[^)]*)\))?$")


def fetch(url: str, dest: Path, sha256: str | None = None, refresh: bool = False) -> Path:
    """`url` saved at `dest` once, checked against `sha256` when one is given."""
    if refresh or not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(url, headers={"User-Agent": "ids-input build"})
        with urllib.request.urlopen(request, timeout=300) as response:
            dest.write_bytes(response.read())
    if sha256 and hashlib.sha256(dest.read_bytes()).hexdigest() != sha256:
        raise ValueError(f"{dest} does not match the pinned SHA-256 of {url}.")
    return dest


def ids_rows(text: str) -> list[tuple[str, str, list[str]]]:
    """(code point, character, sequences with their regions) for every ideograph, in file order."""
    rows = []
    for line in text.lstrip("﻿").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        code_point, char, *sequences = line.rstrip("\r").split("\t")
        written = []
        for sequence in sequences:
            if sequence.startswith("*"):
                continue
            match = SEQUENCE.match(sequence.strip())
            if not match:
                raise ValueError(f"unreadable IDS for {code_point}: {sequence!r}")
            regions = match["regions"]
            written.append(match["ids"] + (f"({regions})" if regions else ""))
        if f"U+{ord(char):04X}" != code_point:
            raise ValueError(f"{code_point} is written {char!r}")
        rows.append((code_point, char, written))
    return rows


def file_date(text: str) -> str:
    match = re.search(r"^# File Date: (\S+)", text.lstrip("﻿"), re.MULTILINE)
    if not match:
        raise ValueError("IDS.TXT has no File Date header")
    return match[1]


def read_ids(path: Path) -> tuple[list[tuple[str, str, list[str]]], str, str]:
    """The rows of IDS.TXT at `path`, its File Date and its SHA-256."""
    raw = path.read_bytes()
    text = raw.decode("utf-8")
    return ids_rows(text), file_date(text), hashlib.sha256(raw).hexdigest()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--ids", type=Path, help="a local IDS.TXT instead of fetching it")
    parser.add_argument("--cache", type=Path, default=ROOT / "cache")
    parser.add_argument("--out", type=Path, default=TARGET)
    args = parser.parse_args(argv)
    path = args.ids or fetch(IDS_URL, args.cache / "IDS.TXT")
    rows, date, digest = read_ids(path)
    from tangut import read_tangut, SOURCE
    tangut = read_tangut(args.cache)
    lines = [
        f"# BabelStone IDS, {IDS_URL}, Andrew West (魏安); File Date {date}, sha256:{digest}",
        "# Public domain facts (IDS.TXT header, note 2). char<TAB>sequences, each with its source regions.",
        *(f"{char}\t{' '.join(sequences)}" for _, char, sequences in rows if sequences),
    ]
    lines.extend([f"# {SOURCE}", *(f"{char}\t{sequence}" for char, sequence in tangut)])
    text = "\n".join(lines) + "\n"
    args.out.parent.mkdir(parents=True, exist_ok=True)
    # A fixed mtime and no file name keep the output byte-identical between builds.
    args.out.write_bytes(gzip.compress(text.encode(), 9, mtime=0))
    print(f"{args.out}: {len(rows) + len(tangut)} ideographs, {len(text.encode())} bytes, {args.out.stat().st_size} gzipped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
