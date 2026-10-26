# /// script
# requires-python = ">=3.11"
# dependencies = ["opencc==1.4.2", "pypinyin==0.55.0"]
# ///
"""Build `data/component-names.tsv`, the names people call components by, for the component search.

Each row names one component: `name<TAB>char<TAB>source<TAB>detail`. The names come from dictionaries
and reference works that record the names of the 214 Kangxi radicals and their positional forms, and
from their readings and meanings:

- anzumura/kanji-tools `data/radicals.txt`: the 214 radicals with their Japanese names and readings
  (のぎ, のぶん, うかんむり), MIT licence.
- KANJIDIC2 (EDRDG): further Japanese radical names, CC BY-SA 4.0.
- Japanese Wikipedia: the redirects to each radical's article (ノ文 to 攴部, ノ木偏 to 禾部), CC BY-SA 4.0.
- catusf/tudien `dict/radical_name.txt`: the Chinese names of the radicals (宝盖头, 绞丝旁, 反文旁), CC0 1.0.
- amzxyz/rime-wanxiang `lua/data/others.txt`: the block of Chinese radical nicknames (宝盖, 绞丝, 秃宝盖), CC BY 4.0.
- Mararsh/MyBox `docs/data2d/ChineseRadicals_example_zh.csv`: one Chinese name for each radical (鱼字旁,
  鸟字旁, 门字框, 骨字旁), Apache 2.0.
- Chinese Wikipedia: the redirects to each radical's article (絞絲旁, 三點水, 寶蓋頭), CC BY-SA 4.0.
- Unihan 18.0.0: kDefinition, kMandarin, kJapaneseOn and kJapaneseKun of each radical (water, silk,
  roof, shui, sui, mizu), Unicode License v3.
- KANJIDIC2: the English meanings, Japanese readings and pinyin of each radical (thread, person, みず,
  いと), CC BY-SA 4.0.
- pypinyin 0.55.0: the pinyin of each Chinese name (baogaitou, jiaosipang, sandianshui), MIT.
- An editorial Hepburn and Kunrei table: the romanization of each kana name (nobun, sanzui, ukanmuri, nogihen; si, ti, tu, hu for the Kunrei spellings).

The traditional or simplified spelling of a Chinese name is added through OpenCC (Apache 2.0) when it
differs, except for characters that are radicals in their own right (几, 厂, 干, 尸, 里, 凶, 虫): those
stay as they are, since 几 must not become 幾 and 尸 must not become 屍. A redirect that names another
radical than the article it points to (男部 to 女部, 鳥偏 to 酉部) is left out.

The Chinese scripts and component forms are folded together for the search by
`data/component-name-folds.tsv`, which this script also writes: OpenCC (Apache 2.0) supplies the
traditional and simplified spellings, the component-forms table the positional forms, and a small
table the Japanese shinjitai forms (竜, 亀, 斉, 歯) that the other two leave apart.

The files with a fixed revision are fetched once into `cache/` and checked against their SHA-256. The
Wikipedia redirects are kept in `data/component-name-redirects.json`; `--refresh` fetches them again
and rewrites that file. The build writes `data/component-names.tsv` and
`data/component-name-folds.tsv`.

    uv run scripts/build_component_names.py [--refresh]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
import unicodedata
import zipfile
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

import opencc
from pypinyin import lazy_pinyin

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "cache"
TARGET = ROOT / "data" / "component-names.tsv"
FOLDS_TARGET = ROOT / "data" / "component-name-folds.tsv"
REDIRECTS = ROOT / "data" / "component-name-redirects.json"

KANJI_TOOLS_REV = "c3e52cbca38a1fdbf9a96abb1dd015450cc1411c"
KANJI_TOOLS_URL = f"https://raw.githubusercontent.com/anzumura/kanji-tools/{KANJI_TOOLS_REV}/data/radicals.txt"
KANJI_TOOLS_SHA256 = "22dd2611343c5d14d0214458888f601a0ae18d9b58425620b06ae80b36359aab"

TUDIEN_REV = "a214ee303eac33528b8be9aa54c5b10cd70270b3"
TUDIEN_URL = f"https://raw.githubusercontent.com/catusf/tudien/{TUDIEN_REV}/dict/radical_name.txt"
TUDIEN_SHA256 = "a694fc66d1a15e2c647044b8e9586001e1a4d3cfdfc0e93a58c5b3b4c41c7376"

RIME_REV = "275c61be289b57e7cc3fe854312e449bae82578c"
RIME_URL = f"https://raw.githubusercontent.com/amzxyz/rime-wanxiang/{RIME_REV}/lua/data/others.txt"
RIME_SHA256 = "166e4bd6201542cd12812d8f7712d8e4b2ee4111e3e95e42293d2a0a1fc586e6"

MYBOX_REV = "107ddc379fd2f4caad37e85c29367d21089b568c"
MYBOX_URL = f"https://raw.githubusercontent.com/Mararsh/MyBox/{MYBOX_REV}/docs/data2d/ChineseRadicals_example_zh.csv"
MYBOX_SHA256 = "a1c61d488ec56bfb6daaefa9d3fd77eddd093d345fceeb0bafe4d33c5631667e"

KANJIDIC2_URL = "https://www.edrdg.org/kanjidic/kanjidic2.xml.gz"
KANJIDIC2_SHA256 = "bdf75923744b355dfb678da8c7ae558342e06d5958998fcdde07c7a281a5fdd6"

UNIHAN_URL = "https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip"
UNIHAN_SHA256 = "4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e"

# Six articles whose base title is a disambiguation page or another subject.
JA_TITLES = {
    "一部": "一部 (部首)",
    "入部": "入部 (部首)",
    "木部": "木部 (部首)",
    "戸部": "戸部 (部首)",
    "支部": "支部 (部首)",
    "田部": "田部 (部首)",
}
# A name for one of a radical's forms, when the common form is not the article's first form.
PREFERRED = {"阜": "阝", "邑": "阝", "攴": "攵", "辵": "辶", "艸": "艹"}
# Redirects that name a different character than the article they point to.
DENY = {
    ("男部", "zh-wikipedia"),
    ("仑部", "zh-wikipedia"),
    ("侖部", "zh-wikipedia"),
    ("围部", "zh-wikipedia"),
    ("鳥偏", "ja-wikipedia"),
}
# Radicals that must not be replaced by a homophone when a name is written in traditional script.
PROTECT = "几厂干尸里凶虫斗鬥"
PLACE = {char: chr(0xE000 + i) for i, char in enumerate(PROTECT)}
BACK = {place: char for char, place in PLACE.items()}

CJK = re.compile(r"[\u3400-\u9fff\uf900-\ufaff\U00020000-\U0003ffff]+")
KANA = re.compile(r"[\u3040-\u30ff]")
PUA = re.compile(r"[\ue000-\uf8ff]")
S2T = opencc.OpenCC("s2t")
T2S = opencc.OpenCC("t2s")


def fetch(url: str, dest: Path, sha256: str, refresh: bool = False) -> Path:
    """`url` saved at `dest` once, checked against `sha256`."""
    if refresh or not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(url, headers={"User-Agent": "ids-input component-names build"})
        with urllib.request.urlopen(request, timeout=300) as response:
            dest.write_bytes(response.read())
    found = hashlib.sha256(dest.read_bytes()).hexdigest()
    if found != sha256:
        raise ValueError(f"{dest} does not match the pinned SHA-256 of {url}: {found}")
    return dest


def get_json(url: str) -> dict:
    """A JSON document from an API, tried again when the service is busy."""
    for attempt in range(5):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "ids-input component-names build"})
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.load(response)
        except Exception:
            if attempt == 4:
                raise
            time.sleep(2**attempt)
    raise AssertionError("unreachable")


def batched(items: list[str], size: int):
    for start in range(0, len(items), size):
        yield items[start:start + size]


def read_forms() -> dict[str, str]:
    """The forms table (`data/component-forms.tsv`) as form → the form it folds to."""
    parent: dict[str, str] = {}
    for line in (ROOT / "data/component-forms.tsv").read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or line.startswith("form\t"):
            continue
        form, char = line.split("\t")[:2]
        parent[form] = char

    def root(char: str) -> str:
        while parent.get(char, char) != char:
            char = parent[char]
        return char

    return {form: root(parent[form]) for form in parent}


FORMS: dict[str, str] = read_forms()
RADICALS = [unicodedata.normalize("NFKC", chr(0x2F00 + index)) for index in range(214)]
RADICAL_SET = set(RADICALS)


def fold_name(text: str) -> str:
    """A name folded the way the search folds a query: NFKC, katakana as hiragana, spaces out."""
    text = unicodedata.normalize("NFKC", text).lower()
    text = re.sub(r"[・·,，、.。:：;；/／|｜\\()（）「」『』【】\[\]{}<>《》〈〉'\"“”‘’!?！？~〜～\-—–_ー]+", "", text)
    text = re.sub(r"[\u30a1-\u30f6]", lambda char: chr(ord(char.group(0)) - 0x60), text)
    return text


def canonical(char: str) -> str:
    return FORMS.get(char, char)


def target(radical: str) -> str:
    return PREFERRED.get(radical, radical)


def read_kanji_tools(path: Path) -> list[list[str]]:
    """Number, forms, long name and readings of each radical, in order."""
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        fields = line.rstrip("\n").split("\t")
        if len(fields) >= 4 and fields[0].isdigit():
            rows.append(fields)
    if len(rows) != 214:
        raise ValueError(f"kanji-tools radicals.txt holds {len(rows)} radicals, not 214")
    return rows


def read_tudien(path: Path) -> dict[str, list[str]]:
    """The named radical entries: radical character → the Chinese names the entry gives."""
    names: dict[str, list[str]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        field = line.split("\t")[0].strip() if line.strip() else ""
        if len(field) != 1 or not 0x2F00 <= ord(field) <= 0x2FD5:
            continue
        radical = unicodedata.normalize("NFKC", field)
        match = re.search(r"NAME(.*?)(?:VARIANTS|STANDALONE|MEANING|EXAMPLES|RANK|MNEMONIC|NOTES|HOMEPAGE)", line, re.S)
        if not match:
            continue
        given = []
        for part in PUA.sub("", match.group(1)).split("·"):
            found = CJK.findall(part)
            if found:
                given.append(found[0])
        if given:
            names.setdefault(radical, []).extend(given)
    return names


def read_rime(path: Path) -> dict[str, list[str]]:
    """The radical-nickname block's names → the components they stand for."""
    lines = path.read_text(encoding="utf-8").splitlines()
    start = next(index for index, line in enumerate(lines) if line.startswith("厂部\t"))
    end = next(index for index, line in enumerate(lines) if line.startswith("石字头\t"))
    names: dict[str, list[str]] = {}
    for line in lines[start:end + 1]:
        if "\t" not in line:
            continue
        key, value = line.split("\t", 1)
        if not CJK.fullmatch(key) or not 2 <= len(key) <= 8:
            continue
        if KANA.search(value) or re.search(r"[A-Za-z0-9]", value):
            continue
        chars = [char for char in value.replace(" ", "") if CJK.fullmatch(char)]
        extra = [char for char in chars if char not in key]
        targets = [char for char in extra if canonical(char) in RADICAL_SET]
        if targets:
            names.setdefault(key, []).append(targets[0])
    return names


