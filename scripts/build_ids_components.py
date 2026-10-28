# /// script
# requires-python = ">=3.11"
# ///
"""Build `data/ids-components.tsv`, the numbered components BabelStone IDS writes out.

IDS.TXT note 6 names a component it does not encode by number and, in its last column, the IDS
fragment that writes it out (`{22}` as `⿺㇉一`); `？` there means the maintainer has no fragment. One
line per component, `{n}<TAB>description<TAB>fragment`, the fragment empty where the note gives `？`.

`{12}`, the right of 龍, is supplied here as `⿷己三`: the note leaves it unrepresentable, and 龍's
description names its two halves, 𦚏 and ⿷己三. `{82}`, the top of 書, is supplied as 聿: the note
writes it `⿱𦘒一`, and the file uses the encoded 聿 for the same shape elsewhere.

    uv run scripts/build_ids_components.py [--ids path/to/IDS.TXT]

Without `--ids` the file is fetched into `cache/`. The adapter applies the fragments when it is given
this file (`components`), so a sequence's numbered components can be read as the IDS they name.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from build_ids_data import IDS_URL, fetch, file_date

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "data" / "ids-components.tsv"
NOTE = re.compile(r"^#\t\{(\d+)\}\t([^\t]*)\t(.*)$")
# `{12}`, the right of 龍, is ⿷己三. BabelStone leaves it `？`, but 龍's own description names the
# two halves and the pair writes 龍.
#
# `{82}`, the top of 書, is 聿. Note 6 writes the shape out as `⿱𦘒一`; the file itself alternates the
# encoded 聿 for that shape — 㶳 is `⿱{82}火` in G and `⿱聿火` in TP, 衋 is `⿱⿻聿皕血` in GHTKP and
# `⿳{82}皕血` in J, and 𤱪 was `⿱聿田` before Unicode 6.0 — so 書 reads ⿱聿日 and 畫 and 晝 reach
# the same 聿 that 建, 律 and 筆 use, through 𤱪 and 書.
REPLACEMENTS = {12: "⿷己三", 82: "聿"}


def rows(text: str) -> list[tuple[int, str, str]]:
    """Each numbered component's description and the fragment that writes it out, in file order."""
    out = {}
    for line in text.lstrip("﻿").splitlines():
        match = NOTE.match(line)
        if not match:
            continue
        number = int(match.group(1))
        # The PUA code point beside the shape stays as a reference; its character does not.
        description = re.sub(r"\(([0-9A-F]+)[^)]*\)", r"(\1)", match.group(2).strip()).strip()
        fragment = match.group(3).strip()
        if fragment == "？" or "{" in fragment:
            fragment = ""
        out[number] = (number, description, REPLACEMENTS.get(number, fragment))
    return [out[number] for number in sorted(out)]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--ids", type=Path, help="a local IDS.TXT instead of fetching it")
    parser.add_argument("--cache", type=Path, default=ROOT / "cache")
    parser.add_argument("--out", type=Path, default=TARGET)
    args = parser.parse_args(argv)
    path = args.ids or fetch(IDS_URL, args.cache / "IDS.TXT")
    text = path.read_text(encoding="utf-8-sig")
    found = rows(text)
    lines = [
        f"# BabelStone IDS numbered components, {IDS_URL}, Andrew West (魏安); File Date {file_date(text)}.",
        "# IDS.TXT note 6: {n}<TAB>description<TAB>the IDS fragment that writes the component out, empty where the note gives ？.",
        "# {12}, the right of 龍, is ⿷己三 here; the note leaves it unrepresentable.",
        "# {82}, the top of 書, is 聿 here; the note writes the same shape as ⿱𦘒一.",
        *(f"{{{number}}}\t{description}\t{fragment}" for number, description, fragment in found),
    ]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    written = sum(1 for _, _, fragment in found if fragment)
    print(f"{args.out}: {len(found)} components, {written} written out, {args.out.stat().st_size} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
