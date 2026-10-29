# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]>=4.50"]
# ///
"""Build `data/ids-parts.json`, the parts palette (難輸入部件).

A part is every component the sequences of BabelStone IDS name, so the palette indexes the whole
corpus rather than a chosen subset; a component the written-out descriptions introduce is a part
too. Each part counts the ideographs whose sequences use it, leaving out the sequences of ideographs
that hfhchan/ids keeps whole.
Each part counts the ideographs whose sequences use it, leaving out the sequences of ideographs that
hfhchan/ids keeps whole. BabelStone's numbered components are written out first, as IDS.TXT note 6
gives them, so 書 counts 聿 and 畫 counts 𤱪's own parts; a number the note leaves `？` stays unread and
counts for nothing. Every character of the CJK Strokes block (U+31C0–U+31E5) is a part, used or
not; CJK Radicals Supplement characters are parts when used. Operators and `？` are not parts.

Each part carries:
- `strokes`: Unihan's kTotalStrokes (its first value, which Unihan gives for the zh-Hans form where
  the forms differ). A part Unihan lacks gets the sum over the leaves of its first compound sequence
  whose leaves all have counts, marked derived; a CJK stroke counts 1 and is marked derived.
  The fourteen radical forms absent from Unihan use explicit counts; anything else stays null.
- `first`: the first stroke in Rime's five-stroke dictionary, using its first listed code when
  it lists alternatives, except that an s/z-only choice uses s (vertical hooks count as 豎).
  h/s/p/n/z map to 横/豎/撇/點/折. Unicode equivalents of CJK strokes use CLASS directly.
  The dictionary's Chinese stroke order can differ from Japanese order.
  The four-stroke grass radical ⻀ has an explicit 横 classification.
- `kind`: s for a CJK stroke; c (common) for a part that is a 常用漢字 (Unihan kJoyoKanji, with the
  form a U+XXXX value points to) or in the first level of the 通用规范汉字表 (Unihan kTGH, positions
  1–3500); d (difficult) for the rest. The palette's Common view lists the parts 50 or more
  ideographs use; its stroke groups list every c and d part.

    uv run scripts/build_ids_parts.py          # write data/ids-parts.json
    uv run scripts/build_ids_parts.py --font   # and the webfont subsets in fonts/
    bun run build:subtrees                    # then add compound parts from the bundled corpus

`--font` subsets Noto Sans CJK JP for the CJK strokes and Plangothic for the rest (both SIL OFL
1.1) to the parts few installed fonts draw: CJK strokes, CJK Radicals Supplement and the
supplementary planes (Extensions B–J). It writes `NotoSansCJKjp-ids-strokes.woff2` and
`Plangothic-ids-parts.woff2` under `fonts/`. The rest of the Basic Multilingual Plane, Extension A
included, comes from the reader's own CJK font.

IDS.TXT, Unihan, hfhchan/ids, Rime and the fonts are fetched once into `cache/`; all but IDS.TXT,
which is unversioned upstream, are checked against pinned SHA-256s.
The `first` field adapts Rime's stroke data under LGPL-3.0; see data/licences/.
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

from build_ids_data import IDS_URL, fetch, read_ids as read_ids_txt

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "data" / "ids-parts.json"
FONT_DIR = ROOT / "fonts"
PLANGOTHIC_URL = (
    "https://github.com/Fitzgerald-Porthmouth-Koenigsegg/Plangothic-Project/releases/download/V2.9.5795"
)
# Noto Sans CJK JP (at weight 400) draws the CJK strokes up to U+31E3, which Plangothic lacks;
# Plangothic draws the rest.
FONTS = {
    "PlangothicP1-Regular.ttf": (
        f"{PLANGOTHIC_URL}/PlangothicP1-Regular.ttf",
        "550b5d0775b15405946b18f4843df439a51e69508d7e6778d94c1f7a53dc5ad6",
    ),
    "PlangothicP2-Regular.ttf": (
        f"{PLANGOTHIC_URL}/PlangothicP2-Regular.ttf",
        "681933370adfe0fc7253f77735275a82fea09fe4f8adba907bdeb46c110daf8f",
    ),
    "NotoSansCJKjp-VF-2.004.ttf": (
        "https://github.com/notofonts/noto-cjk/raw/Sans2.004/Sans/Variable/TTF/NotoSansCJKjp-VF.ttf",
        "240c9b83bf7b386edbae39995ae7e068ed4583f484d92e4a74c34158b5f27b1a",
    ),
}
# Marks the editor draws beside the parts: ⬚ (U+2B1A DOTTED SQUARE), its empty slot.
MARKS = [0x2B1A]
# Each file, the fonts it is cut from and the code points it takes. The ranges do not overlap, so the
# page names them in one @font-face rule each.
FONT_FILES = {
    "NotoSansCJKjp-ids-strokes.woff2": (["NotoSansCJKjp-VF-2.004.ttf"], [(0x2B1A, 0x2B1A), (0x31C0, 0x31E3)]),
    "Plangothic-ids-parts.woff2": (
        ["PlangothicP1-Regular.ttf", "PlangothicP2-Regular.ttf"],
        [(0x2E80, 0x2EFF), (0x31E4, 0x31EF), (0x20000, 0x3FFFF)],
    ),
}

UNICODE_VERSION = "18.0.0"
UNIHAN_URL = f"https://www.unicode.org/Public/{UNICODE_VERSION}/ucd/Unihan.zip"
UNIHAN_SHA256 = "4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e"
HFHCHAN_URL = "https://github.com/hfhchan/ids/releases/download/v1.0.2/ids-20240112.txt"
HFHCHAN_SHA256 = "7466c8bd9151f1db5ef247fcbf84d7de4b36a6ec741e793c54972aa3dcbc0af4"
RIME_REVISION = "1e8fff9b9494ddec23b0cbc526bcfd8171a6fd48"
RIME_URL = f"https://raw.githubusercontent.com/rime/rime-stroke/{RIME_REVISION}/stroke.dict.yaml"
RIME_SHA256 = "b3e93dce89c185f45c3d6e189b86b3a8626913352cc85e1094c786579a665791"
RIME_SOURCE = f"Rime five-stroke dictionary, {RIME_REVISION}, LGPL-3.0, {RIME_URL}"
# CJK Radicals Supplement forms absent from Unihan kTotalStrokes.
RADICAL_COUNTS = dict(zip("⺊⺌⺗⺼⺈⺶⺄⺝⺀⺆⺻⻀⺂⺕", (2, 3, 4, 4, 2, 6, 1, 4, 2, 2, 5, 4, 1, 3), strict=True))

# Binary and ternary description characters, and the unary ones (〾 ⿾ ⿿); ㇯ subtracts.
OPERATORS = set("⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽⿾⿿㇯〾")
UNKNOWN = re.compile(r"\{\d+\}|？")
REGIONS = re.compile(r"\([^)]*\)$")
TGH_FIRST_LEVEL = 3500

# The CJK Strokes block, U+31C0–U+31E5, by the abbreviations of its Unicode 18.0 names (CJK STROKE
# <letters>), written out so the output does not depend on the Unicode version Python carries.
STROKE_NAMES = [
    "T",
    "WG",
    "XG",
    "BXG",
    "SW",
    "HZZ",
    "HZG",
    "HP",
    "HZWG",
    "SZWG",
    "HZT",
    "HZZP",
    "HPWG",
    "HZW",
    "HZZZ",
    "N",
    "H",
    "S",
    "P",
    "SP",
    "D",
    "HZ",
    "HG",
    "SZ",
    "SWZ",
    "ST",
    "SG",
    "PD",
    "PZ",
    "TN",
    "SZZ",
    "SWG",
    "HXWG",
    "HZZZG",
    "PG",
    "Q",
    "HXG",
    "SZP",
]
STROKES = [chr(0x31C0 + offset) for offset in range(len(STROKE_NAMES))]
# Stroke → class: the strokes named here are 横, 豎, 撇 or 點 (㇣ Q is none); every other stroke is 折.
_NAMED = {
    "H": "横",
    "T": "横",
    "S": "豎",
    "SG": "豎",
    "P": "撇",
    "SP": "撇",
    "D": "點",
    "N": "點",
    "TN": "點",
    "Q": None,
}
CLASS = {
    stroke: _NAMED.get(name, "折")
    for stroke, name in zip(STROKES, STROKE_NAMES, strict=True)
    if _NAMED.get(name, "折")
}

def components(ids: str) -> list[str]:
    """The components a sequence names, region tags, operators and unknown components dropped."""
    ids = UNKNOWN.sub("", REGIONS.sub("", ids))
    return [char for char in ids if char not in OPERATORS]


def numbered_fragments(text: str) -> dict[int, str]:
    """The IDS fragment note 6 gives each numbered component, by number."""
    from build_ids_components import rows as component_rows

    return {number: fragment for number, _, fragment in component_rows(text) if fragment}


def written_out(sequence: str, fragments: dict[int, str], seen: frozenset[int] = frozenset()) -> str:
    """`sequence` with its numbered components written out as the fragments give them."""
    def replace(match: re.Match[str]) -> str:
        number = int(match.group(1))
        fragment = fragments.get(number)
        if fragment is None or number in seen:
            return match.group(0)
        return written_out(fragment, fragments, seen | {number})

    return re.sub(r"\{(\d+)\}", replace, sequence)


def read_ids(path: Path) -> tuple[dict[str, list[str]], dict[str, list[str]], str]:
    """char → its sequences (region tags dropped) as IDS.TXT writes them, the same with numbered
    components written out, and the file's File Date."""
    rows, date, _ = read_ids_txt(path)
    fragments = numbered_fragments(path.read_text(encoding="utf-8-sig"))
    source: dict[str, list[str]] = {}
    written: dict[str, list[str]] = {}
    for _, char, sequences in rows:
        plain = [REGIONS.sub("", sequence) for sequence in sequences]
        source[char] = plain
        written[char] = [written_out(sequence, fragments) for sequence in plain]
    return source, written, date