def read_mybox(path: Path) -> dict[str, str]:
    """The one Chinese name each radical gets in MyBox's table: radical → name."""
    names: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines()[1:]:
        fields = line.split(",")
        if len(fields) < 2 or len(fields[0]) != 1:
            continue
        names[fields[0]] = fields[1]
    if len(names) < 214:
        raise ValueError(f"MyBox ChineseRadicals_example_zh.csv holds {len(names)} radicals, fewer than 214")
    return names


def read_unihan(path: Path) -> dict[str, dict[str, str]]:
    """Unihan's readings for the radicals: kDefinition, kMandarin, kJapaneseOn and kJapaneseKun."""
    fields = {"kDefinition": {}, "kMandarin": {}, "kJapaneseOn": {}, "kJapaneseKun": {}}
    with zipfile.ZipFile(path) as archive:
        text = archive.read("Unihan_Readings.txt").decode("utf-8")
    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t", 2)
        if len(parts) != 3 or parts[1] not in fields:
            continue
        fields[parts[1]][chr(int(parts[0][2:], 16))] = parts[2]
    return fields


STOP = {"a", "an", "the", "and", "of", "to", "in", "for", "with", "or", "as", "at", "by", "from", "on", "into", "is", "be"}


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


def pinyin_forms(name: str) -> list[str]:
    """Tone-less pinyin of a Chinese name, the letters only, with both spellings of ü (u and v)."""
    if not name or not all(CJK.fullmatch(char) for char in name):
        return []
    # pypinyin writes ü as v; offer both the v and the u spelling.
    written = "".join(lazy_pinyin(name)).lower().replace("ü", "v")
    written = re.sub(r"[^a-z]", "", written)
    forms = []
    for value in (written.replace("v", "u"), written):
        if len(value) >= 2 and value not in forms:
            forms.append(value)
    return forms


