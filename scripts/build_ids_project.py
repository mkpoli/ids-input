# /// script
# requires-python = ">=3.11"
# ///
"""Build `data/ids-project.tsv.gz`, this project's own IDS descriptions.

BabelStone IDS covers Unicode 16.0 (File Date 2025-06-27) and Yi Bai's level-1 set stops earlier; a
character encoded later has no description in either. `data/ids-project.tsv` holds the descriptions
this project writes for those characters, one line per description, `char<TAB>IDS<TAB>source`. This
script checks each description, drops duplicates and writes the compact table the adapter reads
(`char<TAB>sequences`, as BabelStone's table is written) with the source file's digest in its header.

    uv run scripts/build_ids_project.py
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "ids-project.tsv"
TARGET = ROOT / "data" / "ids-project.tsv.gz"
ARITY = {
    **{operator: 2 for operator in "⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽㇯"},
    **{operator: 3 for operator in "⿲⿳"},
    **{operator: 1 for operator in "⿾⿿〾"},
}
SPACE = re.compile(r"[\s\u200b]")


def check(sequence: str) -> None:
    """Raise unless `sequence` is one whole IDS of the operators this project draws."""
    if not sequence or sequence[0] not in ARITY:
        raise ValueError(f"{sequence!r} does not start with an operator")
    if SPACE.search(sequence):
        raise ValueError(f"{sequence!r} has a space")
    chars, at = list(sequence), 0

    def node() -> None:
        nonlocal at
        if at >= len(chars):
            raise ValueError(f"{sequence!r} is missing a component")
        char = chars[at]
        at += 1
        for _ in range(ARITY.get(char, 0)):
            node()

    node()
    if at != len(chars):
        raise ValueError(f"{sequence!r} has more components than its operators take")


def read_source(path: Path) -> tuple[list[tuple[str, str]], str]:
    """(char, description) rows, and the file's digest. A character may have several descriptions."""
    raw = path.read_bytes()
    rows, seen = [], set()
    for number, line in enumerate(raw.decode("utf-8-sig").splitlines(), 1):
        if not line.strip() or line.startswith("#"):
            continue
        fields = line.split("\t")
        if len(fields) < 3 or not fields[2].strip():
            raise ValueError(f"{path.name}:{number}: expected char, IDS and source")
        char, sequence = fields[0], fields[1]
        if len(char) != 1:
            raise ValueError(f"{path.name}:{number}: {char!r} is not one character")
        check(sequence)
        if (char, sequence) not in seen:
            seen.add((char, sequence))
            rows.append((char, sequence))
    return rows, hashlib.sha256(raw).hexdigest()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--out", type=Path, default=TARGET)
    args = parser.parse_args(argv)
    rows, digest = read_source(args.source)
    lines = [
        "# The IDS Workshop's descriptions for characters newer than BabelStone IDS (Unicode 16.0) and Yi Bai's set.",
        f"# Source: data/{args.source.name}, sha256:{digest}. char<TAB>sequences; regions optional.",
        *(f"{char}\t{sequence}" for char, sequence in rows),
    ]
    text = "\n".join(lines) + "\n"
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(gzip.compress(text.encode(), 9, mtime=0))
    print(f"{args.out}: {len(rows)} descriptions for {len({char for char, _ in rows})} characters, {args.out.stat().st_size} gzipped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