def hfhchan_atomic(text: str) -> set[str]:
    """The characters hfhchan/ids leaves undecomposed: an entry with no operator that names the
    character itself, or a single character that is undecomposed in turn."""
    table = {}
    for line in text.splitlines():
        fields = line.rstrip("\r").split("\t")
        if len(fields) >= 3 and fields[1] and not line.startswith("#"):
            table[fields[1]] = fields[2].split("[")[0].strip()

    def whole(char: str, seen: tuple[str, ...] = ()) -> bool:
        entry = table.get(char)
        if entry is None or any(ch in OPERATORS for ch in entry):
            return False
        if entry == char:
            return True
        return len(entry) == 1 and entry not in seen and whole(entry, (*seen, char))

    return {char for char in table if whole(char)}


def compound(sequence: str) -> bool:
    return any(char in OPERATORS for char in sequence)


def parts(written: dict[str, list[str]], atomic: set[str]) -> Counter:
    """Each part → how many ideographs' sequences use it (once per ideograph).

    `written` is the table with BabelStone's numbered components written out, and the names and the
    count both follow it, so a component the write-out introduces is a part too. Ideographs hfhchan
    keeps whole contribute no parts, as before.
    """
    uses: Counter = Counter()
    for char, sequences in written.items():
        if char in atomic:
            continue
        named = {part for sequence in sequences if compound(sequence) for part in components(sequence)}
        named.discard(char)
        uses.update(named)
    return Counter(uses)