DIGRAPHS = {
    "きゃ": "kya", "きゅ": "kyu", "きょ": "kyo", "しゃ": "sha", "しゅ": "shu", "しょ": "sho",
    "ちゃ": "cha", "ちゅ": "chu", "ちょ": "cho", "にゃ": "nya", "にゅ": "nyu", "にょ": "nyo",
    "ひゃ": "hya", "ひゅ": "hyu", "ひょ": "hyo", "みゃ": "mya", "みゅ": "myu", "みょ": "myo",
    "りゃ": "rya", "りゅ": "ryu", "りょ": "ryo", "ぎゃ": "gya", "ぎゅ": "gyu", "ぎょ": "gyo",
    "じゃ": "ja", "じゅ": "ju", "じょ": "jo", "びゃ": "bya", "びゅ": "byu", "びょ": "byo",
    "ぴゃ": "pya", "ぴゅ": "pyu", "ぴょ": "pyo", "ふぁ": "fa", "ふぃ": "fi", "ふぇ": "fe",
    "ふぉ": "fo", "てぃ": "ti", "でぃ": "di", "うぇ": "we", "うぃ": "wi", "うぉ": "wo",
}
KANA_ROMAJI = {
    "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o", "か": "ka", "き": "ki", "く": "ku",
    "け": "ke", "こ": "ko", "さ": "sa", "し": "shi", "す": "su", "せ": "se", "そ": "so",
    "た": "ta", "ち": "chi", "つ": "tsu", "て": "te", "と": "to", "な": "na", "に": "ni",
    "ぬ": "nu", "ね": "ne", "の": "no", "は": "ha", "ひ": "hi", "ふ": "fu", "へ": "he",
    "ほ": "ho", "ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo", "や": "ya",
    "ゆ": "yu", "よ": "yo", "ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro",
    "わ": "wa", "ゐ": "i", "ゑ": "e", "を": "o", "ん": "n", "が": "ga", "ぎ": "gi",
    "ぐ": "gu", "げ": "ge", "ご": "go", "ざ": "za", "じ": "ji", "ず": "zu", "ぜ": "ze",
    "ぞ": "zo", "だ": "da", "ぢ": "ji", "づ": "zu", "で": "de", "ど": "do", "ば": "ba",
    "び": "bi", "ぶ": "bu", "べ": "be", "ぼ": "bo", "ぱ": "pa", "ぴ": "pi", "ぷ": "pu",
    "ぺ": "pe", "ぽ": "po", "ぁ": "a", "ぃ": "i", "ぅ": "u", "ぇ": "e", "ぉ": "o",
    "ゃ": "ya", "ゅ": "yu", "ょ": "yo", "ゔ": "vu", "ゕ": "ka", "ゖ": "ke",
}


