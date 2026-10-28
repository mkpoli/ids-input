# /// script
# requires-python = ">=3.11"
# ///
"""Build `data/character-vocabulary.tsv.gz`, the readings and meanings a character search knows.

Each row names one character: `name<TAB>char<TAB>source<TAB>detail`. The characters are the common
set Unicode's Unihan marks with `kIICore` (9,810 characters, all with an IDS description), so the
search offers characters the workshop can open and compose rather than the whole of Unicode.

- Unihan 18.0.0: kDefinition, kMandarin, kJapaneseOn, kJapaneseKun, kHangul and kVietnamese, and
  kIICore for the character set. Unicode License v3.
- KANJIDIC2 (EDRDG): English meanings, Japanese kana readings, pinyin, Korean and Vietnamese
  readings and nanori. CC BY-SA 4.0.

Both files are shared alike under CC BY-SA 4.0, because their KANJIDIC2 rows are. The build fetches
the two sources into `cache/`, checks them against their SHA-256, and writes both gzipped tables.
`--refresh` fetches them again.

    uv run scripts/build_character_vocabulary.py [--refresh]
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import re
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "cache"
IDS = ROOT / "data" / "babelstone-ids.tsv.gz"
TARGET = ROOT / "data" / "character-vocabulary.tsv.gz"
RARE_TARGET = ROOT / "data" / "character-vocabulary-rare.tsv.gz"

KANJIDIC2_URL = "https://www.edrdg.org/kanjidic/kanjidic2.xml.gz"
KANJIDIC2_SHA256 = "3617aa8a34015d4283f9ac22e00d2b80448f882cbc5a8e588b5f7ceae6493589"
UNIHAN_URL = "https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip"
UNIHAN_SHA256 = "4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e"

STOP = {"a", "an", "the", "and", "of", "to", "in", "for", "with", "or", "as", "at", "by", "from", "on", "into", "is", "be"}
MARKS = re.compile(r"[・·,，、.。:：;；/／|｜\\()（）「」『』【】\[\]{}<>《》〈〉'\"“”‘’!?！？~〜～\-—–_ー]+")
KATAKANA = re.compile(r"[\u30a1-\u30f6]")
KANA = re.compile(r"^[\u3041-\u3096\u30a1-\u30fa\u30fc]+$")
UNIHAN_FIELDS = {"kDefinition", "kMandarin", "kJapaneseOn", "kJapaneseKun", "kHangul", "kVietnamese", "kIICore", "kGradeLevel"}
KUNREI_PAIRS = (
    ("sha", "sya"), ("shu", "syu"), ("sho", "syo"), ("shi", "si"),
    ("cha", "tya"), ("chu", "tyu"), ("cho", "tyo"), ("chi", "ti"),
    ("ja", "zya"), ("ju", "zyu"), ("jo", "zyo"), ("ji", "zi"),
    ("tsu", "tu"), ("fu", "hu"),
)


def fetch(url: str, dest: Path, sha256: str, refresh: bool = False) -> Path:
    if refresh or not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(url, headers={"User-Agent": "ids-input character vocabulary build"})
        with urllib.request.urlopen(request, timeout=300) as response:
            dest.write_bytes(response.read())
    found = hashlib.sha256(dest.read_bytes()).hexdigest()
    if found != sha256:
        raise ValueError(f"{dest} does not match the pinned SHA-256 of {url}: {found}")
    return dest


def read_ids() -> set[str]:
    """The characters the IDS table describes."""
    chars: set[str] = set()
    with gzip.open(IDS, "rt", encoding="utf-8") as source:
        for line in source:
            if line and not line.startswith("#"):
                chars.add(line.split("\t", 1)[0])
    return chars


def read_unihan(path: Path) -> dict[str, dict[str, str]]:
    """Unihan readings, definitions and the IICore membership of each character."""
    fields: dict[str, dict[str, str]] = {name: {} for name in UNIHAN_FIELDS}
    with zipfile.ZipFile(path) as archive:
        for name in ("Unihan_Readings.txt", "Unihan_IRGSources.txt", "Unihan_DictionaryLikeData.txt"):
            for line in archive.read(name).decode("utf-8").splitlines():
                if not line or line.startswith("#"):
                    continue
                point, field, value = line.split("\t", 2)
                if field in fields:
                    fields[field][chr(int(point[2:], 16))] = value
    return fields


def read_kanjidic2(path: Path) -> dict[str, ET.Element]:
    with gzip.open(path) as source:
        root = ET.parse(source).getroot()
    return {entry.findtext("literal"): entry for entry in root.iter("character") if entry.findtext("literal")}


def meaning_senses(text: str) -> list[str]:
    """The short English senses of a definition, parentheticals, digits and 'radical' notes out."""
    text = re.sub(r"\([^)]*\)", "", text)
    senses = []
    for part in re.split(r"[,;]", text):
        part = part.strip().strip("\"' ")
        if not part or len(part) < 3 or len(part) > 40:
            continue
        if not re.fullmatch(r"[A-Za-z][A-Za-z '\-]*", part):
            continue
        if part.lower() in STOP or any(mark in part.lower() for mark in ("radical", "surname", "variant", "same as", "abbr", "see ")):
            continue
        if part.lower().startswith(("name of", "used in")):
            continue
        if part.lower() not in {sense.lower() for sense in senses}:
            senses.append(part)
        if len(senses) >= 6:
            break
    return senses


def pinyin_forms(text: str) -> list[str]:
    """Tone-less pinyin, the letters only, with both the u and the v spelling of ü."""
    plain = "".join(char for char in unicodedata.normalize("NFKD", text) if not 0x0300 <= ord(char) <= 0x036F)
    plain = re.sub(r"[^a-z]", "", plain.lower().replace("ü", "v"))
    forms = []
    for value in (plain.replace("v", "u"), plain):
        if len(value) >= 2 and value not in forms:
            forms.append(value)
    return forms


def kunrei(word: str) -> str:
    for hepburn, other in KUNREI_PAIRS:
        word = word.replace(hepburn, other)
    return word


def fold_name(text: str) -> str:
    """A name folded as the search folds a query: accents off, kana as hiragana, punctuation out."""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not 0x0300 <= ord(char) <= 0x036F)
    text = unicodedata.normalize("NFKC", text).lower()
    text = MARKS.sub("", text)
    return KATAKANA.sub(lambda match: chr(ord(match.group(0)) - 0x60), text)


def build(unihan: dict[str, dict[str, str]], kanjidic: dict[str, ET.Element], ids: set[str]) -> tuple[list[tuple[str, str, str, str, str]], list[tuple[str, str, str, str, str]]]:
    common = {char for char in ids if char in unihan["kIICore"] or char in kanjidic}
    named = {char for char in ids if char in kanjidic or any(unihan[field].get(char) for field in
             ("kDefinition", "kMandarin", "kJapaneseOn", "kJapaneseKun", "kHangul", "kVietnamese"))}
    # Newspaper frequency for the kanji KANJIDIC2 ranks, the school grade for the others; a lower
    # number comes first among equally close names.
    ranks: dict[str, int] = {}
    for char in named:
        entry = kanjidic.get(char)
        frequency = entry.findtext("misc/freq") if entry is not None else None
        if frequency and frequency.isdigit():
            ranks[char] = int(frequency)
        else:
            grade = unihan["kGradeLevel"].get(char, "")
            if grade.isdigit():
                ranks[char] = 3000 + int(grade)
    rows: list[tuple[str, str, str, str, str]] = []

    def add(name: str, char: str, source: str, detail: str) -> None:
        name = name.strip()
        if not name or len(name) > 40 or char not in named:
            return
        rows.append((name, char, source, detail, str(ranks.get(char, ""))))

    for char in sorted(named):
        definitions = unihan["kDefinition"].get(char, "")
        for sense in meaning_senses(definitions):
            add(sense, char, "unihan", f"kDefinition of {char}")
        for value in unihan["kMandarin"].get(char, "").split():
            for written in pinyin_forms(value):
                add(written, char, "unihan", f"kMandarin of {char}")
        for field in ("kJapaneseOn", "kJapaneseKun"):
            for value in unihan[field].get(char, "").split():
                word = re.sub(r"[^a-z]", "", value.lower())
                if len(word) >= 2:
                    add(word, char, "unihan", f"{field} of {char}")
                    other = kunrei(word)
                    if other != word:
                        add(other, char, "unihan", f"Kunrei of {field} of {char}")
        for value in unihan["kHangul"].get(char, "").split():
            word = value.split(":", 1)[0]
            if word:
                add(word, char, "unihan", f"kHangul of {char}")
        for value in unihan["kVietnamese"].get(char, "").split():
            add(value, char, "unihan", f"kVietnamese of {char}")

        entry = kanjidic.get(char)
        if entry is None:
            continue
        for meaning in entry.iter("meaning"):
            if not (meaning.text and meaning.get("m_lang") in (None, "en")):
                continue
            senses = meaning_senses(meaning.text)
            if senses:
                add(senses[0], char, "kanjidic2", f"meaning of {char}")
                break
        for reading in entry.iter("reading"):
            kind, value = reading.get("r_type"), (reading.text or "").strip()
            if not value:
                continue
            if kind in ("ja_on", "ja_kun", "nanori"):
                if KANA.fullmatch(value):
                    add(value, char, "kanjidic2", f"{kind} reading of {char}")
            elif kind == "pinyin":
                for written in pinyin_forms(value):
                    add(written, char, "kanjidic2", f"pinyin of {char}")
            elif kind == "korean_h":
                for word in value.split():
                    add(word, char, "kanjidic2", f"korean reading of {char}")
            elif kind == "vietnam":
                add(value, char, "kanjidic2", f"vietnam reading of {char}")

    seen: dict[tuple[str, str], int] = {}
    out: list[tuple[str, str, str, str, str]] = []
    for name, char, source, detail, rank in rows:
        key = (fold_name(name), char)
        if key in seen:
            at = seen[key]
            old_name, old_char, old_source, old_detail, old_rank = out[at]
            sources = sorted(set(old_source.split(",")) | set(source.split(",")))
            out[at] = (old_name, old_char, ",".join(sources), old_detail, old_rank)
        else:
            seen[key] = len(out)
            out.append((name, char, source, detail, rank))
    out.sort(key=lambda row: (ord(row[1][0]), fold_name(row[0]), row[0]))
    return [row for row in out if row[1] in common], [row for row in out if row[1] not in common]


def header(rows: list[tuple[str, str, str, str, str]], rare: bool = False) -> str:
    title = "rare characters" if rare else "common characters and KANJIDIC2 kanji"
    return f"""# The readings and meanings of {title}, for the character search (src/core/names.js).