def unihan_fields(path: Path) -> dict[str, dict[str, str]]:
    wanted = {"kTotalStrokes", "kJoyoKanji", "kTGH"}
    found: dict[str, dict[str, str]] = defaultdict(dict)
    with zipfile.ZipFile(path) as archive:
        for name in ("Unihan_IRGSources.txt", "Unihan_OtherMappings.txt"):
            for line in archive.read(name).decode("utf-8").splitlines():
                cells = line.split("\t")
                if len(cells) == 3 and cells[1] in wanted:
                    found[cells[1]][chr(int(cells[0].removeprefix("U+"), 16))] = cells[2]
    return found


def common_set(unihan: dict[str, dict[str, str]]) -> set[str]:
    """常用漢字 and the first level of the 通用规范汉字表."""
    first_level = {
        char
        for char, value in unihan["kTGH"].items()
        if any(int(entry.split(":")[1]) <= TGH_FIRST_LEVEL for entry in value.split())
    }
    # A kJoyoKanji value of U+XXXX names the code point of the form the 常用漢字表 prints (剥 → 剝);
    # both are counted as common.
    joyo = set(unihan["kJoyoKanji"]) | {
        chr(int(value.removeprefix("U+"), 16))
        for value in unihan["kJoyoKanji"].values()
        if value.startswith("U+")
    }
    return joyo | first_level