KUNREI_DIGRAPHS = dict(DIGRAPHS)
KUNREI_DIGRAPHS.update({
    "しゃ": "sya", "しゅ": "syu", "しょ": "syo", "ちゃ": "tya", "ちゅ": "tyu", "ちょ": "tyo",
    "じゃ": "zya", "じゅ": "zyu", "じょ": "zyo",
})
KUNREI_KANA = dict(KANA_ROMAJI)
KUNREI_KANA.update({"し": "si", "ち": "ti", "つ": "tu", "ふ": "hu", "じ": "zi", "ぢ": "zi", "づ": "zu"})


def romanize(text: str, table: dict[str, str] = KANA_ROMAJI, digraphs: dict[str, str] = DIGRAPHS) -> str:
    """Hepburn or Kunrei romanization of kana, long vowel marks and the small tsu read the usual way."""
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[\s　・]", "", text)
    text = re.sub(r"[\u30a1-\u30f6]", lambda char: chr(ord(char.group(0)) - 0x60), text)
    text = text.replace("ヵ", "か").replace("ヶ", "け")
    out = []
    at = 0
    while at < len(text):
        char = text[at]
        if char == "っ":
            following = text[at + 1:at + 3]
            reading = digraphs.get(following) or table.get(text[at + 1:at + 2], "")
            if reading:
                out.append(reading[0])
            at += 1
            continue
        pair = text[at:at + 2]
        if pair in digraphs:
            out.append(digraphs[pair])
            at += 2
            continue
        if char in table:
            out.append(table[char])
            at += 1
            continue
        if char == "ー" and out:
            vowel = next((letter for letter in reversed(out[-1]) if letter in "aeiou"), "")
            out.append(vowel)
            at += 1
            continue
        return ""
    return "".join(out)


KUNREI_PAIRS = (
    ("sha", "sya"), ("shu", "syu"), ("sho", "syo"), ("shi", "si"),
    ("cha", "tya"), ("chu", "tyu"), ("cho", "tyo"), ("chi", "ti"),
    ("ja", "zya"), ("ju", "zyu"), ("jo", "zyo"), ("ji", "zi"),
    ("tsu", "tu"), ("fu", "hu"),
)


def kunrei_reading(word: str) -> str:
    """A Hepburn reading respelled the Kunrei way: shi as si, chi as ti, tsu as tu, fu as hu."""
    for hepburn, kunrei in KUNREI_PAIRS:
        word = word.replace(hepburn, kunrei)
    return word


def read_wikipedia(refresh: bool) -> dict:
    """The redirects to the radical articles, in Japanese and Chinese, and the QIDs they came from."""
    if not refresh and REDIRECTS.exists():
        return json.loads(REDIRECTS.read_text(encoding="utf-8"))
    kanji_tools = read_kanji_tools(fetch(KANJI_TOOLS_URL, CACHE / "kanji-tools-radicals.txt", KANJI_TOOLS_SHA256))
    ja_titles = []
    for _, names, long_name, _ in kanji_tools:
        title = re.match(r"^([^（(]+)[（(]", long_name)
        base = title.group(1) if title else long_name
        ja_titles.append(JA_TITLES.get(base, base))
    ja: dict[str, list[str]] = {}
    qids: dict[str, str] = {}
    for chunk in batched(ja_titles, 40):
        url = ("https://ja.wikipedia.org/w/api.php?action=query&format=json&formatversion=2"
               "&prop=redirects&rdlimit=max&titles=" + urllib.parse.quote("|".join(chunk)))
        for page in get_json(url)["query"]["pages"]:
            ja[page["title"]] = [redirect["title"] for redirect in page.get("redirects", [])]
        time.sleep(1)
    for chunk in batched(ja_titles, 40):
        url = ("https://ja.wikipedia.org/w/api.php?action=query&format=json&formatversion=2"
               "&prop=pageprops&ppprop=wikibase_item&titles=" + urllib.parse.quote("|".join(chunk)))
        for page in get_json(url)["query"]["pages"]:
            qid = page.get("pageprops", {}).get("wikibase_item")
            if qid:
                qids[page["title"]] = qid
        time.sleep(1)
    zh_titles: dict[str, str] = {}
    for chunk in batched(list(dict.fromkeys(qids.values())), 50):
        url = ("https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks"
               "&sitefilter=zhwiki&ids=" + "|".join(chunk))
        for qid, entity in get_json(url)["entities"].items():
            title = entity.get("sitelinks", {}).get("zhwiki", {}).get("title")
            if title:
                zh_titles[qid] = title
        time.sleep(1)
    zh: dict[str, list[str]] = {}
    for chunk in batched(list(dict.fromkeys(zh_titles.values())), 40):
        url = ("https://zh.wikipedia.org/w/api.php?action=query&format=json&formatversion=2"
               "&prop=redirects&rdlimit=max&titles=" + urllib.parse.quote("|".join(chunk)))
        for page in get_json(url)["query"]["pages"]:
            zh[page["title"]] = [redirect["title"] for redirect in page.get("redirects", [])]
        time.sleep(1)
    result = {
        "note": "The redirects to the Japanese and Chinese Wikipedia articles on the 214 Kangxi radicals. "
                "CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/. qid_by_title connects each "
                "Japanese article to its Wikidata item; zh_titles maps the item to its Chinese article.",
        "fetched": date.today().isoformat(),
        "ja": ja,
        "qid_by_title": qids,
        "zh_titles": zh_titles,
        "zh": zh,
    }
    REDIRECTS.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    return result