# columns: name, char, source, detail, rank
# rows: {len(rows)}
# rank: lower is more common; KANJIDIC2 newspaper frequency, or 3000 plus Unihan's kGradeLevel
# Built by scripts/build_character_vocabulary.py.
# source unihan: Unihan 18.0.0 (Unicode Character Database), Unicode License v3, Copyright Unicode, Inc.; kDefinition, kMandarin, kJapaneseOn, kJapaneseKun, kHangul, kVietnamese and kIICore; SHA-256 {UNIHAN_SHA256}
#   https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip
# source kanjidic2: KANJIDIC2 (file version 4, database version 2026-300, created 2026-10-27), Electronic Dictionary Research and Development Group, CC BY-SA 4.0; Copyright EDRDG
#   meanings, Japanese, Korean and Vietnamese readings, pinyin and nanori; https://www.edrdg.org/kanjidic/kanjidic2.xml.gz
# The characters are {'every named IDS character outside the common table' if rare else "Unihan's kIICore set plus every KANJIDIC2 character"}, all with an IDS description.
# The file as a whole is shared alike under CC BY-SA 4.0, because the KANJIDIC2 rows are:
# https://creativecommons.org/licenses/by-sa/4.0/
"""


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="fetch the sources again")
    args = parser.parse_args(argv)
    CACHE.mkdir(parents=True, exist_ok=True)
    fetch(KANJIDIC2_URL, CACHE / "kanjidic2.xml.gz", KANJIDIC2_SHA256, args.refresh)
    fetch(UNIHAN_URL, CACHE / "Unihan.zip", UNIHAN_SHA256, args.refresh)
    unihan = read_unihan(CACHE / "Unihan.zip")
    kanjidic = read_kanjidic2(CACHE / "kanjidic2.xml.gz")
    common, rare = build(unihan, kanjidic, read_ids())
    for path, rows, is_rare in ((TARGET, common, False), (RARE_TARGET, rare, True)):
        text = header(rows, is_rare) + "".join("\t".join(row) + "\n" for row in rows)
        path.write_bytes(gzip.compress(text.encode("utf-8"), 9))
        print(f"wrote {path} ({len(rows)} names, {path.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