def stroke_counts(
    names: list[str], ids: dict[str, list[str]], total: dict[str, str]
) -> dict[str, tuple[int | None, bool]]:
    """part → (stroke count, derived), from Unihan, else from its own first compound sequence."""
    unihan = {char: int(value.split()[0]) for char, value in total.items()}

    def count(char: str, seen: frozenset = frozenset()) -> tuple[int | None, bool]:
        if char in unihan:
            return unihan[char], False
        if char in RADICAL_COUNTS:
            return RADICAL_COUNTS[char], False
        if char in STROKES:
            return 1, True
        if char in seen:
            return None, False
        # The first sequence whose leaves all have counts; a later one is tried when an earlier fails.
        for sequence in ids.get(char, []):
            if compound(sequence) and not UNKNOWN.search(sequence):
                leaves = [count(leaf, seen | {char})[0] for leaf in components(sequence)]
                if leaves and all(value is not None for value in leaves):
                    return sum(leaves), True
        return None, False

    return {name: count(name) for name in names}


def first_strokes(text: str, forms: str = "") -> dict[str, str]:
    """Read complete Rime codes, normalizing vertical hooks and Unicode stroke equivalents."""
    classes = dict(zip("hspnz", "横豎撇點折", strict=True))
    codes: dict[str, list[str]] = defaultdict(list)
    for line in text.splitlines():
        fields = line.split("\t")
        if len(fields) < 2:
            continue
        char, code = fields[:2]
        if len(char) == 1 and code and all(stroke in classes for stroke in code):
            codes[char].append(code)
    first = {}
    for char, variants in codes.items():
        starts = {code[0] for code in variants}
        first[char] = classes["s" if starts == {"s", "z"} else variants[0][0]]
    # An equivalent encoded stroke must stay in the same geometric class.
    for line in forms.splitlines():
        fields = line.split("\t")
        if len(fields) == 4:
            form, char, source, detail = fields
            if source == "unicode-ucd" and detail == "EquivalentUnifiedIdeograph" and form in CLASS:
                first[char] = CLASS[form]
    # CJK RADICAL GRASS THREE: the four-stroke 艹 form begins with a horizontal.
    first["⻀"] = "横"
    # CJK RADICAL SECOND ONE is a single horizontal-fold stroke, which the five classes call 折.
    first["⺂"] = "折"
    return first


def palette(
    written: dict[str, list[str]],
    atomic: set[str],
    unihan: dict[str, dict[str, str]],
    first: dict[str, str],
) -> list[list]:
    """Rows `[part, uses, strokes, derived, first, kind]`, most used first; kind is c(ommon),
    d(ifficult) or s(troke)."""
    uses = parts(written, atomic)
    strokes = STROKES
    names = sorted(set(uses) | set(strokes), key=lambda char: (-uses.get(char, 0), ord(char)))
    counts = stroke_counts(names, written, unihan["kTotalStrokes"])
    common = common_set(unihan)
    rows = []
    for name in names:
        count, derived = counts[name]
        kind = "s" if name in strokes else "c" if name in common else "d"
        cls = CLASS.get(name) if kind == "s" else first.get(name)
        rows.append([name, uses.get(name, 0), count, 1 if derived else 0, cls, kind])
    return rows


def needs_font(char: str) -> bool:
    point = ord(char)
    return 0x2E80 <= point <= 0x2EFF or 0x31C0 <= point <= 0x31EF or point >= 0x20000


def subset_piece(source: Path, codes: list[int], path: Path) -> Path:
    from fontTools import subset
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer

    options = subset.Options()
    options.drop_tables += ["FFTM"]
    options.layout_features, options.name_IDs, options.notdef_outline = [], ["*"], True
    piece = subset.load_font(str(source), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=codes)
    subsetter.subset(piece)
    if "fvar" in piece:
        piece = instancer.instantiateVariableFont(piece, {"wght": 400})
    head = TTFont(source)["head"]
    piece["head"].created, piece["head"].modified = head.created, head.modified
    piece.recalcTimestamp = False
    path.parent.mkdir(parents=True, exist_ok=True)
    piece.save(path)
    return path