def protected(text: str) -> str:
    return "".join(PLACE.get(char, char) for char in text)


def restored(text: str) -> str:
    return "".join(BACK.get(char, char) for char in text)


KANJIDIC_VARIANT = {"戶": "戸", "靑": "青"}
CHINESE_SOURCES = {"tudien", "rime-wanxiang", "zh-wikipedia", "mybox"}
JAPANESE_SOURCES = {"kanji-tools", "kanjidic2", "ja-wikipedia"}
KANA_ONLY = re.compile(r"^[\u3041-\u3096\u30a1-\u30fa\u30fc・\s　]+$")


def build(wikipedia: dict, unihan: dict[str, dict[str, str]]) -> list[tuple[str, str, str, str]]:
    kanji_tools = read_kanji_tools(CACHE / "kanji-tools-radicals.txt")
    tudien = read_tudien(CACHE / "tudien-radical-name.txt")
    rime = read_rime(CACHE / "rime-others.txt")
    mybox = read_mybox(CACHE / "mybox-radicals.csv")
    kanjidic = ET.parse(CACHE / "kanjidic2.xml").getroot()
    by_literal = {character.findtext("literal"): character for character in kanjidic.iter("character") if character.findtext("literal")}
    definitions = unihan["kDefinition"]
    mandarins = unihan["kMandarin"]
    on_readings = unihan["kJapaneseOn"]
    kun_readings = unihan["kJapaneseKun"]

    rows: list[tuple[str, str, str, str]] = []

    def add(name: str, char: str, source: str, detail: str = "") -> None:
        name = name.strip()
        if not name or not char or (name, source) in DENY:
            return
        rows.append((name, char, source, detail))

    def dedupe(given: list[tuple[str, str, str, str]]) -> list[tuple[str, str, str, str]]:
        seen: dict[tuple[str, str], int] = {}
        out: list[tuple[str, str, str, str]] = []
        for name, char, source, detail in given:
            key = (fold_name(name), canonical(char))
            if key in seen:
                at = seen[key]
                old_name, old_char, old_source, old_detail = out[at]
                sources = sorted(set(old_source.split(",")) | set(source.split(",")))
                out[at] = (old_name, old_char, ",".join(sources), old_detail)
            else:
                seen[key] = len(out)
                out.append((name, char, source, detail))
        return out

    # 1. The Japanese names, readings and numbers of the 214 radicals.
    for number, forms, long_name, readings in kanji_tools:
        first = unicodedata.normalize("NFKC", forms.split()[0])
        char = target(first)
        match = re.match(r"^([^（(]+)[（(]([^）)]*)[）)]", long_name)
        title, inside = (match.group(1), match.group(2)) if match else (long_name, "")
        for name in [inside, *readings.split()]:
            add(name, char, "kanji-tools", f"radical {number}")
        add(title, char, "kanji-tools", f"radical {number}")
        for form in forms.split()[1:]:
            add(form, char, "kanji-tools", f"radical {number} form")
        add(f"radical {int(number)}", char, "kanji-tools", "radical number")

    # 2. Further Japanese names KANJIDIC2 records for the radicals.
    for character in by_literal.values():
        literal = character.findtext("literal")
        names = [name.text for name in character.iter("rad_name") if name.text]
        if not names:
            continue
        char = target(canonical(literal))
        for name in names:
            add(name, char, "kanjidic2", f"radical name of {literal}")

    # 3. The Chinese names the radical dictionary gives.
    for radical, names in tudien.items():
        for name in names:
            add(name, target(radical), "tudien", "zh name")

    # 4. The Chinese radical nicknames.
    for name, chars in rime.items():
        add(name, chars[0], "rime-wanxiang", "zh nickname")

    # 5. The one Chinese name each radical gets in MyBox's table.
    for radical, name in mybox.items():
        add(name, target(canonical(radical)), "mybox", "zh radical name")

    # 6. The Japanese redirects to each radical's article.
    for number, forms, long_name, _ in kanji_tools:
        first = unicodedata.normalize("NFKC", forms.split()[0])
        char = target(first)
        match = re.match(r"^([^（(]+)[（(]", long_name)
        base = match.group(1) if match else long_name
        title = JA_TITLES.get(base, base)
        for name in wikipedia["ja"].get(title, []):
            if "曖昧さ回避" in name or len(name) == 1:
                continue
            add(name, char, "ja-wikipedia", f"redirect to {title}")

    # 7. The Chinese redirects to each radical's article, and the article's own title.
    for number, forms, long_name, _ in kanji_tools:
        first = unicodedata.normalize("NFKC", forms.split()[0])
        char = target(first)
        match = re.match(r"^([^（(]+)[（(]", long_name)
        base = match.group(1) if match else long_name
        title = JA_TITLES.get(base, base)
        qid = wikipedia["qid_by_title"].get(title)
        zh = wikipedia["zh_titles"].get(qid) if qid else None
        if zh and len(zh) > 1 and not 0x2F00 <= ord(zh[0]) <= 0x2FD5:
            add(zh, char, "zh-wikipedia", f"article of {zh}")
        for name in wikipedia["zh"].get(zh, []) if zh else []:
            if len(name) == 1 or 0x2F00 <= ord(name[0]) <= 0x2FD5:
                continue
            add(name, char, "zh-wikipedia", f"redirect to {zh}")

    # 8. The words and readings of each radical: Unihan's definitions, Mandarin, Japanese readings
    # and KANJIDIC2's meanings, readings and pinyin.
    for number, forms, long_name, _ in kanji_tools:
        radical = unicodedata.normalize("NFKC", forms.split()[0])
        char = target(radical)
        definition = definitions.get(radical) or definitions.get(char) or ""
        for sense in meaning_senses(definition):
            add(sense, char, "unihan", f"kDefinition of {radical}")
        for value in (mandarins.get(radical) or mandarins.get(char) or "").split():
            plain = "".join(char for char in unicodedata.normalize("NFKD", value) if not 0x0300 <= ord(char) <= 0x036F)
            plain = re.sub(r"[^a-z]", "", plain.lower())
            if len(plain) >= 2:
                add(plain, char, "unihan", f"kMandarin of {radical}")
        for value, label in ((on_readings.get(radical) or on_readings.get(char) or "", "kJapaneseOn"),
                             (kun_readings.get(radical) or kun_readings.get(char) or "", "kJapaneseKun")):
            for word in value.split():
                word = re.sub(r"[^a-z]", "", word.lower())
                if len(word) >= 2:
                    add(word, char, "unihan", f"{label} of {radical}")
                    kunrei = kunrei_reading(word)
                    if kunrei != word:
                        add(kunrei, char, "romaji", f"Kunrei of {label} of {radical}")
        entry = by_literal.get(radical)
        if entry is None:
            entry = by_literal.get(char)
        if entry is None:
            entry = by_literal.get(KANJIDIC_VARIANT.get(radical, ""))
        if entry is None:
            continue
        # One English sense, the first KANJIDIC2 gives: a later one is often a particular use of
        # the character (方 "person" as a suffix) rather than the radical's meaning.
        for meaning in entry.iter("meaning"):
            if not (meaning.text and meaning.get("m_lang") in (None, "en")):
                continue
            senses = meaning_senses(meaning.text)
            if senses:
                add(senses[0], char, "kanjidic2", f"meaning of {radical}")
                break
        for reading in entry.iter("reading"):
            kind, value = reading.get("r_type"), (reading.text or "").strip()
            if not value:
                continue
            if kind in ("ja_on", "ja_kun"):
                clean = value.strip(".-")
                if clean and re.fullmatch(r"[\u3040-\u30ff]+", clean):
                    add(clean, char, "kanjidic2", f"{kind} reading of {radical}")
            elif kind == "pinyin":
                clean = re.sub(r"[^a-z]", "", value.lower())
                if len(clean) >= 2:
                    add(clean, char, "kanjidic2", f"pinyin of {radical}")

    # 9. The traditional or simplified spelling of each Chinese name. The variants are made from
    # the names as they stand, never from a variant, so a simplified name is not turned back and forth.
    rows = dedupe(rows)
    variants = []
    for name, char, source, detail in rows:
        if not set(source.split(",")) & CHINESE_SOURCES:
            continue
        for convert, label in ((S2T, "traditional"), (T2S, "simplified")):
            other = restored(convert.convert(protected(name)))
            if other != name:
                variants.append((other, char, source, (detail + "; " if detail else "") + label + " via OpenCC"))
        # 斗 and 鬥 are protected from OpenCC so the two radicals do not trade spellings; the name
        # of radical 鬥 that MyBox gives in its simplified spelling still needs its own 鬥 spelling.
        if char == "鬥" and "斗" in name:
            variants.append((name.replace("斗", "鬥"), char, source, (detail + "; " if detail else "") + "traditional spelling for radical 191"))
    rows = dedupe(rows + variants)

    # 10. The pinyin of each Chinese name, so a name can be typed on a Latin keyboard.
    pinyin_rows = []
    for name, char, source, detail in rows:
        if not set(source.split(",")) & CHINESE_SOURCES:
            continue
        for written in pinyin_forms(name):
            pinyin_rows.append((written, char, "pypinyin", f"pinyin of {name}"))
    rows = dedupe(rows + pinyin_rows)

    # 11. The Hepburn romanization of each kana name, so a reading can be typed the same way.
    romaji_rows = []
    for name, char, source, detail in rows:
        if not set(source.split(",")) & JAPANESE_SOURCES or not KANA_ONLY.fullmatch(name):
            continue
        for written, style in ((romanize(name), "Hepburn"), (romanize(name, KUNREI_KANA, KUNREI_DIGRAPHS), "Kunrei")):
            if len(written) >= 2:
                romaji_rows.append((written, char, "romaji", f"{style} of {name}"))
    rows = dedupe(rows + romaji_rows)
    rows.sort(key=lambda row: (ord(row[1][0]), row[0]))
    return rows


def build_folds(rows: list[tuple[str, str, str, str]]) -> list[tuple[str, str, str]]:
    """The characters folded together for the name search: Chinese scripts, component forms and
    the Japanese shinjitai forms that stand apart."""
    classes: dict[str, set[str]] = {}
    for form, canon in FORMS.items():
        classes.setdefault(canon, {canon}).add(form)
    def class_target(canon: str) -> str:
        if canon in RADICAL_SET:
            return target(canon)
        for member in sorted(classes[canon]):
            if member in RADICAL_SET:
                return target(member)
        return target(canon)
    folds: dict[str, str] = {}
    sources: dict[str, str] = {}
    priority: dict[str, int] = {}
    # 斗 (radical 68) and 鬥 (radical 191) are different radicals; the forms table and OpenCC
    # treat 鬥 as a form of 斗, which would make either name find both.
    keep = {"鬥"}
    def put(form: str, char: str, source: str, level: int) -> None:
        if form in keep or len(form) != 1 or len(char) != 1 or form == char:
            return
        if not (0x2E80 <= ord(form) <= 0x2FDF or 0x3400 <= ord(form) <= 0x4DBF or 0x4E00 <= ord(form) <= 0x9FFF
                or 0xF900 <= ord(form) <= 0xFAFF or 0x20000 <= ord(form) <= 0x3FFFD):
            return
        if not (0x2E80 <= ord(char) <= 0x2FDF or 0x3400 <= ord(char) <= 0x4DBF or 0x4E00 <= ord(char) <= 0x9FFF
                or 0xF900 <= ord(char) <= 0xFAFF or 0x20000 <= ord(char) <= 0x3FFFD):
            return
        if form in priority:
            if priority[form] > level:
                return
            if priority[form] == level and folds[form] != char:
                raise ValueError(f"two folds for {form}: {folds[form]} and {char}")
        folds[form] = char
        sources[form] = source
        priority[form] = level

    # Component forms fold to the form the names use for their radical.
    for canon, members in classes.items():
        char = T2S.convert(class_target(canon))
        for member in members:
            put(member, char, "component-forms", 4)
    # Japanese shinjitai forms the forms table does not carry.
    for form, traditional in {"竜": "龍", "亀": "龜", "斉": "齊", "歯": "齒"}.items():
        put(form, T2S.convert(traditional), "ja-variants", 3)
    # Traditional and simplified spellings of every character the names and targets use.
    characters = set(RADICAL_SET) | set(FORMS) | set(FORMS.values())
    for name, char, _, _ in rows:
        characters.update(name)
        characters.add(char)
    for char in sorted(characters):
        simplified = T2S.convert(char)
        if len(simplified) == 1 and simplified != char:
            put(char, simplified, "opencc", 1)

    def close(char: str) -> str:
        seen = set()
        while char in folds:
            if char in seen:
                raise ValueError(f"fold cycle at {char}")
            seen.add(char)
            char = folds[char]
        return char

    for form in list(folds):
        folds[form] = close(folds[form])
    out = [(form, char, sources[form]) for form, char in folds.items() if form != char]
    out.sort(key=lambda row: (ord(row[0][0]), row[0]))
    return out