def font(rows: list[list], cache: Path, refresh: bool, out: Path = FONT_DIR) -> None:
    """Subset Noto Sans CJK JP and Plangothic P1 and P2 (merged) to the parts `needs_font` names and the
    editor's `MARKS`, one woff2 per family, so a page that shows no stroke never loads the strokes."""
    from fontTools.merge import Merger
    from fontTools.ttLib import TTFont

    wanted = sorted({ord(row[0]) for row in rows if needs_font(row[0])} | set(MARKS))
    covered: set[int] = set()
    for target, (names, ranges) in FONT_FILES.items():
        pieces = []
        for name in names:
            url, sha256 = FONTS[name]
            source = fetch(url, cache / name, sha256, refresh)
            cmap = TTFont(source).getBestCmap()
            codes = [
                code
                for code in wanted
                if code in cmap
                and code not in covered
                and any(first <= code <= last for first, last in ranges)
            ]
            if codes:
                covered.update(codes)
                pieces.append(str(subset_piece(source, codes, cache / "ids-parts" / f"part-{name}")))
        merged = Merger().merge(pieces) if len(pieces) > 1 else TTFont(pieces[0])
        head = TTFont(pieces[0])["head"]
        merged["head"].created, merged["head"].modified = head.created, head.modified
        merged.recalcTimestamp = False
        merged.flavor = "woff2"
        merged.save(out / target)
        print(
            f"{out / target}: {len(merged.getBestCmap())} characters, {(out / target).stat().st_size} bytes"
        )
    lacking = "".join(chr(code) for code in wanted if code not in covered)
    print(f"{len(covered)} of {len(wanted)} parts drawn; the fonts lack {lacking or 'none'}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cache", type=Path, default=ROOT / "cache")
    parser.add_argument("--out", type=Path, default=TARGET)
    parser.add_argument("--ids", type=Path, help="a local IDS.TXT instead of fetching it")
    parser.add_argument("--refresh", action="store_true", help="download again even when cached")
    parser.add_argument("--font", action="store_true", help="also write the webfont subset")
    args = parser.parse_args(argv)
    unihan_path = fetch(UNIHAN_URL, args.cache / f"Unihan-{UNICODE_VERSION}.zip", UNIHAN_SHA256, args.refresh)
    hfhchan_path = fetch(HFHCHAN_URL, args.cache / "hfhchan-ids-20240112.txt", HFHCHAN_SHA256, args.refresh)
    rime_path = fetch(RIME_URL, args.cache / "rime-stroke.dict.yaml", RIME_SHA256, args.refresh)
    ids_path = args.ids or fetch(IDS_URL, args.cache / "IDS.TXT", refresh=args.refresh)

    ids, written, ids_date = read_ids(ids_path)
    rows = palette(
        written,
        hfhchan_atomic(hfhchan_path.read_text(encoding="utf-8")),
        unihan_fields(unihan_path),
        first_strokes(rime_path.read_text(encoding="utf-8"), (ROOT / "data/component-forms.tsv").read_text(encoding="utf-8")),
    )
    from tangut import read_tangut, tangut_parts, SOURCE
    rows.extend(tangut_parts(read_tangut(args.cache)))
    document = {
        "columns": ["part", "uses", "strokes", "derived", "first", "kind"],
        "common": f"常用漢字 (Unihan kJoyoKanji) or 通用规范汉字表 level 1 (Unihan kTGH ≤ {TGH_FIRST_LEVEL})",
        "sources": [
            f"BabelStone IDS.TXT, File Date {ids_date}, PD, Andrew West, {IDS_URL}"
            "; numbered components written out per its note 6",
            f"hfhchan/ids v1.0.2, MIT, Copyright (c) 2021 Henry Chan, {HFHCHAN_URL}",
            f"Unihan {UNICODE_VERSION}, Unicode License v3, Copyright Unicode, Inc., {UNIHAN_URL}",
            RIME_SOURCE,
            SOURCE,
        ],
        "parts": rows,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n"
    args.out.write_text(text, encoding="utf-8")
    kinds = Counter(row[5] for row in rows)
    size = len(text.encode())
    packed = len(gzip.compress(text.encode(), 9))
    print(f"{args.out}: {len(rows)} parts ({dict(kinds)}), {size} bytes, {packed} gzipped")
    print(f"first strokes: {sum(row[4] is not None for row in rows)} classified")
    if args.font:
        font(rows, args.cache, args.refresh)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