def header(wikipedia: dict, rows: list[tuple[str, str, str, str]]) -> str:
    return f"""# The names, words and readings people use for components, for the component search (src/core/names.js).
# columns: name, char, source, detail
# rows: {len(rows)}
# Built by scripts/build_component_names.py.
# source kanji-tools: anzumura/kanji-tools data/radicals.txt at {KANJI_TOOLS_REV}; MIT; Copyright (c) 2022 Dan H
#   https://github.com/anzumura/kanji-tools
# source kanjidic2: KANJIDIC2 (file version 4, database version 2026-299, created 2026-10-26), Electronic Dictionary Research and Development Group, CC BY-SA 4.0; Copyright EDRDG
#   names, meanings, Japanese readings and pinyin of the radicals; https://www.edrdg.org/kanjidic/kanjidic2.xml.gz
# source ja-wikipedia: the redirects to the Japanese Wikipedia articles on the 214 radicals, CC BY-SA 4.0; fetched {wikipedia['fetched']}
#   https://ja.wikipedia.org/
# source tudien: catusf/tudien dict/radical_name.txt at {TUDIEN_REV}, CC0 1.0; source pleco.hk 偏旁
#   https://github.com/catusf/tudien
# source rime-wanxiang: amzxyz/rime-wanxiang lua/data/others.txt at {RIME_REV}, CC BY 4.0; the radical-nickname block; by amzxyz
#   https://github.com/amzxyz/rime-wanxiang
# source mybox: Mararsh/MyBox docs/data2d/ChineseRadicals_example_zh.csv at {MYBOX_REV}, Apache 2.0; the Chinese name of each radical
#   https://github.com/Mararsh/MyBox
# source zh-wikipedia: the article titles and redirects to the Chinese Wikipedia articles on the 214 radicals, CC BY-SA 4.0; fetched {wikipedia['fetched']}
#   https://zh.wikipedia.org/
# source redirects: data/component-name-redirects.json, CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/; the exact redirects used, read {wikipedia['fetched']}
# source unihan: Unihan 18.0.0 (Unicode Character Database), Unicode License v3, Copyright Unicode, Inc.; kDefinition, kMandarin, kJapaneseOn and kJapaneseKun of the radicals; SHA-256 {UNIHAN_SHA256}
#   https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip
# source pypinyin: pypinyin 0.55.0, MIT; pinyin of Chinese names; by mozillazg
#   https://github.com/mozillazg/python-pinyin
# source romaji: Hepburn and Kunrei romanization of kana names and readings, an editorial table; the readings themselves come from the sources above
# source opencc: traditional and simplified spellings derived with OpenCC 1.4.2, Apache 2.0; by BYVoid
#   https://github.com/BYVoid/OpenCC
# The file as a whole is shared alike under CC BY-SA 4.0, because the Wikipedia and KANJIDIC2 rows are:
# https://creativecommons.org/licenses/by-sa/4.0/
"""


def folds_header(rows: list[tuple[str, str, str]]) -> str:
    return f"""# The characters the component search folds together before it compares a name: Chinese scripts,
# component forms and the Japanese shinjitai forms the other tables leave apart. Built by
# scripts/build_component_names.py; used by src/core/names.js.
# columns: form, char, source
# rows: {len(rows)}
# source component-forms: data/component-forms.tsv, from han-compose's han-component-forms.tsv, Unicode's EquivalentUnifiedIdeograph.txt (Unicode License v3) and cjkvi-variants' radical-variants.txt (public domain)
# source opencc: OpenCC 1.4.2, Apache 2.0; by BYVoid; https://github.com/BYVoid/OpenCC
# source ja-variants: the Japanese shinjitai forms 竜, 亀, 斉 and 歯 and the forms they stand for
# The file as a whole is shared alike under CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/
"""


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="fetch the sources again")
    args = parser.parse_args(argv)
    CACHE.mkdir(parents=True, exist_ok=True)
    fetch(KANJI_TOOLS_URL, CACHE / "kanji-tools-radicals.txt", KANJI_TOOLS_SHA256, args.refresh)
    fetch(TUDIEN_URL, CACHE / "tudien-radical-name.txt", TUDIEN_SHA256, args.refresh)
    fetch(RIME_URL, CACHE / "rime-others.txt", RIME_SHA256, args.refresh)
    fetch(MYBOX_URL, CACHE / "mybox-radicals.csv", MYBOX_SHA256, args.refresh)
    fetch(KANJIDIC2_URL, CACHE / "kanjidic2.xml.gz", KANJIDIC2_SHA256, args.refresh)
    fetch(UNIHAN_URL, CACHE / "Unihan.zip", UNIHAN_SHA256, args.refresh)
    if not (CACHE / "kanjidic2.xml").exists() or args.refresh:
        import gzip
        (CACHE / "kanjidic2.xml").write_bytes(gzip.decompress((CACHE / "kanjidic2.xml.gz").read_bytes()))
    wikipedia = read_wikipedia(args.refresh)
    unihan = read_unihan(CACHE / "Unihan.zip")
    rows = build(wikipedia, unihan)
    folds = build_folds(rows)
    TARGET.write_text(header(wikipedia, rows) + "".join("\t".join(row) + "\n" for row in rows), encoding="utf-8")
    FOLDS_TARGET.write_text(folds_header(folds) + "".join("\t".join(row) + "\n" for row in folds), encoding="utf-8")
    print(f"wrote {TARGET} ({len(rows)} names) and {FOLDS_TARGET} ({len(folds)} folds)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
